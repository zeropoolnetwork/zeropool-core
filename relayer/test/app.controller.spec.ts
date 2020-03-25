import { expect } from 'chai';
import 'mocha';

import { Test } from '@nestjs/testing';
import { AppService } from '../src/app.service';
import { performance } from "perf_hooks";
import * as prettyMilliseconds from "pretty-ms";
import { generateTransactionBatch } from "./transaction-batch";
import { AppController } from "../src/app.controller";


describe('AppController', () => {
    let service: AppService;
    let controller: AppController;

    const response = {
        send: (body?: any) => {
            console.log(body);
        },
        status: (code: number) => response,
        end: () => {
        }
    };

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            controllers: [AppController],
            providers: [AppService],
        }).compile();

        controller = module.get<AppController>(AppController);
        service = module.get<AppService>(AppService);
    });

    describe('test transaction batch', () => {
        it('should create and send two batches', async () => {
            // waiting for synchronizing
            // await delay(10000);

            const { zpTransactionBatch, gasZpTransactionBatch } = await generateTransactionBatch(7);

            const publishedTransactions$: Promise<any>[] = [];

            for (const [i, tx] of zpTransactionBatch.entries()) {
                const res = controller.postTransaction({
                    depositBlockNumber: '0x0',
                    tx,
                    gasTx: gasZpTransactionBatch[i]
                }, response);
                publishedTransactions$.push(res);
            }

            const t1 = performance.now();
            const res = await Promise.all(publishedTransactions$);
            const t2 = performance.now();

            console.log(`relayer done in ${prettyMilliseconds(t2 - t1)}`);
            expect(res.length).to.eq(publishedTransactions$.length);

        });
    });
});
