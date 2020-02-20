import dotenv from 'dotenv';

const isProduction = process.env.NODE_ENV === 'production';

dotenv.config({
  path: isProduction ? './.env' : './.env-dev'
});

type Config = {
  PRIVATE_KEY: string,
  RPC: string,
  MNEMONIC: string,
  CONTRACT_ADDRESS: string
}

const zpMnemonic = process.env.MNEMONIC;
if (!zpMnemonic) {
  throw new Error('MNEMONIC env not defined');
}

const ethPrivateKey = process.env.PRIVATE_KEY;
if (!ethPrivateKey) {
  throw new Error('PRIVATE_KEY env not defined');
}

const contractAddress = process.env.CONTRACT_ADDRESS;
if (!contractAddress) {
  throw new Error('CONTRACT_ADDRESS env not defined');
}

const web3ProviderUrl = process.env.RPC || "https://rinkeby.infura.io/";

const config: Config = {
  PRIVATE_KEY: ethPrivateKey,
  RPC: web3ProviderUrl,
  MNEMONIC: zpMnemonic,
  CONTRACT_ADDRESS: contractAddress
};

export default config;
