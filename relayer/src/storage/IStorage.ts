import { Block, BlockItem, IMerkleTree } from 'zeropool-lib';

export interface IStorage {
  utxoTree: IMerkleTree;

  getBlockItems(): BlockItem<string>[];

  getNullifiers(): string[];

  addBlocks(blocks: Block<string>[]): void;

  getRootHashList(): string[];
}
