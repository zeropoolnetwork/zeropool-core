import { decryptUtxo, encryptUtxo, getKeyPair, getProof, KeyPair, Utxo } from "./utils";

import { getEthereumAddress, hash, toHex } from './ethereum/ethereum';
import ZeroPoolContract from './ethereum/zeropool/zeropool-contract';
// @ts-ignore todo: download it from npm package
import { nullifier, transfer_compute, utxo } from '../../circom/src/inputs';
// @ts-ignore todo: download it from npm package
import { MerkleTree } from '../../circom/src/merkletree';
import { ContractUtxos, DepositHistoryItem, UtxoPair } from "./zero-pool-network.dto";
import {
  BlockItem,
  DepositEvent,
  Message,
  PayNote,
  PublishBlockEvent,
  Tx,
  TxExternalFields
} from "./ethereum/zeropool/zeropool-contract.dto";
import { Transaction } from "web3-core";

class ZeroPoolNetwork {

  private readonly transactionJson: any;
  private readonly proverKey: any;

  public readonly ethAddress: string;
  public readonly contractAddress: string;
  private readonly zpKeyPair: KeyPair;

  public readonly ZeroPool: ZeroPoolContract;

  constructor(
    contractAddress: string,
    ethPrivateKey: string,
    zpMnemonic: string,
    transactionJson: any,
    proverKey: any,
    connectionString: string = 'http://127.0.0.1:8545'
  ) {

    this.transactionJson = transactionJson;
    this.proverKey = proverKey;
    this.ethAddress = getEthereumAddress(ethPrivateKey);
    this.contractAddress = contractAddress;
    this.zpKeyPair = getKeyPair(zpMnemonic);
    this.ZeroPool = new ZeroPoolContract(contractAddress, ethPrivateKey, connectionString);
  }

  async deposit(token: string, amount: number) {
    const [
      blockItem,
      txHash
    ] = await this.prepareBlockItem(
      token,
      BigInt(amount),
      [],
      [utxo(BigInt(token), BigInt(amount), this.zpKeyPair.publicKey)]
    );

    const transactionDetails: Transaction = await this.ZeroPool.deposit({
      token,
      amount,
      txHash
    });

    blockItem.depositBlockNumber = toHex(transactionDetails.blockNumber as number);

    return [
      blockItem,
      txHash
    ];
  }

  async transfer(token: string, toPubKey: string, amount: number): Promise<[BlockItem<string>, string]> {
    const utxoPair = await this.calculateUtxo(BigInt(token), BigInt(toPubKey), BigInt(amount));
    if (utxoPair instanceof Error) {
      throw utxoPair;
    }

    const utxoZeroDelta = 0n;
    return this.prepareBlockItem(
      token,
      utxoZeroDelta,
      utxoPair.utxoIn,
      utxoPair.utxoOut
    );
  }

  async prepareWithdraw(token: string, numInputs: number): Promise<[BlockItem<string>, string]> {
    const utxos: Utxo[] = await this.myUtxos();
    if (utxos.length < numInputs) {
      throw new Error('not enough utxos');
    }
    const utxoIn = utxos.slice(0, numInputs);
    const utxoDelta: bigint = utxoIn.reduce((a, b) => {
      a += b.amount;
      return a;
    }, 0n);

    return this.prepareBlockItem(
      token,
      utxoDelta * -1n,
      utxoIn,
      []
    );
  }

  depositCancel(payNote: PayNote) {
    return this.ZeroPool.cancelDeposit(payNote);
  }

  withdraw(payNote: PayNote) {
    return this.ZeroPool.withdraw(payNote);
  }

  async calculateUtxo(token: bigint, toPubKey: bigint, sendingAmount: bigint): Promise<UtxoPair | Error> {
    const utxos: Utxo[] = await this.myUtxos();
    if (utxos.length === 0) {
      return new Error('you have not utxo');
    }

    const utxoIn = [];
    const utxoOut = [];
    let tmpAmount = 0n;
    for (let i = 0; i < utxos.length; i++) {
      if (i === 2) {
        return new Error('sending amount does not fit in two inputs');
      }
      tmpAmount += utxos[i].amount;
      utxoIn.push(utxos[i]);
      if (tmpAmount === sendingAmount) {
        utxoOut.push(utxo(token, sendingAmount, toPubKey));
        break;
      } else if (tmpAmount > sendingAmount) {
        utxoOut.push(utxo(token, sendingAmount, toPubKey));
        utxoOut.push(utxo(token, tmpAmount - sendingAmount, this.zpKeyPair.publicKey));
        break;
      }
    }

    return { utxoIn, utxoOut }
  }

  async publishBlockItems(blockItems: BlockItem<string>[], blockNumberExpires: number) {
    const rollupCurrentTxNum = await this.ZeroPool.getRollupTxNum();
    return this.ZeroPool.publishBlock(blockItems, +rollupCurrentTxNum >> 8, blockNumberExpires)
  }

  async myDeposits(): Promise<DepositHistoryItem[]> {
    const events = await this.ZeroPool.getDepositEvents();
    if (events.length === 0) {
      return [];
    }
    const myDeposits: DepositEvent[] = events.filter(event => event.owner === this.ethAddress);
    const txHums$: Promise<string>[] = myDeposits.map(
      (deposit: DepositEvent): Promise<string> => {

        const payNote: PayNote = {
          blockNumber: deposit.blockNumber,
          txHash: deposit.params.txHash,
          utxo: {
            amount: deposit.params.amount,
            owner: deposit.owner,
            token: deposit.params.token
          }
        };

        return this.ZeroPool.getDepositTxNum(payNote)
      }
    );

    const txHums: string[] = await Promise.all<string>(txHums$);
    return myDeposits.map((deposit: DepositEvent, i: number) => {
      if (txHums[i] === '115792089237316195423570985008687907853269984665640564039457584007913129639935') {
        return {
          deposit,
          isExists: true,
          isSpent: false,
          spentInTx: '0'
        }
      } else if (txHums[i] === '0') {
        return {
          deposit,
          isExists: false,
          isSpent: false,
          spentInTx: '0'
        }
      }

      return {
        deposit,
        isExists: true,
        isSpent: true,
        spentInTx: txHums[i]
      }
    });
  }

  async utxoRootHash() {
    const { utxoHashes } = await this.getUtxosFromContract();
    const mt = new MerkleTree(32 + 1);
    if (utxoHashes.length === 0) {
      return mt.root;
    }
    mt.pushMany(utxoHashes);
    return mt.root;
  }

  async prepareBlockItem(
    token: string,
    delta: bigint,
    utxoIn: Utxo[] = [],
    utxoOut: Utxo[] = []
  ): Promise<[BlockItem<string>, string]> {

    const { utxoHashes } = await this.getUtxosFromContract();
    const mt = new MerkleTree(32 + 1);
    if (utxoHashes.length !== 0) {
      mt.pushMany(utxoHashes);
    }

    const {
      inputs,
      add_utxo
    } = transfer_compute(mt.root, utxoIn, utxoOut, BigInt(token), delta, 0n, this.zpKeyPair.privateKey);

    const encryptedUTXOs = add_utxo.map((input: Utxo) => encryptUtxo(utxo.pubkey, input));

    const txExternalFields: TxExternalFields<bigint> = {
      owner: delta === 0n ? "0x0000000000000000000000000000000000000000" : this.ethAddress,
      message: [
        {
          data: encryptedUTXOs[0]
        },
        {
          data: encryptedUTXOs[1]
        }
      ]
    };

    const encodedTxExternalFields = this.ZeroPool.encodeTxExternalFields(txExternalFields);
    inputs.message_hash = hash(encodedTxExternalFields);

    const proof = await getProof(this.transactionJson, inputs, this.proverKey);
    const rootPointer
      = BigInt(utxoHashes.length / 2);

    mt.push(...inputs.utxo_out_hash);

    const tx: Tx<bigint> = {
      token,
      rootPointer,
      txExternalFields,
      nullifier: inputs.nullifier,
      utxoHashes: inputs.utxo_out_hash,
      delta: inputs.delta,
      proof: {
        data: proof
      }
    };

    const encodedTx = this.ZeroPool.encodeTx(tx);
    const txHash = hash(encodedTx);

    const blockItem: BlockItem<string> = {
      tx: normalizeTx(tx),
      depositBlockNumber: '0x0',
      newRoot: toHex(mt.root)
    };

    return [
      blockItem,
      txHash
    ];
  }

  async myHistory() {
    const {
      encryptedUtxos,
      utxoHashes,
      blockNumbers
    } = await this.getUtxosFromContract();

    const myUtxo: Utxo[] = [];
    encryptedUtxos.forEach((encryptedUtxo, i) => {
      try {
        const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, utxoHashes[i]);
        if (utxo.amount.toString() !== '0') {
          utxo.blockNumber = blockNumbers[i];
          myUtxo.push(utxo);
        }
      } catch (e) {
      }
    });

    const deposits = await this.myDeposits();

    // todo: fetch withdrawals
    return {
      utxos: myUtxo,
      deposits
    };
  }

  async getBalance() {
    // todo: think about BigNumber
    const balances: { [key: string]: number } = {};
    const utxos = await this.myUtxos();

    for (const utxo of utxos) {
      const asset = toHex(utxo.token);
      if (!balances[asset]) {
        balances[asset] = Number(utxo.amount);
        continue;
      }
      balances[asset] += Number(utxo.amount);
    }

    return balances;
  }

  async myUtxos(): Promise<Utxo[]> {
    const {
      encryptedUtxos,
      utxoHashes,
      blockNumbers,
      nullifiers
    } = await this.getUtxosFromContract();

    if (encryptedUtxos.length === 0) {
      return [];
    }

    const mt = new MerkleTree(32 + 1);
    mt.pushMany(utxoHashes);

    const myUtxo: Utxo[] = [];

    for (const [i, encryptedUtxo] of encryptedUtxos.entries()) {

      const p = new Promise((resolve) => {
        setTimeout(() => resolve(), 1);
      });
      await p;

      try {
        const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, utxoHashes[i]);
        if (utxo.amount.toString() !== '0') {
          utxo.mp_sibling = mt.proof(i);
          utxo.mp_path = i;
          utxo.blockNumber = blockNumbers[i];

          const utxoNullifier = nullifier(utxo, this.zpKeyPair.privateKey);
          if (!nullifiers.find(x => x === utxoNullifier)) {
            myUtxo.push(utxo);
          }
        }
      } catch (e) {
        // Here can't decode UTXO errors appears
        // console.log('Catch error:', e)
      }
    }

    return myUtxo.sort((a: Utxo, b: Utxo) => {
      const diff = b.amount - a.amount;
      if (diff < 0n) {
        return -1
      } else if (diff > 0n) {
        return 1;
      } else {
        return 0
      }
    });
  }

  async getUtxosFromContract(): Promise<ContractUtxos> {
    const blockEvents = await this.ZeroPool.publishBlockEvents();
    if (blockEvents.length === 0) {
      return { encryptedUtxos: [], utxoHashes: [], blockNumbers: [], nullifiers: [] };
    }

    const allEncryptedUtxos: bigint[][] = [];
    const allHashes: bigint[] = [];
    const inBlockNumber: number[] = [];
    const nullifiers: bigint[] = [];

    blockEvents.forEach((block: PublishBlockEvent) => {
      block.params.BlockItems.forEach((item: BlockItem<string>) => {
        nullifiers.push(...item.tx.nullifier.map(BigInt));

        const hashPack = item.tx.utxoHashes.map(BigInt);
        item.tx.txExternalFields.message.forEach((msg: Message<string>, i: number) => {
          allEncryptedUtxos.push(
            msg.data.map(BigInt)
          );
          allHashes.push(hashPack[i]);
          inBlockNumber.push(block.blockNumber);
        })
      });
    });

    return {
      nullifiers,
      encryptedUtxos: allEncryptedUtxos,
      utxoHashes: allHashes,
      blockNumbers: inBlockNumber
    };
  }

}

function normalizeTx(tx: Tx<bigint>): Tx<string> {
  return {
    token: toHex(tx.token),
    rootPointer: toHex(tx.rootPointer),
    nullifier: tx.nullifier.map(x => toHex(x)),
    utxoHashes: tx.utxoHashes.map(x => toHex(x)),
    delta: toHex(tx.delta),
    txExternalFields: {
      owner: tx.txExternalFields.owner,
      message: [
        {
          data: tx.txExternalFields.message[0].data.map(x => toHex(x)),
        },
        {
          data: tx.txExternalFields.message[1].data.map(x => toHex(x)),
        }
      ]
    },
    proof: {
      data: tx.proof.data.map(x => toHex(x))
    }
  };
}

export default ZeroPoolNetwork;

