var createNote_verifier = artifacts.require("./createNote-verifier.sol");
var liquidateNote_verifier = artifacts.require("./liquidateNote-verifier.sol");
var makeOrder_verifier = artifacts.require("./makeOrder-verifier.sol");
var settleOrder_verifier = artifacts.require("./settleOrder-verifier.sol");
var transferNote_verifier = artifacts.require("./transferNote-verifier.sol");

module.exports = function(deployer) {
  deployer.deploy(createNote-erifier);
  deployer.deploy(liquidateNote-verifier);
  deployer.deploy(makeOrder-verifier);
  deployer.deploy(settleOrder-verifier);
  deployer.deploy(transferNote-verifier);
};
