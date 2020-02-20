const HdWallet = require('hdwallet-babyjub');
const snarkjs = require('snarkjs');
const { unstringifybigints } = require("snarkjs/src/stringifybigint");
const buildBn128 = require("websnark/src/bn128.js");

const { utxo_hash, utxo, in_utxo_inputs } = require('../../circom/src/inputs');
const { encrypt_message, decrypt_message } = require("../../circom/src/encryption");
const { linearize_proof, get_pubkey } = require('../../circom/src/utils');
const buildwitness = require('../../circom/src/buildwitness');

const zrpPath = 'm/44\'/0\'/0\'/0/0';

export type Utxo = {
  token: bigint,
  amount: bigint,
  pubkey: bigint,
  blinding?: bigint,
  mp_sibling?: bigint[],
  mp_path?: number,
  blockNumber?: number
}

export type KeyPair = {
  privateKey: bigint,
  publicKey: bigint
}

export async function getProof(transactionJson: any, inputs: Utxo[], proverKey: any): Promise<bigint[]> {
  const circuit = new snarkjs.Circuit(transactionJson);
  const witness = circuit.calculateWitness(inputs);

  const bn128 = await buildBn128();
  const proof = unstringifybigints(await bn128.groth16GenProof(buildwitness(witness), proverKey));
  return linearize_proof(proof);
}

export function getKeyPair(mnemonic: string): KeyPair {
  const privK = HdWallet.Privkey(mnemonic, zrpPath).k;
  return {
    privateKey: privK,
    publicKey: get_pubkey(privK)
  }
}

export function encryptUtxo(pubK: bigint, utxo: Utxo): bigint[] {
  const dataToEncrypt = in_utxo_inputs(utxo);
  const dataHash = utxo_hash(utxo);
  return encrypt_message(dataToEncrypt, pubK, dataHash);
}

export function decryptUtxo(privK: bigint, cipher_text: bigint[], hash: bigint): Utxo {
  const decrypted_message = decrypt_message(cipher_text, privK, hash);
  const receiver_public = get_pubkey(privK);
  const _utxo_rec = utxo(decrypted_message[0], decrypted_message[1], receiver_public, decrypted_message[2]);
  if (utxo_hash(_utxo_rec) !== hash) {
    throw new Error('failed to decrypt utxo');
  }
  return _utxo_rec;
}
