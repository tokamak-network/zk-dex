# ZK-DEX

Zero-Knowledge Decentralized Exchange - Private trading on Ethereum using ZK-SNARKs.

## Overview

ZK-DEX enables private token trading through:
- **Private Notes**: ETH/DAI balances hidden via ZK-SNARKs
- **Private Orders**: Order details only revealed during settlement
- **On-chain Verification**: Groth16 proof verification on Ethereum

## Architecture

```
circuits-circom/     # Circom 2.1 ZK circuits
contracts/           # Solidity smart contracts (0.8.20)
scripts/lib/         # JavaScript proof generation utilities
test/                # Integration & production tests
examples/            # Frontend usage examples
```

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (optional, for containerized testing)

### Installation

```bash
# Install dependencies
npm install

# Install circuit dependencies
cd circuits-circom && npm install && cd ..
```

### Running Tests

#### Local Testing

```bash
# Start Ganache in another terminal
npx ganache --port 8545 --accounts 10 --defaultBalanceEther 1000

# Run all tests
npx truffle test

# Run production tests (real ZK proof verification)
npx truffle test test/ZkDex.production.test.js
```

#### Docker Testing

```bash
# Build and run tests
docker compose build zkdex
docker compose up zkdex

# Development shell
docker compose --profile dev up zkdex-dev

# Cleanup
docker compose down -v
```

## Circuits

Six Circom circuits handle all ZK-DEX operations:

| Circuit | Purpose | Constraints |
|---------|---------|-------------|
| `mint_burn_note` | Deposit/withdraw ETH or DAI | 125K |
| `transfer_note` | Private transfers | 495K |
| `make_order` | Create trade orders | 126K |
| `take_order` | Accept orders | 248K |
| `settle_order` | Execute trades | 614K |
| `convert_note` | Convert smart notes | 369K |

### Building Circuits

```bash
cd circuits-circom

# Compile all circuits
npm run compile

# Run trusted setup (requires Powers of Tau)
npm run setup

# Generate Solidity verifiers
npm run generate-verifiers
```

## Usage Example

```javascript
const noteProofHelper = require('./scripts/lib/noteProofHelper');

// Initialize
await noteProofHelper.init();

// Generate wallet
const { secretKey, owner0, owner1 } = await noteProofHelper.generateKeypair();

// Create and mint ETH note
const { note, sk } = await noteProofHelper.createNote(
    secretKey,
    BigInt('1000000000000000000'), // 1 ETH
    0, // ETH token type
    '0x0',
    '0x' + crypto.randomBytes(32).toString('hex')
);

// Generate proof
const proof = await noteProofHelper.generateMintProof(note, sk);

// Call contract
await zkDai.mint(proof.a, proof.b, proof.c, proof.input, encryptedNote, { value: '1000000000000000000' });
```

## Testing

### Test Suites

| Test File | Description |
|-----------|-------------|
| `test/integration-test.js` | Node.js circuit tests |
| `test/frontend-integration.test.js` | Frontend API tests |
| `test/boundary-edge-cases.test.js` | Boundary value and edge case tests |
| `test/ZkDex.production.test.js` | On-chain proof verification |

### Test Results

- **21/21** Node.js integration tests passing
- **20/20** Frontend integration tests passing
- **33/33** Boundary and edge case tests passing
- **19/19** Truffle tests passing (including E2E trading flow)

## Technical Details

### Proof System

- **Circuit Language**: Circom 2.1.0
- **Proof System**: Groth16
- **Curve**: BN128
- **Hash Function**: SHA256 (1536-bit for notes)

### Solidity Contracts

- **Version**: 0.8.20
- **EVM**: Paris
- **Verifiers**: snarkjs-generated Groth16 verifiers

### Migration from ZoKrates

This project was migrated from ZoKrates to Circom/snarkjs. See [migration.md](migration.md) for details.

## Documents

- [Architecture (EN)](ARCHITECTURE.md) / [Architecture (KO)](ARCHITECTURE_ko.md)
- [Migration Report (EN)](migration.md) / [Migration Report (KO)](migration_ko.md)
- [Architecture Presentation](https://docs.google.com/presentation/d/1b6yD4iV-vS_KyK27CG9ImMRdTypm9mtIbd5m3a_MNeU/edit?usp=sharing)
- [Demo Video](https://youtu.be/QvKaqMH_5lk)

## License

MIT
