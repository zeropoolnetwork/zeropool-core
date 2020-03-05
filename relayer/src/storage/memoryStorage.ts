import { IStorage } from './IStorage';
import { Block, BlockItem, MerkleTree } from 'zeropool-lib';


export class MemoryStorage implements IStorage {

  public utxoTree = MerkleTree(32 + 1);

  private blockItems: BlockItem<string>[] = [];
  private rootHashList: string[] = [];
  private nullifiers: string[] = [];

  getBlockItems(): BlockItem<string>[] {
    return this.blockItems;
  }

  getRootHashList(): string[] {
    return this.rootHashList;
  }

  getNullifiers(): string[] {
    return this.nullifiers;
  }

  addBlocks(blocks: Block<string>[]): void {
    for (const block of blocks) {

      for (const item of block.BlockItems) {

        this.utxoTree.push(BigInt(item.tx.utxoHashes[0]));
        this.utxoTree.push(BigInt(item.tx.utxoHashes[1]));

        this.blockItems.push(item);
        this.rootHashList.push(item.newRoot);
        this.nullifiers.push(...item.tx.nullifier);

      }

      this.utxoTree.pushZeros(512 - block.BlockItems.length * 2);

    }

  }

}
