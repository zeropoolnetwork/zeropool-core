import { Block, BlockItem, Event, IMerkleTree } from 'zeropool-lib';

export interface IStorage {
  lastBlockNumber: number;
  utxoTree: IMerkleTree;

  getBlockEvents(): Event<Block<string>>[];

  getBlockItems(): BlockItem<string>[];

  getNullifiers(): string[];

  addBlockEvents(newBlockEvents: Event<Block<string>>[]): void;

  addBlocks(blocks: Block<string>[]): void
}
