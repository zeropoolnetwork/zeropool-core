pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./lib/IERC20.sol";
import "./lib/AbstractERC20.sol";
import "./OptimisticRollup.sol";

contract Zeropool is OptimisticRollup {
    using AbstractERC20 for IERC20;

    uint256 constant DEPOSIT_EXISTS = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant DEPOSIT_EXPIRES_BLOCKS = 2;
    uint256 constant CHALLENGE_EXPIRES_BLOCKS = 10;
    uint256 constant BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;

    uint256 constant VERSION = 1;

    event Deposit();
    event DepositCancel();
    event NewBlockPack();
    event Withdraw();

    function rollup_block(uint x) external view returns(bytes32) {
        return get_rollup_block(x);
    }

    function deposit_state(bytes32 x) external view returns(uint256) {
        return get_deposit_state(x);
    }

    function withdraw_state(bytes32 x) external view returns(uint256) {
        return get_withdraw_state(x);
    }

    function rollup_tx_num() external view returns(uint256) {
        return get_rollup_tx_num();
    }

    function alive() external view returns(bool) {
        return get_alive();
    }

    function tx_vk() external view returns(VK memory) {
        return get_tx_vk();
    }

    function tree_update_vk() external view returns(VK memory) {
        return get_tree_update_vk();
    }

    function relayer() external view returns(address) {
        return get_relayer();
    }

    function initialized() external view returns(bool) {
        return get_version() < VERSION;
    }

    function version() external view returns(uint256) {
        return VERSION;
    }

    function challenge_expires_blocks() external view returns(uint256) {
        return CHALLENGE_EXPIRES_BLOCKS;
    }

    function deposit_expires_blocks() external view returns(uint256) {
        return DEPOSIT_EXPIRES_BLOCKS;
    }

    
    function init(address relayer) external onlyUninitialized(VERSION) {
        set_alive(true);
        set_relayer(relayer);
        set_version(VERSION);
    }


    function deposit(IERC20 token, uint256 amount, bytes32 txhash)
        public
        payable
        returns (bool)
    {
        uint256 _amount = token.abstractReceive(amount);
        bytes32 deposit_hash = keccak256(
            abi.encode(msg.sender, token, _amount, block.number, txhash)
        );
        set_deposit_state(deposit_hash, DEPOSIT_EXISTS);
        emit Deposit();
        return true;
    }

    function depositCancel(PayNote memory d) public returns (bool) {
        bytes32 deposit_hash = keccak256(abi.encode(d));
        require(get_deposit_state(deposit_hash) >= get_rollup_tx_num());
        require(d.blocknumber < block.number - DEPOSIT_EXPIRES_BLOCKS);
        set_deposit_state(deposit_hash, 0);
        d.utxo.token.abstractTransfer(d.utxo.owner, d.utxo.amount);
        emit DepositCancel();
        return true;
    }

    function withdraw(PayNote memory w) public returns (bool) {
        bytes32 withdraw_hash = keccak256(abi.encode(w));
        uint256 state = get_withdraw_state(withdraw_hash);
        require(state < get_rollup_tx_num() && state != 0);
        require(w.blocknumber < block.number - CHALLENGE_EXPIRES_BLOCKS);
        set_withdraw_state(withdraw_hash, 0);
        w.utxo.token.abstractTransfer(w.utxo.owner, w.utxo.amount);
        emit Withdraw();
        return true;
    }

    function publishBlock(
        uint256 protocol_version,
        BlockItem[] memory items,
        uint256 rollup_cur_block_num,
        uint256 blocknumber_expires
    ) public onlyRelayer onlyAlive returns (bool) {
        uint256 cur_rollup_tx_num = get_rollup_tx_num();

        require(rollup_cur_block_num == cur_rollup_tx_num >> 8, "wrong block number");
        require(protocol_version == get_version(), "wrong protocol version");
        require(block.number < blocknumber_expires, "blocknumber is already expires");
        uint256 nitems = items.length;
        require(nitems > 0 && nitems <= 256, "wrong number of items");
        bytes32[] memory hashes = new bytes32[](nitems); 
        for (uint256 i = 0; i < nitems; i++) {
            BlockItem memory item = items[i];
            bytes32 itemhash = keccak256(abi.encode(item));
            if (item.ctx.delta == 0) {
                require(item.deposit_blocknumber == 0, "deposit_blocknumber should be zero in transfer case");
                require(item.ctx.token == IERC20(0), "token should be zero in transfer case");
                require(item.ctx.ext.owner == address(0), "owner should be zero in tranfer case");
            } else if (item.ctx.delta < MAX_AMOUNT) {
                bytes32 txhash = keccak256(abi.encode(item.ctx));
                bytes32 deposit_hash = keccak256(
                    abi.encode(
                        item.ctx.ext.owner,
                        item.ctx.token,
                        item.ctx.delta,
                        item.deposit_blocknumber,
                        txhash
                    )
                );
                require(get_deposit_state(deposit_hash) == DEPOSIT_EXISTS, "unexisted deposit");
                set_deposit_state(deposit_hash, cur_rollup_tx_num + i);
            } else if (
                item.ctx.delta > BN254_ORDER - MAX_AMOUNT &&
                item.ctx.delta < BN254_ORDER
            ) {
                require(item.deposit_blocknumber == 0, "deposit blocknumber should be zero");
                bytes32 txhash = keccak256(abi.encode(item.ctx));
                bytes32 withdraw_hash = keccak256(
                    abi.encode(
                        item.ctx.ext.owner,
                        item.ctx.token,
                        BN254_ORDER - item.ctx.delta,
                        block.number,
                        txhash
                    )
                );
                require(get_withdraw_state(withdraw_hash) == 0, "withdrawal already published");
                set_withdraw_state(withdraw_hash, cur_rollup_tx_num + i);
            } else revert("wrong behavior");

            hashes[i] = itemhash;
        }
        set_rollup_block(cur_rollup_tx_num >> 8, MerkleProof.keccak256MerkleTree(hashes));
        set_rollup_tx_num(cur_rollup_tx_num+256);
        emit NewBlockPack();
        return true;
    }

    function stopRollup(uint256 lastvalid) internal returns (bool) {
        set_alive(false);
        if (get_rollup_tx_num() > lastvalid) set_rollup_tx_num(lastvalid);
    }

    function challengeTx(BlockItemNote memory cur, BlockItemNote memory base)
        public
        returns (bool)
    {
        require(blockItemNoteVerifyPair(cur, base));
        require(cur.item.ctx.rootptr == base.id);
        uint256[] memory inputs = new uint256[](8);
        inputs[0] = base.item.new_root;
        inputs[1] = cur.item.ctx.nullifier[0];
        inputs[2] = cur.item.ctx.nullifier[1];
        inputs[3] = cur.item.ctx.utxo[0];
        inputs[4] = cur.item.ctx.utxo[1];
        inputs[5] = uint256(address(cur.item.ctx.token));
        inputs[6] = cur.item.ctx.delta;
        inputs[7] = uint256(keccak256(abi.encode(cur.item.ctx.ext))) % BN254_ORDER;
        require(
            !groth16verify(get_tx_vk(), cur.item.ctx.proof, inputs) ||
                cur.item.ctx.rootptr >= cur.id
        );
        stopRollup(
            cur.id &
                0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00
        );
        return true;
    }

    function challengeUTXOTreeUpdate(
        BlockItemNote memory cur,
        BlockItemNote memory prev,
        uint256 right_root
    ) public returns (bool) {
        require(blockItemNoteVerifyPair(cur, prev));
        require(right_root != cur.item.new_root);
        require(cur.id == prev.id + 1);
        uint256[] memory inputs = new uint256[](5);
        inputs[0] = prev.item.new_root;
        inputs[1] = right_root;
        inputs[2] = cur.id;
        inputs[3] = cur.item.ctx.utxo[0];
        inputs[4] = cur.item.ctx.utxo[1];
        require(groth16verify(get_tree_update_vk(), cur.item.ctx.proof, inputs));
        stopRollup(
            cur.id &
                0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00
        );
        return true;
    }


    function challengeDoubleSpend(
        BlockItemNote memory cur,
        BlockItemNote memory prev
    ) public returns (bool) {
        require(blockItemNoteVerifyPair(cur, prev));
        require(cur.id > prev.id);
        require(
            cur.item.ctx.nullifier[0] == prev.item.ctx.nullifier[0] ||
                cur.item.ctx.nullifier[0] == prev.item.ctx.nullifier[1] ||
                cur.item.ctx.nullifier[1] == prev.item.ctx.nullifier[0] ||
                cur.item.ctx.nullifier[1] == prev.item.ctx.nullifier[1]
        );
        stopRollup(
            cur.id &
                0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00
        );
        return true;
    }

// generated verification keys

function get_tx_vk() internal view override returns(VK memory vk) {
    vk.data = new uint256[](32);
	vk.data[0]=16697396276845359349763623132880681261946057173403665684116014317021563254655;
	vk.data[1]=5587233253515298594979379376112193939999977226319827083400780508947632238748;
	vk.data[2]=996344031357008752188061777727343821194999038419356867329464288563909617005;
	vk.data[3]=19290932987249234962967288959963528407103065644647211765713208264341394525627;
	vk.data[4]=8553749439216169983700315269252703464956761305522445870304892856460243321047;
	vk.data[5]=7499331826236872853986916310426702508083585717393534257027110568354271287432;
	vk.data[6]=17818442198315603854906648488684700215588900049016248299047528035268326306021;
	vk.data[7]=15742330311792086244154238527312139581390392470409527670106624318539491230639;
	vk.data[8]=15582884393435508760323520593128472668109949438533129736977260887861833544686;
	vk.data[9]=21497591859374664749646772170336511135502780606163622402006911936080711585567;
	vk.data[10]=7790006490742208514342359392548790920526758492331804655644059775462847493097;
	vk.data[11]=13129551538859899483631249619546540237894645124538636048121349380930189507838;
	vk.data[12]=4746286819103243220536118278269041624087200484408004244046357476009810846546;
	vk.data[13]=18658744770115522082166315751608350375192957102952937317896374405594493134526;
	vk.data[14]=19989489438779009436306295034063506403791061054909758505826349901018217062148;
	vk.data[15]=12423258039559374001195155548721642852023802830208605918786258373002084367632;
	vk.data[16]=7003237418971344613051082595005151675497565165987117592967572800525158824489;
	vk.data[17]=7974534769221088592950139635833940989569216922408396815015576367720824241508;
	vk.data[18]=11849446094135848442330464397836476735986056048931041670863652298683592522299;
	vk.data[19]=5688048430194407294094808809106358923767040643882276446273178191473705984722;
	vk.data[20]=15251866809401758881597063825677390012089302300318896335505843954313586308460;
	vk.data[21]=382122240772754036035492924033721102122148609052952215005785336028904779974;
	vk.data[22]=10812902853773819225346776822522835276124447801378031518741367874851505049128;
	vk.data[23]=5441632396550715758039364769225858885484351780111874540894325037632766747975;
	vk.data[24]=15786403199430745833044642273676411893860838678282184591801848247162444177171;
	vk.data[25]=8656349755733447799905795854043134530429068654454399761530913385689890843892;
	vk.data[26]=16208788594254936587671118621629101795259918519956251673155645395337803398644;
	vk.data[27]=11008397050768236649236829775384097670794106671173713047158085580508730412294;
	vk.data[28]=5000535825997546131883098495344030668482959620659549513047593209192484024554;
	vk.data[29]=6037131813824258546352206109740790709325012719822508419478741594076251165562;
	vk.data[30]=232537091421478948749164191800530205602104220622818161892691965271681780444;
	vk.data[31]=8541890110169324141024763602672843893521937974195030991302885883209417356350;

}

function get_tree_update_vk() internal view override returns(VK memory vk) {
    vk.data = new uint256[](26);
	vk.data[0]=1117561174711447970699783508540835969335571306961098817222886978948744345711;
	vk.data[1]=10780325785780371097555321883689276320673547412863821024704236163981475185231;
	vk.data[2]=9190339596842207972698547696205148463284800225991013839726333455510728418061;
	vk.data[3]=2787003181019705527994114183958804481617926021310039402048478633993643050257;
	vk.data[4]=19025462432212307115968461300130326702118822938799182787816944256592782469896;
	vk.data[5]=13374329695938559341973106697972813681348489436576893374756555356012735204935;
	vk.data[6]=2391540205558897324637905451340679985349421498010435945591140422554529899138;
	vk.data[7]=4538034768061760463973814808256573325692419571060079531866609248139564624084;
	vk.data[8]=1676495264895295799704478861413793414754594619949871821864061782072790895386;
	vk.data[9]=14126847152901573392009992091969331199931177575536794424151289240625771346641;
	vk.data[10]=17538580900482196889842913547024185367722169963653894198473788114352852534451;
	vk.data[11]=8190411413825327934159222466106546022021029229252021910318976779844785663832;
	vk.data[12]=10967610977689797074852479085031480141553081046525341474335007496946965996889;
	vk.data[13]=7518076114965605632016029983105922598125144277731467379298374011599641312871;
	vk.data[14]=12707371020099695894329449101665177001847210301388750083164379479457407482586;
	vk.data[15]=9638979230410286344537095100035451133751102850514918826098902859896696414299;
	vk.data[16]=8486153680023739150613783925554306655861399968866354186425033515785337545045;
	vk.data[17]=4326081295507141428403366893493945239683826229496173558026196418081249993919;
	vk.data[18]=15025661877684012486667234299497831337050778534199450729135536609646068791727;
	vk.data[19]=10170327312676973089401561543622362963624936244289159008674890415147237746815;
	vk.data[20]=8249238187438221843102710918896640046224395740564573077618681767459880159151;
	vk.data[21]=19333329033893998261051692597725252825459050054888992926855629308261440687681;
	vk.data[22]=9410494220927663013897883141562056814411016181471810870390609726747759553716;
	vk.data[23]=6569431686535661164713601709252422249188606253902167941201140375618464568594;
	vk.data[24]=12006374143171123543831491679354588477211042045298704251427754348688205712072;
	vk.data[25]=11397989004848280683211927657137052100877146185703927010611549774118733967444;

}


}
