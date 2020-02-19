import { gasLessCall, getCallData, getEvents, hash, toHex, Web3Ethereum } from '../ethereum';
import * as zeroPoolAbi from './zeropool.abi.json';
import { Contract } from 'web3-eth-contract';
import { TxExternalFieldsStructure, TxStructure } from "./eth-structures";
import { AbiItem } from 'web3-utils';
import { Block, BlockItem, Deposit, DepositEvent, PayNote } from "./zeropool-contract.dto";

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
      await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, 0, data);

    return this.web3Ethereum.sendTransaction(signedTransaction);
  };

  async getDepositEvents(): Promise<DepositEvent[]> {
    const events = await getEvents(this.instance, 'Deposit');

    const transactions = await events.map((event) => {
      const txs = events.map(event => this.web3Ethereum.getTransaction(event.transactionHash));
      return Promise.all(txs);
    });

    return transactions.map(tx => {
      const depositCallData = this.decodeDeposit(tx.input);
      return {
        params: depositCallData,
        owner: tx.from,
        blockNumber: tx.blockNumber
      }
    });
  }

  async publishBlockEvents() {
    const events = await getEvents(this.instance, 'NewBlockPack');

    const transactions = await events.map((event) => {
      const txs = events.map(event => this.web3Ethereum.getTransaction(event.transactionHash));
      return Promise.all(txs);
    });

    return transactions.map(tx => {
      return {
        BlockItems: this.decodePublishedBlocks(tx.input).BlockItems,
        relayer: tx.from,
        blocknumber: tx.blockNumber
      }
    });
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

  getDepositTxNum({ token, amount, txhash, owner, blocknumber }) {
    const encodedData = this.web3Ethereum.encodeParameters(
      ['address', 'address', 'uint256', 'uint256', 'bytes32'],
      [owner, token, amount, blocknumber, txhash]
    );
    const h = hash(encodedData);
    return gasLessCall(this.instance, 'deposit_state', owner, [h]);
  }

  getRollupTxNum() {
    return gasLessCall(this.instance, 'rollup_tx_num', '0x0000000000000000000000000000000000000000', []);
  }

  encodeTxExternalFields(owner, encryptedUTXOs) {
    return this.web3Ethereum.encodeParameter(
      {
        "TxExternalFields": TxExternalFieldsStructure
      },
      {
        "owner": owner.substring(2),
        "Message": [
          {
            "data": encryptedUTXOs[0].map(x => x.toString()),
          },
          {
            "data": encryptedUTXOs[1].map(x => x.toString()),
          },
        ]
      }
    );
  }

  encodeTx({ rootptr, nullifier, utxo, token, delta, TxExternalFields, proof }) {
    return this.web3Ethereum.encodeParameter(
      {
        "Tx": TxStructure
      },
      {
        "rootptr": rootptr.toString(),
        "nullifier": nullifier.map(x => x.toString()),
        "utxo": utxo.map(x => x.toString()),
        "token": token.toString(),
        "delta": delta.toString(),
        "TxExternalFields": {
          "owner": TxExternalFields.owner,
          "Message": [
            {
              "data": TxExternalFields.Message[0].map(x => x.toString()),
            },
            {
              "data": TxExternalFields.Message[1].map(x => x.toString()),
            },
          ]
        },
        "proof": proof.map(x => x.toString())
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

