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
    vk.data[0]=19083586676618588181241121022189148302115143846265274057634178515789425541522;
	vk.data[1]=81734682709379119351827372382537914395894451632304720162641755645366983798;
	vk.data[2]=16679280894448720904271619622322935704907133145325731398178004167577694529227;
	vk.data[3]=18903228601511502126689470199990445541001999715180404375185816963613836226871;
	vk.data[4]=13663046271244275377110314674352295289375922770501900119517982950566589877684;
	vk.data[5]=483564168571897182620192451626088133502163507143046326440329211112918462121;
	vk.data[6]=16559501001022932569082979771706263430444179087536500138963585085420349463423;
	vk.data[7]=9623523168201514583905748483990657180016245907539253075218220414153350351588;
	vk.data[8]=15229833583426402205040012031514697850254522821399893249033342086777726726387;
	vk.data[9]=470744398001273857874068942689229495046933554389747311037076260496752269445;
	vk.data[10]=7673153833418048608469768353079552808897009992555599048955952346794508568713;
	vk.data[11]=20379255055398732280007411055330162490556363195411029740820409749858706847271;
	vk.data[12]=14010980108123452341370355032177269282369172322265972028032623852596015548054;
	vk.data[13]=2010602694298321371261220080637523955877174725166197144793463796546935369505;
	vk.data[14]=11827331641970848249018791507060402639646550381469697186630320984054879658051;
	vk.data[15]=19932135227873747734819495633162631095088044686013642058128603008109991517122;
	vk.data[16]=546122717728821753109262933924329929044483964972534585973243989084670247618;
	vk.data[17]=19197882504173222291305676798186060802889772643656145364396607969858777473240;
	vk.data[18]=3079025494427420850726249161830635142714776092295867140934586860665303421073;
	vk.data[19]=1746154312538307698308659684236359377970307266169477233342774307494313734528;
	vk.data[20]=1750668962583592559453347582962590422049028854549021550631836347968156757666;
	vk.data[21]=2931884338830192964620366885212045740331032389508054587765082964515210137243;
	vk.data[22]=11609728864371463760676563597128352259642122426143489337585644580377141052931;
	vk.data[23]=1866277750873051808146539269994848083702239908128741416703314476768274967681;
	vk.data[24]=465030135085710467652667684166181145297022174953119695491126249786799875357;
	vk.data[25]=17668359420526036744621277058559131057906391358066238174656362416578048367407;
	vk.data[26]=3940679183641598670389691491834622231072482332882496391070085402176937010683;
	vk.data[27]=12694154800574632930051430635795823357916331205102627903153800201217894579182;
	vk.data[28]=12563334585418485878062402673132487192719820069663338406400779005058051755705;
	vk.data[29]=5209903608427988355675301381596891515874164017265170558927935483532854452720;
	vk.data[30]=4711050179634069730545115815176569247145595365948880376685610817304093187820;
	vk.data[31]=21460592003295140913387788532402788293301885890452135973712845209086748235272;

}

function get_tree_update_vk() internal view override returns(VK memory vk) {
    vk.data = new uint256[](26);
    vk.data[0]=9927341460547029852728753500861773344387749035454992176911679192877917614326;
	vk.data[1]=310328084359652166416267459817042255667278116507978414962149299352000101062;
	vk.data[2]=493386504816853366900876821815568508001070316137556861279567937498920001698;
	vk.data[3]=16050960967588593014951452003751705261313151560742102282632329345311357239925;
	vk.data[4]=18156825847965851663862032625267397386086907754120404739408152740543974835318;
	vk.data[5]=13176645693861093810865249899400529123699743741662616180305647975362184695600;
	vk.data[6]=3391499851638059043956782863656586962612506772240835221934169170634234404332;
	vk.data[7]=18268392206599546967104090708600896194600052410608389302726346605813459216009;
	vk.data[8]=9098516986151439176894052362065284716471176875021298523969161367191564971456;
	vk.data[9]=21885959143027836841302233615802174732603365104028875126092282165099265354414;
	vk.data[10]=7670129283807378608625935909491095310213110566554408388065601560701095056703;
	vk.data[11]=7130671474784991141182176526112718975966743466548387852301799633388110224168;
	vk.data[12]=7937204630097084792238930540546978973700729757604694893164413509926070951259;
	vk.data[13]=8407545396818988186449632509683943447654086022799995289006209791993391255704;
	vk.data[14]=14664733377421451839490066683507349204055901257585797506684042433113436019171;
	vk.data[15]=15840252407256494288533360651859793129109626723586685795424274635231317501541;
	vk.data[16]=8032564315529499388720047507429189045976255560471359137390391762122700869379;
	vk.data[17]=11808348160251057184662622624151545848292988533362288568600116898463819914493;
	vk.data[18]=17498019560129459819857213920026201288274979451999480899071607815743841786851;
	vk.data[19]=17384624495734085926685188734246885503312994753956080725596119437833880269858;
	vk.data[20]=1931156580513819053647675364989716628750838477923695514965816971171051219699;
	vk.data[21]=14867384809644522547574123774078983448833920647089298299288805612229559369381;
	vk.data[22]=9168948929820716748276018995954887992460226156428826222193421889623724755643;
	vk.data[23]=18179132919376470282821059367416443269176558413791609646146920482342253978853;
	vk.data[24]=13165221823254245976824310993558969475591080705095640808847370569633878849829;
	vk.data[25]=9543821152288846320507592056661134387108520634609559855537650326371475631556;

}


}
