// Groth16 verifiers (migrated from ZoKrates to Circom/snarkjs)
const MintBurnNoteVerifier = artifacts.require('MintBurnNoteVerifier');
const TransferNoteVerifier = artifacts.require('TransferNoteVerifier');
const ConvertNoteVerifier = artifacts.require('ConvertNoteVerifier');
const MakeOrderVerifier = artifacts.require('MakeOrderVerifier');
const TakeOrderVerifier = artifacts.require('TakeOrderVerifier');
const SettleOrderVerifier = artifacts.require('SettleOrderVerifier');

const ZkDex = artifacts.require('ZkDex.sol');
const MockDai = artifacts.require('MockDai.sol');

module.exports = async function (deployer) {
  // Deploy MockDai token
  await deployer.deploy(MockDai);

  // Deploy Groth16 verifiers
  await deployer.deploy(MintBurnNoteVerifier);
  await deployer.deploy(TransferNoteVerifier);
  await deployer.deploy(ConvertNoteVerifier);
  await deployer.deploy(MakeOrderVerifier);
  await deployer.deploy(TakeOrderVerifier);
  await deployer.deploy(SettleOrderVerifier);

  // Deploy ZkDex with verifier addresses
  await deployer.deploy(
    ZkDex,
    true,  // development mode
    MockDai.address,
    (await MintBurnNoteVerifier.deployed()).address,
    (await TransferNoteVerifier.deployed()).address,
    (await ConvertNoteVerifier.deployed()).address,
    (await MakeOrderVerifier.deployed()).address,
    (await TakeOrderVerifier.deployed()).address,
    (await SettleOrderVerifier.deployed()).address,
  );
};
