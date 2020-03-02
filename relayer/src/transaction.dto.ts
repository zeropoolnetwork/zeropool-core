import { ApiProperty } from '@nestjs/swagger'

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

// export class BlockItem {
//   @ApiProperty()
//   tx: Tx;
//
//   @ApiProperty()
//   newRoot: string;
//
//   @ApiProperty()
//   depositBlockNumber: string;
// }


export class GasDonationDto {
  @ApiProperty()
  gasTx: Tx;

  @ApiProperty()
  donationHash: string;
}


export class TransactionDto {
  @ApiProperty()
  depositBlockNumber: string;

  @ApiProperty()
  tx: Tx;

  @ApiProperty()
  gasTx: Tx;
}

//
// // https://github.com/sidorares/json-bigint
// export class BlockItemDto {
//
//   @ApiProperty()
//   deposit_blocknumber: string;
//
//   @ApiProperty({
//     description: 'Array of BigInt ( 8 elements long )'
//   })
//   proof: Array<string>;    // 8
//
//   @ApiProperty({
//     description: 'Array of BigInt ( 4 elements long )'
//   })
//   message1: Array<string>;
//
//   @ApiProperty({
//     description: 'Array of BigInt ( 4 elements long )'
//   })
//   message2: Array<string>;
//
//   @ApiProperty({
//     description: 'Ethereum address of owner, example: 0x5c526bc400c619Ca631619F52C58545ad56a0F19'
//   })
//   owner: string;
//
//   @ApiProperty({
//     description: 'Asset address, for ETH 0x0000000000000000000000000000000000000000'
//   })
//   token: string;
//
//   @ApiProperty({ description: 'Array of BigInt ( 2 elements long )' })
//   utxo: Array<string>;
//
//   @ApiProperty({ description: 'Array of BigInt ( 2 elements long )' })
//   nullifier: Array<string>;
//
//   @ApiProperty()
//   rootptr: string; // TODO: check type with Kirilnpm s
//
//   @ApiProperty({ description: 'BigInt' })
//   new_root: string; // BigInt
// }
