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

export type Tx = {
    rootptr: BigInt
}
