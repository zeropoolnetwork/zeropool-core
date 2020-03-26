import { expect } from 'chai';
import 'mocha';

import { Test } from '@nestjs/testing';
import { AppService } from '../src/app.service';
import { combineLatest } from "rxjs";
import { performance } from "perf_hooks";
import * as prettyMilliseconds from "pretty-ms";
import { generateTransactionBatch } from "./transaction-batch";


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

            const { zpTransactionBatch, gasZpTransactionBatch } = await generateTransactionBatch(2);

            const publishedTransactions$ = [];
            for (const [i, tx] of zpTransactionBatch.entries()) {
                publishedTransactions$.push(
                    service.publishTransaction(tx, '0x0', gasZpTransactionBatch[i])
                )
            }

            const t1 = performance.now();
            const res = await combineLatest(publishedTransactions$).toPromise();
            const t2 = performance.now();

            console.log(`relayer done in ${prettyMilliseconds(t2 - t1)}`);
            expect(res.length).to.eq(publishedTransactions$.length);

        });
    });
});
