export type StartFinishSteps = 'start' | 'finish';

export type MyUtxoStateSteps = 'fetch-utxo-list-from-contact' | 'find-spent-utxo' | 'find-own-utxo';

export type GetBalanceStep = MyUtxoStateSteps | 'calculate-balances' | StartFinishSteps;

export type PrepareBlockItemStep = 'transfer-compute' | 'get-proof' | 'get-last-root-pointer';

export type DepositStep = MyUtxoStateSteps | PrepareBlockItemStep | 'deposit-asset-to-contract' | StartFinishSteps;

export type TransferStep = MyUtxoStateSteps | PrepareBlockItemStep | 'calculate-in-out' | StartFinishSteps;

export type PrepareWithdrawStep = MyUtxoStateSteps | PrepareBlockItemStep | StartFinishSteps;

export type DepositProgressNotification = {
    step: DepositStep,
    processed?: number,
    outOf?: number
}

export type GetBalanceProgressNotification = {
    step: GetBalanceStep,
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


