import {
    bigintifyTx,
    bigintifyUtxoHistoryState,
    bigintifyUtxoState,
    copyMerkleTreeState,
    copyMyUtxoState,
    copyUtxoHistory,
    delay,
    DEPOSIT_ACTION,
    findDuplicates,
    getAction,
    sortHistory,
    sortUtxo,
    stringifyTx,
    toHex,
    TRANSFER_ACTION,
    WITHDRAW_ACTION,
} from "./utils";
// @ts-ignore
import { bn128 } from "snarkjs";

import { hash, PublishBlockEvent, WithdrawEvent } from './ethereum';
import { BlockItem, DepositEvent, PayNote, Tx, TxExternalFields, ZeroPoolContract } from './ethereum/zeropool';

import { transfer_compute, utxo } from './circom/inputs';
import { MerkleTree } from './circom/merkletree';
import {
    DepositHistoryItem,
    HistoryAndBalances,
    HistoryItem,
    HistoryState,
    IMerkleTree,
    MerkleTreeState,
    MyUtxoState,
    ParsedBlockList,
    Utxo,
    UtxoPair
} from "./zero-pool-network.dto";
import { Transaction } from "web3-core";
import { HttpProvider } from 'web3-providers-http';
import * as assert from "assert";
import { BehaviorSubject, Observable } from "rxjs";
import {
    GetBalanceProgressNotification,
    PrepareDepositProgressNotification,
    PrepareWithdrawProgressNotification,
    TransferProgressNotification
} from "./progressNotifications.dto";
import { encryptUtxo, getBabyJubKeyPair, getProof, KeyPair, tryDecryptUtxo } from "./crypto";

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

const defaultHistoryState: HistoryState<bigint> = {
    items: [],
    lastBlockNumber: 0,
    nullifiers: [],
    utxoList: []
};

export class ZeroPoolNetwork {

    private readonly transactionJson: any;
    private readonly proverKey: any;

    public readonly contractAddress: string;
    public readonly zpKeyPair: KeyPair;

    public readonly ZeroPool: ZeroPoolContract;

    public zpHistoryState$: Observable<HistoryState<bigint>>;
    private zpHistoryStateSubject: BehaviorSubject<HistoryState<bigint>>;

    constructor(
        contractAddress: string,
        web3Provider: HttpProvider,
        zpMnemonic: string,
        transactionJson: any,
        proverKey: any,
        cashedState?: MyUtxoState<string>,
        historyState?: HistoryState<string>,
    ) {

        this.transactionJson = transactionJson;
        this.proverKey = proverKey;
        this.contractAddress = contractAddress;
        this.zpKeyPair = getBabyJubKeyPair(zpMnemonic);
        this.ZeroPool = new ZeroPoolContract(contractAddress, web3Provider);

        if (cashedState) {

            this.utxoStateSubject =
                new BehaviorSubject<MyUtxoState<bigint>>(bigintifyUtxoState(cashedState));

        } else {

            this.utxoStateSubject =
                new BehaviorSubject<MyUtxoState<bigint>>(defaultState);

        }

        this.utxoState$ = this.utxoStateSubject.asObservable();

        if (historyState) {

            this.zpHistoryStateSubject =
                new BehaviorSubject<HistoryState<bigint>>(bigintifyUtxoHistoryState(historyState));

        } else {

            this.zpHistoryStateSubject =
                new BehaviorSubject<HistoryState<bigint>>(defaultHistoryState);

        }

        this.zpHistoryState$ = this.zpHistoryStateSubject.asObservable();

    }

    get zpHistoryState(): HistoryState<bigint> {
        return this.zpHistoryStateSubject.value;
    }

    private utxoStateSubject: BehaviorSubject<MyUtxoState<bigint>>;
    public utxoState$: Observable<MyUtxoState<bigint>>;

    get utxoState(): MyUtxoState<bigint> {
        return this.utxoStateSubject.value;
    }

    set utxoState(val: MyUtxoState<bigint>) {
        this.utxoStateSubject.next(val);
    }

    set zpHistoryState(val: HistoryState<bigint>) {
        this.zpHistoryStateSubject.next(val);
    }

    async prepareDeposit(
        token: string,
        amount: number,
        callback?: (update: PrepareDepositProgressNotification) => any
    ): Promise<[Tx<string>, string]> {

        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = copyMyUtxoState(state);

        const utxoDelta = BigInt(amount);

        const utxoPair = await calculateUtxo(
            state.utxoList,
            BigInt(token),
            this.zpKeyPair.publicKey,
            this.zpKeyPair.publicKey,
            0n,
            utxoDelta
        );

        const [
            tx,
            txHash
        ] = await this.prepareTransaction(
            token,
            utxoDelta,
            utxoPair.utxoIn,
            utxoPair.utxoOut,
            state.merkleTreeState,
            callback
        );

        callback && callback({ step: "finish" });

        return [tx, txHash];

    }

    async deposit(
        token: string,
        amount: number,
        txHash: string,
    ): Promise<number> {

        const transactionDetails: Transaction = await this.ZeroPool.deposit({
            token,
            amount,
            txHash,
        });

        return Number(transactionDetails.blockNumber);
    }

    async transfer(
        token: string,
        toPubKey: string,
        amount: number,
        callback?: (update: TransferProgressNotification) => any,
    ): Promise<[Tx<string>, string]> {

        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = copyMyUtxoState(state);

        callback && callback({ step: "calculate-in-out" });

        const utxoZeroDelta = 0n;

        const utxoPair = await calculateUtxo(
            state.utxoList,
            BigInt(token),
            BigInt(toPubKey),
            this.zpKeyPair.publicKey,
            BigInt(amount),
            utxoZeroDelta
        );

        const [tx, txHash] = await this.prepareTransaction(
            token,
            utxoZeroDelta,
            utxoPair.utxoIn,
            utxoPair.utxoOut,
            state.merkleTreeState,
            callback
        );

        callback && callback({ step: "finish" });

        const depositBlockNumber = '0x0';

        return [tx, depositBlockNumber];
    }

    async prepareWithdraw(
        token: string,
        amount: number,
        callback?: (update: PrepareWithdrawProgressNotification) => any
    ): Promise<[Tx<string>, string]> {

        const utxoDelta = BigInt(amount) * -1n;

        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = copyMyUtxoState(state);

        const utxoPair = await calculateUtxo(
            state.utxoList,
            BigInt(token),
            this.zpKeyPair.publicKey,
            this.zpKeyPair.publicKey,
            0n,
            utxoDelta
        );

        const [tx, txHash] = await this.prepareTransaction(
            token,
            utxoDelta,
            utxoPair.utxoIn,
            utxoPair.utxoOut,
            state.merkleTreeState,
            callback
        );

        callback && callback({ step: "finish" });

        const depositBlockNumber = '0x0';

        return [tx, depositBlockNumber];
    }

    depositCancel(payNote: PayNote, waitBlocks = 0): Promise<Transaction> {
        return this.ZeroPool.cancelDeposit(payNote, waitBlocks);
    }

    withdraw(payNote: PayNote, waitBlocks = 0): Promise<Transaction> {
        return this.ZeroPool.withdraw(payNote, waitBlocks);
    }

    async publishBlockItems(
        blockItems: BlockItem<string>[],
        blockNumberExpires: number,
        waitBlocks = 0
    ): Promise<Transaction> {

        const rollupCurrentTxNum = await this.ZeroPool.getRollupTxNum();
        const version = await this.ZeroPool.getContractVersion();
        return this.ZeroPool.publishBlock(
            blockItems,
            +rollupCurrentTxNum >> 8,
            blockNumberExpires,
            version,
            waitBlocks
        )
    }

    // todo: maybe make sense to cache it
    async getActiveWithdrawals(): Promise<PayNote[]> {
        const [
            publishBlockEvents,
            withdrawEvents
        ] = await Promise.all([
            this.ZeroPool.publishBlockEvents(),
            this.ZeroPool.withdrawEvents()
        ]);

        const activeWithdrawals: PayNote[] = [];
        for (const event of publishBlockEvents) {
            for (const item of event.params.BlockItems) {
                const action = getAction(BigInt(item.tx.delta));

                if (
                    action !== WITHDRAW_ACTION ||
                    item.tx.txExternalFields.owner !== this.ZeroPool.web3Ethereum.ethAddress
                ) {
                    continue;
                }

                const encodedTx = this.ZeroPool.encodeTx(item.tx);
                const txHash = hash(encodedTx);

                const coincidences = withdrawEvents.filter((event: WithdrawEvent) => {
                    return event.params.txHash === txHash;
                });

                if (coincidences.length !== 0) {
                    continue;
                }

                activeWithdrawals.push({
                    utxo: {
                        owner: item.tx.txExternalFields.owner,
                        amount: Number(bn128.r - BigInt(item.tx.delta)),
                        token: item.tx.token
                    },
                    blockNumber: event.blockNumber,
                    txHash: txHash,
                });

            }
        }

        return activeWithdrawals;

    }

    async getUncompleteDeposits(): Promise<PayNote[]> {
        const [
            publishBlockEvents,
            depositEvents
        ] = await Promise.all([
            this.ZeroPool.publishBlockEvents(),
            this.ZeroPool.getDepositEvents()
        ]);

        const userCompleteDepositTxHashList: string[] = [];
        for (const event of publishBlockEvents) {
            for (const item of event.params.BlockItems) {
                const action = getAction(BigInt(item.tx.delta));
                if (
                    action !== DEPOSIT_ACTION ||
                    item.tx.txExternalFields.owner !== this.ZeroPool.web3Ethereum.ethAddress
                ) {
                    continue;
                }

                const encodedTx = this.ZeroPool.encodeTx(item.tx);
                const txHash = hash(encodedTx);
                userCompleteDepositTxHashList.push(
                    txHash
                );
            }
        }

        const unconfirmedDeposits: DepositEvent[] = depositEvents.filter(
            (event: DepositEvent) => {
                const index = userCompleteDepositTxHashList.indexOf(event.params.txHash);
                return index === -1;
            }
        );

        return unconfirmedDeposits.map(
            (event: DepositEvent) => {
                return {
                    utxo: {
                        owner: event.owner,
                        amount: event.params.amount,
                        token: event.params.token
                    },
                    blockNumber: event.blockNumber,
                    txHash: event.params.txHash,
                };
            }
        );
    }

    async prepareTransaction(
        token: string,
        delta: bigint,
        utxoIn: Utxo<bigint>[] = [],
        utxoOut: Utxo<bigint>[] = [],
        merkleState: MerkleTreeState<bigint>,
        callback?: (update: PrepareDepositProgressNotification) => any
    ): Promise<[Tx<string>, string]> {

        const mtState = copyMerkleTreeState(merkleState);

        const mt: IMerkleTree = MerkleTree.fromObject(mtState);

        utxoIn.forEach((x: Utxo<bigint>) => {
            // @ts-ignore
            x.mp_sibling = mt.proof(x.mp_path);
        });

        const {
            inputs,
            add_utxo
        } = transfer_compute(mt.root, utxoIn, utxoOut, BigInt(token), delta, 0n, this.zpKeyPair.privateKey);

        const encryptedUTXOs = add_utxo.map((input: Utxo<bigint>) => encryptUtxo(input.pubkey, input));

        // todo: this is bad fix with || 0n, but is needed for SideChain contract
        const owner = delta === 0n ? 0n : BigInt(this.ZeroPool.web3Ethereum.ethAddress || 0n);

        const txExternalFields: TxExternalFields<bigint> = {
            owner: owner,
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

        const proof = await getProof(this.transactionJson, inputs, this.proverKey);

        callback && callback({ step: "finish-get-proof" });

        const numberOfUtxo = mt._merkleState[0].length;
        const numberOfBlocks = Math.ceil(numberOfUtxo / 512);

        const rootBlock = Math.max(numberOfBlocks - 1, 0);

        const rootPointer = BigInt(
            rootBlock * 256 + (numberOfUtxo / 2 % 256)
        );

        const tx: Tx<bigint> = {
            txExternalFields,
            token: BigInt(token),
            rootPointer: BigInt(rootPointer),
            nullifier: inputs.nullifier,
            utxoHashes: inputs.utxo_out_hash,
            delta: inputs.delta,
            proof: {
                data: proof
            }
        };

        const encodedTx = this.ZeroPool.encodeTx(
            stringifyTx(tx)
        );
        const txHash = hash(encodedTx);

        return [
            stringifyTx(tx),
            txHash
        ];
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

    async fetchMerkleTree(): Promise<IMerkleTree> {
        const utxoState = copyMyUtxoState(this.utxoState);
        const historyState = copyUtxoHistory(this.zpHistoryState);

        const mt: IMerkleTree = MerkleTree.fromObject(utxoState.merkleTreeState);

        const blockEvents = await this.ZeroPool.publishBlockEvents(+utxoState.lastBlockNumber + 1);
        if (blockEvents.length === 0) {
            return mt;
        }
        for (const block of blockEvents) {

            for (const item of block.params.BlockItems) {

                mt.pushMany(
                    item.tx.utxoHashes.map(BigInt)
                );

            }

            mt.pushZeros(512 - (block.params.BlockItems.length * 2));
        }

        utxoState.lastBlockNumber = blockEvents[blockEvents.length - 1].blockNumber;
        historyState.lastBlockNumber = blockEvents[blockEvents.length - 1].blockNumber;
        utxoState.merkleTreeState = {
            length: mt.length,
            _merkleState: mt._merkleState,
            height: mt.height
        };

        this.utxoState = utxoState;
        this.zpHistoryState = historyState;

        return mt;
    }

    async getBalanceAndHistory(): Promise<HistoryAndBalances> {

        const historyState = copyUtxoHistory(this.zpHistoryState);
        const utxoState = copyMyUtxoState(this.utxoState);

        const mt: IMerkleTree = MerkleTree.fromObject(utxoState.merkleTreeState);
        const utxoCount = mt.length;

        const blockEvents = await this.ZeroPool.publishBlockEvents(+utxoState.lastBlockNumber + 1);
        if (blockEvents.length === 0) {
            return {
                historyItems: historyState.items,
                balances: calculateBalance(utxoState)
            };
        }

        let {
            utxoHashList,
            spentNullifiers,
            myUtxo,
            myNullifiers,
            blockNumberList,
            deltaList,
            ownTxAmountList,
            ownUtxoCountList
        } = await parseBlockEvents(this.zpKeyPair.privateKey, blockEvents, utxoCount);

        historyState.utxoList = historyState.utxoList.concat(myUtxo);
        historyState.nullifiers = historyState.nullifiers.concat(myNullifiers);

        historyState.lastBlockNumber = blockEvents[blockEvents.length - 1].blockNumber;
        utxoState.lastBlockNumber = blockEvents[blockEvents.length - 1].blockNumber;

        for (const blockHashList of utxoHashList) {
            mt.pushMany(blockHashList);
            mt.pushZeros(512 - blockHashList.length);
        }

        utxoState.merkleTreeState = {
            length: mt.length,
            height: mt.height,
            _merkleState: mt._merkleState
        };

        for (let i = 0; i < spentNullifiers.length; i = i + 2) {
            const firstUtxoIndex = historyState.nullifiers.indexOf(spentNullifiers[i]);
            const secondUtxoIndex = historyState.nullifiers.indexOf(spentNullifiers[i + 1]);

            const firstInputAmount = historyState.utxoList[firstUtxoIndex]
                ? historyState.utxoList[firstUtxoIndex].amount
                : 0n;

            const secondInputAmount = historyState.utxoList[secondUtxoIndex]
                ? historyState.utxoList[secondUtxoIndex].amount
                : 0n;

            const delta = deltaList[i / 2];
            const countOfOwnUtxo = ownUtxoCountList[i / 2];
            const blockNumber = blockNumberList[i / 2];
            const amount = ownTxAmountList[i / 2];

            const historyItem = getHistoryItem(
                delta,
                firstUtxoIndex,
                secondUtxoIndex,
                countOfOwnUtxo,
                firstInputAmount,
                secondInputAmount,
                blockNumber,
                amount
            );

            if (historyItem) {
                historyState.items.push(historyItem);
            }
        }

        const spentUtxoNullifiers = findDuplicates<bigint>(
            utxoState.nullifiers.concat(spentNullifiers).concat(myNullifiers)
        );

        // find spent utxo
        for (const nullifier of spentUtxoNullifiers) {

            const oldPackIndex = utxoState.nullifiers.indexOf(nullifier);
            const newPackIndex = myNullifiers.indexOf(nullifier);

            if (oldPackIndex !== -1) {
                utxoState.nullifiers = utxoState.nullifiers.filter((x, i) => i !== oldPackIndex);
                utxoState.utxoList = utxoState.utxoList.filter((x, i) => i !== oldPackIndex);
            }

            if (newPackIndex !== -1) {
                myNullifiers = myNullifiers.filter((x, i) => i !== newPackIndex);
                myUtxo = myUtxo.filter((x, i) => i !== newPackIndex);
            }

        }

        utxoState.nullifiers = utxoState.nullifiers.concat(myNullifiers);
        utxoState.utxoList = utxoState.utxoList.concat(myUtxo);

        const sortedHistory = historyState.items.sort(sortHistory);
        this.zpHistoryState = {
            items: sortedHistory,
            lastBlockNumber: historyState.lastBlockNumber,
            nullifiers: historyState.nullifiers,
            utxoList: historyState.utxoList
        };

        this.utxoState = utxoState;

        return {
            historyItems: historyState.items,
            balances: calculateBalance(utxoState)
        };
    }

    async getBalance(callback?: (update: GetBalanceProgressNotification) => any) {

        // callback && callback({ step: 'start' });

        const state = await this.myUtxoState(this.utxoState, callback);
        this.utxoState = state;

        callback && callback({ step: 'calculate-balances' });

        const balances = calculateBalance(state);

        callback && callback({ step: 'finish' });

        return balances;
    }


    async myUtxoState(srcState: MyUtxoState<bigint>, callback?: (update: any) => any): Promise<MyUtxoState<bigint>> {

        const blockEvents = await this.ZeroPool.publishBlockEvents(+srcState.lastBlockNumber + 1);

        return calculateUtxoState(
            this.zpKeyPair.privateKey,
            srcState,
            blockEvents,
            callback
        );

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

function getHistoryItem(
    delta: bigint,
    firstUtxoIndex: number,
    secondUtxoIndex: number,
    countOfOwnUtxo: number,
    firstInputAmount: bigint,
    secondInputAmount: bigint,
    blockNumber: number,
    amount: bigint
): HistoryItem | null {

    const action = getAction(delta);

    if (
        action === WITHDRAW_ACTION &&
        (
            firstUtxoIndex !== -1 ||
            secondUtxoIndex !== -1
        )
    ) {

        return {
            action,
            type: 'out',
            amount: Number(bn128.r - delta),
            blockNumber
        };

    }

    if (
        action === DEPOSIT_ACTION &&
        amount > 0n
    ) {

        return {
            action,
            type: 'in',
            amount: Number(delta),
            blockNumber
        };

    }

    if (
        amount > 0n &&
        action !== DEPOSIT_ACTION &&
        (
            firstUtxoIndex === -1 &&
            secondUtxoIndex === -1
        )
    ) {

        return {
            action,
            type: 'in',
            amount: Number(amount),
            blockNumber
        };

    }

    const utxoAmount = firstInputAmount + secondInputAmount - amount;
    if (
        action === TRANSFER_ACTION &&
        utxoAmount > 0n &&
        (
            firstUtxoIndex !== -1 ||
            secondUtxoIndex !== -1
        ) &&
        countOfOwnUtxo !== 2
    ) {

        return {
            action,
            type: 'out',
            amount: Number(
                firstInputAmount +
                secondInputAmount -
                amount
            ),
            blockNumber
        };

    }

    return null;

}

async function calculateUtxoState(
    privateKey: bigint,
    srcState: MyUtxoState<bigint>,
    blockEventList: PublishBlockEvent[],
    callback?: (update: any) => any
): Promise<MyUtxoState<bigint>> {

    if (blockEventList.length === 0) {
        return srcState;
    }

    const utxoState = copyMyUtxoState(srcState);

    utxoState.lastBlockNumber = blockEventList[blockEventList.length - 1].blockNumber;

    const mt: IMerkleTree = MerkleTree.fromObject(utxoState.merkleTreeState);
    const utxoCount = mt.length;

    let {
        myNullifiers,
        myUtxo,
        spentNullifiers,
        utxoHashList
    } = await parseBlockEvents(privateKey, blockEventList, utxoCount);

    for (const blockHashList of utxoHashList) {
        mt.pushMany(blockHashList);
        mt.pushZeros(512 - blockHashList.length);
    }

    utxoState.merkleTreeState = {
        length: mt.length,
        height: mt.height,
        _merkleState: mt._merkleState
    };

    const spentUtxoNullifiers = findDuplicates<bigint>(
        utxoState.nullifiers.concat(spentNullifiers).concat(myNullifiers)
    );

    // find spent utxo
    for (const nullifier of spentUtxoNullifiers) {

        const oldPackIndex = utxoState.nullifiers.indexOf(nullifier);
        const newPackIndex = myNullifiers.indexOf(nullifier);

        if (oldPackIndex !== -1) {
            utxoState.nullifiers = utxoState.nullifiers.filter((x, i) => i !== oldPackIndex);
            utxoState.utxoList = utxoState.utxoList.filter((x, i) => i !== oldPackIndex);
        }

        if (newPackIndex !== -1) {
            myNullifiers = myNullifiers.filter((x, i) => i !== newPackIndex);
            myUtxo = myUtxo.filter((x, i) => i !== newPackIndex);
        }

    }

    utxoState.nullifiers = utxoState.nullifiers.concat(myNullifiers);
    utxoState.utxoList = utxoState.utxoList.concat(myUtxo);

    return utxoState;
}

async function parseBlockEvents(
    privateKey: bigint,
    newBlockEventList: PublishBlockEvent[],
    lastUtxoCount: number
): Promise<ParsedBlockList> {

    const utxoHashList: bigint[][] = [];
    const spentNullifiers: bigint[] = [];
    const deltaList: bigint[] = [];
    const ownTxAmountList: bigint[] = [];
    const ownUtxoCountList: number[] = [];
    const blockNumberList: number[] = [];

    const myNullifiers: bigint[] = [];
    const myUtxo: Utxo<bigint>[] = [];

    let utxoPathPointer = 0;
    for (const block of newBlockEventList) {

        const blockUtxoHashList: bigint[] = [];

        for (const item of block.params.BlockItems) {

            const tx = bigintifyTx(item.tx);

            const encryptedUtxoPair: bigint[][] = [
                tx.txExternalFields.message[0].data,
                tx.txExternalFields.message[1].data
            ];

            const utxoHashPair: bigint[] = [
                tx.utxoHashes[0],
                tx.utxoHashes[1]
            ];

            let countOfOwnUtxo = 0;
            let ownTxAmount = 0n;
            for (const [i, encryptedUtxo] of encryptedUtxoPair.entries()) {

                await delay(1);

                const decryptedUtxo = tryDecryptUtxo(
                    privateKey,
                    encryptedUtxo,
                    utxoHashPair[i],
                );

                if (decryptedUtxo) {
                    const utxoNumber = lastUtxoCount + utxoPathPointer;

                    decryptedUtxo.utxo.blockNumber = block.blockNumber;
                    decryptedUtxo.utxo.mp_path = utxoNumber;
                    decryptedUtxo.utxo.txNumber = Math.floor(utxoNumber / 2);

                    countOfOwnUtxo++;
                    ownTxAmount += decryptedUtxo.utxo.amount;

                    myUtxo.push(decryptedUtxo.utxo);
                    myNullifiers.push(decryptedUtxo.nullifier);
                }

                utxoPathPointer++;

            }


            spentNullifiers.push(...tx.nullifier);
            deltaList.push(tx.delta);
            blockUtxoHashList.push(...tx.utxoHashes);
            ownTxAmountList.push(ownTxAmount);
            ownUtxoCountList.push(countOfOwnUtxo);
            blockNumberList.push(block.blockNumber);

        }

        utxoHashList.push(blockUtxoHashList);
        utxoPathPointer += (512 - (block.params.BlockItems.length * 2));

    }

    return {
        spentNullifiers,
        deltaList,
        ownTxAmountList,
        utxoHashList,
        myNullifiers,
        myUtxo,
        ownUtxoCountList,
        blockNumberList
    }

}

export async function calculateUtxo(
    srcUtxoList: Utxo<bigint>[],
    token: bigint,
    toPubKey: bigint,
    myPubKey: bigint,
    transferringAmount: bigint,
    delta: bigint
): Promise<UtxoPair> {

    assert.ok(srcUtxoList.length !== 0 || delta > 0n, 'you have not utxoList');

    let utxoList = [...srcUtxoList].sort(sortUtxo);

    const utxoIn = utxoList.slice(0, 2);

    const utxoInAmount = utxoIn.reduce((acc, val) => {
        acc += val.amount;
        return acc;
    }, 0n);

    assert.ok(
        utxoInAmount >= transferringAmount,
        `${transferringAmount} of ${token} not fill in 2 inputs`
    );

    const myChange = utxoInAmount - transferringAmount + delta;

    const utxoOut = [
        utxo(token, transferringAmount, toPubKey)
    ];

    if (myChange > 0) {
        utxoOut.push(
            utxo(token, myChange, myPubKey)
        );
    }

    // if (utxoIn.length !== 2) {
    //     utxoIn.push(empty_utxo(token, myPubKey))
    // }
    //
    // if (utxoOut.length !== 2) {
    //     utxoOut.push(empty_utxo(token, myPubKey))
    // }

    return { utxoIn, utxoOut }
}

function calculateBalance(state: MyUtxoState<bigint>): { [key: string]: number } {
    const balances: { [key: string]: number } = {};
    for (const utxo of state.utxoList) {
        const asset = toHex(utxo.token);
        if (!balances[asset]) {
            balances[asset] = Number(utxo.amount);
            continue;
        }
        balances[asset] += Number(utxo.amount);
    }
    return balances;
}
