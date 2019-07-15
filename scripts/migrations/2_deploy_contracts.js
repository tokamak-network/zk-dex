var createNoteVerifier = artifacts.require("../../circuit/createNote/verifier.sol");

module.exports = function(deployer) {
  // deployer.deploy(SecretNote, 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee, 0x00eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee);
  deployer.deploy(createNoteVerifier);
};
