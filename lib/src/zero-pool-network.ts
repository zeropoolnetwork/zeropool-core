import { decryptUtxo, encryptUtxo, getKeyPair, getProof, KeyPair, Utxo, verify } from "./utils";

import { hash, toHex } from './ethereum';
import { BlockItem, DepositEvent, PayNote, Tx, TxExternalFields, ZeroPoolContract } from './ethereum/zeropool';

import { nullifier, transfer_compute, utxo } from './circom/inputs';
import { MerkleTree } from './circom/merkletree';
import {
    Action,
    ContractUtxos,
    DepositHistoryItem,
    HistoryItem,
    HistoryState,
    IMerkleTree,
    MyUtxoState,
    UtxoPair
} from "./zero-pool-network.dto";
import { Transaction } from "web3-core";
import { HttpProvider } from 'web3-providers-http';
import * as assert from "assert";
import { BehaviorSubject, Observable } from "rxjs";
import {
    DepositProgressNotification,
    GetBalanceProgressNotification,
    PrepareWithdrawProgressNotification,
    TransferProgressNotification,
    UtxoHistoryProgressNotification
} from "./progressNotifications.dto";

const PROOF_LENGTH = 32;

const defaultState: MyUtxoState<bigint> = {
    merkleTreeState: [],
    utxoList: [],
    nullifiers: [],
    lastBlockNumber: 0
};

const defaultHistoryState: HistoryState = {
    items: [],
    lastBlockNumber: 0
};

function copyMyUtxoState(src: MyUtxoState<bigint>): MyUtxoState<bigint> {
    return {
        ...src,
        merkleTreeState: src.merkleTreeState.map(x => [...x]),
        utxoList: src.utxoList.map(x => {
            // @ts-ignore
            return { ...x, mp_sibling: [...x.mp_sibling] }
        }),
        nullifiers: [...src.nullifiers],
    }
}

export const verifyProof = verify;

export class ZeroPoolNetwork {

    private readonly transactionJson: any;
    private readonly proverKey: any;

    public readonly contractAddress: string;
    public readonly zpKeyPair: KeyPair;

    public readonly ZeroPool: ZeroPoolContract;

    private zpHistoryStateSubject: BehaviorSubject<HistoryState>;
    public zpHistoryState$: Observable<HistoryState>;

    get zpHistoryState(): HistoryState {
        return this.zpHistoryStateSubject.value;
    }

    set zpHistoryState(val: HistoryState) {
        this.zpHistoryStateSubject.next(val);
    }

    private utxoStateSubject: BehaviorSubject<MyUtxoState<bigint>>;
    public utxoState$: Observable<MyUtxoState<bigint>>;

    get utxoState(): MyUtxoState<bigint> {
        return this.utxoStateSubject.value;
    }

    set utxoState(val: MyUtxoState<bigint>) {
        this.utxoStateSubject.next(val);
    }

    constructor(
        contractAddress: string,
        web3Provider: HttpProvider,
        zpMnemonic: string,
        transactionJson: any,
        proverKey: any,
        cashedState?: MyUtxoState<string>,
        historyState?: HistoryState,
    ) {

        this.transactionJson = transactionJson;
        this.proverKey = proverKey;
        this.contractAddress = contractAddress;
        this.zpKeyPair = getKeyPair(zpMnemonic);
        this.ZeroPool = new ZeroPoolContract(contractAddress, web3Provider);

        if (cashedState) {
            this.utxoStateSubject = new BehaviorSubject<MyUtxoState<bigint>>(bigintifyUtxoState(cashedState));
        } else {
            this.utxoStateSubject = new BehaviorSubject<MyUtxoState<bigint>>(defaultState);
        }

        this.utxoState$ = this.utxoStateSubject.asObservable();

        this.zpHistoryStateSubject = new BehaviorSubject<HistoryState>(historyState || defaultHistoryState);
        this.zpHistoryState$ = this.zpHistoryStateSubject.asObservable();
    }

    async deposit(
        token: string,
        amount: number,
        callback?: (update: DepositProgressNotification) => any
    ): Promise<BlockItem<string>> {

        callback && callback({ step: "start" });

        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = copyMyUtxoState(state);

        const utxoIn: Utxo<bigint>[] = [];
        const utxoOut: Utxo<bigint>[] = [
            utxo(BigInt(token), BigInt(amount), this.zpKeyPair.publicKey)
        ];

        const [
            blockItem,
            txHash
        ] = await this.prepareBlockItem(
            token,
            BigInt(amount),
            utxoIn,
            utxoOut,
            state.merkleTreeState,
            callback
        );

        callback && callback({ step: "deposit-asset-to-contract" });

        const transactionDetails: Transaction = await this.ZeroPool.deposit({
            token,
            amount,
            txHash
        });

        blockItem.depositBlockNumber = toHex(transactionDetails.blockNumber as number);

        callback && callback({ step: "finish" });

        return blockItem;
    }

    async transfer(
        token: string,
        toPubKey: string,
        amount: number,
        callback?: (update: TransferProgressNotification) => any
    ): Promise<BlockItem<string>> {

        callback && callback({ step: "start" });

        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = copyMyUtxoState(state);

        callback && callback({ step: "calculate-in-out" });

        const utxoPair = await this.calculateUtxo(state.utxoList, BigInt(token), BigInt(toPubKey), BigInt(amount));

        const utxoZeroDelta = 0n;
        const [blockItem, txHash] = await this.prepareBlockItem(
            token,
            utxoZeroDelta,
            utxoPair.utxoIn,
            utxoPair.utxoOut,
            state.merkleTreeState,
            callback
        );

        callback && callback({ step: "finish" });

        return blockItem;
    }

    async prepareWithdraw(
        utxoIn: Utxo<bigint>[],
        callback?: (update: PrepareWithdrawProgressNotification) => any
    ): Promise<BlockItem<string>> {

        assert.ok(utxoIn.length > 0, 'min 1 utxo');
        assert.ok(utxoIn.length <= 2, 'max 2 utxo');
        assert.equal(utxoIn[0].token, utxoIn[1].token, 'different utxo tokens');

        callback && callback({ step: "start" });

        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = copyMyUtxoState(state);

        const utxoDelta: bigint = utxoIn.reduce((a, b) => {
            a += b.amount;
            return a;
        }, 0n);

        const utxoOut: Utxo<bigint>[] = [];

        const token = utxoIn[0].token === 0n ?
            "0x0000000000000000000000000000000000000000" :
            toHex(utxoIn[0].token);

        const [blockItem, txHash] = await this.prepareBlockItem(
            token,
            utxoDelta * -1n,
            utxoIn,
            utxoOut,
            state.merkleTreeState,
            callback
        );

        callback && callback({ step: "finish" });

        return blockItem;
    }

    depositCancel(payNote: PayNote): Promise<Transaction> {
        return this.ZeroPool.cancelDeposit(payNote);
    }

    withdraw(payNote: PayNote): Promise<Transaction> {
        return this.ZeroPool.withdraw(payNote);
    }

    async publishBlockItems(blockItems: BlockItem<string>[], blockNumberExpires: number): Promise<Transaction> {
        const rollupCurrentTxNum = await this.ZeroPool.getRollupTxNum();
        return this.ZeroPool.publishBlock(blockItems, +rollupCurrentTxNum >> 8, blockNumberExpires)
    }

    async calculateUtxo(
        srcUtxoList: Utxo<bigint>[],
        token: bigint,
        toPubKey: bigint,
        sendingAmount: bigint
    ): Promise<UtxoPair> {

        assert.ok(srcUtxoList.length !== 0, 'you have not utxoList');

        let utxoList = [...srcUtxoList];
        utxoList = utxoList.sort(sortUtxo);

        const utxoIn = [];
        const utxoOut = [];
        let tmpAmount = 0n;
        for (let i = 0; i < utxoList.length; i++) {
            assert.ok(i < 2, 'you have not utxoList');

            tmpAmount += utxoList[i].amount;
            utxoIn.push(utxoList[i]);
            if (tmpAmount === sendingAmount) {
                utxoOut.push(utxo(token, sendingAmount, toPubKey));
                break;
            } else if (tmpAmount > sendingAmount) {
                utxoOut.push(utxo(token, sendingAmount, toPubKey));
                utxoOut.push(utxo(token, tmpAmount - sendingAmount, this.zpKeyPair.publicKey));
                break;
            }
        }

        return { utxoIn, utxoOut }
    }

    async prepareBlockItem(
        token: string,
        delta: bigint,
        utxoIn: Utxo<bigint>[] = [],
        utxoOut: Utxo<bigint>[] = [],
        merkleTreeState: bigint[][],
        callback?: (update: any) => any
    ): Promise<[BlockItem<string>, string]> {

        const mt: IMerkleTree = new MerkleTree(PROOF_LENGTH + 1);
        mt._merkleState = merkleTreeState;

        callback && callback({ step: "transfer-compute" });

        const {
            inputs,
            add_utxo
        } = transfer_compute(mt.root, utxoIn, utxoOut, BigInt(token), delta, 0n, this.zpKeyPair.privateKey);

        const encryptedUTXOs = add_utxo.map((input: Utxo<bigint>) => encryptUtxo(input.pubkey, input));

        const txExternalFields: TxExternalFields<bigint> = {
            owner: delta === 0n ? "0x0000000000000000000000000000000000000000" : this.ZeroPool.web3Ethereum.ethAddress,
            message: [
                {
                    data: encryptedUTXOs[0]
                },
                {
                    data: encryptedUTXOs[1]
                }
            ]
        };

        const encodedTxExternalFields = this.ZeroPool.encodeTxExternalFields(txExternalFields);
        inputs.message_hash = hash(encodedTxExternalFields);

        callback && callback({ step: "get-proof" });

        const proof = await getProof(this.transactionJson, inputs, this.proverKey);

        callback && callback({ step: "get-last-root-pointer" });

        const lastRootPointer = await this.ZeroPool.getLastRootPointer();
        const rootPointer
            = BigInt(lastRootPointer ? lastRootPointer + 1 : 0);

        mt.push(inputs.utxo_out_hash[0]);
        mt.push(inputs.utxo_out_hash[1]);

        const tx: Tx<bigint> = {
            token,
            rootPointer,
            txExternalFields,
            nullifier: inputs.nullifier,
            utxoHashes: inputs.utxo_out_hash,
            delta: inputs.delta,
            proof: {
                data: proof
            }
        };

        const encodedTx = this.ZeroPool.encodeTx(tx);
        const txHash = hash(encodedTx);

        const blockItem: BlockItem<string> = {
            tx: normalizeTx(tx),
            depositBlockNumber: '0x0',
            newRoot: toHex(mt.root)
        };

        return [
            blockItem,
            txHash
        ];
    }

    async utxoRootHash() {
        const { utxoHashes } = await this.getUtxoListFromContract();
        const mt = new MerkleTree(PROOF_LENGTH + 1);
        if (utxoHashes.length === 0) {
            return mt.root;
        }
        mt.pushMany(utxoHashes);
        return mt.root;
    }

    async depositExternalHistory(): Promise<DepositHistoryItem[]> {
        const events = await this.ZeroPool.getDepositEvents();
        if (events.length === 0) {
            return [];
        }

        const myDeposits: DepositEvent[] = events.filter(event =>
            event.owner === this.ZeroPool.web3Ethereum.ethAddress);

        const txHums$: Promise<string>[] = myDeposits.map(
            (deposit: DepositEvent): Promise<string> => {

                const payNote: PayNote = {
                    blockNumber: deposit.blockNumber,
                    txHash: deposit.params.txHash,
                    utxo: {
                        amount: deposit.params.amount,
                        owner: deposit.owner,
                        token: deposit.params.token
                    }
                };

                return this.ZeroPool.getDepositTxNum(payNote)
            }
        );

        const txHums: string[] = await Promise.all<string>(txHums$);
        return myDeposits.map((deposit: DepositEvent, i: number) => {
            if (txHums[i] === '115792089237316195423570985008687907853269984665640564039457584007913129639935') {
                return {
                    deposit,
                    isExists: true,
                    isSpent: false,
                    spentInTx: '0'
                }
            } else if (txHums[i] === '0') {
                return {
                    deposit,
                    isExists: false,
                    isSpent: false,
                    spentInTx: '0'
                }
            }

            return {
                deposit,
                isExists: true,
                isSpent: true,
                spentInTx: txHums[i]
            }
        });
    }


    async utxoHistory(callback?: (update: UtxoHistoryProgressNotification) => any): Promise<HistoryState> {

        callback && callback({ step: "start" });

        callback && callback({ step: "fetch-utxo-list-from-contact" });

        const {
            encryptedUtxoList,
            utxoHashes,
            blockNumbers,
            nullifiers,
            utxoDeltaList
        } = await this.getUtxoListFromContract(+this.zpHistoryState.lastBlockNumber + 1);

        if (encryptedUtxoList.length === 0) {
            callback && callback({ step: "finish" });
            return this.zpHistoryState;
        }

        callback && callback({
            step: "find-own-utxo",
            processed: 0,
            outOf: encryptedUtxoList.length
        });

        for (const [i, encryptedUtxo] of encryptedUtxoList.entries()) {

            callback && callback({
                step: "find-own-utxo",
                processed: i + 1,
            });

            const p = new Promise((resolve) => {
                setTimeout(() => resolve(), 1);
            });
            await p;

            try {

                const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, utxoHashes[i]);
                if (utxo.amount.toString() !== '0') {

                    const action = getAction(utxoDeltaList[i]);

                    const historyItem: HistoryItem = {
                        action: action,
                        type: 'in', // because we search among utxo. type 'out' means search among nullifiers
                        amount: Number(utxo.amount),
                        blockNumber: blockNumbers[i]
                    };

                    this.zpHistoryState.items.push(historyItem);

                    const utxoNullifier = nullifier(utxo, this.zpKeyPair.privateKey);
                    const index = nullifiers.indexOf(utxoNullifier);
                    if (index !== -1) {
                        const historyItem: HistoryItem = {
                            action: getAction(utxoDeltaList[index]),
                            type: 'out',
                            amount: Number(utxo.amount),
                            blockNumber: blockNumbers[index]
                        };

                        this.zpHistoryState.items.push(historyItem);
                    }

                }
            } catch (e) {
            }

        }

        const sortedHistory = this.zpHistoryState.items.sort(sortHistory);
        this.zpHistoryState = {
            items: sortedHistory,
            lastBlockNumber: sortedHistory[0].blockNumber
        };

        callback && callback({ step: "finish" });

        return this.zpHistoryState;
    }

    async getBalance(callback?: (update: GetBalanceProgressNotification) => any) {

        callback && callback({ step: 'start' });

        // todo: think about BigNumber
        const balances: { [key: string]: number } = {};
        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = state;

        callback && callback({ step: 'calculate-balances' });

        for (const utxo of state.utxoList) {
            const asset = toHex(utxo.token);
            if (!balances[asset]) {
                balances[asset] = Number(utxo.amount);
                continue;
            }
            balances[asset] += Number(utxo.amount);
        }

        callback && callback({ step: 'finish' });

        return balances;
    }


    async myUtxoState(srcState: MyUtxoState<bigint>, callback?: (update: any) => any): Promise<MyUtxoState<bigint>> {

        const state = copyMyUtxoState(srcState);

        let utxoCount = 0;
        const mt: IMerkleTree = new MerkleTree(PROOF_LENGTH + 1);
        if (state.merkleTreeState.length !== 0) {
            utxoCount = state.merkleTreeState[0].length;
            mt._merkleState = state.merkleTreeState;
        }

        callback && callback({ step: 'fetch-utxo-list-from-contact' });

        const {
            encryptedUtxoList,
            utxoHashes,
            blockNumbers,
            nullifiers
        } = await this.getUtxoListFromContract(+state.lastBlockNumber + 1);

        if (encryptedUtxoList.length === 0) {
            return state;
        }

        for (const hash of utxoHashes) {
            mt.push(hash);
        }

        state.merkleTreeState = mt._merkleState;

        const allNullifiers = state.nullifiers.concat(nullifiers);

        const notUniqueNullifiers = findDuplicates<bigint>(allNullifiers);

        callback && callback({
            step: 'find-spent-utxo',
            processed: 0,
            outOf: notUniqueNullifiers.length
        });

        for (const [i, nullifier] of notUniqueNullifiers.entries()) {

            callback && callback({
                step: 'find-spent-utxo',
                processed: i + 1,
                outOf: notUniqueNullifiers.length
            });

            const index = state.nullifiers.indexOf(nullifier);
            state.nullifiers = state.nullifiers.filter((x, i) => i !== index);
            state.utxoList = state.utxoList.filter((x, i) => i !== index);
        }

        callback && callback({
            step: 'find-own-utxo',
            processed: 0,
            outOf: encryptedUtxoList.length
        });

        for (const [i, encryptedUtxo] of encryptedUtxoList.entries()) {

            callback && callback({
                step: 'find-own-utxo',
                processed: i + 1,
                outOf: encryptedUtxoList.length
            });

            const p = new Promise((resolve) => {
                setTimeout(() => resolve(), 1);
            });
            await p;

            try {
                const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, utxoHashes[i]);
                if (utxo.amount.toString() !== '0') {
                    utxo.mp_sibling = mt.proof(utxoCount + i);
                    utxo.mp_path = utxoCount + i;
                    utxo.blockNumber = blockNumbers[i];

                    const utxoNullifier = nullifier(utxo, this.zpKeyPair.privateKey);
                    if (!nullifiers.find(x => x === utxoNullifier)) {
                        state.utxoList.push(utxo);
                        state.nullifiers.push(utxoNullifier);
                    }
                }
            } catch (e) {
                // Here can't decode UTXO errors appears
                // console.log('Catch error:', e)
            }
        }

        state.lastBlockNumber = Number(state.utxoList[state.utxoList.length - 1].blockNumber);

        return state;
    }

    async getUtxoListFromContract(fromBlockNumber?: string | number): Promise<ContractUtxos> {
        const blockEvents = await this.ZeroPool.publishBlockEvents(fromBlockNumber);
        if (blockEvents.length === 0) {
            return { encryptedUtxoList: [], utxoHashes: [], blockNumbers: [], nullifiers: [], utxoDeltaList: [] };
        }

        const encryptedUtxoList: bigint[][] = [];
        const hashList: bigint[] = [];
        const inBlockNumber: number[] = [];
        const nullifiers: bigint[] = [];
        const utxoDeltaList: bigint[] = [];

        for (const block of blockEvents) {

            for (const item of block.params.BlockItems) {

                nullifiers.push(...item.tx.nullifier.map(BigInt));

                const [hash1, hash2] = item.tx.utxoHashes.map(BigInt);

                const encryptedUtxoPair = item.tx.txExternalFields.message;
                encryptedUtxoList.push(
                    encryptedUtxoPair[0].data.map(BigInt),
                    encryptedUtxoPair[1].data.map(BigInt)
                );


                hashList.push(hash1, hash2);

                const utxoDelta = BigInt(item.tx.delta);
                utxoDeltaList.push(utxoDelta, utxoDelta);

                inBlockNumber.push(block.blockNumber, block.blockNumber);

            }

        }

        return {
            nullifiers,
            utxoDeltaList,
            encryptedUtxoList: encryptedUtxoList,
            utxoHashes: hashList,
            blockNumbers: inBlockNumber
        };
    }

}

const MAX_AMOUNT = 1766847064778384329583297500742918515827483896875618958121606201292619776;

function getAction(delta: bigint): Action {
    if (delta === 0n) {
        return "transfer";
    } else if (delta < MAX_AMOUNT) {
        return "deposit";
    }
    // delta > BN254_ORDER-MAX_AMOUNT && delta < BN254_ORDER
    return "withdraw";
}

function normalizeTx(tx: Tx<bigint>): Tx<string> {
    return {
        token: tx.token,
        rootPointer: toHex(tx.rootPointer),
        nullifier: tx.nullifier.map(x => toHex(x)),
        utxoHashes: tx.utxoHashes.map(x => toHex(x)),
        delta: toHex(tx.delta),
        txExternalFields: {
            owner: tx.txExternalFields.owner,
            message: [
                {
                    data: tx.txExternalFields.message[0].data.map(x => toHex(x)),
                },
                {
                    data: tx.txExternalFields.message[1].data.map(x => toHex(x)),
                }
            ]
        },
        proof: {
            data: tx.proof.data.map(x => toHex(x))
        }
    };
}

function bigintifyUtxoState(state: MyUtxoState<string>): MyUtxoState<bigint> {
    return {
        utxoList: state.utxoList.map(bigintifyUtxo),
        nullifiers: state.nullifiers.map(BigInt),
        lastBlockNumber: state.lastBlockNumber,
        merkleTreeState: state.merkleTreeState.map(x => x.map(BigInt))
    }
}

export function stringifyUtxoState(state: MyUtxoState<bigint>): MyUtxoState<string> {
    return {
        utxoList: state.utxoList.map(stringifyUtxo),
        nullifiers: state.nullifiers.map(String),
        lastBlockNumber: state.lastBlockNumber,
        merkleTreeState: state.merkleTreeState.map(x => x.map(String))
    }
}

function bigintifyUtxo(utxo: Utxo<string>): Utxo<bigint> {
    return {
        amount: BigInt(utxo.amount),
        token: BigInt(utxo.token),
        pubkey: BigInt(utxo.pubkey),
        mp_sibling: utxo.mp_sibling ? utxo.mp_sibling.map(BigInt) : [],
        blinding: utxo.blinding ? BigInt(utxo.blinding) : undefined,
        blockNumber: utxo.blockNumber,
        mp_path: utxo.mp_path
    };
}

function stringifyUtxo(utxo: Utxo<bigint>): Utxo<string> {
    return {
        amount: utxo.amount.toString(),
        token: utxo.token.toString(),
        pubkey: utxo.pubkey.toString(),
        mp_sibling: utxo.mp_sibling ? utxo.mp_sibling.map(String) : [],
        blinding: utxo.blinding ? utxo.blinding.toString() : undefined,
        blockNumber: utxo.blockNumber,
        mp_path: utxo.mp_path
    };
}

function sortHistory(a: HistoryItem, b: HistoryItem) {
    const diff = b.blockNumber - a.blockNumber;
    if (diff < 0n) {
        return -1
    } else if (diff > 0n) {
        return 1;
    } else {
        return 0
    }
}

function sortUtxo(a: Utxo<bigint>, b: Utxo<bigint>): number {
    const diff = b.amount - a.amount;
    if (diff < 0n) {
        return -1
    } else if (diff > 0n) {
        return 1;
    } else {
        return 0
    }
}

function findDuplicates<T>(arr: T[]): T[] {
    let sortedArr = arr.slice().sort();
    let results = [];
    for (let i = 0; i < sortedArr.length - 1; i++) {
        if (sortedArr[i + 1] == sortedArr[i]) {
            results.push(sortedArr[i]);
        }
    }
    return results;
}
