pragma solidity >= 0.6.0;
pragma experimental ABIEncoderV2;


import "./lib/IERC20.sol";
import "./lib/Ownable.sol";
import "./lib/AbstractERC20.sol";
import "./lib/MerkleProof.sol";


contract Zeropool is Ownable{
    using AbstractERC20 for IERC20;

    uint256 constant DEPOSIT_EXISTS = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant DEPOSIT_EXPIRES_BLOCKS = 500;
    uint256 constant CHALLENGE_EXPIRES_BLOCKS = 5760;
    uint256 constant BN254_ORDER = 16798108731015832284940804142231733909759579603404752749028378864165570215949;
    uint256 constant MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;
    bytes32 constant EMPTY_BLOCK_HASH = 0x9867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756af;

    struct Message {
        uint256[4] data;
    }

    struct TxExternalFields {
        address owner;
        Message[2] message;
    }

    struct Proof {
        uint256[8] data;
    }

    struct VK {
        uint256[] data;
    }

    struct Tx {
        uint256 rootptr;
        uint256[2] nullifier;
        uint256[2] utxo;
        IERC20 token;
        uint256 delta;
        TxExternalFields ext;
        uint256[8] proof;
    }

    struct BlockItem {
        Tx ctx;
        uint256 new_root;
        uint256 deposit_blocknumber;
    }
    struct BlockItemNote {
        bytes32[8] proof;
        uint256 id;
        BlockItem item;
    }

    struct UTXO {
        address owner;
        IERC20 token;
        uint256 amount;
    }

    struct PayNote {
        UTXO utxo;
        uint256 blocknumber;
        uint256 txhash;
    }


    mapping (uint256 => bytes32) public rollup_block;
    mapping (bytes32 => uint256) public deposit_state;
    mapping (bytes32 => uint256) public withdraw_state;

    

    uint256 public rollup_tx_num;
    VK tx_vk;
    VK tree_update_vk;
    

    function blokItemNoteVerify(BlockItemNote memory note) internal view returns(bool) {
        (bytes32 itemhash, bytes32) = blockItemHash(note.item);
        return MerkleProof.keccak256MerkleProof(note.proof, note.id & 0xff, itemhash) == rollup_block[note.id>>8];
    }

    function blockItemHash(BlockItem memory item) internal view returns(bytes32 itemhash, bytes32 txhash) {
        txhash = keccak256(abi.encode(item.ctx));
        itemhash = keccak256(abi.encode(txhash, item.new_root, item.deposit_blocknumber));
    }

    function groth16verify(VK memory vk, Proof memory proof, uint256[] memory inputs) internal view returns(bool) {
        // TODO bind groth16verifier
        return true;
    }

    constructor() public {
        rollup_block[0] = EMPTY_BLOCK_HASH;
        rollup_tx_num = 256;
    }



    function deposit(IERC20 token, uint256 amount, bytes32 txhash) public payable returns(bool) {
        uint256 _amount = token.abstractReceive(amount);
        bytes32 deposit_hash = keccak256(abi.encode(msg.sender, token, _amount, block.number, txhash));
        deposit_state[deposit_hash] = DEPOSIT_EXISTS;
        return true;
    }

    function depositCancel(PayNote memory d) public payable returns(bool) {
        bytes32 deposit_hash = keccak256(abi.encode(d));
        require(deposit_state[deposit_hash] >= rollup_tx_num);
        require(d.blocknumber < block.number - DEPOSIT_EXPIRES_BLOCKS);
        delete deposit_state[deposit_hash];
        d.utxo.token.abstractTransfer(d.utxo.owner, d.utxo.amount);
        return true;
    }

    function withdraw(PayNote memory w) public returns(bool) {
        bytes32 withdraw_hash = keccak256(abi.encode(w));
        require(withdraw_state[withdraw_hash] < rollup_tx_num);
        require(w.blocknumber < block.number - CHALLENGE_EXPIRES_BLOCKS);
        delete withdraw_state[withdraw_hash];
        w.utxo.token.abstractTransfer(w.utxo.owner, w.utxo.amount);
        return true;
    }

    function publishBlock(BlockItem[] memory items, uint rollup_cur_block_num, uint blocknumber_expires) public onlyOwner returns(bool) {
        require(rollup_cur_block_num == rollup_tx_num >> 8);
        require(block.number < blocknumber_expires);
        uint256 nitems = items.length;
        require(nitems > 0 && nitems <= 256);
        bytes32[] memory hashes = new bytes32[](nitems);
        for(uint i = 0; i<nitems; i++) {
            BlockItem memory item = items[i];
            bytes32 itemhash = keccak256(abi.encode(item));
            bytes32 txhash = keccak256(abi.encode(item.ctx));
            if (item.ctx.delta == 0) {
                require(item.deposit_blocknumber == 0);
                require(item.ctx.token == IERC20(0));
                require(item.ctx.ext.owner == address(0));
            } else if (item.ctx.delta < MAX_AMOUNT) {
                bytes32 deposit_hash = keccak256(abi.encode(item.ctx.ext.owner, item.ctx.token, item.ctx.delta, item.deposit_blocknumber, txhash));
                require(deposit_state[deposit_hash]==DEPOSIT_EXISTS);
                deposit_state[deposit_hash] = rollup_tx_num+i;
            } else if (item.ctx.delta > BN254_ORDER-MAX_AMOUNT && item.ctx.delta < BN254_ORDER) {
                require(item.deposit_blocknumber == 0);
                bytes32 withdraw_hash = keccak256(abi.encode(item.ctx.ext.owner, item.ctx.token, BN254_ORDER-item.ctx.delta, block.number, txhash));
                require(withdraw_state[withdraw_hash] == 0);
                withdraw_state[withdraw_hash] = rollup_tx_num + i;
            } else revert();

            hashes[i] = itemhash;
        }
        rollup_block[rollup_tx_num >> 8] = MerkleProof.keccak256MerkleTree(hashes);
        rollup_tx_num += 256;
        return true;
    }

    function stopRollup() public {
        //TODO implement rollup stop logic
    }

    function challengeTx(BlockItemNote memory cur, BlockItemNote memory base) public returns(true) {
        require(blockItemNoteVerify(cur) && blockItemNoteVerify(base));
        require(cur.item.ctx.rootptr == base.id);
        uint256[] memory inputs = new uint256[](8);
        inputs[0] = base.item.new_root;
        inputs[1] = cur.item.ctx.nullifier[0];
        inputs[2] = cur.item.ctx.nullifier[1];
        inputs[3] = cur.item.ctx.utxo[0];
        inputs[4] = cur.item.ctx.utxo[1];
        inputs[5] = uint256(cur.item.ctx.token);
        inputs[6] = cur.item.ctx.delta;
        inputs[7] = uint256(keccak256(abi.encode(cur.item.ctx.ext)));
        require(!groth16verify(tx_vk, cur.item.ctx.proof, inputs) || cur.item.ctx.rootptr >= cur.id);
        stopRollup();
        return true;
    }

    function challengeUTXOTreeUpdate(BlockItemNote memory cur, BlockItemNote memory prev) public {
        require(blockItemNoteVerify(cur) && blockItemNoteVerify(prev));
        require(cur.id == prev.id+1);
        uint256[] memory inputes = new uint256[](5);
        inputs[0] = prev.new_root;
        inputs[1] = cur.new_root;
        inputs[2] = prev.id;
        inputs[3] = cur.utxo[0];
        inputs[4] = cur.utxo[1];
        require(!groth16verify(tree_update_vk, cur.item.ctx.proof, inputs));
        stopRollup();
        return true;
    }

    function challengeDoubleSpend(BlockItemNote memory cur, BlockItemNote memory prev) public {
        require(blockItemNoteVerify(cur) && blockItemNoteVerify(prev));
        require(cur.id > prev.id);
        require(cur.item.ctx.nullifier[0] == prev.item.ctx.nullifier[0] ||
            cur.item.ctx.nullifier[0] == prev.item.ctx.nullifier[1] ||
            cur.item.ctx.nullifier[1] == prev.item.ctx.nullifier[0] ||
            cur.item.ctx.nullifier[1] == prev.item.ctx.nullifier[1]);
        stopRollup();
        return true;
    }



}