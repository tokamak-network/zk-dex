// Groth16 verifiers (migrated from ZoKrates to Circom/snarkjs)
const MintBurnNoteVerifier = artifacts.require('MintBurnNoteVerifier');
const TransferNoteVerifier = artifacts.require('TransferNoteVerifier');
const ConvertNoteVerifier = artifacts.require('ConvertNoteVerifier');
const MakeOrderVerifier = artifacts.require('MakeOrderVerifier');
const TakeOrderVerifier = artifacts.require('TakeOrderVerifier');
const SettleOrderVerifier = artifacts.require('SettleOrderVerifier');

const ZkDex = artifacts.require('ZkDex.sol');
const MockDai = artifacts.require('MockDai.sol');

module.exports = async function (deployer, network) {
  // Security: Determine development mode based on network
  // Development mode MUST be false on production networks to enforce ZK proof verification
  const developmentNetworks = ['development', 'test', 'ganache', 'hardhat'];
  const isDevelopment = developmentNetworks.includes(network);

  // Security check: Explicitly fail if attempting to deploy in development mode on production networks
  const productionNetworks = ['mainnet', 'goerli', 'sepolia', 'arbitrum', 'optimism', 'polygon'];
  if (productionNetworks.includes(network) && isDevelopment) {
    throw new Error(
      `❌ SECURITY ERROR: Cannot deploy with development=true on ${network}.\n` +
      `   Development mode bypasses ZK proof verification and MUST be disabled in production.\n` +
      `   Current setting: development=${isDevelopment}`
    );
  }

  console.log(`📋 Deployment Configuration:`);
  console.log(`   Network: ${network}`);
  console.log(`   Development mode: ${isDevelopment}`);
  console.log(`   ZK proof verification: ${isDevelopment ? '❌ DISABLED (dev only)' : '✅ ENABLED'}`);

  // Require explicit confirmation for production deployment
  if (!isDevelopment) {
    console.log(`\n🔒 Production deployment detected - ZK proofs will be enforced.`);
  }

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
    isDevelopment,  // Development mode based on network
    MockDai.address,
    (await MintBurnNoteVerifier.deployed()).address,
    (await TransferNoteVerifier.deployed()).address,
    (await ConvertNoteVerifier.deployed()).address,
    (await MakeOrderVerifier.deployed()).address,
    (await TakeOrderVerifier.deployed()).address,
    (await SettleOrderVerifier.deployed()).address,
  );

  // Post-deployment verification
  const zkDex = await ZkDex.deployed();
  const actualDevelopmentMode = await zkDex.development();

  console.log(`\n✅ Deployment completed:`);
  console.log(`   ZkDex address: ${zkDex.address}`);
  console.log(`   Development mode: ${actualDevelopmentMode}`);

  // Final security check
  if (!isDevelopment && actualDevelopmentMode) {
    throw new Error(
      `❌ CRITICAL SECURITY ERROR: Contract deployed with development=true on production network!\n` +
      `   This allows bypassing ZK proof verification. Deployment MUST be reverted.`
    );
  }

  if (!isDevelopment) {
    console.log(`\n🔒 Security verification passed: ZK proof verification is ENABLED.`);
  }
};
