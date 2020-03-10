// @ts-ignore
import { unstringifyBigInts } from 'snarkjs/src/stringifybigint';
// @ts-ignore
import {
    Action,
    HistoryItem,
    HistoryState,
    IMerkleTree,
    MerkleTreeState,
    MyUtxoState,
    Utxo
} from "./zero-pool-network.dto";
import { Tx } from "./ethereum/zeropool";
import { MerkleTree as MT } from './circom/merkletree';
import { BigNumber } from "bignumber.js";
import { tbn } from "./ethereum";


export const MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;
export const BN254_ORDER = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

export const WITHDRAW_ACTION = "withdraw";
export const DEPOSIT_ACTION = "deposit";
export const TRANSFER_ACTION = "transfer";

export function toHex(val: number | string | BigNumber | BigInt, padding = 0): string {
    if (typeof val === "string") {
        return "0x" + tbn(val).toString(16).padStart(padding, '0');
    }
    return "0x" + val.toString(16).padStart(padding, '0');
}

export function fromHex(hex: string): number {
    return parseInt(hex, 16);
}

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

export function stringifyUtxoHistoryState(state: HistoryState<bigint>): HistoryState<string> {

    return {
        utxoList: state.utxoList.map(stringifyUtxo),
        nullifiers: state.nullifiers.map(String),
        lastBlockNumber: state.lastBlockNumber,
        items: state.items
    };

}

export function bigintifyUtxoHistoryState(state: HistoryState<string>): HistoryState<bigint> {

    return {
        utxoList: state.utxoList.map(bigintifyUtxo),
        nullifiers: state.nullifiers.map(BigInt),
        lastBlockNumber: state.lastBlockNumber,
        items: state.items
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
    return toHex(token, 40);
}

export function unstringifyVk(vk: any): any {
    return unstringifyBigInts(vk);
}

export type UnlinearizedProof = {
    pi_a: bigint[],
    pi_b: bigint[][],
    pi_c: bigint[]
}

export function unLinearizeProof(proof: bigint[]): UnlinearizedProof {
    return {
        pi_a: [
            proof[0],
            proof[1],
            1n
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
            [1n, 0n]
        ],
        pi_c: [
            proof[6],
            proof[7],
            1n
        ]
    };
}

export function copyUtxoHistory(src: HistoryState<bigint>): HistoryState<bigint> {
    return {
        items: src.items.map(x => {
            // @ts-ignore
            return { ...x }
        }),
        lastBlockNumber: src.lastBlockNumber,
        nullifiers: [...src.nullifiers],
        utxoList: src.utxoList.map(x => {
            // @ts-ignore
            return { ...x }
        }),
    }
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

export function delay(time: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), time);
    });
}

export function flat<T>(arr: T[][]): T[] {
    return arr.reduce((acc: T[], val: T[]) => acc.concat(val), []);
}
