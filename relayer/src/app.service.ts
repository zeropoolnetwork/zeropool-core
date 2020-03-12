import { Injectable } from '@nestjs/common';
import { Tx } from './transaction.dto';
import { gasZp, zp } from './zeroPool';
import { MemoryStorage } from './storage/memoryStorage';
import { handleBlock, initialScan, synced } from './blockScanner/blockScanner';
import { Block, BlockItem, IMerkleTree, MerkleTree, ZeroPoolNetwork } from 'zeropool-lib';
import { IStorage } from './storage/IStorage';
import { combineLatest, Observable, of, Subject } from 'rxjs';
import { catchError, concatMap, filter, map, take } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { v4 as uuidv4 } from 'uuid';

const BN128_R = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

export const storage = new MemoryStorage();
export const gasStorage = new MemoryStorage();

// const contractVersion = zp.ZeroPool.getContractVersion();

type TxContract = {
    id: string,
    tx: Tx,
    depositBlockNumber: string
}

type ProcessedTx = {
    id: string
    txData?: string,
}

const generateTxId = () => {
    return uuidv4();
};

@Injectable()
export class AppService {

    private tx$ = new Subject<TxContract>();
    private processedTx$ = new Subject<ProcessedTx>();

    private gasTx$ = new Subject<TxContract>();
    private processedGasTx$ = new Subject<ProcessedTx>();

    constructor() {
        combineLatest([
            fromPromise(initialScan(storage, zp)),
            fromPromise(initialScan(gasStorage, gasZp)),
        ]).subscribe(() => {
            console.log('sync is done');

            this.txPipe(this.tx$, zp, storage).subscribe((data: ProcessedTx) => {
                this.processedTx$.next(data);
            });

            this.txPipe(this.gasTx$, gasZp, gasStorage, 1).subscribe((data: ProcessedTx) => {
                this.processedGasTx$.next(data);
            });

        });
    }

    private txPipe(
        txPipe: Subject<TxContract>,
        localZp: ZeroPoolNetwork,
        localStorage: IStorage,
        waitBlocks = 0,
    ): Observable<ProcessedTx> {

        return txPipe.pipe(
            concatMap(
                (contract: TxContract) => {
                    const txData = fromPromise(this.publishBlock(
                        contract.tx, contract.depositBlockNumber, localZp, localStorage, waitBlocks
                    )).pipe(
                        catchError((e) => {
                            console.log({
                                ...contract,
                                error: e.message,
                            });
                            return of(['error', e.message]);
                        }),
                    );

                    return combineLatest([
                        txData,
                        of(contract.id),
                    ]);
                },
            ),
            map(([txData, id]: [any, string]): ProcessedTx => {
                return {
                    id,
                    txData,
                };
            }),
        );
    }

    // todo: move it to db/redis
    private donationHashList = [];
    async publishGasDonation(gasTx: Tx, donationHash: string): Promise<any> {
        // todo: add storing hashes
        const [receipt, ethTx] = await Promise.all([
            zp.ZeroPool.web3Ethereum.getTransactionReceipt(donationHash),
            zp.ZeroPool.web3Ethereum.getTransaction(donationHash)
        ]);
        if (!receipt) {
            throw new Error('transaction not found');
        }
        if (BigInt(ethTx.value) !== BigInt(gasTx.delta)) {
            throw new Error('tx value !== zp tx delta');
        }
        if (ethTx.to !== zp.ZeroPool.web3Ethereum.ethAddress) {
            throw new Error('transaction not to relayer');
        }
        if (this.donationHashList.indexOf(donationHash) !== -1) {
            throw new Error('donation already exists');
        }
        this.donationHashList.push(donationHash);

        const id = generateTxId();

        this.gasTx$.next({
            tx: gasTx,
            depositBlockNumber: '0x0',
            id,
        });

        return this.processedGasTx$.pipe(
            filter((processedTx) => processedTx.id === id),
            map((processedTx: ProcessedTx) => {
                return processedTx.txData;
            }),
            take(1),
        );

    }

    publishTransaction(
        tx: Tx,
        depositBlockNumber: string,
        gasTx: Tx,
    ): Observable<any[]> {

        if (BN128_R - BigInt(gasTx.delta) < 320n * (10n ** 9n)) {
            throw new Error('not enough gas');
        }

        const id = generateTxId();

        this.tx$.next({ tx, id, depositBlockNumber });

        this.gasTx$.next({
            tx: gasTx,
            depositBlockNumber: '0x0',
            id,
        });

        const gasResult$ = this.processedGasTx$.pipe(
            filter((processedTx) => processedTx.id === id),
            map((processedTx: ProcessedTx) => {
                return processedTx.txData;
            }),
            take(1),
        );

        const result$ = this.processedTx$.pipe(
            filter((processedTx) => processedTx.id === id),
            map((processedTx: ProcessedTx) => {
                return processedTx.txData;
            }),
            take(1),
        );

        return combineLatest([result$, gasResult$]);
    }

    private async publishBlock(
        tx: Tx,
        depositBlockNumber: string,
        localZp: ZeroPoolNetwork,
        storage: IStorage,
        waitBlocks = 0
    ): Promise<any> {

        if (synced.filter(x => !x).length !== 0 || synced.length < 2) {
            throw new Error('relayer not synced');
        }

        const currentBlockNumber = await localZp.ZeroPool.web3Ethereum.getBlockNumber();
        const blockNumberExpires = currentBlockNumber + 500;

        const rollupCurTxNum = await localZp.ZeroPool.getRollupTxNum();
        //const version = await zp.ZeroPool.getContractVersion();
        const version = 1;

        const mt = this.copyMerkleTree(storage.utxoTree);
        mt.push(BigInt(tx.utxoHashes[0]));
        mt.push(BigInt(tx.utxoHashes[1]));
        mt.pushZeros(510);

        const blockItem: BlockItem<string> = {
            tx,
            depositBlockNumber,
            newRoot: mt.root.toString(),
        };

        const block: Block<string> = {
            BlockItems: [blockItem],
            rollupCurrentBlockNumber: +rollupCurTxNum >> 8,
            blockNumberExpires: blockNumberExpires,
        };

        const ok = await handleBlock(block, storage);
        if (!ok) {
            throw new Error('cannot verify block');
        }

        const res = await localZp.ZeroPool.publishBlock(
            block.BlockItems,
            block.rollupCurrentBlockNumber,
            block.blockNumberExpires,
            version,
            waitBlocks
        );

        storage.addBlocks([block]);

        return res;
    }

    private copyMerkleTree(mt: IMerkleTree): IMerkleTree {
        const serialized = mt.serialize();
        const [height, _merkleState, length] = JSON.parse(serialized);
        const utxoMt = MerkleTree(32 + 1);
        utxoMt.height = height;
        utxoMt._merkleState = _merkleState;
        utxoMt.length = length;
        return utxoMt;
    }

}
