import { ApiProperty } from '@nestjs/swagger';

// https://github.com/sidorares/json-bigint
export class TransactionDto {

    @ApiProperty()
    deposit_blocknumber: number;

    @ApiProperty({
        description: "Array of BigInt ( 8 elements long )"
    })
    proof: Array<string>;    // 8

    @ApiProperty({
        description: "Array of BigInt ( 4 elements long )"
    })
    message1: Array<string>;

    @ApiProperty({
        description: "Array of BigInt ( 4 elements long )"
    })
    message2: Array<string>;

    @ApiProperty({
        description: "Ethereum address of owner, example: 0x5c526bc400c619Ca631619F52C58545ad56a0F19"
    })
    owner: string;

    @ApiProperty({
        description: "Asset address, for ETH 0x0000000000000000000000000000000000000000"
    })
    token: string;

    @ApiProperty({description: "Array of BigInt ( 2 elements long )"})
    utxo: Array<string>;

    @ApiProperty({description: "Array of BigInt ( 2 elements long )"})
    nullifier: Array<string>;

    @ApiProperty()
    rootptr: number // TODO: check type with Kirilnpm s

    @ApiProperty({description: "BigInt"})
    new_root: string; // BigInt
}
