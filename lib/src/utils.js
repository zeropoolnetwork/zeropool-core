const HdWallet = require('hdwallet-babyjub');
const snarkjs = require('snarkjs');
const { unstringifyBigInts } = require("snarkjs/src/stringifybigint");
const buildBn128 = require("websnark/src/bn128.js");

const { utxo_hash, utxo, in_utxo_inputs } = require('../../circom/src/inputs');
const { encrypt_message, decrypt_message } = require("../../circom/src/encryption");
const { linearize_proof, get_pubkey } = require('../../circom/src/utils');
const buildwitness = require('../../circom/src/buildwitness');

const zrpPath = 'm/44\'/0\'/0\'/0/0';

async function getProof(transaction_json, inputs, pk) {
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
  const receiver_public = get_pubkey(privK);
  const _utxo_rec = utxo(decrypted_message[0], decrypted_message[1], receiver_public, decrypted_message[2]);
  if (utxo_hash(_utxo_rec) !== hash) {
    throw new Error('failed to decrypt utxo');
  }
  return _utxo_rec;
}

module.exports = { getProof, getKeyPair, encryptUtxo, decryptUtxo };
