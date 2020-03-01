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
import { Action, HistoryItem, IMerkleTree, KeyPair, MerkleTreeState, MyUtxoState, Utxo } from "./zero-pool-network.dto";
import { Tx } from "./ethereum/zeropool";
import { toHex } from "./ethereum";
import { MerkleTree as MT } from './circom/merkletree';

const zrpPath = 'm/44\'/0\'/0\'/0/0';

export const MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;
export const BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

export const WITHDRAW_ACTION = "withdraw";
export const DEPOSIT_ACTION = "deposit";
export const TRANSFER_ACTION = "transfer";

export function MerkleTree(height: number): IMerkleTree {
    return new MT(height);
}

export function getAction(delta: bigint): Action {
    if (delta === 0n) {
        return TRANSFER_ACTION;
    } else if (delta < MAX_AMOUNT) {
        return DEPOSIT_ACTION;
    }
    // delta > BN254_ORDER-MAX_AMOUNT && delta < BN254_ORDER
    return WITHDRAW_ACTION;
}

export function bigintifyTx(tx: Tx<string>): Tx<bigint> {
    return {
        delta: BigInt(tx.delta),
        nullifier: tx.nullifier.map(BigInt),
        proof: {
            data: tx.proof.data.map(BigInt)
        },
        rootPointer: BigInt(tx.rootPointer),
        token: BigInt(tx.token),
        utxoHashes: tx.utxoHashes.map(BigInt),
        txExternalFields: {
            owner: BigInt(tx.txExternalFields.owner),
            message: [
                {
                    data: tx.txExternalFields.message[0].data.map(BigInt)
                },
                {
                    data: tx.txExternalFields.message[1].data.map(BigInt)
                }
            ]
        }

    }
}

export function stringifyTx(tx: Tx<bigint>): Tx<string> {
    return {
        token: stringifyAddress(tx.token),
        rootPointer: toHex(tx.rootPointer),
        nullifier: tx.nullifier.map(x => toHex(x)),
        utxoHashes: tx.utxoHashes.map(x => toHex(x)),
        delta: toHex(tx.delta),
        txExternalFields: {
            owner: stringifyAddress(tx.txExternalFields.owner),
            message: [
                {
                    data: tx.txExternalFields.message[0].data.map(x => toHex(x)),
                },
                {
                    data: tx.txExternalFields.message[1].data.map(x => toHex(x)),
                }
            ]
        },
        proof: {
            data: tx.proof.data.map(x => toHex(x))
        }
    };
}

export function bigintifyUtxoState(state: MyUtxoState<string>): MyUtxoState<bigint> {
    const mt: IMerkleTree = MT.fromObject(state.merkleTreeState);

    return {
        utxoList: state.utxoList.map(bigintifyUtxo),
        nullifiers: state.nullifiers.map(BigInt),
        lastBlockNumber: state.lastBlockNumber,
        merkleTreeState: {
            height: mt.height,
            length: mt.length,
            _merkleState: mt._merkleState
        }
    }
}

export function stringifyUtxoState(state: MyUtxoState<bigint>): MyUtxoState<string> {
    const mt: IMerkleTree = MT.fromObject(state.merkleTreeState);

    return {
        utxoList: state.utxoList.map(stringifyUtxo),
        nullifiers: state.nullifiers.map(String),
        lastBlockNumber: state.lastBlockNumber,
        merkleTreeState: mt.toObject()
    };
}

export function bigintifyUtxo(utxo: Utxo<string>): Utxo<bigint> {
    return {
        amount: BigInt(utxo.amount),
        token: BigInt(utxo.token),
        pubkey: BigInt(utxo.pubkey),
        mp_sibling: utxo.mp_sibling ? utxo.mp_sibling.map(BigInt) : [],
        blinding: utxo.blinding ? BigInt(utxo.blinding) : undefined,
        blockNumber: utxo.blockNumber,
        mp_path: utxo.mp_path
    };
}

export function stringifyUtxo(utxo: Utxo<bigint>): Utxo<string> {
    return {
        amount: utxo.amount.toString(),
        token: stringifyAddress(utxo.token),
        pubkey: utxo.pubkey.toString(),
        mp_sibling: utxo.mp_sibling ? utxo.mp_sibling.map(String) : [],
        blinding: utxo.blinding ? utxo.blinding.toString() : undefined,
        blockNumber: utxo.blockNumber,
        mp_path: utxo.mp_path
    };
}

export function sortHistory(a: HistoryItem, b: HistoryItem) {
    const diff = b.blockNumber - a.blockNumber;
    if (diff < 0n) {
        return -1
    } else if (diff > 0n) {
        return 1;
    } else {
        return 0
    }
}

export function sortUtxo(a: Utxo<bigint>, b: Utxo<bigint>): number {
    const diff = b.amount - a.amount;
    if (diff < 0n) {
        return -1
    } else if (diff > 0n) {
        return 1;
    } else {
        return 0
    }
}

export function findDuplicates<T>(arr: T[]): T[] {
    let sortedArr = arr.slice().sort();
    let results = [];
    for (let i = 0; i < sortedArr.length - 1; i++) {
        if (sortedArr[i + 1] == sortedArr[i]) {
            results.push(sortedArr[i]);
        }
    }
    return results;
}

export function stringifyAddress(token: bigint): string {
    if (token === 0n) {
        return "0x0000000000000000000000000000000000000000";
    }
    return toHex(token);
}


export async function getProof(transactionJson: any, inputs: any, proverKey: any): Promise<bigint[]> {
    const circuit = new snarkjs.Circuit(transactionJson);
    const witness = circuit.calculateWitness(inputs);

    const bn128 = await buildBn128();
    const proof = unstringifyBigInts(await bn128.groth16GenProof(buildwitness(witness), proverKey));
    return linearize_proof(proof);
}

export function unstringifyVk(vk: any): any {
    return unstringifyBigInts(vk);
}

export function unLinearizeProof(proof: bigint[]) {
    return {
        pi_a: [
            proof[0],
            proof[1],
        ],
        pi_b: [
            [
                proof[3],
                proof[2]
            ],
            [
                proof[5],
                proof[4]
            ],
        ],
        pi_c: [
            proof[6],
            proof[7],
        ]
    };
}

export async function verifyProof(proof: bigint[], publicSignals: bigint[], verifierKey: any): Promise<boolean> {
    const bn128 = await buildBn128();
    return await bn128.groth16Verify(verifierKey, publicSignals, unLinearizeProof(proof));
}

export function getKeyPair(mnemonic: string): KeyPair {
    const privateKey = HdWallet.Privkey(mnemonic, zrpPath).k;
    return {
        privateKey: privateKey,
        publicKey: get_pubkey(privateKey)
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

export function copyMyUtxoState(src: MyUtxoState<bigint>): MyUtxoState<bigint> {
    return {
        ...src,
        merkleTreeState: copyMerkleTreeState(src.merkleTreeState),
        utxoList: src.utxoList.map(x => {
            // @ts-ignore
            return { ...x }
        }),
        nullifiers: [...src.nullifiers],
    }
}

export function copyMerkleTreeState(src: MerkleTreeState<bigint>): MerkleTreeState<bigint> {
    return {
        _merkleState: src._merkleState.map(x => [...x]),
        height: src.height,
        length: src.length
    }
}
