export type ContractUtxos = {
  encryptedUtxos: bigint[][],
  utxoHashes: bigint[],
  blockNumbers: number[],
  nullifiers: bigint[]
}

export type DepositHistoryItem = {
  deposit
  isExists: boolean,
  isSpent: boolean,
  spentInTx: number
}
