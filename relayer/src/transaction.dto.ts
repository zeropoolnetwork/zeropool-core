import { ApiProperty } from '@nestjs/swagger'
import { Transaction } from "web3-core";

export class Proof {

    @ApiProperty()
    data: string[]
}

export class Message {

    @ApiProperty()
    data: string[]
}

export class TxExternalFields {

    @ApiProperty()
    owner: string;

    @ApiProperty()
    message: Message[];
}


export class Tx {

    @ApiProperty()
    rootPointer: string;

    @ApiProperty()
    nullifier: string[];

    @ApiProperty()
    utxoHashes: string[];

    @ApiProperty()
    token: string;

    @ApiProperty()
    delta: string;

    @ApiProperty()
    txExternalFields: TxExternalFields;

    @ApiProperty()
    proof: Proof;
}

export class GasDonationRequest {
    @ApiProperty()
    gasTx: Tx;

    @ApiProperty()
    donationHash: string;
}


export class TransactionRequest {
    @ApiProperty()
    depositBlockNumber: string;

    @ApiProperty()
    tx: Tx;

    @ApiProperty()
    gasTx: Tx;
}

export type RelayerAddressResponse = {
    address: string
}

export type TransactionResponse = {
    transactionHash: string
} | Transaction
