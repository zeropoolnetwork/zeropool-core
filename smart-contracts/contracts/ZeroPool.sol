pragma solidity >= 0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "lib/AbstractERC20.sol";
import "lib/MerkleProof.sol";


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
    }

    struct BlockItem {
        Tx ctx;
        uint256 new_root;
        uint256 deposit_blocknumber;
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
    VK public tx_vk;
    VK public tree_update_vk;
    

    function groth16verify(VK memory vk, Proof memory proof, uint256[] memory inputs) internal view returns(bool) {
        // TODO bind groth16verifier
        return true;
    }

    constructor() public {
        rollup_block[0] = EMPTY_BLOCK_HASH;
        rollup_tx_num = 256;
    }



    function deposit(IERC20 token, uint256 amount, bytes32 txhash) public returns(bool) {
        uint256 _amount = token.abstractReceive(amount);
        bytes32 deposit_hash = keccak256(abi.encode(msg.sender, token, _amount, block.number, txhash));
        deposit_state[deposit_hash] = DEPOSIT_EXISTS;
        return true;
    }

    function depositCancel(PayNote memory d) public payable returns(bool) {
        bytes32 deposit_hash = keccak256(abi.encode(d));
        require(deposit_state[deposit_hash] >= rollup_tx_num, 800);
        require(d.blocknumber < block.number - DEPOSIT_EXPIRES_BLOCKS, 810);
        delete deposit_state[deposit_hash];
        d.utxo.token.abstractTransfer(d.utxo.owner, d.utxo.amount);
        return true;
    }

    function withdraw(PayNote w) public returns(bool) {
        bytes32 withdraw_hash = keccak256(abi.encode(w));
        require(withdraw_state[withdraw_hash] < rollup_tx_num, 900);
        require(w.blocknumber < block.number - CHALLENGE_EXPIRES_BLOCKS, 910);
        delete withdraw_state[withdraw_hash];
        w.utxo.token.abstractTransfer(w.utxo.owner, w.utxo.amount);
        return true;
    }

    function publishBlock(BlockItem[] memory items, uint rollup_cur_block_num, uint blocknumber_expires) public returns(bool) {
        require(rollup_cur_block_num == rollup_tx_num >> 8, 1000);
        require(block.number < blocknumber_expires, 1010);
        uint256 nitems = items.length;
        require(nitems > 0 && nitems <= 256, 1100);
        bytes32[] memory hashes = new bytes32[](nitems);
        for(uint i = 0; i<nitems; i++) {
            BlockItem memory item = items[i];
            bytes32 txhash = keccak256(abi.encode(item));
            if (items.ctx.delta == 0) {
                require(items.deposit_blocknumber == 0, 1210);
                require(items.ctx.token == IERC20(0), 1220);
                require(items.ctx.ext.owner == address(0), 1230);
            } else if (item.ctx.delta < MAX_AMOUNT) {
                bytes32 deposit_hash = keccak256(abi.encode(items.ctx.ext.owner, items.ctx.token, item.ctx.delta, items.deposit_blocknumber, txhash));
                require(deposit_state[deposit_hash]==DEPOSIT_EXISTS, 1240);
                deposit_state[deposit_hash] = rollup_tx_num+i;
            } else if (item.ctx.delta > BN254_ORDER-MAX_AMOUNT && item.ctx.delta < MAX_AMOUNT) {
                require(items.deposit_blocknumber == 0, 1210);
                bytes32 withdraw_hash = keccak256(abi.encode(items.ctx.ext.owner, items.ctx.token, BN254_ORDER-item.ctx.delta, block.number, txhash));
                require(!withdraw_state[withdraw_hash], 1250);
                withdraw_state[withdraw_hash] = true;
            } else revert(1260);

            hashes[i] = txhash;
        }
        rollup_block[rollup_tx_num >> 8] = MerkleProof.keccak256MerkleTree(hashes);
        rollup_tx_num += 256;
        return true;
    }

    function challengeTxProof() public {

    }

    function challengeUTXOTreeUpdate() public {

    }

    function challengeDoubleSpend() public {

    }



}