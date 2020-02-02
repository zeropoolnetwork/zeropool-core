const { getEthereumAddress, keccak256, encodeTxExternalFields } = require('./ethereum/ethereum');

const HdWallet = require('hdwallet-babyjub');
const snarkjs = require('snarkjs');
const { unstringifyBigInts } = require("snarkjs/src/stringifybigint");
const buildBn128 = require("websnark/src/bn128.js");

const { utxo_hash, transfer_compute, utxo, in_utxo_inputs } = require('../circom/src/inputs');
const { encrypt_message, decrypt_message } = require("../circom/src/encryption");
const { linearize_proof, get_pubkey } = require('../circom/src/utils');
const buildwitness = require('../circom/src/buildwitness');


const transaction_json = require('./../circom/circuitsCompiled/transaction');
const fs = require('fs'),
  proover_key = fs.readFileSync('./../circom/circuitsCompiled/transaction_pk.bin').buffer;

const zrpPath = 'm/44\'/0\'/0\'/0/0';

const { zpMnemonic, ethPrivateKey, contractAddress } = initEnvironments();

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
  const utxo_out = [
    utxo(token_address, input_amount, publicKey),
    utxo(token_address, 0n, publicKey)
  ];
  const delta = input_amount;

  const encryptedUTXOs = utxo_out.map(utxo => encryptUtxo(publicKey, utxo));

  const tx_external_fields = {
    owner: ethereum_address,
    Message: encryptedUTXOs
  };
  const encoded_tx_external_fields = encodeTxExternalFields(ethereum_address, encryptedUTXOs);

  const message_hash = keccak256(encoded_tx_external_fields);

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
    TxExternalFields: tx_external_fields,
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
  const privK = HdWallet.Privkey(mnemonic, zrpPath).k;
  return {
    privateKey: privK,
    publicKey: get_pubkey(privK)
  }
}

function encryptUtxo(pubK, utxo) {
  const dataToEncrypt = in_utxo_inputs(utxo);
  const dataHash = utxo_hash(utxo);

  return encrypt_message(dataToEncrypt, pubK, dataHash);
}

function decryptUtxo(privK, cipher_text, hash) {
  const decrypted_message = decrypt_message(cipher_text, privK, hash);
  console.log(decrypted_message)
  const receiver_public = get_pubkey(privK);
  const _utxo_rec = utxo(decrypted_message[0], decrypted_message[1], receiver_public, decrypted_message[2]);
  if (utxo_hash(_utxo_rec) !== hash) {
    throw new Error('failed to decrypt utxo');
  }
  return _utxo_rec;
}

function initEnvironments() {
  const zpMnemonic = process.env.MNEMONIC;
  if (!zpMnemonic) {
    throw new Error('MNEMONIC env not defined');
  }

  const ethPrivateKey = process.env.PRIVATE_KEY;
  if (!ethPrivateKey) {
    throw new Error('PRIVATE_KEY env not defined');
  }

  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error('CONTRACT_ADDRESS env not defined');
  }

  return {
    zpMnemonic,
    ethPrivateKey,
    contractAddress
  }
}


