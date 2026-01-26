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
vapp/                # Vue 3 frontend application
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
# Build and run all tests
docker compose run zkdex

# Run frontend integration tests only
docker compose --profile test run test-frontend

# Run production tests only
docker compose --profile test run test-production

# Cleanup
docker compose down -v
```

## Docker Environment

### Available Services

| Service | Description | Port | Command |
|---------|-------------|------|---------|
| `ganache` | Local Ethereum blockchain | 8545 | `docker compose up ganache -d` |
| `vapp-api` | Backend API server (Express) | 3000 | `docker compose up vapp-api -d` |
| `zkdex` | Main test runner | - | `docker compose run zkdex` |
| `vapp` | Frontend (Production/nginx) | 8080 | `docker compose up vapp -d` |
| `vapp-dev` | Frontend (Development/hot reload) | 8081 | `docker compose --profile dev up vapp-dev -d` |
| `zkdex-dev` | Development shell | - | `docker compose --profile dev run zkdex-dev` |
| `test-frontend` | Frontend integration tests | - | `docker compose --profile test run test-frontend` |
| `test-production` | Production tests | - | `docker compose --profile test run test-production` |

### Quick Start with Docker

```bash
# Start full stack (ganache + backend API + frontend production)
docker compose up ganache vapp-api vapp -d

# Access frontend at http://localhost:8080
# Backend API at http://localhost:3000

# Start full stack (development mode with hot reload)
docker compose --profile dev up ganache vapp-api vapp-dev -d

# Access frontend at http://localhost:8081

# Run all tests in Docker
docker compose run zkdex

# Interactive development shell
docker compose --profile dev run zkdex-dev
```

### Docker Files

| File | Description |
|------|-------------|
| `Dockerfile` | Main ZK-DEX build (circuits, contracts, tests) |
| `vapp/Dockerfile` | Frontend multi-stage build (dev/prod) |
| `docker-compose.yml` | Service orchestration |
| `.dockerignore` | Excludes large files (ptau, intermediate zkeys) |
| `vapp/.dockerignore` | Frontend build exclusions |

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

## Frontend (vapp)

The `vapp` directory contains a Vue 3 frontend application for interacting with ZK-DEX.

### Technology Stack

| Component | Version |
|-----------|---------|
| Vue | 3.4.21 |
| State Management | Pinia 2.1.7 |
| UI Library | Oruga UI 0.8.12 + Bulma |
| Build Tool | Vite 5.1.5 |
| Language | TypeScript 5.4.2 |
| Web3 Library | ethers.js 6.11.1 |
| Router | Vue Router 4.3.0 |

### Installation

```bash
cd vapp
npm install
```

### Development

```bash
# Start Vite development server (http://localhost:8080)
npm run dev

# Type checking
npm run type-check
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend Server

The Express backend serves the API for account and note management:

```bash
# Start Express backend server
npm run server
```

### Features

- MetaMask wallet connection
- Account import/export/delete
- Note minting and liquidation (ETH/DAI)
- Private note transfers
- Note combining
- Order creation and taking
- Order settlement and history

For detailed migration information, see [migration_vapp.md](migration_vapp.md) or [migration_vapp_ko.md](migration_vapp_ko.md).

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
- [Circuit Migration (EN)](migration.md) / [Circuit Migration (KO)](migration_ko.md)
- [Frontend Migration (EN)](migration_vapp.md) / [Frontend Migration (KO)](migration_vapp_ko.md)
- [Architecture Presentation](https://docs.google.com/presentation/d/1b6yD4iV-vS_KyK27CG9ImMRdTypm9mtIbd5m3a_MNeU/edit?usp=sharing)
- [Demo Video](https://youtu.be/QvKaqMH_5lk)

## License

MIT
