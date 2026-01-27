# ZK-DEX Architecture Documentation

A privacy-preserving decentralized exchange (DEX) built with Zero-Knowledge Proofs (ZK-SNARKs) using Circom/snarkjs, enabling confidential trading on Ethereum.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Directory Structure](#directory-structure)
3. [Technology Stack](#technology-stack)
4. [Smart Contracts](#smart-contracts)
5. [ZK Circuits](#zk-circuits)
6. [Scripts & Libraries](#scripts--libraries)
7. [Data Flow & Architecture](#data-flow--architecture)
8. [Key Concepts](#key-concepts)
9. [Testing](#testing)
10. [Docker Environment](#docker-environment)

---

## Project Overview

ZK-DEX enables users to:
- **Mint** private notes representing token balances (ETH/DAI)
- **Spend** notes to transfer value without revealing amounts
- **Trade** tokens through privacy-preserving orders
- **Settle** orders atomically with zero-knowledge proofs

All operations are verified on-chain using Groth16 proofs, ensuring transaction validity without exposing private data.

---

## Directory Structure

```
zk-dex/
├── circuits-circom/          # Circom 2.1 circuit definitions
│   ├── main/                 # Main circuit files
│   │   ├── mint_burn_note.circom
│   │   ├── transfer_note.circom
│   │   ├── convert_note.circom
│   │   ├── make_order.circom
│   │   ├── take_order.circom
│   │   └── settle_order.circom
│   ├── utils/                # Utility circuits
│   │   ├── poseidon/        # Poseidon hash implementations
│   │   ├── babyjubjub/      # ECC operations
│   │   ├── pack/            # Bit packing utilities
│   │   └── math/            # Mathematical operations
│   ├── build/               # Compiled artifacts (.wasm, .zkey, .r1cs)
│   └── scripts/             # Build scripts
│
├── contracts/                # Solidity smart contracts (0.8.20)
│   ├── ZkDex.sol            # Main DEX contract
│   ├── ZkDai.sol            # Note management
│   ├── ZkDaiBase.sol        # Base contract
│   ├── MintNotes.sol        # Minting logic
│   ├── SpendNotes.sol       # Spending logic
│   ├── LiquidateNotes.sol   # Liquidation logic
│   └── verifiers/           # Groth16 verifier contracts
│
├── scripts/lib/              # JavaScript utilities
│   ├── noteProofHelper.js   # Unified proof generation API
│   ├── snarkjsUtils.js      # snarkjs wrapper functions
│   ├── circomlibBabyJub.js  # BabyJubJub operations
│   └── Note.js              # Note class
│
├── test/                     # Test suites
│   ├── integration-test.js
│   ├── frontend-integration.test.js
│   └── ZkDex.production.test.js
│
├── examples/                 # Usage examples
│   └── frontend-usage.js
│
├── Dockerfile               # Docker build (conditional)
├── docker-compose.yml       # Container orchestration
└── truffle-config.js        # Truffle configuration
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Ethereum (Solidity 0.8.20) |
| **Framework** | Truffle 5.11, Ganache |
| **ZK Proofs** | Circom 2.1.0, snarkjs 0.7.x |
| **Proof System** | Groth16 (BN128 curve) |
| **Cryptography** | BabyJubJub (circomlibjs), Poseidon (circomlibjs) |
| **Testing** | Mocha, Chai |

---

## Smart Contracts

### Contract Hierarchy

```
ZkDex (Main Contract)
├── ZkDai
│   ├── MintNotes
│   ├── SpendNotes
│   └── LiquidateNotes
└── ZkDaiBase
    └── Verifier Contracts (Groth16)
```

### Core Contracts

#### ZkDex.sol (Main DEX Contract)

The core contract managing privacy-preserving trading operations.

**Key Functions:**
| Function | Description |
|----------|-------------|
| `makeOrder()` | Maker creates a trading order with ZK proof |
| `takeOrder()` | Taker accepts an order with stake note |
| `settleOrder()` | Atomic settlement with price calculation |
| `convertNote()` | Convert smart notes to normal notes |

**Order States:**
```
Created → Taken → Settled
```

#### ZkDai.sol (Note Management)

Handles core note operations for both ETH and DAI tokens.

**Key Functions:**
| Function | Description |
|----------|-------------|
| `mint(a, b, c, input, encryptedNote)` | Create new note with Groth16 proof |
| `spend(a, b, c, input, note1, note2)` | Spend notes, create two new notes |
| `liquidate(to, a, b, c, input)` | Convert notes back to tokens |

### Verifier Contracts

Auto-generated from Circom circuits using snarkjs (located in `contracts/verifiers/`):

| Verifier | Purpose | Public Inputs |
|----------|---------|---------------|
| `MintBurnNoteVerifier.sol` | Note creation/burning | 5 |
| `TransferNoteVerifier.sol` | Note transfers | 9 |
| `ConvertNoteVerifier.sol` | Note conversion | 7 |
| `MakeOrderVerifier.sol` | Order creation | 4 |
| `TakeOrderVerifier.sol` | Order taking | 9 |
| `SettleOrderVerifier.sol` | Order settlement | 21 |

**Groth16 Proof Format:**
```solidity
function verifyProof(
    uint256[2] memory a,      // G1 point
    uint256[2][2] memory b,   // G2 point
    uint256[2] memory c,      // G1 point
    uint256[N] memory input   // Public inputs
) public view returns (bool);
```

---

## ZK Circuits

Circuits are written in Circom 2.1 and compiled to Groth16 proving systems.

### Note Structure

```
Note = {
  ownerAddress,  // 160-bit address derived from Poseidon(pk.x, pk.y) & MASK_160
  value,         // Token amount (256-bit)
  type,          // 0=ETH, 1=DAI (256-bit)
  viewingKey,    // Poseidon(pk.x, pk.y) full 254-bit field element, split into vk0(128-bit) + vk1(128-bit)
  salt           // Random value (254-bit, BN128 field compatible)
}
```

### Address Derivation

Owner address is derived from BabyJubJub public key using Poseidon:

```
address = Poseidon(pk.x, pk.y) & ((1 << 160) - 1)  // Lower 160 bits of Poseidon hash
```

This provides:
- Compact representation (160-bit vs 512-bit public key)
- Collision resistance (~2^80 security level)
- Compatible with Ethereum address format
- SNARK-friendly (Poseidon is native to BN128 field arithmetic)

### Circuit Descriptions

#### 1. mint_burn_note (Note Creation)

**Purpose:** Proves ownership and correct hash computation for new notes.

**Constraints:** ~131,000

**Public Signals (snarkjs order):**
```
[output, nh0, nh1, value, tokenType]
```

**Operations:**
1. Verify ownership via address derivation (sk → pk → Poseidon → address)
2. Compute and verify Poseidon hash of note (6 field element inputs)

#### 2. transfer_note (Spend & Split)

**Purpose:** Spend 1-2 notes and create 2 new notes with value conservation.

**Constraints:** ~516,000

**Verification:**
- Ownership of input notes
- Value conservation: `sum(inputs) == sum(outputs)`
- Correct hash computation for all notes

#### 3. convert_note (Smart Note Conversion)

**Purpose:** Convert smart notes (from trading) to normal notes.

**Constraints:** ~385,000

**Verification:**
- Smart note owner matches origin note hash
- New note has correct ownership

#### 4. make_order (Order Creation)

**Purpose:** Create trading order without revealing amount.

**Constraints:** ~131,000

**Output:** Commitment to order parameters with ownership proof.

#### 5. take_order (Order Taking)

**Purpose:** Accept order by creating a stake note for the maker.

**Constraints:** ~258,000

**Verification:**
- Taker owns parent note
- Stake note value equals parent note value
- Stake note owner is maker note hash (smart note)

#### 6. settle_order (Order Settlement)

**Purpose:** Atomic swap with price calculation (most complex circuit).

**Constraints:** ~641,000

**Math Operations:**
```
makerValue * price == q0 * 10^18 + r0
takerValue == q1 * price + r1
```

**Output Notes (all smart notes):**
1. **Reward note** - Maker's source token to taker (owner = taker parent hash)
2. **Payment note** - Taker's target token to maker (owner = maker note hash)
3. **Change note** - Remainder to taker (owner = taker parent hash)

### Circuit Complexity Summary

| Circuit | Non-linear Constraints |
|---------|------------------------|
| mint_burn_note | ~131,000 |
| make_order | ~131,000 |
| take_order | ~258,000 |
| convert_note | ~385,000 |
| transfer_note | ~516,000 |
| settle_order | ~641,000 |

**Note:** ~98% of constraint cost comes from BabyJubJub scalar multiplication (EscalarMulFix) for ownership verification, not from hashing. Poseidon hashing is extremely SNARK-efficient compared to the previous SHA-256 approach.

---

## Scripts & Libraries

### Core Libraries (`scripts/lib/`)

#### noteProofHelper.js (Unified API)

Main entry point for proof generation.

```javascript
// Initialize (required once)
await noteProofHelper.init();

// Key generation - returns { sk, pk } (BabyJubJub keypair)
// Address derived via Poseidon(pk.x, pk.y) & MASK_160
const { sk, pk } = await noteProofHelper.generateKeypair();

// Note creation with Poseidon-derived address
const note = await noteProofHelper.createNote(sk, value, tokenType);

// Smart note creation (for trading)
// owner = Poseidon(parentNoteHash) lower 160 bits
const smartNote = await noteProofHelper.createSmartNote(ownerNote, value, tokenType, viewingKey, salt);

// Proof generation
const proof = await noteProofHelper.generateMintProof(note, sk);
const proof = await noteProofHelper.generateTransferProof(old0, old1, new0, new1, sk0, sk1);
const proof = await noteProofHelper.generateMakeOrderProof(makerNote, sk);
const proof = await noteProofHelper.generateTakeOrderProof(parentNote, stakeNote, sk);
const proof = await noteProofHelper.generateSettleOrderProof(maker, stake, reward, payment, change, price, sk);
const proof = await noteProofHelper.generateConvertProof(smartNote, originNote, newNote, sk);
```

#### snarkjsUtils.js (Low-level)

Direct snarkjs wrapper functions.

```javascript
// Proof generation
getMintNBurnProof(note, sk)
getTransferProof(old0, old1, new0, new1, sk0, sk1)
getMakeOrderProof(makerNote, sk)
getTakeOrderProof(parentNote, stakeNote, sk)
getSettleOrderProof(maker, stake, reward, payment, change, price, sk, q0, r0, q1, r1)
getConvertProof(smartNote, originNote, newNote, sk)

// Utilities
formatProofForContract(proof, publicSignals)  // Convert to Solidity format
verifyProofLocal(circuitName, proof, signals) // Local verification
```

#### Note.js

Core Note class for managing privacy notes.

```javascript
class Note {
  constructor(ownerAddress, value, type, viewingKey, salt)
  // ownerAddress: 160-bit address (hex string)
  // viewingKey: { vk0, vk1 } - two 128-bit values (from Poseidon(pk.x, pk.y))

  hash()              // Poseidon hash of note (single field element output)
  toCircuitInput()    // Format for circuit
}

// Note hash computation:
// Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt) — 6 field element inputs, single field element output

// Constants
EMPTY_NOTE_HASH = '0x...'  // Computed with zero ownerAddress
ETH_TOKEN_TYPE = 0
DAI_TOKEN_TYPE = 1
```

---

## Data Flow & Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Application                      │
│              (noteProofHelper.js API)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ JavaScript
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    snarkjs (WASM)                            │
│         Witness calculation + Groth16 proof generation       │
└────────────────────────┬────────────────────────────────────┘
                         │ Web3.js
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Smart Contracts (ZkDex.sol)                     │
│    ZkDai: mint(), spend(), liquidate()                       │
│    ZkDex: makeOrder(), takeOrder(), settleOrder()            │
└────────────────────────┬────────────────────────────────────┘
                         │ Proof verification
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              Groth16 Verifier Contracts                      │
│         verifyProof() - Pairing checks on BN128              │
└─────────────────────────────────────────────────────────────┘
```

### Proof Generation Flow

```
1. User initiates transaction (Mint/Spend/Order)
           ↓
2. noteProofHelper prepares circuit inputs
           ↓
3. snarkjs executes:
   ├── Load WASM witness calculator
   ├── Compute witness (private inputs)
   ├── Load zkey (proving key)
   └── Generate Groth16 proof
           ↓
4. Format proof for Solidity:
   ├── a: [2] G1 point
   ├── b: [[2],[2]] G2 point (coordinates swapped)
   └── c: [2] G1 point
           ↓
5. Submit to smart contract
           ↓
6. Smart contract verifies via verifier contract
           ↓
7. If valid: Update state → Emit event
   If invalid: Revert transaction
```

### Trading Flow

```
┌─────────────┐    makeOrder()    ┌─────────────┐
│   MAKER     │ ───────────────→  │   ORDER     │
│   Note      │                   │  (Created)  │
│  "Trading"  │                   └──────┬──────┘
└─────────────┘                          │
                                         │ takeOrder()
┌─────────────┐                          ↓
│   TAKER     │ ───────────────→  ┌─────────────┐
│ Parent Note │                   │   ORDER     │
│  "Trading"  │                   │   (Taken)   │
└─────────────┘                   └──────┬──────┘
       ↓                                 │
┌─────────────┐                          │ settleOrder()
│   STAKE     │                          ↓
│   Note      │                   ┌─────────────┐
│ (Smart Note)│                   │   ORDER     │
└─────────────┘                   │  (Settled)  │
                                  └──────┬──────┘
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ↓                          ↓                          ↓
       ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
       │   REWARD    │           │   PAYMENT   │           │   CHANGE    │
       │ (Smart Note)│           │ (Smart Note)│           │ (Smart Note)│
       │  to Taker   │           │  to Maker   │           │  remainder  │
       └─────────────┘           └─────────────┘           └─────────────┘
              │                          │                          │
              └──────────────────────────┴──────────────────────────┘
                                         │
                                         ↓ convertNote()
                                  ┌─────────────┐
                                  │   NORMAL    │
                                  │    Note     │
                                  └─────────────┘
```

---

## Key Concepts

### Privacy Model

- **Note-based UTXO:** Similar to Zcash, balances are represented as notes
- **ECDH Encryption:** Note data encrypted with BabyJubJub ECDH + AES-256-GCM before on-chain storage
- **ZK Proofs:** Ownership and validity proven without revealing data
- **Address-based Ownership:** Owner = Poseidon(pk.x, pk.y) & MASK_160 (lower 160 bits of Poseidon hash)
- **Smart Notes:** Owner = Poseidon(parentNoteHash) lower 160 bits (enables atomic swaps)

### Cryptographic Primitives

| Primitive | Usage |
|-----------|-------|
| **BabyJubJub** | Ownership keys (efficient in SNARKs) |
| **Poseidon** | Address derivation (pk → 160-bit), note hashing (6 inputs → single field element) |
| **ECDH (BabyJubJub) + AES-256-GCM** | Note encryption for on-chain storage |
| **Groth16** | SNARK proof system |
| **BN128** | Elliptic curve for pairings |

### Hash Splitting (Legacy)

With the migration from SHA-256 to Poseidon, hash splitting is no longer needed for note hashes. Poseidon outputs a single BN128 field element (~254 bits), which fits directly into a circuit signal without splitting.

Previously, SHA-256 produced 256-bit outputs that exceeded the ~254-bit BN128 field limit, requiring a split into two 128-bit halves (nh0, nh1). This added complexity to both circuits and smart contracts.

```javascript
// Legacy (SHA-256): required splitting
// note.hashArr() → [nh0, nh1]  // two 128-bit values

// Current (Poseidon): single field element output
// note.hash() → noteHash        // single ~254-bit field element
```

### Public Signal Order (snarkjs)

**Important:** snarkjs places circuit outputs FIRST in public signals:

```
Circuit: signal output out; signal input public noteHash;
snarkjs: [out, noteHash, ...]  // output comes first!
```

With Poseidon, note hashes are single field elements (no split h0/h1), simplifying the public signal layout. All contracts have been updated to use this order.

---

## Testing

### Test Suites

| File | Description | Tests |
|------|-------------|-------|
| `integration-test.js` | Node.js circuit tests | 21 |
| `frontend-integration.test.js` | Frontend API tests | 20 |
| `ZkDex.production.test.js` | On-chain proof verification | 19 |

### Running Tests

```bash
# Local testing
npx ganache --port 8545 --accounts 10 --defaultBalanceEther 1000
npx truffle test

# Production tests (real proofs)
npx truffle test test/ZkDex.production.test.js

# Frontend integration
node test/frontend-integration.test.js

# Boundary and edge case tests
node test/boundary-edge-cases.test.js
```

### Test Results

- **93/93** total tests passing
  - Node.js integration: 21/21
  - Frontend integration: 20/20
  - Boundary/edge cases: 33/33
  - Truffle (on-chain): 19/19
- E2E trading flow verified: Make → Take → Settle → Convert

---

## Docker Environment

### Services

| Service | Description | Port | Profile |
|---------|-------------|------|---------|
| `ganache` | Local Ethereum blockchain | 8545 | default |
| `vapp-api` | Backend API server (Express) | 3000 | default |
| `zkdex` | Run tests | - | default |
| `vapp` | Frontend (Production/nginx) | 8080 | default |
| `vapp-dev` | Frontend (Development/hot reload) | 8081 | dev |
| `zkdex-dev` | Development shell | - | dev |
| `test-frontend` | Frontend integration tests | - | test |
| `test-production` | Production tests | - | test |

### Backend API Server (vapp-api)

Express-based backend server providing:

- **Account Management**: Create, unlock, import/export accounts
- **Proof Generation**: ZK-SNARK proof generation (mint, transfer, order, etc.)
- **Note Management**: Store and retrieve notes
- **Order Management**: Create, query, update order status

**API Endpoints:**
| Path | Description |
|------|-------------|
| `POST /accounts` | Create new account |
| `POST /accounts/unlock` | Unlock account (returns secret key) |
| `POST /circuits` | Generate ZK proof |
| `GET/POST /notes` | Query/store notes |
| `GET/POST /orders` | Query/create orders |

### Usage

```bash
# Run all tests
docker compose run zkdex

# Start full stack (ganache + API + frontend production)
docker compose up ganache vapp-api vapp -d

# Frontend: http://localhost:8080
# Backend API: http://localhost:3000

# Start full stack (development mode with hot reload)
docker compose --profile dev up ganache vapp-api vapp-dev -d

# Frontend: http://localhost:8081

# Development shell
docker compose --profile dev run zkdex-dev

# Cleanup
docker compose down -v
```

### Docker Files

| File | Description |
|------|-------------|
| `Dockerfile` | Multi-stage build (circuits, contracts, tests, frontend dev/prod) |
| `docker-compose.yml` | Service orchestration |
| `.dockerignore` | Excludes large files (ptau, intermediate zkeys) |

### Dockerfile Features

- **Conditional build:** Uses pre-built `.zkey` files if present
- **Fallback:** Downloads Powers of Tau and compiles if no artifacts
- **Multi-stage:** Circom compiler built from Rust, frontend with nginx

---

## Configuration

### Truffle Config

```javascript
{
  networks: {
    development: { host: "127.0.0.1", port: 8545 },
    docker: { host: "ganache", port: 8545, network_id: "5777" }
  },
  compilers: {
    solc: {
      version: "0.8.20",
      settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" }
    }
  }
}
```

### Key Dependencies

```json
{
  "snarkjs": "^0.7.6",
  "circomlibjs": "^0.1.7",
  "ffjavascript": "^0.3.1",
  "@openzeppelin/contracts": "^4.9.3"
}
```

---

## License

MIT
