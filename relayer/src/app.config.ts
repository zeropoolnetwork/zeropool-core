import * as config from 'config';

const appConfig = config.get('app');
const networkConfig = config.get('network');

export const AppConfig = {
    port: process.env.PORT || appConfig.port || 3000,
    txAggregationTime: process.env.BLOCK_TIME || appConfig.txAggregationTime || 2000,
};

export const NetworkConfig = {
    rpc: process.env.RPC || networkConfig.rpc,
    contract: process.env.CONTRACT || networkConfig.contract,
    etherscan_prefix: process.env.ETHERSCAN_PREFIX || networkConfig.etherscan_prefix,
};

export const Mnemonic = process.env.MNEMONIC || config.get('mnemonic');
