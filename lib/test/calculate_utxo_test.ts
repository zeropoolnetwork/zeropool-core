import { expect } from 'chai';
import 'mocha';

import { calculateUtxo, Utxo, UtxoPair } from '../src'
import { fr_random, randrange, u160_random } from "../src/circom/utils";

describe('Utxo test', () => {

    it('should calculate utxo pair for deposit', async () => {
        for (let test = 0; test < 10; test++) {

            const token = u160_random();
            const myPublicKey = fr_random();
            const toPubKey = myPublicKey;
            const delta = u160_random();
            const transferringAmount = 0n;

            const srcUtxoList = generateRandomUtxoList(token, myPublicKey);

            const calculatedUtxoList = await calculateUtxo(
                srcUtxoList,
                token,
                toPubKey,
                myPublicKey,
                transferringAmount,
                delta
            );

            await testFunc(srcUtxoList, calculatedUtxoList, delta);

        }
    });

    it('should calculate utxo pair for withdraw', async () => {
        for (let test = 0; test < 10; test++) {

            const token = u160_random();
            const myPublicKey = fr_random();
            const toPubKey = myPublicKey;
            const delta = u160_random() * -1n;
            const transferringAmount = 0n;

            const srcUtxoList = generateRandomUtxoList(token, myPublicKey);

            const calculatedUtxoList = await calculateUtxo(
                srcUtxoList,
                token,
                toPubKey,
                myPublicKey,
                transferringAmount,
                delta
            );

            await testFunc(srcUtxoList, calculatedUtxoList, delta);

        }
    });

    it('should calculate utxo pair for transfer', async () => {
        for (let test = 0; test < 10; test++) {

            const token = u160_random();
            const myPublicKey = fr_random();
            const toPubKey = fr_random();
            const delta = 0n;

            const srcUtxoList = generateRandomUtxoList(token, myPublicKey);

            const transferringAmount = randrange(
                1n,
                srcUtxoList[0].amount + srcUtxoList[1].amount
            );

            const calculatedUtxoList = await calculateUtxo(
                srcUtxoList,
                token,
                toPubKey,
                myPublicKey,
                transferringAmount,
                delta
            );

            await testFunc(srcUtxoList, calculatedUtxoList, delta);

        }
    });

});

async function testFunc(srcUtxoList: Utxo<bigint>[], calculatedUtxoList: UtxoPair, delta: bigint) {

    const firstInput = calculatedUtxoList.utxoIn[0];
    const secondInput = calculatedUtxoList.utxoIn[1];

    const firstOutput = calculatedUtxoList.utxoOut[0];
    const secondOutput = calculatedUtxoList.utxoOut[1];

    const amountFirstInput = srcUtxoList[0] && srcUtxoList[0].amount || 0n;
    const amountSecondInput = srcUtxoList[1] && srcUtxoList[1].amount || 0n;


    expect(firstOutput.amount == (amountFirstInput + amountSecondInput + delta));

    if (amountFirstInput > amountSecondInput) {
        expect(firstInput).to.eq(srcUtxoList[0]);
    } else {
        expect(firstInput).to.eq(srcUtxoList[1]);
    }

    expect(secondInput === undefined && secondOutput === undefined);
}

function generateRandomUtxoList(token: bigint, myPublicKey: bigint) {

    const srcUtxoList: Utxo<bigint>[] = [];

    for (let i = 0; i < 2; i++) {

        const utxo: Utxo<bigint> = {
            token,
            amount: u160_random(),
            pubkey: myPublicKey,
            blinding: fr_random(),
        };

        srcUtxoList.push(utxo);

    }

    return srcUtxoList;

}
