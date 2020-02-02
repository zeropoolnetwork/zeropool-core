const Web3 = require('web3');
const { privateToAddress, addHexPrefix, toChecksumAddress } = require('ethereumjs-util');
const ethereumjs = require('ethereumjs-tx');
const zeropool_abi = require('./zeropool.abi');

const web3 = new Web3('https://mainnet.infura.io');
const keccak256 = web3.utils.keccak256;


function zeropool(contractAddress) {
  const instance = new web3.eth.Contract(zeropool_abi, contractAddress);

  return {
    deposit
  };
}

function deposit() {

}

function getCallData(instance, methodName, parameters) {
  if (!instance.methods[methodName])
    throw new Error(`Method ${methodName} does not exist`);
  return instance.methods[methodName](...parameters).encodeABI();
}

async function signTransaction(privateKey, to, value, data = "") {
  const from = getAddress(privateKey);
  const nonce = await web3.eth.getTransactionCount(from);
  const gasPrice = await web3.eth.getGasPrice();
  const gasLimit = data
    ? await web3.eth.estimateGas({ to, data })
    : 21000;

  const txParam = { from, nonce, to, value, data, gasPrice, gasLimit };

  return sign(txParam, privateKey);
}

function sign(txParam, privateKey) {
  if (privateKey.indexOf('0x') === 0) {
    privateKey = privateKey.substring(2);
  }

  const tx = new ethereumjs.Transaction(txParam);
  const privateKeyBuffer = Buffer.from(privateKey, 'hex');
  tx.sign(privateKeyBuffer);
  const serializedTx = tx.serialize();
  return serializedTx.toString('hex');
}

function encodeTxExternalFields(owner, encryptedUTXOs) {
  return web3.eth.abi.encodeParameter(
    {
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

function getEthereumAddress(privateKey) {
  if (privateKey.indexOf('0x') === 0) {
    privateKey = privateKey.substring(2);
  }
  const addressBuffer = privateToAddress(Buffer.from(privateKey, 'hex'));
  const hexAddress = addressBuffer.toString('hex');
  return addHexPrefix(toChecksumAddress(hexAddress));
}

module.exports = { zeropool, keccak256, encodeTxExternalFields, getEthereumAddress };
