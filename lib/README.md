# ZeroPoolNetwork

## Description
ZeroPoolNetwork is a pure JavaScript library for iterating with ZeroPool Ethereum smart contract.

## Installation
### Frontend
```bash
npm i -s zeropool-lib@0.5.5
```
### Backend
```bash
npm i -s zeropool-lib@0.5.51-node
```

## Build
### Frontend
```bash
git clone https://github.com/zeropoolnetwork/zeropool-core.git

cd lib

npm i

npm run build:browser
```

### Backend  
Go to the `package.json` and change `"websnark": "github:krboktv/websnark#915a64ec65df8ac304aa23c957f7c3ec5459685c"` to `"websnark": "0.0.5"`
```bash
git clone https://github.com/zeropoolnetwork/zeropool-core.git

cd lib

npm i

npm run build
```

## Usage
```javascript
const zp = new ZeroPoolNetwork(
  contractAddress,
  provider,        // for example: Web3 or Truffle provider
  mnemonic,       
  transactionJson, // see: compiled folder
  proverKey,       // see: compiled folder
);
```

### Available view methods
```javascript
/*
    This type of deposits haven't included to ZeroPool block 
    but exists in Ethereum chain 
*/

zp.getUncompleteDeposits();
```

```javascript
/*
  Allows to get not finalized withdrawals  
*/

zp.getActiveWithdrawals();
```

```javascript
// Balance object {[asset]: balance}

zp.getBalance();
```

```javascript
/*
    Allows to get:
    1. Merkle Tree State
    2. Last fetched block number
    3. Utxo list (by public key)
    4. Nullifiers of each utxo
*/

zp.getMyUtxoState();
```

```javascript
/*
    Balance by each asset
    ZeroPool Deposit/Transfer/Withdraw history
*/

zp.getBalanceAndHistory();
```

```javascript
// Actual Merkle Tree State

zp.fetchMerkleTree();
```

### PrepareDeposit

Generate ZeroPool transaction and its hash

```javascript
const token = "0x0000000000000000000000000000000000000000";
const amount = 10000002;
zp.prepareDeposit(token, amount)
  .then(console.log)
  
/*
[
    {
      tx: {
        token: '0x0000000000000000000000000000000000000000',
        rootPointer: '0x6a',
        nullifier: [
          '0xbf39f6a7ee49c3e9715d6107a3a1122ca1ae80f28dd25512b1316a03b13345',
          '0x14e247a277fda49a5bf7aa63b5629ae406a25c54c68bd4c357cc00be460bccd4'
        ],
        utxoHashes: [
          '0xee9541ff3784792d550b3d6ba498ec1685d1156c86709462db6a27427bf1cf2',
          '0x25c44b40af6abb8d854cfd222a8b51bf8182c4a2213ab6119d5208dabfd6e2f5'
        ],
        delta: '0x30644e72e131a029b85045b68181585d2833e84879b9709143dec31fa42aa801',
        txExternalFields: {
          owner: '0x5c526bc400c619Ca631619F52C58545ad56a0F19',
          message: [Array]
        },
        proof: { data: [Array] }
      },
      depositBlockNumber: '0x0',
      newRoot: '0x2d945693d4e2e412ad4b21df76a9423af24adbdb48d905fe42b5d5c22307e3f7'
    },
    '0xc68eca23f89667fd80105d1d7e9c7a087297a7ce701d11e50109e5dd66d9ad98'
]
*/
```

### Deposit

Deposit ZeroPool transaction to Ethereum Chain

```javascript
const token = "0x0000000000000000000000000000000000000000";
const amount = 10000002;
// hash of ZeroPool transaction from prepareDeposit fundtion response
const zeroPoolTxHash = "0xc68eca23f89667fd80105d1d7e9c7a087297a7ce701d11e50109e5dd66d9ad98";

zp.deposit(token, amount, zeroPoolTxHash)
  .then(console.log)
  
/*
[
    {
      tx: {
        token: '0x0000000000000000000000000000000000000000',
        rootPointer: '0x6a',
        nullifier: [
          '0xbf39f6a7ee49c3e9715d6107a3a1122ca1ae80f28dd25512b1316a03b13345',
          '0x14e247a277fda49a5bf7aa63b5629ae406a25c54c68bd4c357cc00be460bccd4'
        ],
        utxoHashes: [
          '0xee9541ff3784792d550b3d6ba498ec1685d1156c86709462db6a27427bf1cf2',
          '0x25c44b40af6abb8d854cfd222a8b51bf8182c4a2213ab6119d5208dabfd6e2f5'
        ],
        delta: '0x30644e72e131a029b85045b68181585d2833e84879b9709143dec31fa42aa801',
        txExternalFields: {
          owner: '0x5c526bc400c619Ca631619F52C58545ad56a0F19',
          message: [Array]
        },
        proof: { data: [Array] }
      },
      depositBlockNumber: '0x0',
      newRoot: '0x2d945693d4e2e412ad4b21df76a9423af24adbdb48d905fe42b5d5c22307e3f7'
    },
    '0xc68eca23f89667fd80105d1d7e9c7a087297a7ce701d11e50109e5dd66d9ad98'
]
*/
```

### Cancel Deposit

Cancel deposit that was not included to ZeroPool block

```javascript
const deposit = {
    utxo: { 
        token: '0x0000000000000000000000000000000000000000',
        amount: '10000002',
        owner: '0x5c526bc400c619Ca631619F52C58545ad56a0F19'
    },  
    txHash: '0x626b9a6681dae7ec6776d083f08c42fba7c0d1f68bbead511478235ca5afc257',
    blockNumber: 105 
}; 

zp.depositCancel(deposit)
  .then(console.log)
```

### Transfer

Create ZeroPool transaction

```javascript
const token = "0x0000000000000000000000000000000000000000";
const destPubKey = "0x8aba319d7609671a719e30fee2b7c74631ac2ebbb19676510268f64bcae27e8";
const amount = 10002;
zp.transfer(token, destPubKey, amount)
  .then(console.log)
```

### Prepare withdraw

Prepare ZeroPool Withdraw

```javascript
const token = "0x0000000000000000000000000000000000000000";
const numberOfUtxo = 1;
zp.prepareWithdraw(token, numberOfUtxo)
  .then(console.log)
```

### Withdraw

Withdraw funds from ZeroPool smart contract

```javascript
zp.withdraw({
    utxo: {
      token: "0x0000000000000000000000000000000000000000",
      amount: 10 ** 5,
      owner: zp.ethAddress
    },   
    blockNumber: 168,
    txHash: "0xc68eca23f89667fd80105d1d7e9c7a087297a7ce701d11e50109e5dd66d9ad98"
}).then(console.log);
```


### Publish blocks

Send ZeroPool Transactions to the smart contract

```javascript
const blockItem = [
  {
    tx: {
      token: '0x0000000000000000000000000000000000000000',
      rootPointer: '0x6a',
      nullifier: [
        '0xbf39f6a7ee49c3e9715d6107a3a1122ca1ae80f28dd25512b1316a03b13345',
        '0x14e247a277fda49a5bf7aa63b5629ae406a25c54c68bd4c357cc00be460bccd4'
      ],
      utxoHashes: [
        '0xee9541ff3784792d550b3d6ba498ec1685d1156c86709462db6a27427bf1cf2',
        '0x25c44b40af6abb8d854cfd222a8b51bf8182c4a2213ab6119d5208dabfd6e2f5'
      ],
      delta: '0x30644e72e131a029b85045b68181585d2833e84879b9709143dec31fa42aa801',
      txExternalFields: {
        owner: '0x5c526bc400c619Ca631619F52C58545ad56a0F19',
        message: [Array]
      },
      proof: { data: [Array] }
    },
    depositBlockNumber: '0x0',
    newRoot: '0x2d945693d4e2e412ad4b21df76a9423af24adbdb48d905fe42b5d5c22307e3f7'
  },
  '0xc68eca23f89667fd80105d1d7e9c7a087297a7ce701d11e50109e5dd66d9ad98'
];

const blocks = [blockItem];
const blockNumberExpires = 500;

zp.publishBlockItems(blocks, blockNumberExpires)
  .then(console.log)
```

