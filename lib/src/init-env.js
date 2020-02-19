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

const web3ProviderUrl = process.env.URL || "https://rinkeby.infura.io/";

module.exports = {
  zpMnemonic,
  ethPrivateKey,
  contractAddress,
  web3ProviderUrl
};
