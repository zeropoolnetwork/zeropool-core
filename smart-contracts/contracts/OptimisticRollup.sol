pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;


import "./lib/IERC20.sol";
import "./lib/MerkleProof.sol";
import "./lib/Groth16Verifier.sol";



contract OptimisticRollup {
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


    function blockItemNoteVerify(BlockItemNote memory note, mapping(uint256 => bytes32) storage rollup_block)
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
            ) ==
            rollup_block[note.id >> 8];
    }

    function blockItemNoteVerifyPair(
        BlockItemNote memory note0,
        BlockItemNote memory note1,
        mapping(uint256 => bytes32) storage rollup_block
    ) internal view returns (bool) {
        (bytes32 itemhash0,) = blockItemHash(note0.item);
        (bytes32 itemhash1,) = blockItemHash(note1.item);

        return
            MerkleProof.keccak256MerkleProof(
                note0.proof,
                note0.id & 0xff,
                itemhash0
            ) ==
            rollup_block[note0.id >> 8] &&
            MerkleProof.keccak256MerkleProof(
                note1.proof,
                note1.id & 0xff,
                itemhash1
            ) ==
            rollup_block[note1.id >> 8] &&
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
