# ZK-DEX

Zero-Knowledge Decentralized Exchange - Private trading on Ethereum using ZK-SNARKs.

## Overview

ZK-DEX enables private token trading through:
- **Private Notes**: ETH/DAI balances hidden via Poseidon hash + Groth16 proofs
- **Private Orders**: Order details only revealed during settlement
- **On-chain Verification**: Groth16 proof verification on Ethereum
- **Client-side Proving**: Browser-based ZK proof generation via Web Workers

## Architecture

```
circuits-circom/     # Circom 2.1 ZK circuits (Poseidon-based)
contracts/           # Solidity smart contracts (0.8.20)
scripts/lib/         # Node.js proof generation utilities
test/                # Integration, production & edge case tests
examples/            # Frontend usage examples
vapp/                # Vue 3 frontend application
  ├── src/components/  # Vue components (NoteTree SVG, forms, etc.)
  ├── src/composables/ # Reusable logic (D3 layout, formatters)
  ├── src/lib/         # Client-side crypto (circuit loader, proof gen, Poseidon)
  ├── src/stores/      # Pinia state management
  ├── src/types/       # TypeScript type definitions
  ├── src/workers/     # Web Worker for proof generation
  └── public/circuits/ # Compiled wasm/zkey files
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

# Install frontend dependencies
cd vapp && npm install && cd ..
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
| `mint_burn_note` | Deposit/withdraw ETH or DAI | 131K |
| `transfer_note` | Private transfers | 516K |
| `make_order` | Create trade orders | 131K |
| `take_order` | Accept orders | 258K |
| `settle_order` | Execute trades | 641K |
| `convert_note` | Convert smart notes | 385K |

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

// Initialize (loads Poseidon, BabyJubJub)
await noteProofHelper.init();

// Generate keypair (BabyJubJub curve)
const { sk, pk } = await noteProofHelper.generateKeypair();

// Create ETH note (internally: sk → pk → Poseidon address, auto-generates viewingKey & salt)
const { note } = await noteProofHelper.createNote(
    sk,
    BigInt('1000000000000000000'), // 1 ETH
    0  // ETH token type
);

// Generate mint proof (Groth16)
const proof = await noteProofHelper.generateMintProof(note, sk);

// Call contract
await zkDex.mint(proof.a, proof.b, proof.c, proof.input, encryptedNote, { value: '1000000000000000000' });
```

## Frontend (vapp)

The `vapp` directory contains a Vue 3 frontend application for interacting with ZK-DEX.

### Technology Stack

| Component | Version | Description |
|-----------|---------|-------------|
| Vue | 3.4.21 | Reactive UI framework |
| Pinia | 2.1.7 | State management |
| Oruga UI + Bulma | 0.8.12 | UI components & CSS |
| Vite | 5.1.5 | Build tool |
| TypeScript | 5.4.2 | Type safety |
| ethers.js | 6.11.1 | Ethereum interaction |
| snarkjs | 0.7.6 | Client-side Groth16 proving |
| circomlibjs | 0.1.7 | Poseidon hash, BabyJubJub |
| d3-hierarchy | 3.1.2 | Note tree SVG layout |

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
- Account creation with scrypt-based keystore encryption
- Account import/export/delete
- Note minting and liquidation (ETH/DAI)
- Private note transfers with client-side proof generation (Web Worker)
- Note combining (merge multiple notes)
- Order creation, taking, and settlement
- Order history tracking
- Note Transfer Tree visualization (D3.js SVG)
- ZK privacy masking toggle

For detailed migration information, see [migration_vapp.md](migration_vapp.md) or [migration_vapp_ko.md](migration_vapp_ko.md).

## Testing

### Test Suites

| Test File | Description |
|-----------|-------------|
| `test/integration-test.js` | Node.js circuit integration tests |
| `test/frontend-integration.test.js` | Frontend API tests |
| `test/boundary-edge-cases.test.js` | Boundary value and edge case tests |
| `test/ZkDex.production.test.js` | On-chain proof verification (Truffle) |
| `test/ZkDex.groth16.test.js` | Groth16 proof generation & verification |
| `test/proof-generation-test.js` | Proof generation correctness tests |
| `test/verify-sk-field-reduction.js` | Secret key field reduction verification |

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
- **Hash Function**: Poseidon (note hashing, address derivation)
- **Key Scheme**: BabyJubJub (EdDSA-compatible)
- **Ownership**: Address-based (160-bit, derived from Poseidon(pk.x, pk.y))

### Solidity Contracts

- **Version**: 0.8.20
- **EVM**: Paris
- **Verifiers**: snarkjs-generated Groth16 verifiers

### Client-side Proof Generation

ZK proofs are generated entirely in the browser:
1. Circuit wasm/zkey files loaded from `public/circuits/` via manifest
2. `snarkjs.groth16.fullProve()` runs in a Web Worker (non-blocking)
3. Proof calldata formatted for on-chain verification

### Migration History

- **ZoKrates → Circom/snarkjs**: See [migration.md](migration.md)
- **SHA256 → Poseidon hash**: See [migration.md](migration.md)
- **Public key ownership → Address-based ownership**: 160-bit address derived from BabyJubJub public key

## FAQ

### What are Viewing Key and Salt?

Note hashes are computed as a Poseidon hash of 6 fields:

```
noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
```

**Viewing Key** (`viewingKey`):
- Derived from the BabyJubJub public key: `viewingKey = Poseidon(pk.x, pk.y)` (254-bit)
- The owner address is the lower 160 bits of the viewing key: `ownerAddress = truncate160(viewingKey)`
- Split into two 128-bit halves (`vk0`, `vk1`) for the note hash circuit input
- Purpose: Links note ownership to the public key without directly exposing it
- For Smart Notes: `viewingKey = parentNoteHash` (the parent note's hash)

**Salt**:
- Random value generated via `crypto.randomBytes(32)`, masked to 254 bits (BN128 field compatible)
- Purpose: Prevents pre-image attacks. Even identical owner/value/token combinations produce different hashes
- Without salt, repeated deposits of the same amount by the same user would be revealed by hash collisions

### How is note data protected?

Privacy is determined at two layers: the **circuit layer** and the **on-chain storage layer**.

**Circuit layer: Different visibility per operation**

Only information included in each circuit's public inputs is revealed externally:

| Circuit | Public inputs | Value | Owner |
|---------|--------------|-------|-------|
| `mint_burn_note` | noteHash, value, tokenType | **Public** (required: `msg.value` verification) | Private |
| `transfer_note` | o0Hash, o1Hash, newHash, changeHash | **Private** | **Private** |
| `make_order` | noteHash, tokenType | Private | Private |
| `take_order` | hashes, newOwnerAddress, types | Private | Partially public |
| `settle_order` | hashes, ownerAddresses, types, price | Private (price only) | Partially public |
| `convert_note` | smartHash, originHash, newHash | **Private** | **Private** |

- **Deposit/Withdraw boundary** (mint/liquidate): Value is always public. The contract must verify `msg.value` matches the note value when ETH enters or leaves the system.
- **Internal transfers** (transfer, convert): Only hashes are public; value and owner remain private. Value conservation (input sum = output sum) is verified inside the circuit.

**On-chain storage layer: ECDH encryption**

Note data is encrypted before being stored on-chain using ECDH key agreement on BabyJubJub + AES-256-GCM:

```solidity
// ZkDaiBase.sol
mapping(bytes32 => bytes) public encryptedNotes;  // noteHash → ECDH encrypted bytes
```

The client encrypts note data with the recipient's BabyJubJub public key before submitting to the contract:

```
On-chain format: 0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
```

Only the note owner (holding the corresponding BabyJubJub secret key) can decrypt. Third parties can read the encrypted bytes from the public mapping but cannot recover the plaintext `{ownerAddress, value, token, viewingKey, salt}`.

> **Note**: Legacy notes (pre-ECDH migration) are stored as plaintext RLP and remain publicly readable. Only newly created notes use ECDH encryption.

**Summary: Current privacy guarantees**

| Layer | Protection | Description |
|-------|-----------|-------------|
| Circuit (ZK proofs) | **Partial** | Value/owner private in transfer/convert; value public in mint |
| On-chain storage | **Protected** | ECDH-encrypted — only the note owner can decrypt |
| On-chain storage (legacy) | **Not protected** | Pre-migration notes stored as plaintext RLP |
| Ownership (note spending) | **Protected** | Secret key + ZK proof required to transfer or spend |

### Can specific notes be selectively disclosed to specific parties?

Three approaches are possible with the current ECDH-encrypted on-chain storage:

**1. Note-level disclosure** (no additional circuit required):
   - Share the note preimage `{ownerAddress, value, tokenType, viewingKey, salt}` directly
   - The recipient recomputes the Poseidon hash and verifies it matches the on-chain note hash
   - Downside: All fields of the note are revealed

**2. Account-level disclosure** (Zcash viewing key approach):
   - Share the viewing key with a specific party — they can scan all notes for that account
   - Downside: All-or-nothing — cannot selectively reveal individual notes

**3. ZK proof-based selective disclosure** (strongest):
   - A dedicated circuit proves "my owned note satisfies condition X" without revealing the note
   - Example: "I hold a valid note worth at least 100 ETH"
   - Specific note content (hash, salt, exact amount) remains private
   - Downside: Requires separate circuit development and trusted setup

### What is the proving cost for ZK-based selective disclosure?

98% of circuit cost comes from BabyJubJub scalar multiplication (`EscalarMulFix`), which is a fixed cost of ~128K constraints per ownership proof.

Cost breakdown of the `mint_burn_note` circuit (131K constraints):

| Component | Operation | Constraints | Ratio |
|-----------|-----------|-------------|-------|
| `EscalarMulFix(254)` | sk × G (BabyJubJub scalar mul) | ~128K | 97.7% |
| `Poseidon(6)` | Note hash | ~1,500 | 1.1% |
| `Poseidon(2)` + truncation | pk → address | ~350 | 0.3% |
| `Num2Bits(254)` + misc | Bit decomposition, equality checks | ~300 | 0.2% |

Selective disclosure circuit cost depends on what is being proved:

| Scenario | Required operations | Constraints | Browser proving time |
|----------|-------------------|-------------|---------------------|
| Preimage verification only (no ownership proof) | Poseidon(6) + value comparison | ~2K | < 1 sec |
| Ownership + attribute proof (1 note) | EscalarMulFix + Poseidon hash + comparison | ~131K | 3–10 sec |
| N-note balance aggregation proof | N × (EscalarMulFix + Poseidon) | ~N × 131K | N × 3–10 sec |

When ownership proof is required, cost scales **linearly with the number of notes**. The selective disclosure logic itself (hash verification + value comparison ~2K) is negligible — the number of BabyJubJub scalar multiplications determines the cost.

## Future Improvements

### 1. ZK Proof-Based Selective Disclosure

With ECDH encryption now applied to on-chain note data, dedicated Circom circuits can be added for selective attribute disclosure:

- **Balance proof**: "The total value of my owned notes exceeds X"
- **Ownership proof**: "I own the note with a specific hash"
- **Token type proof**: "My held notes are ETH/DAI"

This proves conditions without exposing note content (hash, salt, exact amounts), achieving both regulatory compliance (proof of funds) and privacy simultaneously.

### 2. Server-Side Proving

Currently all ZK proofs are generated in the browser (WASM). Complex circuits (settle_order at 641K constraints) may require tens of seconds in the browser.

**Improvement**: Introducing server-side proving with rapidsnark in a native environment can provide 10–100x speedup. Private inputs would be encrypted on the client before transmission, with the server generating and returning only the proof.

### 3. Incremental Proving

Aggregate proofs over multiple notes (e.g., balance sum of 5 notes) currently require proving all notes simultaneously in a single circuit. Cost increases linearly with note count (N × ~131K constraints).

**Improvement**: Pre-generate proofs for individual notes, then compose a final proof using a lightweight recursive proof aggregation circuit. Since Groth16 does not natively support recursive composition, this would require transitioning to PLONK or Nova proof systems.

## Documents

- [Architecture (EN)](ARCHITECTURE.md) / [Architecture (KO)](ARCHITECTURE_ko.md)
- [Circuit Migration (EN)](migration.md) / [Circuit Migration (KO)](migration_ko.md)
- [Frontend Migration (EN)](migration_vapp.md) / [Frontend Migration (KO)](migration_vapp_ko.md)
- [Architecture Presentation](https://docs.google.com/presentation/d/1b6yD4iV-vS_KyK27CG9ImMRdTypm9mtIbd5m3a_MNeU/edit?usp=sharing)
- [Demo Video](https://youtu.be/QvKaqMH_5lk)

## License

MIT
