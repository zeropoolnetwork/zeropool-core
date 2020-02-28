import zp from '../zeroPool';
import { Block, PublishBlockEvent, Tx } from 'zeropool-lib';
import { verifyTx } from './verifier';
import { IStorage } from '../storage/IStorage';

export async function initialScan(storage: IStorage): Promise<void> {

  const lastBlockNumber = storage.lastBlockNumber;

  const blockEvents = await zp.ZeroPool.publishBlockEvents(lastBlockNumber + 1);

  for (const event of blockEvents) {
    await handleBlock(event.params, storage);
    storage.addBlockEvents([event]);
  }

}

export async function handleBlock(
  block: Block<string>,
  storage: IStorage
): Promise<boolean> {

  const storageBlockItems = storage.getBlockItems();
  const storageNullifiers = storage.getNullifiers();

  const nullifiers = [...storageNullifiers];

  const lastBlockItemRootHash = storageBlockItems.length !== 0 ?
    storageBlockItems[storageBlockItems.length - 1].newRoot :
    '0xDE2890813A22F5DD1131E6EB966C6EA5D0A61340E03CE5B339435EEF7B08D8E';

  for (const [i, item] of block.BlockItems.entries()) {
    const lastRootHash = i !== 0 ?
      block.BlockItems[i - 1].newRoot :
      lastBlockItemRootHash;

    const okProof = await verifyTx(item.tx, lastRootHash);

    if (!okProof) {
      return false;
    }

    const okDoubleSpend = checkDoubleSpend(item.tx, nullifiers);

    if (!okDoubleSpend) {
      return false;
    }

    nullifiers.push(...item.tx.nullifier);
  }

  return true;
}

function checkDoubleSpend(tx: Tx<string>, allNullifiers: string[]): boolean {
  return !allNullifiers.find(x => x === tx.nullifier[0] || x === tx.nullifier[1]);
}
