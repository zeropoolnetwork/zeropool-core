import { gasLessCall, getCallData, getEvents, hash, Web3Ethereum } from '../ethereum';
import { Contract, EventData } from 'web3-eth-contract';
import { HttpProvider } from 'web3-providers-http';

import { TxExternalFieldsStructure, TxStructure } from "./eth-structures";
import {
    Block,
    BlockItem,
    BlockItemNote,
    CancelDepositEvent,
    Deposit,
    DepositEvent,
    Event,
    PayNote,
    PublishBlockEvent,
    SmartContractBlockItemSchema,
    Tx,
    TxExternalFields,
    WithdrawEvent
} from "./zeropool-contract.dto";
import { Transaction } from 'web3-core';
import { ZeroPoolAbi } from "./zeropool.abi";
import { toHex } from "../../utils";

export class ZeroPoolContract {

    public readonly web3Ethereum: Web3Ethereum;

    private readonly contractAddress: string;
    private readonly instance: Contract;

    constructor(
        contractAddress: string,
        web3Provider: HttpProvider
    ) {
        this.contractAddress = contractAddress;
        this.web3Ethereum = new Web3Ethereum(web3Provider);
        this.instance = this.web3Ethereum.createInstance(ZeroPoolAbi, contractAddress);
    }

    async deposit(
        deposit: Deposit,
        onTransactionHash?: (error: any, txHash: string | undefined) => void
    ): Promise<Transaction> {

        const params = [
            deposit.token,
            toHex(deposit.amount),
            deposit.txHash
        ];

        const data = getCallData(this.instance, 'deposit', params);

        return (await this.web3Ethereum.sendTransaction({
            to: this.contractAddress,
            value: deposit.amount,
            data
        }, 1, onTransactionHash)) as Transaction;
    };

    async cancelDeposit(
        payNote: PayNote,
        waitBlocks = 0,
        onTransactionHash?: (error: any, txHash: string | undefined) => void
    ): Promise<Transaction> {

        const params = [[
            [
                payNote.utxo.owner,
                payNote.utxo.token,
                toHex(payNote.utxo.amount)
            ],
            toHex(payNote.blockNumber),
            payNote.txHash
        ]];

        const data = getCallData(this.instance, 'depositCancel', params);

        return (await this.web3Ethereum.sendTransaction({
            to: this.contractAddress,
            data
        }, waitBlocks, onTransactionHash)) as Transaction;

    };

    async withdraw(
        payNote: PayNote,
        waitBlocks = 0,
        onTransactionHash?: (error: any, txHash: string | undefined) => void
    ): Promise<Transaction> {

        const params = [[
            [
                payNote.utxo.owner,
                payNote.utxo.token,
                toHex(payNote.utxo.amount)
            ],
            toHex(payNote.blockNumber),
            payNote.txHash
        ]];

        const data = getCallData(this.instance, 'withdraw', params);

        return (await this.web3Ethereum.sendTransaction({
            to: this.contractAddress,
            data
        }, waitBlocks, onTransactionHash)) as Transaction;
    };

    async publishBlock(
        blockItems: BlockItem<string>[],
        rollupCurrentBlockNumber: number,
        blockNumberExpires: number,
        version: number,
        waitBlock = 0,
        gasPrice?: number | string,
        onTransactionHash?: (error: any, txHash: string | undefined) => void
    ): Promise<Transaction> {

        const params = [
            toHex(version),
            blockItems.map(packBlockItem),
            toHex(rollupCurrentBlockNumber),
            toHex(blockNumberExpires)
        ];

        const data = getCallData(this.instance, 'publishBlock', params);

        return (await this.web3Ethereum.sendTransaction({
            to: this.contractAddress,
            data,
            gasPrice
        }, waitBlock, onTransactionHash) as Transaction);
    };

    async challengeTx(
        challengingBlockItem: BlockItemNote<string>,
        lastBlockItem: BlockItemNote<string>
    ): Promise<Transaction> {

        const params = [
            packBlockItemNote(challengingBlockItem),
            packBlockItemNote(lastBlockItem)
        ];

        const data = getCallData(this.instance, 'challengeTx', params);

        return (await this.web3Ethereum.sendTransaction({
            to: this.contractAddress,
            data
        })) as Transaction;
    };

    async challengeUTXOTreeUpdate(
        challengingBlockItem: BlockItemNote<string>,
        previousBlockItem: BlockItemNote<string>
    ): Promise<Transaction> {

        const params = [
            packBlockItemNote(challengingBlockItem),
            packBlockItemNote(previousBlockItem)
        ];

        const data = getCallData(this.instance, 'challengeUTXOTreeUpdate', params);

        return (await this.web3Ethereum.sendTransaction({
            to: this.contractAddress,
            data
        })) as Transaction;
    };

    async challengeDoubleSpend(
        challengingBlockItem: BlockItemNote<string>,
        lastBlockItem: BlockItemNote<string>
    ): Promise<Transaction> {

        const params = [
            packBlockItemNote(challengingBlockItem),
            packBlockItemNote(lastBlockItem)
        ];

        const data = getCallData(this.instance, 'challengeDoubleSpend', params);

        return (await this.web3Ethereum.sendTransaction({
            to: this.contractAddress,
            data
        })) as Transaction;
    };

    async getDepositEvents(): Promise<DepositEvent[]> {
        const events = await getEvents(this.instance, 'Deposit');

        const transactions$: Promise<Transaction>[] = events.map((e: EventData) => {
            return this.web3Ethereum.getTransaction(e.transactionHash);
        });

        const transactions: Transaction[] = await Promise.all<Transaction>(transactions$);

        return transactions.map(
            (tx: Transaction): DepositEvent => {
                const depositCallData = this.decodeDeposit(tx.input);
                return {
                    params: depositCallData,
                    owner: tx.from,
                    blockNumber: tx.blockNumber as number // todo: maybe make sense to handle null
                }
            }
        );
    }

    async publishBlockEvents(fromBlockNumber?: string | number): Promise<PublishBlockEvent[]> {

        const events = await getEvents(
            this.instance,
            'NewBlockPack',
            fromBlockNumber);

        if (events.length === 0) {
            return [];
        }

        return this.parseBlockEvents(events);
    }

    async withdrawEvents(fromBlockNumber?: string | number): Promise<WithdrawEvent[]> {

        const events = await getEvents(
            this.instance,
            'Withdraw',
            fromBlockNumber);

        if (events.length === 0) {
            return [];
        }

        return this.parsePayNoteEvents(events);
    }

    async cancelDepositEvents(fromBlockNumber?: string | number): Promise<CancelDepositEvent[]> {

        const events = await getEvents(
            this.instance,
            'DepositCancel',
            fromBlockNumber);

        if (events.length === 0) {
            return [];
        }

        return this.parsePayNoteEvents(events);
    }

    getContractVersion(): Promise<number> {
        return gasLessCall(this.instance, 'version', []);
    }

    getChallengeExpiresBlocks(): Promise<number> {
        return gasLessCall(this.instance, 'challenge_expires_blocks', []);
    }

    getDepositExpiresBlocks(): Promise<number> {
        return gasLessCall(this.instance, 'deposit_expires_blocks', []);
    }

    private async parseBlockEvents(events: EventData[]): Promise<PublishBlockEvent[]> {
        const transactions$: Promise<Transaction>[] = events.map((e: EventData) => {
            return this.web3Ethereum.getTransaction(e.transactionHash);
        });

        const transactions: Transaction[] = await Promise.all<Transaction>(transactions$);

        return transactions.map(
            (tx: Transaction): PublishBlockEvent => {
                const publishBlockCallData = this.decodePublishedBlocks(tx.input);
                return {
                    params: {
                        BlockItems: publishBlockCallData.BlockItems,
                        blockNumberExpires: publishBlockCallData.blockNumberExpires,
                        rollupCurrentBlockNumber: publishBlockCallData.rollupCurrentBlockNumber
                    },
                    owner: tx.from,
                    blockNumber: tx.blockNumber as number
                }
            }
        );
    }

    decodePublishedBlocks(hex: string): Block<string> {
        const item = {
            "Tx": TxStructure,
            "new_root": 'uint256',
            "deposit_blocknumber": 'uint256'
        };

        const decodedParameters = this.web3Ethereum.decodeParameters(
            ['uint256', { "BlockItem[]": item }, 'uint', 'uint'],
            cutFunctionSignature(hex)
        );

        const blockItems: BlockItem<string>[] = decodedParameters['1']
            .map((item: SmartContractBlockItemSchema) => ({
                newRoot: item.new_root,
                depositBlockNumber: item.deposit_blocknumber,
                tx: {
                    utxoHashes: item.Tx.utxo,
                    rootPointer: item.Tx.rootptr,
                    token: item.Tx.token,
                    delta: item.Tx.delta,
                    nullifier: item.Tx.nullifier,
                    proof: {
                        data: item.Tx.proof
                    },
                    txExternalFields: {
                        owner: item.Tx.TxExternalFields.owner,
                        message: [
                            {
                                data: item.Tx.TxExternalFields.Message[0].data
                            },
                            {
                                data: item.Tx.TxExternalFields.Message[1].data
                            }
                        ]
                    }
                }
            }));

        return {
            BlockItems: blockItems,
            rollupCurrentBlockNumber: decodedParameters['2'],
            blockNumberExpires: decodedParameters['3']
        }
    }

    async getLastRootPointer(): Promise<number | null> {
        const events = await getEvents(this.instance, 'NewBlockPack');
        if (events.length === 0) {
            return null;
        }

        const lastTransaction = await this.web3Ethereum.getTransaction(
            events[events.length - 1].transactionHash
        );

        const publishBlockCallData = this.decodePublishedBlocks(lastTransaction.input);
        return +publishBlockCallData.BlockItems[
        publishBlockCallData.BlockItems.length - 1
            ].tx.rootPointer;
    }

    decodeDeposit(hex: string): Deposit {
        const decodedParameters = this.web3Ethereum.decodeParameters(
            ['address', 'uint256', 'bytes32'],
            cutFunctionSignature(hex)
        );

        return {
            token: decodedParameters['0'],
            amount: decodedParameters['1'],
            txHash: decodedParameters['2']
        }
    }

    decodePayNote(hex: string): PayNote {
        const decodedParameters = this.web3Ethereum.decodeParameters(
            ['address', 'address', 'uint256', 'uint256', 'bytes32'],
            cutFunctionSignature(hex)
        );

        return {
            utxo: {
                owner: decodedParameters['0'],
                token: decodedParameters['1'],
                amount: decodedParameters['2']
            },
            blockNumber: decodedParameters['3'],
            txHash: decodedParameters['4']
        }
    }

    encodeTx(tx: Tx<string>): string {
        return this.web3Ethereum.encodeParameter(
            {
                "Tx": TxStructure
            },
            {
                "rootptr": tx.rootPointer.toString(),
                "nullifier": tx.nullifier,
                "utxo": tx.utxoHashes,
                "token": tx.token,
                "delta": tx.delta.toString(),
                "TxExternalFields": {
                    "owner": tx.txExternalFields.owner,
                    "Message": [
                        {
                            "data": tx.txExternalFields.message[0].data,
                        },
                        {
                            "data": tx.txExternalFields.message[1].data
                        }
                    ]
                },
                "proof": tx.proof.data
            }
        )
    }

    getDepositTxNum(payNote: PayNote): Promise<string> {
        const encodedData = this.web3Ethereum.encodeParameters(
            ['address', 'address', 'uint256', 'uint256', 'bytes32'],
            [payNote.utxo.owner, payNote.utxo.token, payNote.utxo.amount, payNote.blockNumber, payNote.txHash]
        );
        const dataHash = hash(encodedData);
        return gasLessCall(this.instance, 'deposit_state', [dataHash]);
    }

    getRollupTxNum(): Promise<string> {
        return gasLessCall(this.instance, 'rollup_tx_num', []);
    }

    encodeTxExternalFields(txExternalFields: TxExternalFields<bigint>): string {
        return this.web3Ethereum.encodeParameter(
            {
                "TxExternalFields": TxExternalFieldsStructure
            },
            {
                "owner": txExternalFields.owner === 0n ?
                    "0x0000000000000000000000000000000000000000" :
                    toHex(txExternalFields.owner, 40),
                "Message": [
                    {
                        "data": txExternalFields.message[0].data.map(x => x.toString()),
                    },
                    {
                        "data": txExternalFields.message[1].data.map(x => x.toString()),
                    },
                ]
            }
        );
    }

    private async parsePayNoteEvents(events: EventData[]): Promise<Event<PayNote>[]> {
        const transactions$: Promise<Transaction>[] = events.map((e: EventData) => {
            return this.web3Ethereum.getTransaction(e.transactionHash);
        });

        const transactions: Transaction[] = await Promise.all<Transaction>(transactions$);

        return transactions.map(
            (tx: Transaction): WithdrawEvent => {
                const payNote = this.decodePayNote(tx.input);
                return {
                    params: payNote,
                    owner: tx.from,
                    blockNumber: tx.blockNumber as number
                }
            }
        );
    }

}

function cutFunctionSignature(hex: string): string {
    if (hex.indexOf('0x') === 0) {
        return hex.substring(11);
    }
    return hex.substring(8);
}

function packBlockItemNote(blockItemNote: BlockItemNote<string>): any[] {
    const proof = [blockItemNote.proof];
    const id = blockItemNote.id;
    const blockItem = packBlockItem(blockItemNote.BlockItem);
    return [proof, id, blockItem];
}

function packBlockItem(blockItem: BlockItem<string>): any[] {
    const Proof = [blockItem.tx.proof.data];

    const message = [
        [blockItem.tx.txExternalFields.message[0].data],
        [blockItem.tx.txExternalFields.message[1].data],
    ];

    const txExternalFields = [
        blockItem.tx.txExternalFields.owner,
        message
    ];

    const tx = [
        blockItem.tx.rootPointer,
        blockItem.tx.nullifier,
        blockItem.tx.utxoHashes,
        blockItem.tx.token,
        blockItem.tx.delta,
        txExternalFields,
        Proof
    ];

    return [tx, blockItem.newRoot, blockItem.depositBlockNumber];
}

