pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./lib/IERC20.sol";
import "./lib/Ownable.sol";
import "./lib/AbstractERC20.sol";
import "./lib/MerkleProof.sol";


contract Zeropool is Ownable {
    using AbstractERC20 for IERC20;

    uint256 constant DEPOSIT_EXISTS = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant DEPOSIT_EXPIRES_BLOCKS = 500;
    uint256 constant CHALLENGE_EXPIRES_BLOCKS = 5760;
    uint256 constant BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;
    bytes32 constant EMPTY_BLOCK_HASH = 0x9867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756af;

    event Deposit();
    event NewBlockPack();

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

    mapping(uint256 => bytes32) public rollup_block;


    uint256 public rollup_tx_num;
    bool public alive = true;
    VK tx_vk;
    VK tree_update_vk;

    modifier onlyAlive() {
        require(alive);
        _;
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


    constructor() public {
        rollup_block[0] = EMPTY_BLOCK_HASH;
        rollup_tx_num = 256;
    }



    function publishBlock(
        BlockItem[] memory items,
        uint256 rollup_cur_block_num,
        uint256 blocknumber_expires
    ) public onlyOwner returns (bool) {
        require(alive);
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
