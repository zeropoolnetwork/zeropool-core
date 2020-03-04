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

      this.txPipe(this.tx$, zp, storage, this.publishBlock).subscribe((data: ProcessedTx) => {
        this.processedTx$.next(data);
      });

      this.txPipe(this.gasTx$, gasZp, gasStorage, this.publishGasBlock).subscribe((data: ProcessedTx) => {
        this.processedGasTx$.next(data);
      });

    });
  }

  private txPipe(
    txPipe: Subject<TxContract>,
    localZp: ZeroPoolNetwork,
    localStorage: IStorage,
    publishBlock: any
  ): Observable<ProcessedTx> {

    return txPipe.pipe(
      concatMap(
        (contract: TxContract) => {
          const txData = fromPromise(publishBlock(
            contract.tx, contract.depositBlockNumber, localZp, localStorage, this.copyMerkleTree
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

  async publishGasDonation(gasTx: Tx, donationHash: string): Promise<any> {
    const ethTx = await zp.ZeroPool.web3Ethereum.getTransaction(donationHash);
    if (!ethTx) {
      throw new Error('transaction not found');
    }
    if (BigInt(ethTx.value) !== BigInt(gasTx.delta)) {
      throw new Error('tx value !== zp tx delta');
    }
    return this.publishBlock(gasTx, '0', gasZp, gasStorage, this.copyMerkleTree);
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
    copyMerkleTree
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
    );

    storage.addBlocks([block]);

    return res;
  }

  private async publishGasBlock(
    tx: Tx,
    depositBlockNumber: string,
    localZp: ZeroPoolNetwork,
    storage: IStorage,
    copyMerkleTree
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

    // const ok = await handleBlock(block, storage);
    // if (!ok) {
    //   throw new Error('cannot verify block');
    // }

    const res = await localZp.ZeroPool.publishBlock(
      block.BlockItems,
      block.rollupCurrentBlockNumber,
      block.blockNumberExpires,
      version,
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
