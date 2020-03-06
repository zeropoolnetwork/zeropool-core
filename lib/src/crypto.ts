import { DecryptedUtxo, Utxo } from "./zero-pool-network.dto";
import { in_utxo_inputs, nullifier, utxo } from "./circom/inputs";
import { decrypt_message, encrypt_message } from "./circom/encryption";
import { linearize_proof, randrange } from "./circom/utils"
// @ts-ignore
import * as snarkjs from "snarkjs";
// @ts-ignore
import * as babyJub from "circomlib/src/babyjub.js";
// @ts-ignore
import * as poseidon from "circomlib/src/poseidon";
// @ts-ignore
import * as HdWallet from "hdwallet-babyjub";
// @ts-ignore
import buildBn128 from "websnark/src/bn128";
// @ts-ignore
import { unstringifyBigInts } from "snarkjs/src/stringifybigint";
import buildwitness from "./circom/buildwitness";
import { unLinearizeProof } from "./utils";

export type KeyPair = {
    privateKey: bigint,
    publicKey: bigint
}

export const hash2 = poseidon.createHash(3, 8, 53);
export const hash3 = poseidon.createHash(4, 8, 54);

let bn128: any = undefined;

export async function getProof(transactionJson: any, inputs: any, proverKey: any): Promise<bigint[]> {
    if (typeof bn128 === "undefined") {
        bn128 = await buildBn128();
    }
    const circuit = new snarkjs.Circuit(transactionJson);
    const witness = circuit.calculateWitness(inputs);
    const proof = unstringifyBigInts(await bn128.groth16GenProof(buildwitness(witness), proverKey));
    return linearize_proof(proof);
}

export async function verifyProof(proof: bigint[], publicSignals: bigint[], verifierKey: any): Promise<boolean> {
    return snarkjs.groth.isValid(verifierKey, unLinearizeProof(proof), publicSignals);
}

export function getBabyJubPublicKey(privateKey: bigint) {
    return babyJub.mulPointEscalar(babyJub.Base8, privateKey)[0];
}

const zrpPath = 'm/44\'/0\'/0\'/0/';

export function getBabyJubKeyPair(mnemonic: string, path: number = 0): KeyPair {
    const privateKey = HdWallet.Privkey(mnemonic, zrpPath + path).k;
    return {
        privateKey: privateKey,
        publicKey: getBabyJubPublicKey(privateKey)
    }
}

export function encryptUtxo(pubK: bigint, utxo: Utxo<bigint>): bigint[] {
    // @ts-ignore
    const dataToEncrypt = in_utxo_inputs(utxo);
    const dataHash = utxoHash(utxo);
    return encrypt_message(dataToEncrypt, pubK, dataHash);
}

export function tryDecryptUtxo(
    privateKey: bigint,
    encryptedUtxo: bigint[],
    utxoHash: bigint,
): DecryptedUtxo | undefined {
    try {

        const utxo = decryptUtxo(
            privateKey,
            encryptedUtxo,
            utxoHash
        );

        if (utxo.amount === 0n) {
            return undefined;
        }

        const utxoNullifier = nullifier(utxo, privateKey);

        return {
            utxo,
            nullifier: utxoNullifier
        };


    } catch (e) {

        return undefined;

    }

}

export function decryptUtxo(privateKey: bigint, cipher_text: bigint[], hash: bigint): Utxo<bigint> {
    const decrypted_message = decrypt_message(cipher_text, privateKey, hash);
    const receiver_public = getBabyJubPublicKey(privateKey);
    const _utxo_rec = utxo(decrypted_message[0], decrypted_message[1], receiver_public, decrypted_message[2]);
    if (utxoHash(_utxo_rec) !== hash) {
        throw new Error('failed to decrypt utxoList');
    }
    return _utxo_rec;
}

function ownerCommit(publicKey: bigint, blinding: bigint): bigint[] {
    return hash2([publicKey, blinding]);
}

function frRandom(): bigint {
    return randrange(0n, snarkjs.bn128.r);
}

function outUtxoInputs(utxo: Utxo<bigint>) {
    if (!utxo.blinding) {
        utxo.blinding = frRandom();
    }
    return [utxo.token, utxo.amount, ownerCommit(utxo.pubkey, utxo.blinding)];
}

function utxoHash(utxo: Utxo<bigint>) {
    return hash3(outUtxoInputs(utxo));
}
