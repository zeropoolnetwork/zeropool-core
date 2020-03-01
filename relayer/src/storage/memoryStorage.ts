import { IStorage } from './IStorage';
import { Block, BlockItem, Event, MerkleTree, bigintifyUtxo } from 'zeropool-lib';


export class MemoryStorage implements IStorage {

  public lastBlockNumber = 0;
  public utxoTree = MerkleTree(32+1);

  private blockEventList: Event<Block<string>>[] = [];
  private blockItems: BlockItem<string>[] = [];
  private nullifiers: string[] = [];

  getBlockEvents(): Event<Block<string>>[] {
    return this.blockEventList;
  }

  getBlockItems(): BlockItem<string>[] {
    return this.blockItems;
  }

  getNullifiers(): string[] {
    return this.nullifiers;
  }

  addBlockEvents(blockEvents: Event<Block<string>>[]): void {
    this.lastBlockNumber = blockEvents[blockEvents.length - 1].blockNumber;

    for (const event of blockEvents) {

      for (const item of event.params.BlockItems) {
        
        this.utxoTree.push(BigInt(item.tx.utxoHashes[0]));
        this.utxoTree.push(BigInt(item.tx.utxoHashes[1]));
        this.blockItems.push(item);
        this.nullifiers.push(...item.tx.nullifier);
      }

      this.utxoTree.pushZeros(512 - event.params.BlockItems.length*2);

    }

    this.blockEventList = this.blockEventList.concat(blockEvents);
  }


  addBlocks(blocks: Block<string>[]): void {
    for (const block of blocks) {

      for (const item of block.BlockItems) {

        this.blockItems.push(item);
        this.nullifiers.push(...item.tx.nullifier);

      }

    }

  }

}
