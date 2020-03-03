export type FinishStep = 'finish';

export type MyUtxoStateSteps = 'finish-fetch-utxo-list-from-contact';

export type PrepareBlockItemStep = 'finish-get-proof';

export type PrepareDepositStep = MyUtxoStateSteps | PrepareBlockItemStep | FinishStep;


export type BalanceStep = MyUtxoStateSteps | 'calculate-balances' | FinishStep;

export type UtxoHistoryStep = 'fetch-utxo-list-from-contact' | 'find-own-utxo' | FinishStep;

export type TransferStep = MyUtxoStateSteps | PrepareBlockItemStep | 'calculate-in-out' | FinishStep;

export type PrepareWithdrawStep = MyUtxoStateSteps | PrepareBlockItemStep | FinishStep;

export type PrepareDepositProgressNotification = {
    step: PrepareDepositStep,
    processed?: number,
    outOf?: number
}

export type GetBalanceProgressNotification = {
    step: BalanceStep,
    processed?: number,
    outOf?: number
}

export type TransferProgressNotification = {
    step: TransferStep,
    processed?: number,
    outOf?: number
}

export type PrepareWithdrawProgressNotification = {
    step: PrepareWithdrawStep,
    processed?: number,
    outOf?: number
}

export type UtxoHistoryProgressNotification = {
    step: UtxoHistoryStep,
    processed?: number,
    outOf?: number
}


