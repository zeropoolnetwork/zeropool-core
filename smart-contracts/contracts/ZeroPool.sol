pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./lib/IERC20.sol";
import "./lib/Ownable.sol";
import "./lib/AbstractERC20.sol";
import "./OptimisticRollup.sol";

contract Zeropool is Ownable, OptimisticRollup {
    using AbstractERC20 for IERC20;

    uint256 constant DEPOSIT_EXISTS = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant DEPOSIT_EXPIRES_BLOCKS = 500;
    uint256 constant CHALLENGE_EXPIRES_BLOCKS = 5760;
    uint256 constant BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;
    bytes32 constant EMPTY_BLOCK_HASH = 0x9867cc5f7f196b93bae1e27e6320742445d290f2263827498b54fec539f756af;

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
        rollup_block[0] = EMPTY_BLOCK_HASH;
        rollup_tx_num = 256;
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
        inputs[7] = uint256(keccak256(abi.encode(cur.item.ctx.ext)));
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
        BlockItemNote memory prev
    ) public returns (bool) {
        require(blockItemNoteVerifyPair(cur, prev, rollup_block));
        require(cur.id == prev.id + 1);
        uint256[] memory inputs = new uint256[](5);
        inputs[0] = prev.item.new_root;
        inputs[1] = cur.item.new_root;
        inputs[2] = prev.id;
        inputs[3] = cur.item.ctx.utxo[0];
        inputs[4] = cur.item.ctx.utxo[1];
        require(!groth16verify(tree_update_vk, cur.item.ctx.proof, inputs));
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
