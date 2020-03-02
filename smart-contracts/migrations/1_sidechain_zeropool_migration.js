const ZeroPool = artifacts.require("ZeropoolSidechain");
const MainnetProxy = artifacts.require("SidechainProxy");


module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(MainnetProxy);
  await deployer.deploy(ZeroPool);

  const mainnetProxy = await MainnetProxy.deployed();

  const hardforkcalldata = web3.eth.abi.encodeFunctionCall({
    name: 'init',
    type: 'function',
    inputs: [{
        type: 'address',
        name: 'relayer'
    }]
  }, [accounts[0]]);

console.log(hardforkcalldata)
  await mainnetProxy.hardfork(ZeroPool.address, hardforkcalldata);

};
