const {
  getCallData, fetchEvent,
  tbn, keccak256, Web3Ethereum
} = require("./ethereum");
const zeropool_abi = require('./zeropool.abi').abi;

const Message = [
  {
    "data": 'uint256[4]',
  },
  {
    "data": 'uint256[4]',
  },
];

const TxExternalFields = {
  "owner": 'address',
  "Message": Message
};

const Tx = {
  "rootptr": 'uint256',
  "nullifier": 'uint256[2]',
  "utxo": 'uint256[2]',
  "token": 'address',
  "delta": 'uint256',
  "TxExternalFields": TxExternalFields,
  "proof": 'uint256[8]'
};

class ZeroPoolContract {

  constructor(contractAddress, privateKey, connectionString = 'http://127.0.0.1:8545') {
    this.contractAddress = contractAddress;
    this.privateKey = privateKey;
    this.web3Ethereum = new Web3Ethereum(connectionString);
    this.instance = this.web3Ethereum.createInstance(zeropool_abi, contractAddress);
  }

  async deposit({ token, amount, txhash }) {
    const data = getCallData(this.instance, 'deposit', [token, '0x' + tbn(amount).toString(16), txhash]);
    const signedTransaction = await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, amount, data);
    return this.web3Ethereum.sendTransaction(signedTransaction);
  };

  async cancelDeposit({ owner, token, amount, blocknumber, txhash }) {
    const data = getCallData(this.instance, 'depositCancel', [[
      [
        owner,
        token,
        '0x' + tbn(amount).toString(16)
      ],
      '0x' + blocknumber.toString(16),
      txhash
    ]]);
    const signedTransaction = await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, 0, data);
    return this.web3Ethereum.sendTransaction(signedTransaction);
  };

  async publishBlock(blocks, rollup_cur_block_num, blocknumber_expires) {
    blocks = blocks.map(packBlock);
    const data = getCallData(this.instance, 'publishBlock', [blocks, toHex(rollup_cur_block_num), toHex(blocknumber_expires)]);
    const signedTransaction = await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, 0, data);
    return this.web3Ethereum.sendTransaction(signedTransaction);
  };

  async depositEvents() {
    return fetchEvent(this.instance, 'Deposit')
      .then(async (events) => {
        const transaction = events.map(event => this.web3Ethereum.getTransaction(event.transactionHash));
        return Promise.all(transaction);
      }).then(transactions => {
        return transactions.map(tx => {
          const depositData = this.decodeDeposit(tx.input);
          return {
            token: depositData.token,
            amount: depositData.amount,
            txhash: depositData.txhash,
            owner: tx.from,
            blocknumber: tx.blockNumber
          }
        })
      })
  }

  async publishBlockEvents() {
    return fetchEvent(this.instance, 'NewBlockPack')
      .then(async (events) => {
        const transaction = events.map(event => this.web3Ethereum.getTransaction(event.transactionHash));
        return Promise.all(transaction);
      }).then(transactions => {
        return transactions
          .map(tx => {
            return {
              BlockItems: this.decodePublishedBlocks(tx.input).BlockItems,
              relayer: tx.from,
              blocknumber: tx.blockNumber
            }
          });
      })
  }

  decodeDeposit(hex) {
    const decodedParameters = this.web3Ethereum.decodeParameters(['address', 'uint256', 'bytes32'], hex.substring(11));
    return {
      token: decodedParameters['0'],
      amount: decodedParameters['1'],
      txhash: decodedParameters['2']
    }
  }

  decodePublishedBlocks(hex) {
    const BlockItem = {
      "Tx": {
        "rootptr": 'uint256',
        "nullifier": 'uint256[2]',
        "utxo": 'uint256[2]',
        "token": 'address',
        "delta": 'uint256',
        "TxExternalFields": {
          "owner": 'address',
          "Message": [
            {
              "data": 'uint256[4]',
            },
            {
              "data": 'uint256[4]',
            },
          ]
        },
        "proof": 'uint256[8]'
      },
      "new_root": 'uint256',
      "deposit_blocknumber": 'uint256'
    };

    const decodedParameters = this.web3Ethereum.decodeParameters([{ "BlockItem[]": BlockItem }, 'uint', 'uint'], hex.substring(11));
    return {
      BlockItems: decodedParameters['0'],
      rollup_cur_block_num: decodedParameters['1'],
      blocknumber_expires: decodedParameters['2']
    }
  }

  getDepositTxNum({ token, amount, txhash, owner, blocknumber }) {
    const encodedData = this.web3Ethereum.encodeParameters(
      ['address', 'address', 'uint256', 'uint256', 'bytes32'],
      [owner, token, amount, blocknumber, txhash]
    );
    const hash = keccak256(encodedData);
    return this.web3Ethereum.gaslessCall(this.instance, 'deposit_state', owner, [hash]);
  }

  getRollupTxNum() {
    return this.web3Ethereum.gaslessCall(this.instance, 'rollup_tx_num', '0x0000000000000000000000000000000000000000', []);
  }

  encodeTxExternalFields(owner, encryptedUTXOs) {
    return this.web3Ethereum.encodeParameter(
      {
        "TxExternalFields": TxExternalFields
      },
      {
        "owner": owner.substring(2),
        "Message": [
          {
            "data": encryptedUTXOs[0].map(x => x.toString()),
          },
          {
            "data": encryptedUTXOs[1].map(x => x.toString()),
          },
        ]
      }
    );
  }

  encodeTx({ rootptr, nullifier, utxo, token, delta, TxExternalFields, proof }) {
    return this.web3Ethereum.encodeParameter(
      {
        "Tx": Tx
      },
      {
        "rootptr": rootptr.toString(),
        "nullifier": nullifier.map(x => x.toString()),
        "utxo": utxo.map(x => x.toString()),
        "token": token.toString(),
        "delta": delta.toString(),
        "TxExternalFields": {
          "owner": TxExternalFields.owner,
          "Message": [
            {
              "data": TxExternalFields.Message[0].map(x => x.toString()),
            },
            {
              "data": TxExternalFields.Message[1].map(x => x.toString()),
            },
          ]
        },
        "proof": proof.map(x => x.toString())
      }
    )
  }


}

function packBlock({
                     proof,
                     message1, message2, owner, delta, token, utxo,
                     nullifier, rootptr, new_root, deposit_blocknumber
                   }) {
  nullifier = nullifier.map(toHex);
  utxo = utxo.map(toHex);
  message1 = message1.map(toHex);
  message2 = message2.map(toHex);
  proof = proof.map(toHex);

  const Proof = [proof];
  const Message = [[message1], [message2]];
  const TxExternalFields = [owner, Message];
  const Tx = [toHex(rootptr), nullifier, utxo, token, toHex(delta), TxExternalFields, Proof];
  return [Tx, toHex(new_root), toHex(deposit_blocknumber)];
}

function toHex(num) {
  return "0x" + tbn(num).toString(16)
}

module.exports = ZeroPoolContract;
