const MakeNoteVerifier = artifacts.require('mintNBurnNote_Verifier.sol');
const SpendNoteVerifier = artifacts.require('transferNote_Verifier.sol');
const ConvertNoteVerifier = artifacts.require('convertNote_Verifier.sol');
const MakeOrderVerifier = artifacts.require('makeOrder_Verifier.sol');
const TakeOrderVerifier = artifacts.require('takeOrder_Verifier.sol');
const SettleOrderVerifier = artifacts.require('settleOrder_Verifier.sol');

const ZkDex = artifacts.require('ZkDex.sol');
const MockDai = artifacts.require('MockDai.sol');

// const USE_DUMMY = process.env.USE_DUMMY === 'true';
const USE_DUMMY = true;

console.log('USE_DUMMY', USE_DUMMY);

module.exports = async function (deployer) {
  await deployer.deploy(MockDai);
  await deployer.deploy(MakeNoteVerifier);
  await deployer.deploy(SpendNoteVerifier);
  await deployer.deploy(ConvertNoteVerifier);
  await deployer.deploy(MakeOrderVerifier);
  await deployer.deploy(TakeOrderVerifier);
  await deployer.deploy(SettleOrderVerifier);

  await deployer.deploy(
    ZkDex,
    USE_DUMMY,
    MockDai.address,
    (await MakeNoteVerifier.deployed()).address,
    (await SpendNoteVerifier.deployed()).address,
    (await ConvertNoteVerifier.deployed()).address,
    (await MakeOrderVerifier.deployed()).address,
    (await TakeOrderVerifier.deployed()).address,
    (await SettleOrderVerifier.deployed()).address,
  );
};
