import { Injectable } from '@nestjs/common';
import { Tx } from './transaction.dto';
import { gasZp, zp } from './zeroPool';
import { MemoryStorage } from './storage/memoryStorage';
import { handleBlock, initialScan, synced } from './blockScanner/blockScanner';
import { Block, BlockItem, IMerkleTree, MerkleTree, ZeroPoolNetwork } from 'zeropool-lib';
import { IStorage } from './storage/IStorage';

const BN128_R = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

export const storage = new MemoryStorage();
export const gasStorage = new MemoryStorage();

// const contractVersion = zp.ZeroPool.getContractVersion();

@Injectable()
export class AppService {

  constructor() {
    initialScan(storage, zp);
    initialScan(gasStorage, gasZp);
  }

  async publishGasDonation(gasTx: Tx, donationHash: string): Promise<any> {
    const ethTx = await zp.ZeroPool.web3Ethereum.getTransaction(donationHash);
    if (!ethTx) {
      throw new Error('transaction not found');
    }
    if (BigInt(ethTx.value) !== BigInt(gasTx.delta)) {
      throw new Error('tx value !== zp tx delta');
    }
    return this.publishBlock(gasTx, '0', gasZp, gasStorage);
  }

  async publishTransaction(
    tx: Tx,
    depositBlockNumber: string,
    gasTx: Tx,
  ): Promise<any> {

    if (BN128_R - BigInt(gasTx.delta) < 320n * (10n ** 9n)) {
      throw new Error('not enough gas');
    }

    const [_, txData] = await Promise.all([
      this.publishBlock(gasTx, '0', gasZp, gasStorage),
      this.publishBlock(tx, depositBlockNumber, zp, storage),
    ]);

    return txData;
  }

  private async publishBlock(
    tx: Tx,
    depositBlockNumber: string,
    localZp: ZeroPoolNetwork,
    storage: IStorage,
  ): Promise<any> {

    if (synced.filter(x => !x).length !== 0 || synced.length < 2) {
      throw new Error('relayer not synced');
    }

    const currentBlockNumber = await localZp.ZeroPool.web3Ethereum.getBlockNumber();
    const blockNumberExpires = currentBlockNumber + 500;

    const rollupCurTxNum = await localZp.ZeroPool.getRollupTxNum();
    //const version = await zp.ZeroPool.getContractVersion();
    const version = 1;

    const mt = this.copyMerkleTree(storage.utxoTree);
    mt.push(BigInt(tx.utxoHashes[0]));
    mt.push(BigInt(tx.utxoHashes[1]));
    mt.pushZeros(510);

    const blockItem: BlockItem<string> = {
      tx,
      depositBlockNumber,
      newRoot: mt.root.toString(),
    };

    const block: Block<string> = {
      BlockItems: [blockItem],
      rollupCurrentBlockNumber: +rollupCurTxNum >> 8,
      blockNumberExpires: blockNumberExpires,
    };

    const ok = await handleBlock(block, storage);
    if (!ok) {
      throw new Error('cannot verify block');
    }

    console.log(
      block.BlockItems,
      block.rollupCurrentBlockNumber,
      block.blockNumberExpires,
      version,
    );

    const res = await localZp.ZeroPool.publishBlock(
      block.BlockItems,
      block.rollupCurrentBlockNumber,
      block.blockNumberExpires,
      version,
    );

    storage.addBlocks([block]);

    return res;
  }

  private copyMerkleTree(mt: IMerkleTree): IMerkleTree {
    const serialized = mt.serialize();
    const [height, _merkleState, length] = JSON.parse(serialized);
    const utxoMt = MerkleTree(32 + 1);
    utxoMt.height = height;
    utxoMt._merkleState = _merkleState;
    utxoMt.length = length;
    return utxoMt;
  }

}
