export type Event<T> = {
    params: T,
    owner: string,
    blockNumber: number
}

export type DepositEvent = Event<Deposit>;
export type PublishBlockEvent = Event<Block<string>>;
export type WithdrawEvent = Event<PayNote>;

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
    data: T[] // Snark Proof 8
}

export type Message<T> = {
    data: T[] // 4
}

export type TxExternalFields<T> = {
    owner: T,
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

export type BlockItem<T> = {
    tx: Tx<T>,
    newRoot: T,
    depositBlockNumber: T
}

export type BlockItemNote<T> = {
    proof: T[], // MerkleProof 8
    id: number,
    BlockItem: BlockItem<T>
}

export type Block<T> = {
    BlockItems: BlockItem<T>[],
    rollupCurrentBlockNumber: number
    blockNumberExpires: number
}

export type SmartContractBlockItemSchema = {
    new_root: string,
    deposit_blocknumber: string,
    Tx: {
        utxo: string[],
        rootptr: string,
        token: string,
        delta: string,
        nullifier: string[],
        proof: string[],
        TxExternalFields: {
            owner: string,
            Message: [{
                data: string[]
            }, {
                data: string[]
            }]
        }
    }
};
