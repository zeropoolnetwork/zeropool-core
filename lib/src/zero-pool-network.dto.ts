import { DepositEvent } from "./ethereum/zeropool/zeropool-contract.dto";
import { Utxo } from "./utils";

export type ContractUtxos = {
  encryptedUtxos: bigint[][],
  utxoHashes: bigint[],
  blockNumbers: number[],
  nullifiers: bigint[]
}

export type DepositHistoryItem = {
  deposit: DepositEvent,
  isExists: boolean,
  isSpent: boolean,
  spentInTx: string
}

export type UtxoPair = {
  utxoIn: Utxo[],
  utxoOut: Utxo[]
}
