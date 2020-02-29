pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;


import "./OptimisticRollup.sol";


contract Zeropool is OptimisticRollup {

    event NewBlockPack();
    uint256 constant VERSION = 1;

    function rollup_block(uint x) external view returns(bytes32) {
        return get_rollup_block(x);
    }

    function rollup_tx_num() external view returns(uint256) {
        return get_rollup_tx_num();
    }


    function init(address relayer) external onlyUninitialized(VERSION) {
        set_alive(true);
        set_relayer(relayer);
        set_version(VERSION);
    }



    function publishBlock(
        BlockItem[] memory items,
        uint256 rollup_cur_block_num,
        uint256 blocknumber_expires
    ) public onlyRelayer returns (bool) {
        uint256 cur_rollup_tx_num = get_rollup_tx_num();
        require(rollup_cur_block_num == cur_rollup_tx_num >> 8);
        require(block.number < blocknumber_expires);
        uint256 nitems = items.length;
        require(nitems > 0 && nitems <= 256);
        bytes32[] memory hashes = new bytes32[](nitems);
        for (uint256 i = 0; i < nitems; i++) {
            BlockItem memory item = items[i];
            bytes32 itemhash = keccak256(abi.encode(item));
            hashes[i] = itemhash;
        }
        set_rollup_block(cur_rollup_tx_num >> 8, MerkleProof.keccak256MerkleTree(hashes));
        set_rollup_tx_num(cur_rollup_tx_num+256);
        emit NewBlockPack();
        return true;
    }

}
