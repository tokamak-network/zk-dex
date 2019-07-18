const ZkDex = artifacts.require("ZkDex.sol");
const MockDai = artifacts.require("MockDai.sol");

module.exports = async function(deployer) {
  await deployer.deploy(MockDai);
  await deployer.deploy(ZkDex, true, MockDai.address);
};
