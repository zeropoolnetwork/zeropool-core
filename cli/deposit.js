const { transfer_compute, utxo } = require('../circom/src/inputs');

// const Web3 = require('web3');
const HdWallet = require('hdwallet-babyjub');
const snarkjs = require('snarkjs');
const snark = require('./../circuitsCompiled/transaction');

// const web3 = new Web3('https://mainnet.infura.io');
const zrpPath = 'm/44\'/0\'/0\'/0/0';

const zpMnemonic = process.env.MNEMONIC;
if (!zpMnemonic) {
  throw new Error('you do not entered zero pool mnemonic');
}
const ethPrivateKey = process.env.PRIVATE_KEY;
if (!ethPrivateKey) {
  throw new Error('you do not entered Ethereum private key');
}

const zpPrivateKey = HdWallet.Privkey(zpMnemonic, zrpPath).k;
const zpPublicKey = HdWallet.Pubkey(zpMnemonic, zrpPath).K[0];

const token = 0n;
const input_amount = 10000000n;

const utxo_in = [];
const utxo_out = [utxo(token, input_amount, zpPublicKey)];

const delta = input_amount;
const message_hash = 0n;


const { inputs } = transfer_compute(root, utxo_in, utxo_out, token, delta, message_hash, zpPrivateKey);
const circuit = new snarkjs.Circuit(snark);
const witness = circuit.calculateWitness(inputs);
console.log(witness)
