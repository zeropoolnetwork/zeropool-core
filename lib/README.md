# ZeroPoolNetwork

## Description
ZeroPoolNetwork is a pure JavaScript library for iterating with ZeroPool Ethereum smart contract.

## Installation
todo

## Usage
```javascript
const zp = new ZeroPoolNetwork(contractAddress, ethPrivateKey, zpMnemonic);
```

### Deposit
```javascript
zp.deposit("0x0000000000000000000000000000000000000000", 10000001n)
  .then(console.log)
```

### My Deposits
```javascript
zp.myDeposits()
  .then(console.log)
```

### Cancel Deposit
```javascript
const deposit = { 
  token: '0x0000000000000000000000000000000000000000',
  amount: '10000001',
  txhash: '0x53f654b28f6f3e64c4621d497e048c23b8bbffd84260d358f190cdce460688d3',
  owner: '0xF0E1831dFeC63ee3c5d536Ce362A0AD178dD9aAD',
  blocknumber: 60 
}; 

zp.depositCancel(deposit)
  .then(console.log)
```
