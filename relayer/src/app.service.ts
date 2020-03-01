import { Injectable } from '@nestjs/common';
import { BlockItem } from './transaction.dto';
import { gasZp, zp } from './zeroPool';
import { MemoryStorage } from './storage/memoryStorage';
import { handleBlock, initialScan, synced } from './blockScanner/blockScanner';
import { Block, ZeroPoolNetwork } from 'zeropool-lib';
import { IStorage } from './storage/IStorage';

const storage = new MemoryStorage();
const gasStorage = new MemoryStorage();

@Injectable()
export class AppService {

  constructor() {
    // initialScan(storage, zp);
    // initialScan(gasStorage, gasZp);
  }

  private async publishBlock(
    blockItems: BlockItem[],
    blockNumberExpires: number,
    zp: ZeroPoolNetwork,
    storage: IStorage,
  ): Promise<any> {

    // if(synced.filter(x => !x)) {
    //   throw new Error('relayer not synced');
    // }

    const rollupCurTxNum = await zp.ZeroPool.getRollupTxNum();

    const block: Block<string> = {
      BlockItems: blockItems,
      rollupCurrentBlockNumber: +rollupCurTxNum >> 8,
      blockNumberExpires: blockNumberExpires,
    };

    // const ok = await handleBlock(block, storage);
    // if (!ok) {
    //   throw new Error('cannot verify block');
    // }

    const tx = await zp.ZeroPool.publishBlock(
      block.BlockItems,
      block.rollupCurrentBlockNumber,
      block.blockNumberExpires,
    );

    storage.addBlocks([block]);

    return tx;
  }

  publishBlockItem(blockItem: BlockItem): Promise<any> {
    const blockNumberExpires = 500000000; // todo: fetch it from Blockchain
    return this.publishBlock(
      [blockItem],
      blockNumberExpires,
      zp,
      storage,
    );
  }

  publishGasBlockItem(blockItem: BlockItem): Promise<any> {
    const blockNumberExpires = 500000000; // todo: fetch it from Blockchain
    return this.publishBlock(
      [blockItem],
      blockNumberExpires,
      gasZp,
      gasStorage,
    );
  }

}
