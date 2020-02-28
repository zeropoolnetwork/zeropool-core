import { Block, BlockItem, Event } from "zeropool-lib";

export interface IStorage {
    lastBlockNumber: number;

    getBlockEvents(): Event<Block<string>>[];

    getBlockItems(): BlockItem<string>[];

    getNullifiers(): string[];

    addBlockEvents(newBlockEvents: Event<Block<string>>[]): void;
}
