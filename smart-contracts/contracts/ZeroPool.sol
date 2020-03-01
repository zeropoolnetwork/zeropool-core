pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import "./lib/IERC20.sol";
import "./lib/AbstractERC20.sol";
import "./OptimisticRollup.sol";

contract Zeropool is OptimisticRollup {
    using AbstractERC20 for IERC20;

    uint256 constant DEPOSIT_EXISTS = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant DEPOSIT_EXPIRES_BLOCKS = 500;
    uint256 constant CHALLENGE_EXPIRES_BLOCKS = 5760;
    uint256 constant BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;

    uint256 constant VERSION = 1;

    event Deposit();
    event NewBlockPack();

    function rollup_block(uint x) external view returns(bytes32) {
        return get_rollup_block(x);
    }

    function deposit_state(bytes32 x) external view returns(uint256) {
        return get_deposit_state(x);
    }

    function withdraw_state(bytes32 x) external view returns(uint256) {
        return get_withdraw_state(x);
    }

    function rollup_tx_num() external view returns(uint256) {
        return get_rollup_tx_num();
    }

    function alive() external view returns(bool) {
        return get_alive();
    }

    function tx_vk() external view returns(VK memory) {
        return get_tx_vk();
    }

    function tree_update_vk() external view returns(VK memory) {
        return get_tree_update_vk();
    }

    function relayer() external view returns(address) {
        return get_relayer();
    }

    function initialized() external view returns(bool) {
        return get_version() < VERSION;
    }

    function version() external view returns(uint256) {
        return VERSION;
    }

    
    function init(address relayer) external onlyUninitialized(VERSION) {
        set_alive(true);
        set_relayer(relayer);
        set_version(VERSION);
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
        set_deposit_state(deposit_hash, DEPOSIT_EXISTS);
        emit Deposit();
        return true;
    }

    function depositCancel(PayNote memory d) public returns (bool) {
        bytes32 deposit_hash = keccak256(abi.encode(d));
        require(get_deposit_state(deposit_hash) >= get_rollup_tx_num());
        require(d.blocknumber < block.number - DEPOSIT_EXPIRES_BLOCKS);
        set_deposit_state(deposit_hash, 0);
        d.utxo.token.abstractTransfer(d.utxo.owner, d.utxo.amount);
        return true;
    }

    function withdraw(PayNote memory w) public returns (bool) {
        bytes32 withdraw_hash = keccak256(abi.encode(w));
        uint256 state = get_withdraw_state(withdraw_hash);
        require(state < get_rollup_tx_num() && state != 0);
        require(w.blocknumber < block.number - CHALLENGE_EXPIRES_BLOCKS);
        set_withdraw_state(withdraw_hash, 0);
        w.utxo.token.abstractTransfer(w.utxo.owner, w.utxo.amount);
        return true;
    }

    function publishBlock(
        uint256 protocol_version,
        BlockItem[] memory items,
        uint256 rollup_cur_block_num,
        uint256 blocknumber_expires
    ) public onlyRelayer onlyAlive returns (bool) {
        uint256 cur_rollup_tx_num = get_rollup_tx_num();

        require(rollup_cur_block_num == cur_rollup_tx_num >> 8, "wrong block number");
        require(protocol_version == get_version(), "wrong protocol version");
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
                require(get_deposit_state(deposit_hash) == DEPOSIT_EXISTS, "unexisted deposit");
                set_deposit_state(deposit_hash, cur_rollup_tx_num + i);
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
                require(get_withdraw_state(withdraw_hash) == 0, "withdrawal already published");
                set_withdraw_state(withdraw_hash, cur_rollup_tx_num + i);
            } else revert("wrong behavior");

            hashes[i] = itemhash;
        }
        set_rollup_block(cur_rollup_tx_num >> 8, MerkleProof.keccak256MerkleTree(hashes));
        set_rollup_tx_num(cur_rollup_tx_num+256);
        emit NewBlockPack();
        return true;
    }

    function stopRollup(uint256 lastvalid) internal returns (bool) {
        set_alive(false);
        if (get_rollup_tx_num() > lastvalid) set_rollup_tx_num(lastvalid);
    }

    function challengeTx(BlockItemNote memory cur, BlockItemNote memory base)
        public
        returns (bool)
    {
        require(blockItemNoteVerifyPair(cur, base));
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
            !groth16verify(get_tx_vk(), cur.item.ctx.proof, inputs) ||
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
        require(blockItemNoteVerifyPair(cur, prev));
        require(right_root != cur.item.new_root);
        require(cur.id == prev.id + 1);
        uint256[] memory inputs = new uint256[](5);
        inputs[0] = prev.item.new_root;
        inputs[1] = right_root;
        inputs[2] = cur.id;
        inputs[3] = cur.item.ctx.utxo[0];
        inputs[4] = cur.item.ctx.utxo[1];
        require(groth16verify(get_tree_update_vk(), cur.item.ctx.proof, inputs));
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
        require(blockItemNoteVerifyPair(cur, prev));
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
