import { IStorage } from "./IStorage";
import { Event, Block, BlockItem } from "zeropool-lib";

export class MemoryStorage implements IStorage {

    public lastBlockNumber = 0;

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

    addBlockEvents(blockEvents: Event<Block<string>>[]) {
        this.lastBlockNumber = blockEvents[blockEvents.length - 1].blockNumber;

        for (const event of blockEvents) {

            for (const item of event.params.BlockItems) {

                this.blockItems.push(item);
                this.nullifiers.push(...item.tx.nullifier);

            }

        }

        this.blockEventList = this.blockEventList.concat(blockEvents);
    }

}
