
const { utxo_hash, PROOF_LENGTH, transfer_compute, utxo } = require('../circom/src/inputs');
const { MerkleTree } = require('../circom/src/merkletree');

// const Web3 = require('web3');
const HdWallet = require('hdwallet-babyjub');
const snarkjs = require('snarkjs');
const transaction_json = require('./../circom/circuitsCompiled/transaction');

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

const mt = new MerkleTree(PROOF_LENGTH + 1);

const zpPrivateKey = HdWallet.Privkey(zpMnemonic, zrpPath).k;
const zpPublicKey = HdWallet.Pubkey(zpMnemonic, zrpPath).K[0];

const token = 0n;
const input_amount = 10000000n;

const utxo_in = [];
const utxo_out = [utxo(token, input_amount, zpPublicKey)];

const utxo_hashes = utxo_out.map(e=>utxo_hash(e));
mt.pushMany(utxo_hashes);

const root = mt.root;

const delta = input_amount;
const message_hash = 0n;


const { inputs } = transfer_compute(root, utxo_in, utxo_out, token, delta, message_hash, zpPrivateKey);

const circuit = new snarkjs.Circuit(transaction_json);
const witness = circuit.calculateWitness(inputs);
console.log(witness)
