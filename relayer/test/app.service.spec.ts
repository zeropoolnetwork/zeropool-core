import { expect } from 'chai';
import 'mocha';

import { Test } from '@nestjs/testing';
import { AppService } from '../src/app.service';
import { gasZp, zp } from './test-zeropool';
import { calculateUtxo, MerkleTreeFromObject, MerkleTreeState, Tx } from "zeropool-lib";
import { unstringifyBigInts } from 'snarkjs/src/stringifybigint';
import { combineLatest } from "rxjs";
import { AppConfig } from "../src/app.config";
import { performance } from "perf_hooks";
import * as prettyMilliseconds from "pretty-ms";

const ethToken = '0x0000000000000000000000000000000000000000';

describe('AppService', () => {
    let service: AppService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [AppService],
        }).compile();

        service = module.get<AppService>(AppService);
    });

    describe('test transaction batch', () => {
        it('should create and send two batches', async () => {
            // waiting for synchronizing
            // await delay(10000);

            // todo: complete for several blocks. current implementation has unhandled behaviour
            const numOfTransactions = 60;

            const zpInitialState = await zp.getMyUtxoState(zp.utxoState);
            const gasZpInitialState = await gasZp.getMyUtxoState(gasZp.utxoState);

            const utxoList = zpInitialState.utxoList;
            const gasUtxoList = gasZpInitialState.utxoList;

            const mt = MerkleTreeFromObject(zpInitialState.merkleTreeState);
            const gasMt = MerkleTreeFromObject(gasZpInitialState.merkleTreeState);

            const zpTransactionBatch: Tx<string>[] = [];
            const gasZpTransactionBatch: Tx<string>[] = [];

            let lastGeneratedUtxo = utxoList[0];
            let lastGasGeneratedUtxo = gasUtxoList[0];
            for (let i = 0; i < numOfTransactions; i++) {
                const stringMtState = mt.toObject();
                const stringGasMtState = gasMt.toObject();

                const mtState: MerkleTreeState<bigint> = getBigIntMtState(stringMtState);
                const gasMtState: MerkleTreeState<bigint> = getBigIntMtState(stringGasMtState);

                console.log(`${i + 1}/${numOfTransactions} mt root: ${mt.root}`);
                console.log(`${i + 1}/${numOfTransactions} mp_path: ${lastGeneratedUtxo.mp_path}`);
                console.log(`${i + 1}/${numOfTransactions} gas_mp_path: ${lastGasGeneratedUtxo.mp_path}`);

                const utxoPair = await calculateUtxo(
                    [lastGeneratedUtxo],
                    BigInt(ethToken),
                    zp.zpKeyPair.publicKey,
                    zp.zpKeyPair.publicKey,
                    lastGeneratedUtxo.amount,
                    0n
                );

                const [tx, txHash] = await zp.prepareTransaction(
                    ethToken,
                    0n,
                    utxoPair.utxoIn,
                    utxoPair.utxoOut,
                    mtState
                );
                zpTransactionBatch.push(tx);

                const utxoHashList = tx.utxoHashes.map(BigInt);

                const newUtxo = utxoPair.utxoOut[0].amount > 0n
                    ? utxoPair.utxoOut[0]
                    : utxoPair.utxoOut[1];

                newUtxo.mp_path = utxoPair.utxoOut[0].amount > 0n
                    ? mt.length
                    : mt.length + 1;
                mt.pushMany(utxoHashList);
                if ((i + 1) % AppConfig.maxBatchCapacity === 0) {
                    mt.pushZeros(512 - AppConfig.maxBatchCapacity * 2);
                }

                lastGeneratedUtxo = newUtxo;

                // gas transaction
                const gasDelta = -320n * (10n ** 9n);
                const gasUtxoPair = await calculateUtxo(
                    [lastGasGeneratedUtxo],
                    BigInt(ethToken),
                    gasZp.zpKeyPair.publicKey,
                    gasZp.zpKeyPair.publicKey,
                    0n,
                    gasDelta
                );

                const [gasTx, gasTxHash] = await gasZp.prepareTransaction(
                    ethToken,
                    gasDelta,
                    gasUtxoPair.utxoIn,
                    gasUtxoPair.utxoOut,
                    gasMtState
                );

                gasZpTransactionBatch.push(gasTx);

                const utxoGasHashList = gasTx.utxoHashes.map(BigInt);

                const newGasUtxo = gasUtxoPair.utxoOut[0].amount > 0n
                    ? gasUtxoPair.utxoOut[0]
                    : gasUtxoPair.utxoOut[1];

                newGasUtxo.mp_path = gasUtxoPair.utxoOut[0].amount > 0n
                    ? gasMt.length
                    : gasMt.length + 1;
                gasMt.pushMany(utxoGasHashList);
                if ((i + 1) % AppConfig.maxBatchCapacity === 0) {
                    gasMt.pushZeros(512 - AppConfig.maxBatchCapacity * 2);
                }

                lastGasGeneratedUtxo = newGasUtxo;

            }

            const publishedTransactions$ = [];
            for (const [i, tx] of zpTransactionBatch.entries()) {
                publishedTransactions$.push(
                    service.publishTransaction(tx, '0x0', gasZpTransactionBatch[i])
                )
            }

            const t1 = performance.now();

            let processedTxCounter = 0;
            combineLatest(publishedTransactions$).subscribe(
                (res) => {
                    console.log(res);
                    processedTxCounter += res.length;
                },
                (err) => {
                    throw err;
                },
                () => {
                    const t2 = performance.now();
                    console.log(`relayer done in ${prettyMilliseconds(t2 - t1)}`);
                    expect(processedTxCounter).to.eq(publishedTransactions$.length);
                }
            );

        });
    });
});

function getBigIntMtState(mtState: MerkleTreeState<string>): MerkleTreeState<bigint> {
    return {
        length: mtState.length,
        height: mtState.height,
        _merkleState: unstringifyBigInts(mtState._merkleState)
    }
}
