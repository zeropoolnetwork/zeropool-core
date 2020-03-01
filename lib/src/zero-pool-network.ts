import {
    bigintifyUtxoState,
    copyMerkleTreeState,
    copyMyUtxoState,
    decryptUtxo,
    encryptUtxo,
    findDuplicates,
    getAction,
    getKeyPair,
    getProof,
    sortHistory,
    sortUtxo,
    stringifyAddress,
    stringifyTx,
} from "./utils";
// @ts-ignore
import { bn128 } from "snarkjs";

import { hash, toHex } from './ethereum';
import { BlockItem, DepositEvent, PayNote, Tx, TxExternalFields, ZeroPoolContract } from './ethereum/zeropool';

import { nullifier, transfer_compute, utxo } from './circom/inputs';
import { MerkleTree } from './circom/merkletree';
import {
    ContractUtxos,
    DepositHistoryItem,
    HistoryItem,
    HistoryState,
    IMerkleTree,
    KeyPair,
    MerkleTreeState,
    MyUtxoState,
    Utxo,
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
    merkleTreeState: {
        height: PROOF_LENGTH + 1,
        length: 0,
        _merkleState: Array(PROOF_LENGTH + 1).fill(0).map(() => [])
    },
    utxoList: [],
    nullifiers: [],
    lastBlockNumber: 0
};

const defaultHistoryState: HistoryState = {
    items: [],
    lastBlockNumber: 0
};

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

        const utxoDelta = BigInt(amount);

        const [
            blockItem,
            txHash
        ] = await this.prepareBlockItem(
            token,
            utxoDelta,
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
        if (utxoIn[1]) {
            assert.equal(utxoIn[0].token, utxoIn[1].token, 'different utxo tokens');
        }

        callback && callback({ step: "start" });

        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = copyMyUtxoState(state);

        const utxoDelta: bigint = utxoIn.reduce((a, b) => {
            a += b.amount;
            return a;
        }, 0n);

        const utxoOut: Utxo<bigint>[] = [];

        const token = stringifyAddress(utxoIn[0].token);

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
        merkleState: MerkleTreeState<bigint>,
        callback?: (update: any) => any
    ): Promise<[BlockItem<string>, string]> {

        const mtState = copyMerkleTreeState(merkleState);

        const mt: IMerkleTree = MerkleTree.fromObject(mtState);

        callback && callback({ step: "transfer-compute" });

        utxoIn.forEach((x: Utxo<bigint>) => {
            // @ts-ignore
            x.mp_sibling = mt.proof(x.mp_path);
        });

        const {
            inputs,
            add_utxo
        } = transfer_compute(mt.root, utxoIn, utxoOut, BigInt(token), delta, 0n, this.zpKeyPair.privateKey);

        const encryptedUTXOs = add_utxo.map((input: Utxo<bigint>) => encryptUtxo(input.pubkey, input));

        const txExternalFields: TxExternalFields<bigint> = {
            owner: delta === 0n ? 0n : BigInt(this.ZeroPool.web3Ethereum.ethAddress),
            message: [
                {
                    data: encryptedUTXOs[0]
                },
                {
                    data: encryptedUTXOs[1]
                }
            ]
        };

        inputs.message_hash = this.txExternalFieldsHash(txExternalFields);

        callback && callback({ step: "get-proof" });

        const proof = await getProof(this.transactionJson, inputs, this.proverKey);

        mt.push(inputs.utxo_out_hash[0]);
        mt.push(inputs.utxo_out_hash[1]);

        callback && callback({ step: "get-last-root-pointer" });

        const rootPointer
            = BigInt(
            mt._merkleState[0].length / 2 !== 0 ?
                (mt._merkleState[0].length / 2) - 1 :
                0
        );

        const tx: Tx<bigint> = {
            token: BigInt(token),
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
            tx: stringifyTx(tx),
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

        let utxoCounter = 0;
        for (const [i, blockEncryptedUtxoList] of encryptedUtxoList.entries()) {

            for (const [j, encryptedUtxo] of blockEncryptedUtxoList.entries()) {

                callback && callback({
                    step: "find-own-utxo",
                    processed: i + 1,
                });

                const p = new Promise((resolve) => {
                    setTimeout(() => resolve(), 1);
                });
                await p;

                try {

                    const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, utxoHashes[i][j]);
                    if (utxo.amount.toString() !== '0') {

                        const action = getAction(utxoDeltaList[utxoCounter]);

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

                utxoCounter++;

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

        const mt: IMerkleTree = MerkleTree.fromObject(srcState.merkleTreeState);
        const utxoCount = mt.length;

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

        for (const blockHashList of utxoHashes) {

            for (const hash of blockHashList) {
                mt.push(hash);
            }

            mt.pushZeros(512 - blockHashList.length);

        }

        state.merkleTreeState = {
            length: mt.length,
            height: mt.height,
            _merkleState: mt._merkleState
        };

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

        let utxoCounter = 0;
        let utxoPathPointer = 0;
        for (const [i, blockEncryptedUtxoList] of encryptedUtxoList.entries()) {

            for (const [j, encryptedUtxo] of blockEncryptedUtxoList.entries()) {

                callback && callback({
                    step: 'find-own-utxo',
                    processed: utxoCounter + 1,
                    outOf: encryptedUtxoList.length //todo: fix it
                });

                const p = new Promise((resolve) => {
                    setTimeout(() => resolve(), 1);
                });
                await p;

                try {
                    const utxo = decryptUtxo(this.zpKeyPair.privateKey, encryptedUtxo, utxoHashes[i][j]);
                    if (utxo.amount.toString() !== '0') {

                        // utxo.mp_sibling = mt.proof(utxoNum);
                        utxo.mp_path = utxoCount + utxoPathPointer;
                        utxo.blockNumber = blockNumbers[utxoCounter];

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

                utxoCounter++;
                utxoPathPointer++;

            }

            utxoPathPointer += (512 - blockEncryptedUtxoList.length);

        }

        state.lastBlockNumber = Number(state.utxoList[state.utxoList.length - 1].blockNumber);

        return state;
    }

    async getUtxoListFromContract(fromBlockNumber?: string | number): Promise<ContractUtxos> {
        const blockEvents = await this.ZeroPool.publishBlockEvents(fromBlockNumber);
        if (blockEvents.length === 0) {
            return { encryptedUtxoList: [], utxoHashes: [], blockNumbers: [], nullifiers: [], utxoDeltaList: [] };
        }

        const encryptedUtxoList: bigint[][][] = [];
        const hashList: bigint[][] = [];
        const inBlockNumber: number[] = [];
        const nullifiers: bigint[] = [];
        const utxoDeltaList: bigint[] = [];

        for (const block of blockEvents) {

            const blockHashList: bigint[] = [];
            const blockEncryptedUtxoList: bigint[][] = [];

            for (const item of block.params.BlockItems) {

                nullifiers.push(...item.tx.nullifier.map(BigInt));

                const [hash1, hash2] = item.tx.utxoHashes.map(BigInt);

                const encryptedUtxoPair = item.tx.txExternalFields.message;
                blockEncryptedUtxoList.push(
                    encryptedUtxoPair[0].data.map(BigInt),
                    encryptedUtxoPair[1].data.map(BigInt)
                );


                blockHashList.push(hash1, hash2);

                const utxoDelta = BigInt(item.tx.delta);
                utxoDeltaList.push(utxoDelta, utxoDelta);

                inBlockNumber.push(block.blockNumber, block.blockNumber);

            }

            hashList.push(blockHashList);
            encryptedUtxoList.push(blockEncryptedUtxoList);

        }

        return {
            nullifiers,
            utxoDeltaList,
            encryptedUtxoList: encryptedUtxoList,
            utxoHashes: hashList,
            blockNumbers: inBlockNumber
        };
    }

    txExternalFieldsHash(ext: TxExternalFields<bigint>): bigint {
        const encodedTxExternalFields = this.ZeroPool.encodeTxExternalFields(ext);
        return BigInt(
            hash(
                encodedTxExternalFields.substring(2)
            )
        ) % bn128.r;
    }

}
