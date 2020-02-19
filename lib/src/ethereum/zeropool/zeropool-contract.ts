import { gasLessCall, getCallData, getEvents, hash, toHex, Web3Ethereum } from '../ethereum';
import * as zeroPoolAbi from './zeropool.abi.json';
import { Contract, EventData } from 'web3-eth-contract';
import { TxExternalFieldsStructure, TxStructure } from "./eth-structures";
import { AbiItem } from 'web3-utils';
import {
  Block,
  BlockItem,
  Deposit,
  DepositEvent,
  PayNote,
  PublishBlockEvent,
  Tx,
  TxExternalFields
} from "./zeropool-contract.dto";
import { Transaction } from 'web3-core';

export class ZeroPoolContract {

  public readonly web3Ethereum: Web3Ethereum;

  private readonly contractAddress: string;
  private readonly privateKey: string;
  private readonly instance: Contract;

  constructor(
    contractAddress: string,
    privateKey: string,
    connectionString: string = 'http://127.0.0.1:8545'
  ) {
    this.contractAddress = contractAddress;
    this.privateKey = privateKey;
    this.web3Ethereum = new Web3Ethereum(connectionString);
    this.instance = this.web3Ethereum.createInstance(zeroPoolAbi as AbiItem[], contractAddress);
  }

  async deposit(deposit: Deposit): Promise<string> {
    const params = [
      deposit.token,
      toHex(deposit.amount),
      deposit.txHash
    ];

    const data = getCallData(this.instance, 'deposit', params);

    const signedTransaction =
      // @ts-ignore
      await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, deposit.amount, data);

    return this.web3Ethereum.sendTransaction(signedTransaction);
  };

  async cancelDeposit(payNote: PayNote): Promise<string> {
    const params = [[
      [
        payNote.utxo.owner,
        payNote.utxo.token,
        toHex(payNote.utxo.amount)
      ],
      toHex(payNote.blockNumber),
      payNote.txHash
    ]];

    const data = getCallData(this.instance, 'depositCancel', params);

    const signedTransaction =
      // @ts-ignore
      await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, 0, data);

    return this.web3Ethereum.sendTransaction(signedTransaction);
  };

  async withdraw(payNote: PayNote): Promise<string> {
    const params = [[
      [
        payNote.utxo.owner,
        payNote.utxo.token,
        toHex(payNote.utxo.amount)
      ],
      toHex(payNote.blockNumber),
      payNote.txHash
    ]];

    const data = getCallData(this.instance, 'withdraw', params);

    const signedTransaction =
      // @ts-ignore
      await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, 0, data);

    return this.web3Ethereum.sendTransaction(signedTransaction);
  };

  async publishBlock(
    blocks: BlockItem<string>[],
    rollupCurrentBlockNumber: number,
    blockNumberExpires: number
  ): Promise<string> {

    const params = [
      blocks.map(packBlockItem),
      toHex(rollupCurrentBlockNumber),
      toHex(blockNumberExpires)
    ];

    const data = getCallData(this.instance, 'publishBlock', params);

    const signedTransaction =
      // @ts-ignore
      await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, 0, data);

    return this.web3Ethereum.sendTransaction(signedTransaction);
  };

  async getDepositEvents(): Promise<DepositEvent[]> {
    const events = await getEvents(this.instance, 'Deposit');

    const transactions$: Promise<Transaction>[] = events.map((e: EventData) => {
      return this.web3Ethereum.getTransaction(e.transactionHash);
    });

    const transactions: Transaction[] = await Promise.all<Transaction>(transactions$);

    return transactions.map(
      (tx: Transaction): DepositEvent => {
        const depositCallData = this.decodeDeposit(tx.input);
        return {
          params: depositCallData,
          owner: tx.from,
          blockNumber: tx.blockNumber as number
        }
      }
    );
  }

  async publishBlockEvents(): Promise<PublishBlockEvent[]> {
    const events = await getEvents(this.instance, 'NewBlockPack');

    const transactions$: Promise<Transaction>[] = events.map((e: EventData) => {
      return this.web3Ethereum.getTransaction(e.transactionHash);
    });

    const transactions: Transaction[] = await Promise.all<Transaction>(transactions$);

    return transactions.map(
      (tx: Transaction): PublishBlockEvent => {
        const publishBlockCallData = this.decodePublishedBlocks(tx.input);
        return {
          params: publishBlockCallData,
          owner: tx.from,
          blockNumber: tx.blockNumber as number
        }
      }
    );
  }

  decodeDeposit(hex: string): Deposit {
    const decodedParameters = this.web3Ethereum.decodeParameters(
      ['address', 'uint256', 'bytes32'],
      cutFunctionSignature(hex)
    );

    return {
      token: decodedParameters['0'],
      amount: decodedParameters['1'],
      txHash: decodedParameters['2']
    }
  }

  decodePublishedBlocks(hex: string): Block<string> {
    const BlockItem = {
      "Tx": TxStructure,
      "new_root": 'uint256',
      "deposit_blocknumber": 'uint256'
    };

    const decodedParameters = this.web3Ethereum.decodeParameters(
      [{ "BlockItem[]": BlockItem }, 'uint', 'uint'],
      cutFunctionSignature(hex)
    );

    return {
      BlockItems: decodedParameters['0'],
      rollupCurrentBlockNumber: decodedParameters['1'],
      blockNumberExpires: decodedParameters['2']
    }
  }

  getDepositTxNum(payNote: PayNote): Promise<string> {
    const encodedData = this.web3Ethereum.encodeParameters(
      ['address', 'address', 'uint256', 'uint256', 'bytes32'],
      [payNote.utxo.owner, payNote.utxo.token, payNote.utxo.amount, payNote.blockNumber, payNote.txHash]
    );
    const dataHash = hash(encodedData);
    return gasLessCall(this.instance, 'deposit_state', [dataHash]);
  }

  getRollupTxNum(): Promise<string> {
    return gasLessCall(this.instance, 'rollup_tx_num', []);
  }

  encodeTxExternalFields(txExternalFields: TxExternalFields<BigInt>): string {
    return this.web3Ethereum.encodeParameter(
      {
        "TxExternalFields": TxExternalFieldsStructure
      },
      {
        "owner": txExternalFields.owner.substring(2),
        "Message": [
          {
            "data": txExternalFields.message[0].data.map(x => x.toString()),
          },
          {
            "data": txExternalFields.message[1].data.map(x => x.toString()),
          },
        ]
      }
    );
  }

  encodeTx(tx: Tx<BigInt>): string {
    return this.web3Ethereum.encodeParameter(
      {
        "Tx": TxStructure
      },
      {
        "rootptr": tx.rootPointer.toString(),
        "nullifier": tx.nullifier.map(x => x.toString()),
        "utxo": tx.utxoHashes.map(x => x.toString()),
        "token": tx.token.toString(),
        "delta": tx.delta.toString(),
        "TxExternalFields": {
          "owner": tx.txExternalFields.owner,
          "Message": [
            {
              "data": tx.txExternalFields.message[0].data.map(x => x.toString()),
            },
            {
              "data": tx.txExternalFields.message[1].data.map(x => x.toString())
            }
          ]
        },
        "proof": tx.proof.data.map(x => x.toString())
      }
    )
  }

}

function cutFunctionSignature(hex: string): string {
  if (hex.indexOf('0x') === 0) {
    return hex.substring(11);
  }
  return hex.substring(8);
}

function packBlockItem(blockItem: BlockItem<string>): any[] {
  const Proof = [blockItem.tx.proof];

  const Message = [
    [blockItem.tx.txExternalFields.message[0]],
    [blockItem.tx.txExternalFields.message[1]],
  ];

  const TxExternalFields = [
    blockItem.tx.txExternalFields.owner,
    Message
  ];

  const Tx = [
    blockItem.tx.rootPointer,
    blockItem.tx.nullifier,
    blockItem.tx.utxoHashes,
    blockItem.tx.token,
    blockItem.tx.delta,
    TxExternalFields,
    Proof
  ];

  return [Tx, blockItem.newRoot, blockItem.depositBlockNumber];
}

