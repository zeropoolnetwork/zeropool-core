const Web3 = require('web3');
const { privateToAddress, addHexPrefix, toChecksumAddress } = require('ethereumjs-util');
const HdWallet = require('hdwallet-babyjub');
const snarkjs = require('snarkjs');
const { unstringifyBigInts } = require("snarkjs/src/stringifybigint");
const buildBn128 = require("websnark/src/bn128.js");

const { utxo_hash, PROOF_LENGTH, transfer_compute, utxo } = require('../circom/src/inputs');
const { linearize_proof } = require('../circom/src/utils');
const { MerkleTree, merkleDefaults } = require('../circom/src/merkletree');
const buildwitness = require('../circom/src/buildwitness');


const transaction_json = require('./../circom/circuitsCompiled/transaction');
const fs = require('fs'),
  proover_key = fs.readFileSync('./../circom/circuitsCompiled/transaction_pk.bin').buffer;

const zrpPath = 'm/44\'/0\'/0\'/0/0';

const zpMnemonic = process.env.MNEMONIC;
if (!zpMnemonic) {
  throw new Error('you do not entered zero pool mnemonic');
}
const ethPrivateKey = process.env.PRIVATE_KEY;
if (!ethPrivateKey) {
  throw new Error('you do not entered Ethereum private key');
}

const web3 = new Web3('https://mainnet.infura.io');

(async function main() {
  const keyPair = getKeyPair(zpMnemonic);
  const depositData = await getDepositData(
    {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey
    },
    {
      ethereum_address: getEthereumAddress(ethPrivateKey),
      token_address: 0n,
      input_amount: 1000000n,
      root: 0n // todo: compute from the all fetched UTXOs
    });
  console.log(depositData)
})();

async function getDepositData({ privateKey, publicKey }, { ethereum_address, token_address, input_amount, root }) {

  const utxo_in = [];
  const utxo_out = [utxo(token_address, input_amount, publicKey)];

  const delta = input_amount;
  const message_hash = 0n;


  const { inputs } = transfer_compute(root, utxo_in, utxo_out, token_address, delta, message_hash, privateKey);
  const proof = await getProof(inputs, proover_key);

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
  return {
    // todo: fetch rootptr from the last BlockItem.new_root
    rootptr: root,
    nullifier: inputs.nullifier,
    utxo: inputs.utxo_out_hash,
    token: inputs.token,
    delta: inputs.delta,
    TxExternalFields: {
      owner: ethereum_address,
      Message: [
        [0n, 0n, 0n, 0n],
        [0n, 0n, 0n, 0n]
      ]
    },
    proof: proof
  }
}


async function getProof(inputs, pk) {
  const circuit = new snarkjs.Circuit(transaction_json);
  const witness = circuit.calculateWitness(inputs);

  const bn128 = await buildBn128();
  const proof = unstringifyBigInts(await bn128.groth16GenProof(buildwitness(witness), pk));
  return linearize_proof(proof);
}

function getKeyPair(mnemonic) {
  return {
    privateKey: HdWallet.Privkey(mnemonic, zrpPath).k,
    publicKey: HdWallet.Pubkey(mnemonic, zrpPath).K[0]
  }
}

function getEthereumAddress(privateKey) {
  if (privateKey.indexOf('0x') === 0) {
    privateKey = privateKey.substring(2);
  }
  const addressBuffer = privateToAddress(Buffer.from(privateKey, 'hex'));
  const hexAddress = addressBuffer.toString('hex');
  return addHexPrefix(toChecksumAddress(hexAddress));
}
