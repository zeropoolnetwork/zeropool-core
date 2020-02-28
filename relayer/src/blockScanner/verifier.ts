import * as path from "path";
import * as fs from "fs";
import { bigintifyTx, Tx, unstringifyVk, verifyProof } from "zeropool-lib";
import { zp } from "../zeroPool";

const vkPath = path.join(__dirname, './../../compiled/transaction_vk.json');
// @ts-ignore
const vk = unstringifyVk(JSON.parse(fs.readFileSync(vkPath)));

export async function verifyTx(
    stringTx: Tx<string>,
    lastBlockRootHash: string
): Promise<boolean> {

    const tx = bigintifyTx(stringTx);

    // todo: pass in parameters zp in case of other logic
    const messageHash = zp.txExternalFieldsHash(tx.txExternalFields);

    const inputs = [
        BigInt(lastBlockRootHash),
        tx.nullifier[0],
        tx.nullifier[1],
        tx.utxoHashes[0],
        tx.utxoHashes[1],
        tx.token,
        tx.delta,
        messageHash
    ];

    return verifyProof(tx.proof.data, inputs, vk);
}
