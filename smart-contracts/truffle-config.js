const env = process.env;
if (env.NODE_ENV !== 'production') {
  require('dotenv').load();
}

const HDWalletProvider = require('truffle-hdwallet-provider');


module.exports = {
  compilers: {
    solc: {
      version: "0.5.2",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
    },
    ropsten: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://ropsten.infura.io/", 0, 10),
      network_id: 3, // eslint-disable-line camelcase
      skipDryRun: true
    },
    coverage: {
      host: 'localhost',
      network_id: '*', // eslint-disable-line camelcase
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01,
    },
    testrpc: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
    },
    rinkeby: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://rinkeby.infura.io/", 0, 10),
      network_id: 4,
      skipDryRun: true
    },
    sokol: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://sokol.poa.network/", 0, 10),
      network_id: "*", // Match any network id
      skipDryRun: true
    },
    skale: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "http://157.230.154.5:8134/", 0, 10),
      gasPrice: 0,
      network_id: "*",
      skipDryRun: true
    },
    thunder: {
      provider: new HDWalletProvider(process.env.MNEMONIC, "https://mainnet-rpc.thundercore.com/"),
      network_id: "*",
      gas: 3000000,
      gasPrice: 20000000000
    },
  },
};

