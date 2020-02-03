const {
  createInstance, encodeParameter,
  getCallData, signTransaction,
  sendTransaction, fetchEvent,
  decodeParameters, tbn
} = require("./ethereum");
const zeropool_abi = require('./zeropool.abi').abi;

function zeropool(contractAddress, privateKey) {
  const instance = createInstance(zeropool_abi, contractAddress);
  return {
    deposit: prepareDeposit(instance, privateKey),
    cancelDeposit: prepareCancelDeposit(instance, privateKey),
    depositEvents: fetchDepositEvents(instance),
    decodeDeposit
  };
}

function prepareDeposit(instance, privateKey) {
  return async function ({ token, amount, txhash }) {
    const data = getCallData(instance, 'deposit', [token, '0x' + tbn(amount).toString(16), txhash]);
    const signedTransaction = await signTransaction(privateKey, instance._address, amount, data);
    return sendTransaction(signedTransaction);
  };
}

/*
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
 */
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

function fetchDepositEvents(instance) {
  return function () {
    return fetchEvent(instance, 'Deposit');
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

/*
  struct Tx {
    uint256 rootptr;
    uint256[2] nullifier;
    uint256[2] utxo;
    IERC20 token;
    uint256 delta;
    TxExternalFields ext;
    uint256[8] proof;
  }

  struct TxExternalFields {
    address owner;
    Message[2] message;
  }

 struct Message {
    uint256[4] data;
  }
*/
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

module.exports = { zeropool, encodeTx, encodeTxExternalFields };
