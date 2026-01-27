# Contributing to ZK-DEX

## Prerequisites

- **Node.js** 18+ (20 recommended)
- **Truffle** 5.x (`npm install -g truffle`)
- **Ganache** for local blockchain (`npm install -g ganache`)
- **Circom** 2.1+ (for circuit compilation only)
- **snarkjs** 0.7+ (for trusted setup and proof generation)

## Project Setup

```bash
# 1. Clone and install root dependencies
git clone https://github.com/tokamak-network/zk-dex.git
cd zk-dex
npm install

# 2. Install circuit dependencies
cd circuits-circom
npm install
cd ..

# 3. Install frontend dependencies
cd vapp
npm install
cd ..
```

## Project Structure

```
zk-dex/
├── circuits-circom/     # Circom 2.1 ZK circuits (Poseidon-based)
│   ├── main/            # 6 circuit source files
│   ├── utils/           # Reusable circuit components (poseidon, babyjubjub, math)
│   ├── build/           # Compiled artifacts (wasm, zkey, r1cs)
│   └── scripts/         # compile.sh, setup.sh, generate_verifiers.sh
├── contracts/           # Solidity smart contracts (0.8.20)
│   ├── ZkDex.sol        # Main DEX contract (order book + settlement)
│   ├── ZkDai.sol        # Entry point (inherits Mint/Spend/Liquidate)
│   ├── ZkDaiBase.sol    # Shared state and types
│   └── verifiers/       # Auto-generated Groth16 verifier contracts
├── scripts/lib/         # Node.js proof generation utilities
│   ├── noteProofHelper.js  # Unified API for all proof types
│   ├── snarkjsUtils.js     # Low-level snarkjs wrapper
│   ├── Note.js             # Note class (Poseidon hash, circuit inputs)
│   └── ecdhCrypto.js       # ECDH encryption for notes
├── test/                # Truffle tests (Mocha/Chai)
├── vapp/                # Vue 3 frontend application
│   ├── src/lib/         # Client-side crypto (BabyJubJub, Poseidon, ECDH)
│   ├── src/stores/      # Pinia state management
│   ├── src/workers/     # Web Worker proof generation
│   └── app.cjs          # Express backend API
└── examples/            # Usage examples
```

See [architecture.md](docs/architecture.md) for detailed technical documentation.

## Running Tests

### Smart Contract Tests (requires Ganache)

```bash
# Start Ganache in a separate terminal
ganache --deterministic --accounts 10 --defaultBalanceEther 1000

# Run Truffle tests
npm test
```

### Frontend Unit Tests

```bash
cd vapp
npx vitest run        # Run all 308+ tests
npx vitest            # Watch mode
```

### All Tests

```bash
npm run test:all
```

## Building

### Compile Smart Contracts

```bash
npm run compile       # truffle compile
```

### Compile ZK Circuits (requires Circom 2.1+)

```bash
cd circuits-circom
npm run compile       # Compile all 6 circuits
npm run setup         # Run trusted setup (requires ptau file)
npm run generate-verifiers  # Generate Solidity verifier contracts
```

### Build Frontend

```bash
cd vapp
npm run build         # Production build
npm run dev           # Development server (port 8080)
```

## Docker (Full Stack)

```bash
# Start full stack
docker compose up ganache vapp-api vapp -d

# Run contract tests
docker compose run zkdex

# Cleanup
docker compose down -v
```

## Code Style

### JavaScript/TypeScript
- 2-space indentation
- Single quotes
- Semicolons required
- Async/await preferred over callbacks
- JSDoc for public functions

### Solidity
- 2-space indentation
- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Lint with `npm run lint`

### Vue Components
- `<script setup lang="ts">` (Composition API)
- PascalCase file names (`NoteList.vue`)
- Pinia stores in `src/stores/`

## Key Concepts

- **Notes**: UTXO-like private balances (ETH/DAI), hashed with Poseidon
- **Groth16 Proofs**: ZK proofs generated client-side via snarkjs
- **BabyJubJub**: Elliptic curve for ownership keys (SNARK-friendly)
- **Poseidon Hash**: SNARK-native hash for address derivation and note hashing
- **ECDH Encryption**: BabyJubJub ECDH + AES-256-GCM for on-chain note privacy

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes with tests
4. Run `npm run test:all` to verify
5. Submit a Pull Request with a clear description
