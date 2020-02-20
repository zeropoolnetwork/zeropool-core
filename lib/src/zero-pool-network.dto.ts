import { Utxo } from "./utils";

export type ContractUtxos = {
  encryptedUtxos: BigInt[][],
  utxoHashes: BigInt[],
  blockNumbers: number[],
  nullifiers: BigInt[]
}
