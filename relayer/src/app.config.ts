console.log( process.env.NODE_ENV)

import * as config from 'config';


const appConfig = config.get('app') as any;
const networkConfig = config.get('network') as any;

export const AppConfig = {
    port: process.env.PORT || appConfig.port || 3000,
    txAggregationTime: process.env.BLOCK_TIME || appConfig.txAggregationTime || 2000,
};

export const NetworkConfig = {
    rpc: process.env.RPC || networkConfig.rpc,
    contract: process.env.CONTRACT_ADDRESS || networkConfig.contract,
    etherscan_prefix: process.env.ETHERSCAN_PREFIX || networkConfig.etherscan_prefix,
};

console.log('CONFIG: #1');
export const Mnemonic = process.env.MNEMONIC || config.get('mnemonic');
console.log(Mnemonic);
console.log(NetworkConfig.rpc);
console.log(NetworkConfig.contract);
console.log(NetworkConfig.etherscan_prefix);
console.log('CONFIG: #2');
