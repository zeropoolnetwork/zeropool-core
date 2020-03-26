import { gasZp, zp } from "./test-zeropool";
import { calculateUtxo, MerkleTreeFromObject, MerkleTreeState, Tx } from "zeropool-lib";
import { AppConfig } from "../src/app.config";
import { unstringifyBigInts } from 'snarkjs/src/stringifybigint';

const ethToken = '0x0000000000000000000000000000000000000000';

export type TransactionBatch = {
    zpTransactionBatch: Tx<string>[],
    gasZpTransactionBatch: Tx<string>[]
}

export async function generateTransactionBatch(numOfTransactions: number): Promise<TransactionBatch> {

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

    return {
        zpTransactionBatch,
        gasZpTransactionBatch
    }
}


function getBigIntMtState(mtState: MerkleTreeState<string>): MerkleTreeState<bigint> {
    return {
        length: mtState.length,
        height: mtState.height,
        _merkleState: unstringifyBigInts(mtState._merkleState)
    }
}
