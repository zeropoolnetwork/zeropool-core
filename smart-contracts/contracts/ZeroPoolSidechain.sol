pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;


import "./lib/Ownable.sol";
import "./OptimisticRollup.sol";


contract Zeropool is Ownable, OptimisticRollup {

    bytes32 constant EMPTY_BLOCK_HASH = 0x9867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756af;

    event NewBlockPack();

    mapping(uint256 => bytes32) public rollup_block;


    uint256 public rollup_tx_num;


    constructor() public {
        rollup_block[0] = EMPTY_BLOCK_HASH;
        rollup_tx_num = 256;
    }



    function publishBlock(
        BlockItem[] memory items,
        uint256 rollup_cur_block_num,
        uint256 blocknumber_expires
    ) public onlyOwner returns (bool) {
        require(rollup_cur_block_num == rollup_tx_num >> 8);
        require(block.number < blocknumber_expires);
        uint256 nitems = items.length;
        require(nitems > 0 && nitems <= 256);
        bytes32[] memory hashes = new bytes32[](nitems);
        for (uint256 i = 0; i < nitems; i++) {
            BlockItem memory item = items[i];
            bytes32 itemhash = keccak256(abi.encode(item));
            hashes[i] = itemhash;
        }
        rollup_block[rollup_tx_num >> 8] = MerkleProof.keccak256MerkleTree(
            hashes
        );
        rollup_tx_num += 256;
        emit NewBlockPack();
        return true;
    }

}
