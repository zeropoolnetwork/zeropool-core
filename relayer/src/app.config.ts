// import * as config from 'config';

// const appConfig = config.get('app'); // todo: describe it
// const networkConfig = config.get('network');

export const AppConfig = {
  port: +process.env.PORT || 3000,
  txAggregationTime: +process.env.BLOCK_TIME || 2000,
};

export const NetworkConfig = {
  rpc: process.env.RPC || 'http://127.0.0.1:8545',
  contract: process.env.CONTRACT_ADDRESS,
  etherscan_prefix: process.env.ETHERSCAN_PREFIX
};

// export const AppConfig = {
//     port: process.env.PORT || appConfig.port || 3000,
//     txAggregationTime: process.env.BLOCK_TIME || appConfig.txAggregationTime || 2000,
// };
//
// export const NetworkConfig = {
//     rpc: process.env.RPC || networkConfig.rpc || 'http://127.0.0.1:8545',
//     contract: process.env.CONTRACT_ADDRESS || networkConfig.contract,
//     etherscan_prefix: process.env.ETHERSCAN_PREFIX || networkConfig.etherscan_prefix,
// };

export const Mnemonic = process.env.MNEMONIC;
// export const Mnemonic = process.env.MNEMONIC || config.get('mnemonic');
