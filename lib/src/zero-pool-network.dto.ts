import { DepositEvent } from "./ethereum/zeropool";

export interface IMerkleTree {
    _merkleState: bigint[][];
    height: number;
    length: number;
    root: bigint;

    push(leaf: bigint): void;

    proof(index: number): bigint[];

    pushMany(elements: bigint[]): void;

    pushZeros(n: number): void;

    serialize(): string;

    toObject(): MerkleTreeState<string>
}

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

export type MyUtxoState<T> = {
    merkleTreeState: MerkleTreeState<T>,
    lastBlockNumber: string | number,
    utxoList: Utxo<T>[],
    nullifiers: T[]
};

export type MerkleTreeState<T> = {
    height: number
    _merkleState: T[][]
    length: number
}

export type Action = 'deposit' | 'deposit_external' | 'deposit_cancel' |
    'withdraw' | 'withdraw_external' | 'withdraw_force' |
    'transfer';

export type ActionType = 'in' | 'out';

export type HistoryState<T> = {
    lastBlockNumber: string | number,
    items: HistoryItem[],
    nullifiers: T[],
    utxoList: Utxo<T>[]
}

export type HistoryItem = {
    action: Action,
    type: ActionType,
    amount: number,
    blockNumber: number
}

export type DepositHistoryItem = {
    deposit: DepositEvent,
    isExists: boolean,
    isSpent: boolean,
    spentInTx: string
}

export type ContractUtxos = {
    encryptedUtxoList: bigint[][][],
    utxoDeltaList: bigint[],
    utxoHashes: bigint[][],
    blockNumbers: number[],
    nullifiers: bigint[]
}

export type UtxoPair = {
    utxoIn: Utxo<bigint>[],
    utxoOut: Utxo<bigint>[]
}

export type HistoryAndBalances = {
    historyItems: HistoryItem[],
    balances: { [key: string]: number }
}
