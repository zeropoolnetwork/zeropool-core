import { Block, Tx, ZeroPoolNetwork } from 'zeropool-lib';
import { verifyTx } from './verifier';
import { IStorage } from '../storage/IStorage';

export let synced = [];

export async function initialScan(
    storage: IStorage,
    zp: ZeroPoolNetwork,
): Promise<void> {

    const blockEvents = await zp.ZeroPool.publishBlockEvents();

    for (const event of blockEvents) {
        // const ok = await handleBlock(event.params, storage);
        // console.log(ok);
        // if (!ok) {
        //   console.log(event.params)
        // }
        storage.addBlocks([event.params]);
    }

    synced.push(true);

}

export async function handleBlock(
    block: Block<string>,
    storage: IStorage,
): Promise<boolean> {

    const storageNullifiers = storage.getNullifiers();

    const nullifiers = [...storageNullifiers];

    const savedRootHashList = storage.getRootHashList();

    const rootHashList = [...savedRootHashList];
    const newRootHashList = block.BlockItems.map(x => x.newRoot);
    rootHashList.push(newRootHashList);

    for (const item of block.BlockItems) {

        const txRootHash = getRootHash(rootHashList, BigInt(item.tx.rootPointer));

        const okProof = await verifyTx(item.tx, txRootHash);

        if (!okProof) {
            console.log('bad proof');
            return false;
        }

        const okDoubleSpend = checkDoubleSpend(item.tx, nullifiers);

        if (!okDoubleSpend) {
            console.log('double spend');
            return false;
        }

        nullifiers.push(...item.tx.nullifier);
    }

    return true;
}

function getRootHash(rootHashList: string[][], rootPointer: bigint): string {
    if (rootHashList.length === 1) {
        // in case of we got the first block
        return '0xDE2890813A22F5DD1131E6EB966C6EA5D0A61340E03CE5B339435EEF7B08D8E';
    }

    const blockPointer = Number(rootPointer >> 8n);
    const blockItemInBlockPointer = Number(rootPointer % 256n) - 1;

    return rootHashList[Number(blockPointer)][Number(blockItemInBlockPointer)];
}

function checkDoubleSpend(tx: Tx<string>, allNullifiers: string[]): boolean {
    return !allNullifiers.find(x => x === tx.nullifier[0] || x === tx.nullifier[1]);
}
