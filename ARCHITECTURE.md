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
│   │   ├── sha256/          # SHA256 implementations
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
| **Cryptography** | BabyJubJub (circomlibjs), SHA-256 |
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
  ownerAddress,  // 160-bit address derived from SHA256(pk.x || pk.y)[96:256]
  value,         // Token amount (256-bit)
  type,          // 0=ETH, 1=DAI (256-bit)
  viewingKey,    // vk0(128-bit) + vk1(128-bit) for note decryption
  salt           // Random value (256-bit)
}
```

### Address Derivation

Owner address is derived from BabyJubJub public key using SHA256:

```
address = SHA256(pk.x || pk.y)[96:256]  // Last 160 bits
```

This provides:
- Compact representation (160-bit vs 512-bit public key)
- Collision resistance (~2^80 security level)
- Compatible with Ethereum address format

### Circuit Descriptions

#### 1. mint_burn_note (Note Creation)

**Purpose:** Proves ownership and correct hash computation for new notes.

**Constraints:** ~154,900

**Public Signals (snarkjs order):**
```
[output, nh0, nh1, value, tokenType]
```

**Operations:**
1. Verify ownership via address derivation (sk → pk → SHA256 → address)
2. Compute and verify SHA256 hash of note (1184-bit input)

#### 2. transfer_note (Spend & Split)

**Purpose:** Spend 1-2 notes and create 2 new notes with value conservation.

**Constraints:** ~492,085

**Verification:**
- Ownership of input notes
- Value conservation: `sum(inputs) == sum(outputs)`
- Correct hash computation for all notes

#### 3. convert_note (Smart Note Conversion)

**Purpose:** Convert smart notes (from trading) to normal notes.

**Constraints:** ~337,437

**Verification:**
- Smart note owner matches origin note hash
- New note has correct ownership

#### 4. make_order (Order Creation)

**Purpose:** Create trading order without revealing amount.

**Constraints:** ~154,900

**Output:** Commitment to order parameters with ownership proof.

#### 5. take_order (Order Taking)

**Purpose:** Accept order by creating a stake note for the maker.

**Constraints:** ~246,040

**Verification:**
- Taker owns parent note
- Stake note value equals parent note value
- Stake note owner is maker note hash (smart note)

#### 6. settle_order (Order Settlement)

**Purpose:** Atomic swap with price calculation (most complex circuit).

**Constraints:** ~520,221

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
| mint_burn_note | 154,900 |
| make_order | 154,900 |
| take_order | 246,040 |
| convert_note | 337,437 |
| transfer_note | 492,085 |
| settle_order | 520,221 |

**Note:** Constraint counts increased for ownership verification (SHA256-based address derivation) but decreased overall due to smaller note hash input (1184-bit vs 1536-bit).

---

## Scripts & Libraries

### Core Libraries (`scripts/lib/`)

#### noteProofHelper.js (Unified API)

Main entry point for proof generation.

```javascript
// Initialize (required once)
await noteProofHelper.init();

// Key generation - returns 160-bit ownerAddress
const { secretKey, ownerAddress } = await noteProofHelper.generateKeypair();

// Note creation with ownerAddress
const { note, sk } = await noteProofHelper.createNote(secretKey, value, tokenType, viewingKey, salt);

// Smart note creation (for trading)
// owner = SHA256(parentNoteHash)[96:256] (160-bit truncation)
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
  // viewingKey: { vk0, vk1 } - two 128-bit values

  hash()              // SHA256 hash of note (1184-bit input)
  hashArr()           // [nh0, nh1] 128-bit split
  toCircuitInput()    // Format for circuit
}

// Note hash computation (1184 bits total):
// SHA256(ownerAddress(160) || value(256) || type(256) || vk0(128) || vk1(128) || salt(256))

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
- **Encrypted Storage:** Note data encrypted with viewing keys
- **ZK Proofs:** Ownership and validity proven without revealing data
- **Address-based Ownership:** Owner = 160-bit address derived from SHA256(pk)
- **Smart Notes:** Owner = SHA256(parentNoteHash)[96:256] (160-bit truncation, enables atomic swaps)

### Cryptographic Primitives

| Primitive | Usage |
|-----------|-------|
| **BabyJubJub** | Ownership keys (efficient in SNARKs) |
| **SHA-256** | Address derivation (512-bit → 160-bit) and note hash (1184-bit) |
| **Groth16** | SNARK proof system |
| **BN128** | Elliptic curve for pairings |

### Hash Splitting

ZK circuits have field element limitations (~254 bits). SHA-256 hashes (256 bits) are split:

```javascript
// Split 256-bit hash to two 128-bit values
note.hashArr() → [nh0, nh1]

// In circuit: verify nh0 and nh1 separately
// In contract: reconstruct full hash
calcHash(nh0, nh1) → original hash
```

### Public Signal Order (snarkjs)

**Important:** snarkjs places circuit outputs FIRST in public signals:

```
Circuit: signal output out; signal input public nh0;
snarkjs: [out, nh0, ...]  // output comes first!
```

All contracts have been updated to use this order.

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

| Service | Description | Profile |
|---------|-------------|---------|
| `ganache` | Local Ethereum blockchain | default |
| `zkdex` | Run tests | default |
| `zkdex-dev` | Development shell | dev |
| `test-production` | Production tests | test |

### Usage

```bash
# Build (uses local circuit artifacts if available)
docker compose build zkdex

# Run tests
docker compose up zkdex

# Development mode
docker compose --profile dev up zkdex-dev

# Cleanup
docker compose down -v
```

### Dockerfile Features

- **Conditional build:** Uses pre-built `.zkey` files if present
- **Fallback:** Downloads Powers of Tau and compiles if no artifacts
- **Multi-stage:** Circom compiler built from Rust

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
