pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;


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


library AbstractERC20 {

    function abstractReceive(IERC20 token, uint256 amount) internal returns(uint256) {
        if (token == IERC20(0)) {
            require(msg.value == amount);
            return amount;
        } else {
            uint256 balance = abstractBalanceOf(token, address(this));
            token.transferFrom(msg.sender, address(this), amount);
            uint256 cmp_amount = abstractBalanceOf(token, address(this)) - balance;
            require(cmp_amount != 0);
            return cmp_amount;
        }
    }

    function abstractTransfer(IERC20 token, address to, uint256 amount) internal returns(uint256) {
        if (token == IERC20(0)) {
            payable(to).transfer(amount);
            return amount;
        } else {
            uint256 balance = abstractBalanceOf(token, address(this));
            token.transfer(to, amount);
            uint256 cmp_amount = balance - abstractBalanceOf(token, address(this));
            require(cmp_amount != 0);
            return cmp_amount;
        }
    }

    function abstractBalanceOf(IERC20 token, address who) internal view returns (uint256) {
        if (token == IERC20(0)) {
            return who.balance;
        } else {
            return token.balanceOf(who);
        }
    }
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
    using AbstractERC20 for IERC20;

    uint256 constant DEPOSIT_EXISTS = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant DEPOSIT_EXPIRES_BLOCKS = 500;
    uint256 constant CHALLENGE_EXPIRES_BLOCKS = 5760;
    uint256 constant BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;

    event Deposit();
    event NewBlockPack();


    mapping(uint256 => bytes32) public rollup_block;
    mapping(bytes32 => uint256) public deposit_state;
    mapping(bytes32 => uint256) public withdraw_state;

    uint256 public rollup_tx_num;
    bool public alive = true;
    VK tx_vk;
    VK tree_update_vk;

    modifier onlyAlive() {
        require(alive);
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
            ) ==
            rollup_block[note.id >> 8];
    }

    constructor() public {
        alive = true;
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
        deposit_state[deposit_hash] = DEPOSIT_EXISTS;
        emit Deposit();
        return true;
    }

    function depositCancel(PayNote memory d) public payable returns (bool) {
        bytes32 deposit_hash = keccak256(abi.encode(d));
        require(deposit_state[deposit_hash] >= rollup_tx_num);
        require(d.blocknumber < block.number - DEPOSIT_EXPIRES_BLOCKS);
        delete deposit_state[deposit_hash];
        d.utxo.token.abstractTransfer(d.utxo.owner, d.utxo.amount);
        return true;
    }

    function withdraw(PayNote memory w) public returns (bool) {
        bytes32 withdraw_hash = keccak256(abi.encode(w));
        uint256 state = withdraw_state[withdraw_hash];
        require(state < rollup_tx_num && state != 0);
        require(w.blocknumber < block.number - CHALLENGE_EXPIRES_BLOCKS);
        delete withdraw_state[withdraw_hash];
        w.utxo.token.abstractTransfer(w.utxo.owner, w.utxo.amount);
        return true;
    }

    function publishBlock(
        BlockItem[] memory items,
        uint256 rollup_cur_block_num,
        uint256 blocknumber_expires
    ) public onlyOwner returns (bool) {
        require(alive, "contract stopped");
        require(rollup_cur_block_num == rollup_tx_num >> 8, "wrong block number");
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
                require(deposit_state[deposit_hash] == DEPOSIT_EXISTS, "unexisted deposit");
                deposit_state[deposit_hash] = rollup_tx_num + i;
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
                require(withdraw_state[withdraw_hash] == 0, "withdrawal already published");
                withdraw_state[withdraw_hash] = rollup_tx_num + i;
            } else revert("wrong behavior");

            hashes[i] = itemhash;
        }
        rollup_block[rollup_tx_num >> 8] = MerkleProof.keccak256MerkleTree(
            hashes
        );
        rollup_tx_num += 256;
        emit NewBlockPack();
        return true;
    }

    function stopRollup(uint256 lastvalid) internal returns (bool) {
        alive = false;
        if (rollup_tx_num > lastvalid) rollup_tx_num = lastvalid;
    }

    function challengeTx(BlockItemNote memory cur, BlockItemNote memory base)
        public
        returns (bool)
    {
        require(blockItemNoteVerifyPair(cur, base, rollup_block));
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
            !groth16verify(tx_vk, cur.item.ctx.proof, inputs) ||
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
        require(blockItemNoteVerifyPair(cur, prev, rollup_block));
        require(right_root != cur.item.new_root);
        require(cur.id == prev.id + 1);
        uint256[] memory inputs = new uint256[](5);
        inputs[0] = prev.item.new_root;
        inputs[1] = right_root;
        inputs[2] = cur.id;
        inputs[3] = cur.item.ctx.utxo[0];
        inputs[4] = cur.item.ctx.utxo[1];
        require(groth16verify(tree_update_vk, cur.item.ctx.proof, inputs));
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
        require(blockItemNoteVerifyPair(cur, prev, rollup_block));
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
}
