import { Injectable } from '@nestjs/common';
import { BlockItemDto } from './transaction.dto';
import zp from './zeroPool';
import { MemoryStorage } from './storage/memoryStorage';
import { handleBlock, initialScan } from './blockScanner/blockScanner';
import { Block } from 'zeropool-lib';

const storage = new MemoryStorage();

@Injectable()
export class AppService {

  constructor() {
    initialScan(storage);
  }

  async publishBlock(blockItems: BlockItemDto[], blockNumberExpires: number): Promise<any> {

    const rollupCurTxNum = await zp.ZeroPool.getRollupTxNum();

    const block: Block<string> = {
      BlockItems: blockItems,
      rollupCurrentBlockNumber: +rollupCurTxNum >> 8,
      blockNumberExpires: blockNumberExpires,
    };

    const ok = await handleBlock(block, storage);
    if (!ok) {
      throw new Error('cannot verify block');
    }

    return zp.ZeroPool.publishBlock(
      block.BlockItems,
      block.rollupCurrentBlockNumber,
      block.blockNumberExpires,
    );
  }

  publishBlockItem(blockItem: BlockItemDto): Promise<any> {
    const blockNumberExpires = 500000000; // todo: fetch it from Blockchain
    return this.publishBlock([blockItem], blockNumberExpires);
  }

}
