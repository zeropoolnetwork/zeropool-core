pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;


import "./lib/IERC20.sol";
import "./lib/MerkleProof.sol";
import "./lib/Groth16Verifier.sol";
import "./lib/UnstructuredStorage.sol";


contract OptimisticRollup is UnstructuredStorage {
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
        Proof proof;
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

    bytes32 constant PTR_ROLLUP_BLOCK = 0xd790c52c075936677813beed5aa36e1fce5549c1b511bc0277a6ae4213ee93d8; // zeropool.instance.rollup_block
    bytes32 constant PTR_DEPOSIT_STATE = 0xc9bc9b91da46ecf8158f48c23ddba2c34e9b3dffbc3fcfd2362158d58383f80b; //zeropool.instance.deposit_state
    bytes32 constant PTR_WITHDRAW_STATE = 0x7ad39ce31882298a63a0da3c9e2d38db2b34986c4be4550da17577edc0078639; //zeropool.instance.withdraw_state

    bytes32 constant PTR_ROLLUP_TX_NUM = 0xeeb5c14c43ac322ae6567adef70b1c44e69fe064f5d4a67d8c5f0323c138f65e; //zeropool.instance.rollup_tx_num
    bytes32 constant PTR_ALIVE = 0x58feb0c2bb14ff08ed56817b2d673cf3457ba1799ad05b4e8739e57359eaecc8; //zeropool.instance.alive
    bytes32 constant PTR_TX_VK = 0x08cff3e7425cd7b0e33f669dbfb21a086687d7980e87676bf3641c97139fcfd3; //zeropool.instance.tx_vk
    bytes32 constant PTR_TREE_UPDATE_VK = 0xf0f9fc4bf95155a0eed7d21afd3dfd94fade350663e7e1beccf42b5109244d86; //zeropool.instance.tree_update_vk
    bytes32 constant PTR_VERSION = 0x0bf0574ec126ccd99fc2670d59004335a5c88189b4dc4c4736ba2c1eced3519c; //zeropool.instance.version
    bytes32 constant PTR_RELAYER = 0xa6c0702dad889760bc0a910159487cf57ece87c3aff39b866b8eaec3ef42f09b; //zeropool.instance.relayer

    function get_rollup_block(uint256 x) internal view returns(bytes32 value) {
        bytes32 pos = keccak256(abi.encodePacked(PTR_ROLLUP_BLOCK, x));
        value = get_bytes32(pos);
    }

    function set_rollup_block(uint256 x, bytes32 value) internal {
        bytes32 pos = keccak256(abi.encodePacked(PTR_ROLLUP_BLOCK, x));
        set_bytes32(pos, value);
    }

    function get_deposit_state(bytes32 x) internal view returns(uint256 value) {
        bytes32 pos = keccak256(abi.encodePacked(PTR_DEPOSIT_STATE, x));
        value = get_uint256(pos);
    }

    function set_deposit_state(bytes32 x, uint256 value) internal {
        bytes32 pos = keccak256(abi.encodePacked(PTR_DEPOSIT_STATE, x));
        set_uint256(pos, value);
    }



    function get_withdraw_state(bytes32 x) internal view returns(uint256 value) {
        bytes32 pos = keccak256(abi.encodePacked(PTR_WITHDRAW_STATE, x));
        value = get_uint256(pos);
    }

    function set_withdraw_state(bytes32 x, uint256 value) internal {
        bytes32 pos = keccak256(abi.encodePacked(PTR_WITHDRAW_STATE, x));
        set_uint256(pos, value);
    }



    function get_rollup_tx_num() internal view returns(uint256 value) {
        value = get_uint256(PTR_ROLLUP_TX_NUM);
    }

    function set_rollup_tx_num(uint256 value) internal {
        set_uint256(PTR_ROLLUP_TX_NUM, value);
    }

    function get_alive() internal view returns(bool value) {
        value = get_bool(PTR_ALIVE);
    }

    function set_alive(bool x) internal {
        set_bool(PTR_ALIVE, x);
    }

    function get_tx_vk() internal view returns(VK memory vk) {
        vk.data = get_uint256_list(PTR_TX_VK);
    }

    function set_tx_vk(VK memory vk) internal {
        set_uint256_list(PTR_TX_VK, vk.data);
    }

    function get_tree_update_vk() internal view returns(VK memory vk) {
        vk.data = get_uint256_list(PTR_TREE_UPDATE_VK);
    }

    function set_tree_update_vk(VK memory vk) internal {
        set_uint256_list(PTR_TREE_UPDATE_VK, vk.data);
    }

    function get_version() internal view returns(uint256 value) {
        value = get_uint256(PTR_VERSION);
    }

    function set_version(uint256 value) internal {
        set_uint256(PTR_VERSION, value);
    }

    function get_relayer() internal view returns(address value) {
        value = get_address(PTR_RELAYER);
    }

    function set_relayer(address value) internal {
        set_address(PTR_RELAYER, value);
    }


    modifier onlyInitialized(uint256 version) {
        require(get_version() == version, "contract should be initialized");
        _;
    }

    modifier onlyUninitialized(uint256 version) {
        require(get_version() < version, "contract should be uninitialized");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == get_relayer(), "This is relayer-only action");
        _;
    }

    modifier onlyAlive() {
        require(get_alive(), "Contract stopped");
        _;
    }


    function blockItemNoteVerify(BlockItemNote memory note)
        internal
        view
        returns (bool)
    {
        (bytes32 itemhash, ) = blockItemHash(note.item);
        return
            MerkleProof.keccak256MerkleProof(
                note.proof,
                note.id & 0xff,
                itemhash
            ) == get_rollup_block(note.id >> 8);
    }

    function blockItemNoteVerifyPair(
        BlockItemNote memory note0,
        BlockItemNote memory note1
    ) internal view returns (bool) {
        (bytes32 itemhash0,) = blockItemHash(note0.item);
        (bytes32 itemhash1,) = blockItemHash(note1.item);


        return
            MerkleProof.keccak256MerkleProof(
                note0.proof,
                note0.id & 0xff,
                itemhash0
            ) ==
            get_rollup_block(note0.id >> 8) &&
            MerkleProof.keccak256MerkleProof(
                note1.proof,
                note1.id & 0xff,
                itemhash1
            ) ==
            get_rollup_block(note1.id >> 8) &&
            itemhash0 != itemhash1;
    }

    function blockItemHash(BlockItem memory item)
        internal
        pure
        returns (bytes32 itemhash, bytes32 txhash)
    {
        txhash = keccak256(abi.encode(item.ctx));
        itemhash = keccak256(
            abi.encode(txhash, item.new_root, item.deposit_blocknumber)
        );
    }

    function groth16verify(
        VK memory vk,
        Proof memory proof,
        uint256[] memory inputs
    ) internal view returns (bool) {
        return Groth16Verifier.verify(vk.data, proof.data, inputs);
    }

}
