const Web3 = require('web3');
const { privateToAddress, addHexPrefix, toChecksumAddress } = require('ethereumjs-util');
const ethereumjs = require('ethereumjs-tx');
const { web3ProviderUrl } = require("../init-env");
const { BigNumber } = require('bignumber.js');

const web3 = new Web3(web3ProviderUrl);
const keccak256 = web3.utils.keccak256;

const tbn = BigNumber;
const tw = (x) => BigNumber.isBigNumber(x) ? x.times(1e18).integerValue() : tbn(x).times(1e18).integerValue();
const fw = (x) => BigNumber.isBigNumber(x) ? x.times(1e-18).toNumber() : tbn(x).times(1e-18).toNumber();


function getCallData(instance, methodName, parameters) {
  if (!instance.methods[methodName])
    throw new Error(`Method ${methodName} does not exist`);
  return instance.methods[methodName](...parameters).encodeABI();
}

function sendTransaction(rawTx) {
  if (rawTx.indexOf('0x') !== 0) {
    rawTx = '0x' + rawTx;
  }
  return web3.eth.sendSignedTransaction(rawTx);
}

async function signTransaction(privateKey, to, value, data = "") {
  const from = getEthereumAddress(privateKey);
  let nonce = await web3.eth.getTransactionCount(from);
  let gasPrice = await web3.eth.getGasPrice();
  let gas = data
    ? await web3.eth.estimateGas({ to, data, gas: 5000000, from, value })
    : 21000;

  gas = "0x" + gas.toString(16);
  value = "0x" + tbn(value).toString(16);
  nonce = "0x" + nonce.toString(16);
  gasPrice = "0x" + tbn(gasPrice).toString(16);

  const txParam = { from, nonce, to, value, data, gasPrice, gasLimit: gas };

  return sign(txParam, privateKey);
}

function sign(txParam, privateKey) {
  if (privateKey.indexOf('0x') === 0) {
    privateKey = privateKey.substring(2);
  }

  const tx = new ethereumjs.Transaction(txParam, {'chain':'rinkeby'});
  const privateKeyBuffer = Buffer.from(privateKey, 'hex');
  tx.sign(privateKeyBuffer);
  const serializedTx = tx.serialize();
  return serializedTx.toString('hex');
}

function gaslessCall(instance, methodName, addressFrom, parameters) {
  return instance.methods[methodName](...parameters).call({ from: addressFrom });
}

function encodeParameter(param, value) {
  return web3.eth.abi.encodeParameter(param, value)
}

function createInstance(abi, address) {
  return new web3.eth.Contract(abi, address);
}

function getEthereumAddress(privateKey) {
  if (privateKey.indexOf('0x') === 0) {
    privateKey = privateKey.substring(2);
  }
  const addressBuffer = privateToAddress(Buffer.from(privateKey, 'hex'));
  const hexAddress = addressBuffer.toString('hex');
  return addHexPrefix(toChecksumAddress(hexAddress));
}

module.exports = {
  getCallData,
  signTransaction,
  sendTransaction,
  gaslessCall,
  encodeParameter,
  createInstance,
  keccak256,
  getEthereumAddress,
  tbn,
  tw,
  fw
};
