const MakeNoteVerifier = artifacts.require("mintNBurnNote_Verifier.sol");
const SpendNoteVerifier = artifacts.require("transferNote_Verifier.sol");
const MakeOrderVerifier = artifacts.require("makeOrder_Verifier.sol");
const TakeOrderVerifier = artifacts.require("takeOrder_Verifier.sol");
const SettleOrderVerifier = artifacts.require("settleOrder_Verifier.sol");

const ZkDex = artifacts.require("ZkDex.sol");
const MockDai = artifacts.require("MockDai.sol");

module.exports = async function(deployer) {
  await deployer.deploy(MockDai);
  await deployer.deploy(MakeNoteVerifier);
  await deployer.deploy(SpendNoteVerifier);
  await deployer.deploy(MakeOrderVerifier);
  await deployer.deploy(TakeOrderVerifier);
  await deployer.deploy(SettleOrderVerifier);

  await deployer.deploy(
    ZkDex,
    true,
    MockDai.address,
    (await MakeNoteVerifier.deployed()).address,
    (await SpendNoteVerifier.deployed()).address,
    (await MakeOrderVerifier.deployed()).address,
    (await TakeOrderVerifier.deployed()).address,
    (await SettleOrderVerifier.deployed()).address,
  );
};