// @ts-ignore
import * as HdWallet from 'hdwallet-babyjub';
// @ts-ignore
import * as snarkjs from 'snarkjs';
// @ts-ignore
import { unstringifyBigInts } from 'snarkjs/src/stringifybigint';
// @ts-ignore
import buildBn128 from 'websnark/src/bn128.js';
import { in_utxo_inputs, utxo, utxo_hash } from './circom/inputs';
import { decrypt_message, encrypt_message } from './circom/encryption';
import { get_pubkey, linearize_proof } from './circom/utils';
import buildwitness from './circom/buildwitness';

const zrpPath = 'm/44\'/0\'/0\'/0/0';

export type Utxo<T> = {
    token: T,
    amount: T,
    pubkey: T,
    blinding?: T,
    mp_sibling?: T[],
    mp_path?: number,
    blockNumber?: number
}

export type KeyPair = {
    privateKey: bigint,
    publicKey: bigint
}

export async function getProof(transactionJson: any, inputs: any, proverKey: any): Promise<bigint[]> {
    const circuit = new snarkjs.Circuit(transactionJson);
    const witness = circuit.calculateWitness(inputs);

    const bn128 = await buildBn128();
    const proof = unstringifyBigInts(await bn128.groth16GenProof(buildwitness(witness), proverKey));
    return linearize_proof(proof);
}

export async function verifyProof(proof: bigint[], publicSignals: bigint[], verifierKey: any): Promise<boolean> {
    const bn128 = await buildBn128();
    return await bn128.groth16Verify(verifierKey, publicSignals, proof);
}

export function getKeyPair(mnemonic: string): KeyPair {
    const privK = HdWallet.Privkey(mnemonic, zrpPath).k;
    return {
        privateKey: privK,
        publicKey: get_pubkey(privK)
    }
}

export function encryptUtxo(pubK: bigint, inputs: Utxo<bigint>): bigint[] {
    // @ts-ignore
    const dataToEncrypt = in_utxo_inputs(inputs);
    const dataHash = utxo_hash(inputs);
    return encrypt_message(dataToEncrypt, pubK, dataHash);
}

export function decryptUtxo(privateKey: bigint, cipher_text: bigint[], hash: bigint): Utxo<bigint> {
    const decrypted_message = decrypt_message(cipher_text, privateKey, hash);
    const receiver_public = get_pubkey(privateKey);
    const _utxo_rec = utxo(decrypted_message[0], decrypted_message[1], receiver_public, decrypted_message[2]);
    if (utxo_hash(_utxo_rec) !== hash) {
        throw new Error('failed to decrypt utxoList');
    }
    return _utxo_rec;
}
