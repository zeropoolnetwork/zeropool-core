export type Event<T> = {
  params: T,
  owner: string,
  blockNumber: number
}

export type DepositEvent = Event<Deposit>;
export type PublishBlockEvent = Event<Block<string>>;

export type Deposit = {
  token: string,
  amount: number,
  txHash: string
};

export type UTXO = {
  owner: string;
  token: string;
  amount: number;
}

export type PayNote = {
  utxo: UTXO,
  blockNumber: number,
  txHash: string
}

export type Proof<T> = {
  data: T[] // 8
}

export type Message<T> = {
  data: T[] // 4
}

export type TxExternalFields<T> = {
  owner: string,
  message: Message<T>[] // 2
}

export type Tx<T> = {
  rootPointer: T,
  nullifier: T[],  // 2
  utxoHashes: T[], // 2
  token: T,
  delta: T,
  txExternalFields: TxExternalFields<T>,
  proof: Proof<T>
}
export type BlockItem<T> = [{
  tx: Tx<T>,
  newRoot: T,
  depositBlockNumber: T
}]

export type Block<T> = {
  BlockItems: BlockItem<T>[],
  rollupCurrentBlockNumber: number
  blockNumberExpires: number
}
