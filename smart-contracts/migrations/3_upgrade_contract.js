const ZeroPool = artifacts.require("ZeroPool");
const MainnetProxy = artifacts.require("MainnetProxy");

module.exports = async function(deployer, network, accounts) {
  const mainnetProxy = await MainnetProxy.at(process.env.PROXY_ADDRESS);
  await deployer.deploy(ZeroPool);

  await mainnetProxy.hardfork(ZeroPool.address, '0x');
};
