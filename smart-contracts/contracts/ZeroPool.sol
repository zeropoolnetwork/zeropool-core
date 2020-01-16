pragma solidity >= 0.6.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ZeroPool is Ownable {

    uint256 constant DEPOSIT_CANCEL_PERIOD = 7200;
    uint256 constant BN254_ORDER = 16798108731015832284940804142231733909759579603404752749028378864165570215949;
    uint256 constant MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;

    struct Tx {
        bytes32 root_at;
        uint256[2] nullifier;
        uint256[2] utxo;
        address owner;
        address token;
        uint256 delta;
        uint256[5][2] message;
        uint256[8] proof;
    }

    struct UTXO {
        address owner;
        address token;
        uint256 amount;
    }



    mapping (bytes32=>uint32) public txs;
    mapping (bytes32=>bytes32) public deposits;
    mapping (bytes32=>bytes32) public withdrawals;

    mapping (bytes32=>uint32) public deposit_consumed_at;

    uint32 public cursor;
    uint32 public defect = 0xffffffff;

    function depositIsConsumed(bytes32 tx_hash) internal returns(bool) {
        return (deposit_consumed_at[tx_hash] > 0) && (deposit_consumed_at[tx_hash] < defect);
    }

    function deposit(address token, uint256 amount, bytes32 tx_hash) public payable returns(bool) {
        require(deposits[tx_hash]==bytes32(0));
        uint256 value = amount;
        require ((token != address(0)) || (msg.value == value));
        if (asset != address(0)) {
            uint256 cur_balance = IERC20(token).balaceOf(this);
            IERC20(token).transferFrom(msg.sender, this, value);
            value = IERC20(token).balaceOf(this) - cur_balance;
            require(value > 0);
        }

        bytes32 deposit_hash = keccak256(abi.encode(msg.sender, token, value, block.timestamp));
        deposits[tx_hash] = deposit_hash;
        return true;
    }

    function cancelDeposit(UTXO memory d, uint256 timestamp, bytes32 tx_hash) public returns (bool) {
        require(timestamp < (block.timestamp + DEPOSIT_CANCEL_PERIOD));
        require(!depositIsConsumed(tx_hash));

        bytes32 deposit_hash = keccak256(abi.encode(d, timestamp));
        require(deposits[tx_hash] == deposit_hash);
        if (d.token == address(0)) {
            payable(d.owner).transfer(d.amount);
        } else {
            IERC20(d.token).transfer(d.owner, d.amount);
        }

        delete deposits[tx_hash];
        return true;
    }


    function publishTx(Tx memory txn, uint256 deposit_timestamp) public onlyOwner returns(bool) {
        require((txs[txn.root_at] > 0) && (txs[txn.root_at] < cursor));
        bytes32 tx_hash = keccak256(abi.encode(txn, block.timestamp));
        require(txs[tx_hash] == 0);

        if (txn.delta == 0) { //do nothing

        } else if (txn.delta < MAX_AMOUNT) { // deposit
            bytes32 deposit_hash = keccak256(abi.encode(txn.owner, txn.token, txn.delta, deposit_timestamp));
            require(deposits[tx_hash] == deposit_hash);
            require(deposit_consumed_at[tx_hash] == 0);
            deposit_consumed_at[tx_hash] = cursor;
 
        } else if (txn.delta > (BN254_ORDER-MAX_AMOUNT)) { //withdrawal
            withdrawals[tx_hash] = keccak256(abi.encode(txn.owner, txn.token, BN254_ORDER-txn.delta, block.timestamp));

        } else revert();

        txs[tx_hash] = cursor;
        cursor++;
        return true;
    }


}