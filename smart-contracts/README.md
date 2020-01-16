# Updatable Merkle tree with tests

Here is Merkle tree with in memory root update for inserting multiple elements.

## Test

Setup .env file and run ganache, install all depending npm packages.

```
MNEMONIC=....some mnemonic from metamask or ganache here....
ETHEREUM_RPC=http://127.0.0.2:8545/

```

To run test type

```sh
truffle deploy --network ganache --reset && truffle test
```

