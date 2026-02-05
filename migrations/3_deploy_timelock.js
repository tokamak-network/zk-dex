// TimeLock contract deployment
const CreateTimeLockVerifier = artifacts.require('CreateTimeLockVerifier');
const SpendTimeLockVerifier = artifacts.require('SpendTimeLockVerifier');
const MintBurnNoteVerifier = artifacts.require('MintBurnNoteVerifier');

const TimeLock = artifacts.require('TimeLock.sol');
const MockDai = artifacts.require('MockDai.sol');

module.exports = async function (deployer, network) {
  // Security: Determine development mode based on network
  const developmentNetworks = ['development', 'test', 'ganache', 'hardhat'];
  const isDevelopment = developmentNetworks.includes(network);

  console.log(`\n📋 TimeLock Deployment Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Development mode: ${isDevelopment}`);

  // Get MockDai address from previous deployment
  const mockDai = await MockDai.deployed();
  console.log(`   MockDai address: ${mockDai.address}`);

  // Get MintBurnNoteVerifier from previous deployment (for ZkDaiBase)
  const mintBurnNoteVerifier = await MintBurnNoteVerifier.deployed();
  console.log(`   MintBurnNoteVerifier address: ${mintBurnNoteVerifier.address}`);

  // Deploy TimeLock verifiers
  await deployer.deploy(CreateTimeLockVerifier);
  await deployer.deploy(SpendTimeLockVerifier);

  const createTimeLockVerifier = await CreateTimeLockVerifier.deployed();
  const spendTimeLockVerifier = await SpendTimeLockVerifier.deployed();

  console.log(`   CreateTimeLockVerifier address: ${createTimeLockVerifier.address}`);
  console.log(`   SpendTimeLockVerifier address: ${spendTimeLockVerifier.address}`);

  // Deploy TimeLock contract
  await deployer.deploy(
    TimeLock,
    isDevelopment,
    mockDai.address,
    mintBurnNoteVerifier.address,
    createTimeLockVerifier.address,
    spendTimeLockVerifier.address
  );

  const timeLock = await TimeLock.deployed();

  console.log(`\n✅ TimeLock Deployment completed:`);
  console.log(`   TimeLock address: ${timeLock.address}`);
  console.log(`   Development mode: ${await timeLock.development()}`);

  // Output for frontend configuration
  console.log(`\n📝 Frontend Configuration:`);
  console.log(`   localStorage.setItem('zkdex_timelock_address', '${timeLock.address}')`);
};
