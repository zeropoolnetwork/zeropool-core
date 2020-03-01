pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;



contract Ownable {
    address private _owner;

    constructor () internal {
        _owner = msg.sender;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }


}



interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

library MerkleProof {
    function keccak256MerkleProof(
        bytes32[8] memory proof,
        uint256 path,
        bytes32 leaf
    ) internal pure returns (bytes32) {
        bytes32 root = leaf;
        for (uint256 i = 0; i < 8; i++) {
            root = (path >> i) & 1 == 0
                ? keccak256(abi.encode(leaf, proof[i]))
                : keccak256(abi.encode(proof[i], leaf));
        }
        return root;
    }

    //compute merkle tree for up to 256 leaves
    function keccak256MerkleTree(bytes32[] memory buff)
        internal
        pure
        returns (bytes32)
    {
        uint256 buffsz = buff.length;
        bytes32 last_tx = buff[buffsz - 1];
        for (uint8 level = 1; level < 8; level++) {
            bool buffparity = (buffsz & 1 == 0);
            buffsz = (buffsz >> 1) + (buffsz & 1);

            for (uint256 i = 0; i < buffsz - 1; i++) {
                buff[i] = keccak256(abi.encode(buff[2 * i], buff[2 * i + 1]));
            }
            buff[buffsz - 1] = buffparity
                ? keccak256(
                    abi.encode(buff[2 * buffsz - 2], buff[2 * buffsz - 1])
                )
                : keccak256(abi.encode(buff[2 * buffsz - 2], last_tx));
            last_tx = keccak256(abi.encode(last_tx, last_tx));
        }
        return buff[0];
    }
}


library Groth16Verifier {
  uint constant q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
  uint constant r = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

  struct G1Point {
    uint X;
    uint Y;
  }
  // Encoding of field elements is: X[0] * z + X[1]
  struct G2Point {
    uint[2] X;
    uint[2] Y;
  }

  /// @return the sum of two points of G1
  function addition(G1Point memory p1, G1Point memory p2) internal view returns (G1Point memory) {
    G1Point memory t;
    uint[4] memory input;
    input[0] = p1.X;
    input[1] = p1.Y;
    input[2] = p2.X;
    input[3] = p2.Y;
    bool success;
    /* solium-disable-next-line */
    assembly {
      success := staticcall(sub(gas(), 2000), 6, input, 0xc0, t, 0x60)
      // Use "invalid" to make gas estimation work
      switch success case 0 { invalid() }
    }
    require(success);
    return t;
  }

  /// @return the product of a point on G1 and a scalar, i.e.
  /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
  function scalar_mul(G1Point memory p, uint s) internal view returns (G1Point memory) {
    if(s==0) return G1Point(0,0);
    if(s==1) return p;
    G1Point memory t;
    uint[3] memory input;
    input[0] = p.X;
    input[1] = p.Y;
    input[2] = s;
    bool success;
    /* solium-disable-next-line */
    assembly {
      success := staticcall(sub(gas(), 2000), 7, input, 0x80, t, 0x60)
      // Use "invalid" to make gas estimation work
      switch success case 0 { invalid() }
    }
    require (success);
    return t;
  }


  function verify(uint[] memory input, uint[8] memory proof, uint[] memory vk) internal view returns (bool) {
    uint nsignals = (vk.length-16)/2;
    require((nsignals>0) && (input.length == nsignals) && (proof.length == 8) && (vk.length == 16 + 2*nsignals));

    for(uint i=0; i<input.length; i++)
      require(input[i]<r);


    uint[] memory p_input = new uint[](24);

    p_input[0] = proof[0];
    p_input[1] = q-(proof[1]%q);  //proof.A negation
    p_input[2] = proof[2];
    p_input[3] = proof[3];
    p_input[4] = proof[4];
    p_input[5] = proof[5];

    // alpha1 computation
    p_input[6] = vk[0];     //vk.alfa1 == G1Point(vk[0], vk[1])
    p_input[7] = vk[1];


    p_input[8] = vk[2];
    p_input[9] = vk[3];
    p_input[10] = vk[4];
    p_input[11] = vk[5];

    //vk_x computation
    G1Point memory t = G1Point(vk[14], vk[15]);  //vk.IC[0] == G1Point(vk[14], vk[15])
    for(uint j = 0; j < nsignals; j++)
      t = addition(t, scalar_mul(G1Point(vk[16+2*j], vk[17+2*j]), input[j]));  //vk.IC[j + 1] == G1Point(vk[16+2*j], vk[17+2*j])

    p_input[12] = t.X;
    p_input[13] = t.Y;

    p_input[14] = vk[6];
    p_input[15] = vk[7];
    p_input[16] = vk[8];
    p_input[17] = vk[9];

    //C computation
    p_input[18] = proof[6];   //proof.C == G1Point(proof[6], proof[7])
    p_input[19] = proof[7];

    p_input[20] = vk[10];
    p_input[21] = vk[11];
    p_input[22] = vk[12];
    p_input[23] = vk[13];


    uint[1] memory out;
    bool success;
    // solium-disable-next-line 
    assembly {
      success := staticcall(sub(gas(), 2000), 8, add(p_input, 0x20), 768, out, 0x20)
      // Use "invalid" to make gas estimation work
      switch success case 0 { invalid() }
    }

    require(success);
    return out[0] != 0;
  }

}



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
