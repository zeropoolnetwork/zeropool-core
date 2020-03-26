import { ZeroPoolNetwork } from 'zeropool-lib';
// @ts-ignore
import * as HDWalletProvider from 'truffle-hdwallet-provider';
import * as fs from 'fs';
import * as path from 'path';
import { NetworkConfig } from '../src/app.config';

const testMnemonic = 'easy orphan imitate asthma sphere train enrich safe average crouch puzzle chunk delay pear digital jelly slam discover damage mandate enough beauty laptop update';

const hdWallet = new HDWalletProvider(testMnemonic, NetworkConfig.rpc, 0, 1);
const gasHdWallet = new HDWalletProvider(testMnemonic, NetworkConfig.gasRpc, 0, 1);

// const transactionJsonPath = path.join(__dirname, './../compiled/transaction.json');
// // const transactionJson = fs.readFileSync(transactionJsonPath);

import * as transactionJson from './../compiled/transaction.json';

const proverKeyPath = path.join(__dirname, './../compiled/transaction_pk.bin');
// @ts-ignore
const proverKey = fs.readFileSync(proverKeyPath).buffer;

export const zp = new ZeroPoolNetwork(
    NetworkConfig.contract,
    // @ts-ignore
    hdWallet,
    testMnemonic,
    transactionJson,
    proverKey,
);

export const gasZp = new ZeroPoolNetwork(
    NetworkConfig.gasContract,
    // @ts-ignore
    gasHdWallet,
    testMnemonic,
    transactionJson,
    proverKey,
);
