import { gasLessCall, getCallData, getEvents, hash, tbn, toHex, Web3Ethereum } from '../ethereum';
import * as zeroPoolAbi from './zeropool.abi.json';
import { Contract } from 'web3-eth-contract';
import { TxExternalFieldsStructure, TxStructure } from "./eth-structures";
import { AbiItem } from 'web3-utils';
import { Deposit, PayNote } from "./zeropool-contract.dto";

class ZeroPoolContract {

    public readonly web3Ethereum: Web3Ethereum;

    private readonly contractAddress: string;
    private readonly privateKey: string;
    private readonly instance: Contract;

    constructor(
        contractAddress: string,
        privateKey: string,
        connectionString: string = 'http://127.0.0.1:8545'
    ) {
        this.contractAddress = contractAddress;
        this.privateKey = privateKey;
        this.web3Ethereum = new Web3Ethereum(connectionString);
        this.instance = this.web3Ethereum.createInstance(zeroPoolAbi as AbiItem[], contractAddress);
    }

    async deposit(deposit: Deposit) {
        const data = getCallData(
            this.instance,
            'deposit',
            [
                deposit.token,
                toHex(deposit.amount),
                deposit.txHash
            ]
        );

        const signedTransaction = await this.web3Ethereum.signTransaction(
            this.privateKey,
            // @ts-ignore
            this.instance._address,
            deposit.amount,
            data
        );
        return this.web3Ethereum.sendTransaction(signedTransaction);
    };

    async cancelDeposit(payNote: PayNote) {
        const data = getCallData(this.instance, 'depositCancel', [[
            [
                payNote.utxo.owner,
                payNote.utxo.token,
                toHex(payNote.utxo.amount)
            ],
            toHex(payNote.blockNumber),
            payNote.txHash
        ]]);

        const signedTransaction = await this.web3Ethereum.signTransaction(
            this.privateKey,
            // @ts-ignore
            this.instance._address,
            0,
            data
        );
        return this.web3Ethereum.sendTransaction(signedTransaction);
    };

    async withdraw(payNote: PayNote) {
        const data = getCallData(this.instance, 'withdraw', [[
            [
                payNote.utxo.owner,
                payNote.utxo.token,
                toHex(payNote.utxo.amount)
            ],
            toHex(payNote.blockNumber),
            payNote.txHash
        ]]);

        const signedTransaction = await this.web3Ethereum.signTransaction(
            this.privateKey,
            // @ts-ignore
            this.instance._address,
            0,
            data
        );
        return this.web3Ethereum.sendTransaction(signedTransaction);
    };

    async publishBlock(blocks, rollup_cur_block_num, blocknumber_expires) {
        blocks = blocks.map(packBlock);
        const data = getCallData(this.instance, 'publishBlock', [blocks, toHex(rollup_cur_block_num), toHex(blocknumber_expires)]);
        const signedTransaction = await this.web3Ethereum.signTransaction(this.privateKey, this.instance._address, 0, data);
        return this.web3Ethereum.sendTransaction(signedTransaction);
    };

    getDepositEvents() {
        return getEvents(this.instance, 'Deposit')
            .then(async (events) => {
                const transaction = events.map(event => this.web3Ethereum.getTransaction(event.transactionHash));
                return Promise.all(transaction);
            }).then(transactions => {
                return transactions.map(tx => {
                    const depositData = this.decodeDeposit(tx.input);
                    return {
                        token: depositData.token,
                        amount: depositData.amount,
                        txhash: depositData.txhash,
                        owner: tx.from,
                        blocknumber: tx.blockNumber
                    }
                })
            })
    }

    publishBlockEvents() {
        return getEvents(this.instance, 'NewBlockPack')
            .then(async (events) => {
                const transaction = events.map(event => this.web3Ethereum.getTransaction(event.transactionHash));
                return Promise.all(transaction);
            }).then(transactions => {
                return transactions
                    .map(tx => {
                        return {
                            BlockItems: this.decodePublishedBlocks(tx.input).BlockItems,
                            relayer: tx.from,
                            blocknumber: tx.blockNumber
                        }
                    });
            })
    }

    decodeDeposit(hex) {
        const decodedParameters = this.web3Ethereum.decodeParameters(['address', 'uint256', 'bytes32'], hex.substring(11));
        return {
            token: decodedParameters['0'],
            amount: decodedParameters['1'],
            txhash: decodedParameters['2']
        }
    }

    decodePublishedBlocks(hex) {
        const BlockItem = {
            "Tx": TxStructure,
            "new_root": 'uint256',
            "deposit_blocknumber": 'uint256'
        };

        const decodedParameters = this.web3Ethereum.decodeParameters([{ "BlockItem[]": BlockItem }, 'uint', 'uint'], hex.substring(11));
        return {
            BlockItems: decodedParameters['0'],
            rollup_cur_block_num: decodedParameters['1'],
            blocknumber_expires: decodedParameters['2']
        }
    }

    getDepositTxNum({ token, amount, txhash, owner, blocknumber }) {
        const encodedData = this.web3Ethereum.encodeParameters(
            ['address', 'address', 'uint256', 'uint256', 'bytes32'],
            [owner, token, amount, blocknumber, txhash]
        );
        const h = hash(encodedData);
        return gasLessCall(this.instance, 'deposit_state', owner, [h]);
    }

    getRollupTxNum() {
        return gasLessCall(this.instance, 'rollup_tx_num', '0x0000000000000000000000000000000000000000', []);
    }

    encodeTxExternalFields(owner, encryptedUTXOs) {
        return this.web3Ethereum.encodeParameter(
            {
                "TxExternalFields": TxExternalFieldsStructure
            },
            {
                "owner": owner.substring(2),
                "Message": [
                    {
                        "data": encryptedUTXOs[0].map(x => x.toString()),
                    },
                    {
                        "data": encryptedUTXOs[1].map(x => x.toString()),
                    },
                ]
            }
        );
    }

    encodeTx({ rootptr, nullifier, utxo, token, delta, TxExternalFields, proof }) {
        return this.web3Ethereum.encodeParameter(
            {
                "Tx": TxStructure
            },
            {
                "rootptr": rootptr.toString(),
                "nullifier": nullifier.map(x => x.toString()),
                "utxo": utxo.map(x => x.toString()),
                "token": token.toString(),
                "delta": delta.toString(),
                "TxExternalFields": {
                    "owner": TxExternalFields.owner,
                    "Message": [
                        {
                            "data": TxExternalFields.Message[0].map(x => x.toString()),
                        },
                        {
                            "data": TxExternalFields.Message[1].map(x => x.toString()),
                        },
                    ]
                },
                "proof": proof.map(x => x.toString())
            }
        )
    }


}

function packBlock({
                       proof,
                       message1, message2, owner, delta, token, utxo,
                       nullifier, rootptr, new_root, deposit_blocknumber
                   }) {
    const Proof = [proof];
    const Message = [[message1], [message2]];
    const TxExternalFields = [owner, Message];
    const Tx = [rootptr, nullifier, utxo, token, delta, TxExternalFields, Proof];
    return [Tx, new_root, deposit_blocknumber];
}

module.exports = ZeroPoolContract;
