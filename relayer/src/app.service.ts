import { Injectable } from '@nestjs/common';
import * as prettyMilliseconds from 'pretty-ms';
import { Tx } from './transaction.dto';
import { gasZp, zp } from './zeroPool';
import { MemoryStorage } from './storage/memoryStorage';
import { handleBlock, initialScan, synced } from './blockScanner/blockScanner';
import { Block, BlockItem, IMerkleTree, MerkleTree, Tx as ZpTx, ZeroPoolNetwork } from 'zeropool-lib';
import { IStorage } from './storage/IStorage';
import { combineLatest, concat, Observable, of, Subject } from 'rxjs';
import { bufferTime, catchError, concatMap, delay, filter, map, mergeMap, take } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { v4 as uuidv4 } from 'uuid';
import { performance } from "perf_hooks";
import { AppConfig } from "./app.config";

const BN128_R = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

export const storage = new MemoryStorage('zp');
export const gasStorage = new MemoryStorage('gas');

// const contractVersion = zp.ZeroPool.getContractVersion();

type BlockItemDetails = {
    tx: ZpTx<string>,
    depositBlockNumber: string
}

type TxContract = {
    id: string,
    payload: BlockItemDetails,
}

type ProcessedTx = {
    id: string
    txData?: string,
    error?: string
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

        const t1 = performance.now();

        combineLatest([
            fromPromise(initialScan(storage, zp)),
            fromPromise(initialScan(gasStorage, gasZp)),
        ]).subscribe(() => {
            const t2 = performance.now();
            console.log(`sync is done in ${prettyMilliseconds(t2 - t1)}`);

            this.txPipe(this.tx$, zp, storage).subscribe((data: ProcessedTx[]) => {
                data.forEach((processedTx) => {
                    this.processedTx$.next(processedTx);
                })
            });

            this.txPipe(this.gasTx$, gasZp, gasStorage, 1).subscribe((data: ProcessedTx[]) => {
                data.forEach((processedTx) => {
                    this.processedGasTx$.next(processedTx);
                })
            });

        });
    }

    // todo: move it to db/redis
    private donationHashList = [];

    public publishGasDonation(gasTx: Tx, donationHash: string): Observable<any> {
        // todo: add storing hashes
        const transactionChecks = Promise.all([
            zp.ZeroPool.web3Ethereum.getTransactionReceipt(donationHash),
            zp.ZeroPool.web3Ethereum.getTransaction(donationHash)
        ]);

        return fromPromise(transactionChecks).pipe(
            mergeMap(([receipt, ethTx]) => {
                if (!receipt) {
                    throw new Error('transaction not found');
                }
                if (!receipt.status) {
                    throw new Error('transaction failed');
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
                    payload: {
                        depositBlockNumber: '0x0',
                        tx: packZpTx(gasTx)
                    }, id
                });

                return this.processedGasTx$.pipe(
                    filter((processedTx) => processedTx.id === id),
                    take(1),
                );
            }),
            take(1)
        );

    }

    public publishTransaction(
        tx: Tx,
        depositBlockNumber: string,
        gasTx: Tx,
    ): Observable<ProcessedTx[]> {

        if (BN128_R - BigInt(gasTx.delta) < 320n * (10n ** 9n)) {
            throw new Error('not enough gas');
        }

        const id = generateTxId();

        this.tx$.next({
            payload: {
                depositBlockNumber: depositBlockNumber,
                tx: packZpTx(tx)
            }, id
        });

        this.gasTx$.next({
            payload: {
                depositBlockNumber: '0x0',
                tx: packZpTx(gasTx)
            }, id
        });

        const gasResult$ = this.processedGasTx$.pipe(
            filter((processedTx) => processedTx.id === id),
            take(1),
        );

        const result$ = this.processedTx$.pipe(
            filter((processedTx) => processedTx.id === id),
            take(1),
        );

        return combineLatest([result$, gasResult$]).pipe(take(1));
    }

    private txPipe(
        txPipe: Subject<TxContract>,
        localZp: ZeroPoolNetwork,
        localStorage: IStorage,
        waitBlocks = 0,
    ): Observable<ProcessedTx[]> {

        return txPipe.pipe(
            bufferTime(AppConfig.txAggregationTime),
            filter((txs) => txs.length > 0),
            concatMap((contract: TxContract[]) => {
                console.log(
                    `${getCurrentDate()}: Received Transaction ${localStorage.storageName} Batch with ${contract.length} tx`
                );

                const chunkedContractList: TxContract[][] = splitArr(contract, AppConfig.maxBatchCapacity);

                const processedTxChunkList$: Observable<ProcessedTx[]>[] = chunkedContractList.map((contractChunk: TxContract[]) => {
                    const processedTx$ = this.handleTransactionContractList(
                        contractChunk,
                        localZp,
                        localStorage,
                        waitBlocks
                    );

                    if (chunkedContractList.length > 1) {
                        return processedTx$.pipe(delay(15000), take(1));
                    }
                    return processedTx$.pipe(take(1));
                });

                return concat(...processedTxChunkList$)
            }),
        );

    }

    private handleTransactionContractList(
        contract: TxContract[],
        localZp: ZeroPoolNetwork,
        localStorage: IStorage,
        waitBlocks = 0,
    ): Observable<ProcessedTx[]> {
        return of('').pipe(
            mergeMap(() => {
                return fromPromise(this.publishBlock(
                    contract.map(x => x.payload), localZp, localStorage, waitBlocks
                ))
            }),
            map((txData: any) => {
                return contract.map(x => {
                    return { txData, id: x.id };
                })
            }),
            catchError((e) => {
                console.log({
                    ...contract.map(x => x.payload),
                    error: e.message,
                });
                const processedTransactionList = contract.map(x => {
                    return { id: x.id, error: e.message || e }
                });
                return of(processedTransactionList);
            }),
            take(1)
        );
    }

    private async publishBlock(
        blockItemDetails: BlockItemDetails[],
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

        const mt = copyMerkleTree(storage.utxoTree);
        const blockItemList: BlockItem<string>[] = [];

        for (const details of blockItemDetails) {
            mt.push(BigInt(details.tx.utxoHashes[0]));
            mt.push(BigInt(details.tx.utxoHashes[1]));

            const blockItem: BlockItem<string> = {
                tx: details.tx,
                depositBlockNumber: details.depositBlockNumber,
                newRoot: mt.root.toString(),
            };

            blockItemList.push(blockItem);

        }

        mt.pushZeros(512 - blockItemDetails.length * 2);

        const block: Block<string> = {
            BlockItems: blockItemList,
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

}

function packZpTx(tx: Tx): ZpTx<string> {
    return {
        txExternalFields: tx.txExternalFields,
        delta: tx.delta,
        utxoHashes: tx.utxoHashes,
        token: tx.token,
        rootPointer: tx.rootPointer,
        proof: tx.proof,
        nullifier: tx.nullifier
    };
}

function copyMerkleTree(mt: IMerkleTree): IMerkleTree {
    const serialized = mt.serialize();
    const [height, _merkleState, length] = JSON.parse(serialized);
    const utxoMt = MerkleTree(32 + 1);
    utxoMt.height = height;
    utxoMt._merkleState = _merkleState;
    utxoMt.length = length;
    return utxoMt;
}

function getCurrentDate(): string {
    const today = new Date();
    const date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    return date + ' ' + time;
}

const splitArr = (arr: any[], chunkSize: number): any[][] => {
    const tmp = [];
    for (let i = 0, j = arr.length; i < j; i += chunkSize) {
        tmp.push(
            arr.slice(i, i + chunkSize)
        );
    }
    return tmp;
};

const linearizeArray = (arr: any[][]): any[] => {
    const arr2 = [];
    for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr[i].length; j++) {
            let k = i;
            arr2[k] = arr[i];
            k++;
        }
    }
    return arr2;
};
