const ZeroPool = artifacts.require("ZeroPool");

module.exports = function(deployer) {
  deployer.deploy(ZeroPool);
};
