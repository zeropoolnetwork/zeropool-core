const {
  createInstance, encodeParameter,
  getCallData, signTransaction,
  sendTransaction, fetchEvent,
  decodeParameters, decodeParameter, tbn,
  getTransaction, gaslessCall,
  encodeParameters, keccak256
} = require("./ethereum");
const zeropool_abi = require('./zeropool.abi').abi;

function zeropool(contractAddress, privateKey) {
  const instance = createInstance(zeropool_abi, contractAddress);
  return {
    deposit: prepareDeposit(instance, privateKey),
    cancelDeposit: prepareCancelDeposit(instance, privateKey),
    publishBlock: preparePublishBlock(instance, privateKey),
    depositEvents: fetchDepositEvents(instance),
    publishBlockEvents: fetchPublishedBlocks(instance),
    isDepositExists: prepareDepositChecking(instance),
    getRootPtr: getRootPtr(instance),
    getRollupTxNum: getRollupTxNum(instance)
  };
}

function prepareDeposit(instance, privateKey) {
  return async function ({ token, amount, txhash }) {
    const data = getCallData(instance, 'deposit', [token, '0x' + tbn(amount).toString(16), txhash]);
    const signedTransaction = await signTransaction(privateKey, instance._address, amount, data);
    return sendTransaction(signedTransaction);
  };
}

function prepareCancelDeposit(instance, privateKey) {
  return async function ({ owner, token, amount, blocknumber, txhash }) {
    const data = getCallData(instance, 'depositCancel', [[
      [
        owner,
        token,
        '0x' + tbn(amount).toString(16)
      ],
      '0x' + blocknumber.toString(16),
      txhash
    ]]);
    const signedTransaction = await signTransaction(privateKey, instance._address, 0, data);
    return sendTransaction(signedTransaction);
  };
}

function preparePublishBlock(instance, privateKey) {
  return async function (blocks, rollup_cur_block_num, blocknumber_expires) {
    blocks = blocks.map(packBlock);
    const data = getCallData(instance, 'publishBlock', [blocks, toHex(rollup_cur_block_num), toHex(blocknumber_expires)]);
    const signedTransaction = await signTransaction(privateKey, instance._address, 0, data);
    return sendTransaction(signedTransaction);
  };
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

function prepareDepositChecking(instance) {
  return async function ({ token, amount, txhash, owner, blocknumber }) {
    const encodedData = encodeParameters(
      ['address', 'address', 'uint256', 'uint256', 'bytes32'],
      [owner, token, amount, blocknumber, txhash]
    );
    const hash = keccak256(encodedData);
    const result = await gaslessCall(instance, 'deposit_state', owner, [hash]);
    return result !== '0';
  }
}

function getRootPtr(instance) {
  return function () {
    return getRollupTxNum()
      .then(rollupTxNum => {
        return gaslessCall(instance, 'rollup_block', '0x0000000000000000000000000000000000000000', [rollupTxNum >> 8]);
      });
  }
}

function getRollupTxNum(instance) {
  return function () {
    return gaslessCall(instance, 'rollup_tx_num', '0x0000000000000000000000000000000000000000', []);
  }
}

function fetchDepositEvents(instance) {
  return function () {
    return fetchEvent(instance, 'Deposit')
      .then(async (events) => {
        const transaction = events.map(event => getTransaction(event.transactionHash));
        return Promise.all(transaction);
      }).then(transactions => {
        return transactions.map(tx => {
          const depositData = decodeDeposit(tx.input);
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
}

function fetchPublishedBlocks(instance) {
  return function () {
    return fetchEvent(instance, 'NewBlockPack')
      .then(async (events) => {
        const transaction = events.map(event => getTransaction(event.transactionHash));
        return Promise.all(transaction);
      }).then(transactions => {
        return transactions
          .map(tx => {
            return {
              input: decodePublishedBlocks(tx.input),
              relayer: tx.from,
              blocknumber: tx.blockNumber
            }
          })
          .map(({ input, relayer, blocknumber }) => {
            return input.Blocks.map(x => {
              return {
                BlockItem: x,
                new_root: x.new_root,
                deposit_blocknumber: x.deposit_blocknumber,
                relayer,
                blocknumber
              }
            });
          })[0]
      })
  }
}

function decodeDeposit(hex) {
  const decodedParameters = decodeParameters(['address', 'uint256', 'bytes32'], hex.substring(11));
  return {
    token: decodedParameters['0'],
    amount: decodedParameters['1'],
    txhash: decodedParameters['2']
  }
}

function decodePublishedBlocks(hex) {
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

  const decodedParameters = decodeParameters([{ "BlockItem[]": BlockItem }, 'uint', 'uint'], hex.substring(11));
  return {
    Blocks: decodedParameters['0'],
    rollup_cur_block_num: decodedParameters['1'],
    blocknumber_expires: decodedParameters['2']
  }
}

function encodeTxExternalFields(owner, encryptedUTXOs) {
  return encodeParameter(
    {
      "TxExternalFields": {
        "owner": 'address',
        // maybe we should pass the name of the field instead structure name
        "Message": [
          {
            "data": 'uint256[4]',
          },
          {
            "data": 'uint256[4]',
          },
        ]
      }
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

function encodeTx({ rootptr, nullifier, utxo, token, delta, TxExternalFields, proof }) {
  return encodeParameter(
    {
      "Tx": {
        "rootptr": 'uint256',
        "nullifier": 'uint256[2]',
        "utxo": 'uint256[2]',
        "token": 'address',
        "delta": 'uint256',
        "TxExternalFields": {
          "owner": 'address',
          // maybe we should pass the name of the field instead structure name
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
      }
    },
    {
      "rootptr": rootptr.toString(),
      "nullifier": nullifier.map(x => x.toString()),
      "utxo": utxo.map(x => x.toString()),
      "token": token.toString(),
      "delta": delta.toString(),
      "TxExternalFields": {
        "owner": TxExternalFields.owner,
        // maybe we should pass the name of the field instead structure name
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

function toHex(num) {
  return "0x" + tbn(num).toString(16)
}

module.exports = { zeropool, encodeTx, encodeTxExternalFields };
