pragma solidity >=0.6.0;

library MerkleProof {
    function keccak256MerkleProof(bytes32[8] memory proof, uint8 path, bytes32 leaf) internal pure returns(bytes32) {
        bytes32 root = leaf;
        for(uint8 i=0; i<8 i++) {
            root = path >> i & 1 == 0 ?  keccak256(abi.encode(leaf, proof[i])) : keccak256(abi.encode(proof[i], leaf));
        }
        return root;
    }

    function keccak256ProofDefault(uint8 level) internal pure returns(bytes32) {
        if (level & 4 == 0) {
            if (level & 2 == 0) {
                if (level & 1 == 0) {
                    return 0x0000000000000000000000000000000000000000000000000000000000000000;
                } else {
                    return 0xad3228b676f7d3cd4284a5443f17f1962b36e491b30a40b2405849e597ba5fb5;
                }
            } else {
                if (level & 1 == 0) {
                    return 0xb4c11951957c6f8f642c4af61cd6b24640fec6dc7fc607ee8206a99e92410d30;
                } else {
                    return 0x21ddb9a356815c3fac1026b6dec5df3124afbadb485c9ba5a3e3398a04b7ba85;
                }
            }
        } else {
            if (level & 2 == 0) {
                if (level & 1 == 0) {
                    return 0xe58769b32a1beaf1ea27375a44095a0d1fb664ce2dd358e7fcbfb78c26a19344;
                } else {
                    return 0x0eb01ebfc9ed27500cd4dfc979272d1f0913cc9f66540d7e8005811109e1cf2d;
                }
            } else {
                if (level & 1 == 0) {
                    return 0x887c22bd8750d34016ac3c66b5ff102dacdd73f6b014e710b51e8022af9a1968;
                } else {
                    return 0xffd70157e48063fc33c97a050f7f640233bf646cc98d9524c6b92bcf3ab56f83;
                }
            }
        }
    }


    //compute merkle tree for up to 256 leaves
    function keccak256MerkleTree(bytes32[] memory buff) internal pure returns(bytes32) {
        uint buffsz = buff.length;
        for (uint level = 1; level < 8; level++) {
            bool buffparity = (buffsz & 1 == 0);
            buffsz = (buffsz >> 1) + (buffsz & 1);

            for (uint i = 0; i < buffsz-1; i++) {
                buff[i] = keccak256(abi.encode(buff[2*i], buff[2*i+1]));
            }
            buff[buffsz-1] = buffparity ? keccak256(abi.encode(leaves[2*buffsz-2], leaves[2*buffsz-1])) : 
                keccak256(abi.encode(leaves[2*buffsz-2], keccak256ProofDefault(level)));
        }
        return buff[0];

    }
}