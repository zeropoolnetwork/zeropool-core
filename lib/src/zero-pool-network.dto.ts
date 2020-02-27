import { DepositEvent } from "./ethereum/zeropool";
import { Utxo } from "./utils";

export interface IMerkleTree {
  _merkleState: any[];
  push: (leaf: bigint) => void;
  proof: (index: number) => Array<any>; // replace any with correct type
  root: bigint;
  pushMany: (elements: bigint[]) => void;
}

export type MyUtxoState<T> = {
  merkleTreeState: T[][],
  lastBlockNumber: string | number,
  utxoList: Utxo<T>[],
  nullifiers: T[]
};

export type Action = 'deposit' | 'deposit_external' | 'deposit_cancel' |
  'withdraw' | 'withdraw_external' | 'withdraw_force' |
  'transfer';

export type ActionType = 'in' | 'out';

export type HistoryState = {
  lastBlockNumber: string | number,
  items: HistoryItem[]
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
  encryptedUtxoList: bigint[][],
  utxoDeltaList: bigint[],
  utxoHashes: bigint[],
  blockNumbers: number[],
  nullifiers: bigint[]
}

export type UtxoPair = {
  utxoIn: Utxo<bigint>[],
  utxoOut: Utxo<bigint>[]
}
