const ZkDai = artifacts.require("TestZkDai.sol");
const MockDai = artifacts.require("MockDai.sol");

module.exports = async function(deployer) {
  await deployer.deploy(MockDai);
  await deployer.deploy(ZkDai, true, MockDai.address);
};