var createNote_verifier = artifacts.require("./createNoteVerifier.sol");
var liquidateNote_verifier = artifacts.require("./liquidateNoteVerifier.sol");
var makeOrder_verifier = artifacts.require("./makeOrderVerifier.sol");
var takeOrder_verifier = artifacts.require("./takeOrderVerifier.sol");
var settleOrder_verifier = artifacts.require("./settleOrderVerifier.sol");
var transferNote_verifier = artifacts.require("./transferNoteVerifier.sol");

module.exports = function(deployer) {
  deployer.deploy(createNote_verifier);
  deployer.deploy(liquidateNote_verifier);
  deployer.deploy(makeOrder_verifier);
  deployer.deploy(takeOrder_verifier);
  deployer.deploy(settleOrder_verifier);
  deployer.deploy(transferNote_verifier);
};
