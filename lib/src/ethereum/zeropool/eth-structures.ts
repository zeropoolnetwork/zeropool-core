type MessageEthStructure = [
    {
        data: 'uint256[4]',
    },
    {
        data: 'uint256[4]',
    }
];

export interface ITxExternalFieldsStructure {
    owner: 'address',
    Message: MessageEthStructure
}

export interface ITxStructure {
    rootptr: 'uint256',
    nullifier: 'uint256[2]',
    utxo: 'uint256[2]',
    token: 'address',
    delta: 'uint256',
    TxExternalFields: Readonly<ITxExternalFieldsStructure>,
    proof: 'uint256[8]'
}

export const TxExternalFieldsStructure: Readonly<ITxExternalFieldsStructure> = {
    owner: 'address',
    Message: [
        {
            data: 'uint256[4]',
        },
        {
            data: 'uint256[4]',
        }
    ]
};

export const TxStructure: Readonly<ITxStructure> = {
    rootptr: 'uint256',
    nullifier: 'uint256[2]',
    utxo: 'uint256[2]',
    token: 'address',
    delta: 'uint256',
    TxExternalFields: TxExternalFieldsStructure,
    proof: 'uint256[8]'
};
