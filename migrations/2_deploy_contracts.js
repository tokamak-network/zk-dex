const ZkDai = artifacts.require("TestZkDai.sol");
const MockDai = artifacts.require("MockDai.sol");

module.exports = async function(deployer) {
  await deployer.deploy(MockDai);
  await deployer.deploy(ZkDai, 10000, web3.utils.toBN(1e18.toString(10))  , MockDai.address);
};