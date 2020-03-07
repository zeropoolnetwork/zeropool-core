import Web3 from 'web3';
import { AbiItem, keccak256 } from 'web3-utils';
import { Contract, EventData } from 'web3-eth-contract';
import { HttpProvider } from 'web3-providers-http';
import { Transaction } from 'web3-core';
import { addHexPrefix, privateToAddress, toChecksumAddress } from 'ethereumjs-util';
import { Transaction as Tx, TxData } from 'ethereumjs-tx';
import { BigNumber } from 'bignumber.js'
import { toHex } from "../utils";

export class Web3Ethereum {

    // @ts-ignore
    public ethAddress: string;

    private web3: Web3;

    constructor(provider: HttpProvider) {
        this.web3 = new Web3(provider);
        this.web3.eth.getAccounts()
            .then((addresses: string[]) => {
                if (addresses.length === 0) {
                    console.warn('web3 provider has not addresses');
                } else {
                    this.ethAddress = addresses[0];
                }
            });
    }

    createInstance(abi: AbiItem[], address?: string,): Contract {
        return new this.web3.eth.Contract(abi, address);
    }

    getTransaction(txHash: string): Promise<Transaction> {
        return this.web3.eth.getTransaction(txHash);
    }

    getBalance(address: string): Promise<string> {
        return this.web3.eth.getBalance(address);
    }

    getBlockNumber(): Promise<number> {
        return this.web3.eth.getBlockNumber();
    }

    encodeParameter(param: any, value: any): string {
        return this.web3.eth.abi.encodeParameter(param, value)
    }

    encodeParameters(types: any[], value: any): string {
        return this.web3.eth.abi.encodeParameters(types, value)
    }

    decodeParameter(types: any, hex: string): { [key: string]: any } {
        return this.web3.eth.abi.decodeParameter(types, hex)
    }

    decodeParameters(types: any[], hex: string): { [key: string]: any } {
        return this.web3.eth.abi.decodeParameters(types, hex)
    }

    async sendTransaction(
        to: string,
        value: number | string,
        data: string = "",
        confirmations = 1
    ): Promise<string | Transaction> {

        const nonce = await this.web3.eth.getTransactionCount(this.ethAddress);

        return new Promise((resolve) => {
            this.web3.eth.sendTransaction({
                nonce,
                data,
                to,
                from: this.ethAddress,
                value: toHex(value)
            })
                .on('transactionHash', (transactionHash: string) => {
                    if (confirmations === 0) {
                        resolve(transactionHash);
                    }
                })
                .on('receipt', (receipt: any) => {
                    if (confirmations === 1) {
                        resolve(receipt);
                    }
                })
                .on('confirmation', (num: any, receipt: any) => {
                    if (num === confirmations) {
                        resolve(receipt);
                    }
                });
        })
    }

    sendSignedTransaction(rawTx: string, confirmations: number = 1): Promise<string | Transaction> {
        if (rawTx.indexOf('0x') !== 0) {
            rawTx = '0x' + rawTx;
        }

        return new Promise((resolve) => {
            this.web3.eth.sendSignedTransaction(rawTx)
                .on('transactionHash', (transactionHash: string) => {
                    if (confirmations === 0) {
                        resolve(transactionHash);
                    }
                })
                .on('confirmation', (num: any, receipt: any) => {
                    if (num === confirmations) {
                        resolve(receipt);
                    }
                });
        })
    }

    async signTransactionCustom(
        privateKey: string,
        to: string,
        value: number | string,
        data: string = ""
    ) {
        const from = getEthereumAddress(privateKey);

        const nonce = await this.web3.eth.getTransactionCount(from)
            .then((x: number): string => toHex(x));

        const gasPrice = await this.web3.eth.getGasPrice()
            .then((x: string): string => toHex(x));

        const gas = data

            ? await this.web3.eth.estimateGas({ to, data, gas: 5000000, from, value })
                .then((x: number): string => toHex(tbn(x).times(1.2).integerValue()))

            : toHex(21000);

        value = toHex(value);

        const txParam: TxData = { nonce, to, value, data, gasPrice, gasLimit: gas };

        return sign(txParam, privateKey);
    }
}

function sign(txParam: TxData, privateKey: string): string {
    if (privateKey.indexOf('0x') === 0) {
        privateKey = privateKey.substring(2);
    }

    const tx = new Tx(txParam, { chain: 'rinkeby' });
    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    tx.sign(privateKeyBuffer);
    const serializedTx = tx.serialize();
    return serializedTx.toString('hex');
}

export const hash = keccak256;

export const tbn = (x: number | string): BigNumber => new BigNumber(x);
export const tw = (x: string | number | BigNumber) =>
    BigNumber.isBigNumber(x) ? x.times(1e18).integerValue() : tbn(x).times(1e18).integerValue();
export const fw = (x: string | number | BigNumber) =>
    BigNumber.isBigNumber(x) ? x.times(1e-18).toNumber() : tbn(x).times(1e-18).toNumber();

export function getEvents(
    instance: Contract,
    event: string,
    fromBlockNumber: string | number = 0,
    onData?: (data: EventData) => any
): Promise<EventData[]> {
    if (onData) {
        return instance.events[event]({ fromBlock: fromBlockNumber })
            .on('data', function (event: EventData) {
                onData(event);
            })
    }
    return instance.getPastEvents(event, { fromBlock: fromBlockNumber, toBlock: 'latest' })
}

export function gasLessCall(
    instance: Contract,
    methodName: string,
    parameters: any[],
    addressFrom: string = '0x0000000000000000000000000000000000000000',
    blockNumber: string = 'latest'
): Promise<any> {
    return instance.methods[methodName](...parameters).call({ from: addressFrom }, blockNumber);
}

export function getCallData(instance: Contract, methodName: string, parameters: any): string {
    if (!instance.methods[methodName])
        throw new Error(`Method ${ methodName } does not exist`);
    return instance.methods[methodName](...parameters).encodeABI();
}

export function getEthereumAddress(privateKey: string) {
    if (privateKey.indexOf('0x') === 0) {
        privateKey = privateKey.substring(2);
    }
    const addressBuffer = privateToAddress(Buffer.from(privateKey, 'hex'));
    const hexAddress = addressBuffer.toString('hex');
    return addHexPrefix(toChecksumAddress(hexAddress));
}
