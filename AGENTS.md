# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

ZK-DEX is a zero-knowledge decentralized exchange enabling private token trading on Ethereum using ZK-SNARKs (Groth16 proofs over BN128, Poseidon hash, BabyJubJub keys).

## Build & Development Commands

### Smart Contracts (Root)
```bash
# Start Ganache (required for tests)
npx ganache --port 8545 --accounts 10 --defaultBalanceEther 1000

# Compile contracts
npm run compile  # truffle compile

# Run all Truffle tests (requires running Ganache)
npm test  # truffle test

# Run a single test file
npx truffle test test/ZkDex.production.test.js

# Lint Solidity
npm run lint  # solium --dir ./contracts
```

### Circuits (circuits-circom/)
```bash
cd circuits-circom

# Compile all Circom circuits
npm run compile  # bash scripts/compile.sh

# Run trusted setup (requires Powers of Tau file in ptau/)
npm run setup  # bash scripts/setup.sh

# Generate Solidity verifier contracts
npm run generate-verifiers

# Run circuit tests
npm test  # mocha test/**/*.test.js
```

### Frontend (vapp/)
```bash
cd vapp

# Dev server at localhost:8080
npm run dev

# Run Vitest tests
npm run test  # vitest run

# Watch mode
npm run test:watch  # vitest

# Type checking
npm run type-check  # vue-tsc --noEmit

# Production build
npm run build

# Start Express backend API
npm run server  # node app.cjs
```

### Docker
```bash
# Full stack (ganache + backend + frontend)
docker compose up ganache vapp-api vapp -d

# Run contract tests in container
docker compose run --rm zkdex

# Production tests only
docker compose --profile test run --rm test-production

# Dev mode with hot reload (port 8081)
docker compose --profile dev up ganache vapp-api vapp-dev -d
```

## Architecture

### Circuits (circuits-circom/main/)
Six Groth16 circuits handle all ZK operations:
- `mint_burn_note.circom` - Deposit/withdraw ETH or DAI (131K constraints)
- `transfer_note.circom` - Private transfers (516K constraints)
- `make_order.circom` - Create trade orders (131K constraints)
- `take_order.circom` - Accept orders (258K constraints)
- `settle_order.circom` - Execute trades (641K constraints)
- `convert_note.circom` - Convert smart notes (385K constraints)

Circuit utilities in `circuits-circom/utils/` include Poseidon hash, BabyJubJub operations, and math helpers.

### Smart Contracts (contracts/)
- `ZkDex.sol` - Main DEX: order book management, order matching, settlement
- `ZkDai.sol` - Entry point inheriting MintNotes, SpendNotes, LiquidateNotes
- `ZkDaiBase.sol` - Shared state: note tree, encrypted note storage, token registry
- `verifiers/` - Auto-generated Groth16 verifier contracts (one per circuit)

Contract inheritance: `ZkDex` → `ZkDai` → `{MintNotes, SpendNotes, LiquidateNotes}` → `ZkDaiBase`

### Proof Generation (scripts/lib/)
- `noteProofHelper.js` - **Main API**: init(), generateKeypair(), createNote(), generateMintProof(), etc.
- `Note.js` - Note class with Poseidon hash computation and circuit input formatting
- `snarkjsUtils.js` - Low-level snarkjs wrapper for all 6 circuit types
- `ecdhCrypto.js` - BabyJubJub ECDH + AES-256-GCM encryption for on-chain note privacy

### Frontend (vapp/src/)
- `lib/` - Client-side crypto: circuit loading, Poseidon, BabyJubJub, ECDH
- `workers/` - Web Worker for non-blocking Groth16 proof generation
- `stores/` - Pinia stores: account, notes, orders, wallet state
- `composables/` - Vue composables: D3 layout, formatters
- `api/` - Backend API client (axios)
- `components/` - Vue components including NoteTree SVG visualization

Express backend in `vapp/app.cjs` serves API for account and note management.

### Key Cryptographic Flow
1. User generates BabyJubJub keypair (sk, pk)
2. Notes are created with Poseidon hash: `hash(pkX, pkY, value, tokenType, vkX, vkY, salt)`
3. Groth16 proofs generated client-side via snarkjs in Web Worker
4. Notes encrypted with ECDH before on-chain storage
5. Verifier contracts validate proofs on-chain

## Testing

| Test File | Purpose |
|-----------|---------|
| `test/ZkDex.production.test.js` | On-chain proof verification with Truffle |
| `test/ZkDex.groth16.test.js` | Groth16 proof generation & verification |
| `test/integration.test.js` | Node.js circuit integration |
| `test/frontend-integration.test.js` | Frontend API tests |
| `test/boundary-edge-cases.test.js` | Boundary values and edge cases |

## Code Style

- **Solidity**: 0.8.20, 2-space indent, follows Solidity Style Guide
- **JavaScript/TypeScript**: 2-space indent, single quotes, semicolons required
- **Vue**: Composition API with `<script setup lang="ts">`, PascalCase file names
