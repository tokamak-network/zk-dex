# ZoKrates → Circom/snarkjs Migration Report

## Overview

Migrated ZK-DEX project's ZoKrates-based ZK-SNARK circuits to Circom/snarkjs.

**Migration Date:** 2026-01-25
**Status:** ✅ Complete (Production tests passing)

## Summary of Changes

### 1. Proof System Changes

| Item | Before (ZoKrates) | After (Circom/snarkjs) |
|------|-------------------|------------------------|
| Circuit Language | ZoKrates DSL | Circom 2.1.0 |
| Proof System | PGHR13 (8 elements) | Groth16 (3 elements: a, b, c) |
| Proof Generation | Docker container | Node.js (snarkjs) |
| Solidity Version | ^0.5.0 | ^0.8.20 |

### 2. New Files Created

#### Circom Circuits (`circuits-circom/`)

```
circuits-circom/
├── package.json
├── node_modules/
├── build/                          # Compiled artifacts
│   ├── *.r1cs                      # R1CS constraint system
│   ├── *_js/*.wasm                 # WASM executables
│   ├── *.zkey                      # Groth16 proving key
│   └── *_vk.json                   # Verification key
├── utils/
│   ├── sha256/
│   │   ├── sha256_512bit.circom
│   │   └── sha256_1536bit.circom
│   ├── babyjubjub/
│   │   ├── get_pubkey.circom
│   │   ├── get_address.circom
│   │   └── proof_of_ownership.circom
│   ├── pack/
│   │   ├── pack128.circom
│   │   ├── pack160.circom
│   │   └── unpack256.circom
│   ├── math/
│   │   └── safe_math.circom
│   └── is_smart.circom
├── main/
│   ├── mint_burn_note.circom
│   ├── transfer_note.circom
│   ├── convert_note.circom
│   ├── make_order.circom
│   ├── take_order.circom
│   └── settle_order.circom
└── scripts/
    ├── compile.sh
    ├── setup.sh
    └── generate_verifiers.sh
```

#### Proof Generation Utilities

- `scripts/lib/snarkjsUtils.js` - Replaces dockerUtils.js

#### Solidity Verifier Contracts

- `contracts/verifiers/IGroth16Verifier.sol` - Interface
- `contracts/verifiers/MintBurnNoteVerifier.sol`
- `contracts/verifiers/TransferNoteVerifier.sol`
- `contracts/verifiers/ConvertNoteVerifier.sol`
- `contracts/verifiers/MakeOrderVerifier.sol`
- `contracts/verifiers/TakeOrderVerifier.sol`
- `contracts/verifiers/SettleOrderVerifier.sol`

### 3. Modified Files

#### Solidity Contracts (0.5.0 → 0.8.20)

| File | Key Changes |
|------|-------------|
| `contracts/ZkDaiBase.sol` | pragma upgrade, OpenZeppelin 4.x imports |
| `contracts/MintNotes.sol` | abstract keyword, constructor changes |
| `contracts/SpendNotes.sol` | abstract keyword, variable name conflicts |
| `contracts/LiquidateNotes.sol` | abstract keyword |
| `contracts/ZkDai.sol` | OpenZeppelin 4.x imports |
| `contracts/ZkDex.sol` | array.length++ → push() pattern |
| `contracts/RLPReader.sol` | address type conversion fixes |
| `contracts/Requestable.sol` | SPDX license added |
| `contracts/Migrations.sol` | constructor changes |
| `contracts/test/MockDai.sol` | ERC20 constructor args added |
| `contracts/test/TestZkDai.sol` | interface import fixes |

#### Configuration Files

| File | Changes |
|------|---------|
| `truffle-config.js` | solc 0.5.8 → 0.8.20, evmVersion: paris |
| `package.json` | Added snarkjs, @openzeppelin/contracts |

## Circuit Details

### Public Input Format

**Important**: snarkjs/Groth16 places outputs **at the beginning** of the array.

| Circuit | Public Inputs (snarkjs order) | Count |
|---------|-------------------------------|-------|
| mint_burn_note | [output, nh0, nh1, value, tokenType] | 5 |
| transfer_note | [output, o0h0, o0h1, o1h0, o1h1, nh0, nh1, changeH0, changeH1] | 9 |
| convert_note | [output, smartH0, smartH1, originH0, originH1, nh0, nh1] | 7 |
| make_order | [output, nh0, nh1, tokenType] | 4 |
| take_order | [output, oh0, oh1, oType, nh0, nh1, nOwner0, nOwner1, nType] | 9 |
| settle_order | [output, o0h*, o1h*, n0h*, n1h*, n2h*, price] | 21 |

### Circuit Complexity

| Circuit | Non-linear Constraints |
|---------|------------------------|
| mint_burn_note | 154,900 |
| make_order | 154,900 |
| take_order | 246,040 |
| convert_note | 337,437 |
| transfer_note | 492,085 |
| settle_order | 520,481 |

*Updated after address-based ownership migration (Phase 2) and security fixes (Phase 2.2-2.3)*

## Groth16 Proof Format

### Before (PGHR13)
```javascript
// 8 elements
{
  a: [2], a_p: [2], b: [2][2], b_p: [2],
  c: [2], c_p: [2], h: [2], k: [2]
}
```

### After (Groth16)
```javascript
// 3 elements
{
  a: [2],       // G1 point
  b: [[2],[2]], // G2 point (coordinate swap needed for Solidity)
  c: [2]        // G1 point
}
```

**Note**: snarkjs `pi_b` coordinates differ from Solidity verifier order:
```javascript
// snarkjsUtils.js formatProofForContract()
b: [
    [proof.pi_b[0][1], proof.pi_b[0][0]],  // coordinate swap
    [proof.pi_b[1][1], proof.pi_b[1][0]]
]
```

## Test Results

### Circuit Compilation & Setup
- ✅ All 6 circuits compiled successfully
- ✅ Powers of Tau ceremony completed (2^20)
- ✅ Groth16 zkey generation completed
- ✅ Verification key export completed

### Smart Contracts
- ✅ All contracts compiled with Solidity 0.8.20
- ⚠️ Some function state mutability warnings (pure/view)

### Proof Generation
- ✅ MintNBurnNote proof generation success
- ✅ MakeOrder proof generation success
- ✅ TransferNote proof generation success
- ✅ TakeOrder proof generation success
- ✅ SettleOrder proof generation success
- ✅ ConvertNote proof generation success

### Production Mode Tests (development=false)
- ✅ ETH note minting (real Groth16 verification)
- ✅ DAI note minting (real Groth16 verification)
- ✅ Invalid proof rejection
- ✅ MakeOrder execution (real Groth16 verification)
- ✅ TransferNote (Spend) execution (real Groth16 verification)
- ✅ Liquidate execution (real Groth16 verification)
- ✅ **E2E trading flow (Make → Take → Settle → Convert) verified**

## Usage

### 1. Circuit Compilation
```bash
cd circuits-circom
npm install
~/.cargo/bin/circom main/mint_burn_note.circom --r1cs --wasm --sym -o build/
```

### 2. Trusted Setup
```bash
# Download Powers of Tau (already done)
curl -L -o build/pot20_final.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_20.ptau

# Generate zkey
npx snarkjs groth16 setup build/mint_burn_note.r1cs build/pot20_final.ptau build/mint_burn_note_0000.zkey
echo "random" | npx snarkjs zkey contribute build/mint_burn_note_0000.zkey build/mint_burn_note.zkey --name="1st"
npx snarkjs zkey export verificationkey build/mint_burn_note.zkey build/mint_burn_note_vk.json
```

### 3. Proof Generation (JavaScript)
```javascript
const { getMintNBurnProof } = require('./scripts/lib/snarkjsUtils');

const proof = await getMintNBurnProof(note, secretKey);
// proof = { a, b, c, input }
```

### 4. Smart Contract Call
```javascript
await zkDai.mint(
  proof.a,
  proof.b,
  proof.c,
  proof.input,
  encryptedNote,
  { value: noteValue }
);
```

## Issues Resolved

### 1. BabyJubJub Base Point Unification ✓

**Problem**: JavaScript babyjubjub library and circomlib use different base points

- babyjubjub npm (ZoKrates compatible):
  - gX: `16540640123574156134436876038791482806971768689494387082833631921987005038935`
  - gY: `20819045374670962167435360035096875258406992893633759881276124905556507972311`

- circomlib (snarkjs compatible):
  - BASE8[0]: `5299619240641551281634865583518297030282874472190772894086521144482721001553`
  - BASE8[1]: `16950150798460657717958625567821834550301663161624707787222815936182638968203`

**Solution**: Created `circomlibBabyJub.js` wrapper using `circomlibjs` package

### 2. Note.js and snarkjsUtils.js Integration ✓

**Solution**: Created `noteProofHelper.js`
- Key pair generation using circomlibBabyJub
- Unified Note object and proof generation

### 3. snarkjs Public Signal Order ✓

**Problem**: snarkjs/circom outputs public signals as `[output, ...public_inputs]`, but existing Solidity contracts expected `[...public_inputs, output]`

**Affected Contracts**:
- `MintNotes.sol` - input[0,1] → input[1,2]
- `LiquidateNotes.sol` - input[0,1] → input[1,2]
- `SpendNotes.sol` - input[0..7] → input[1..8]
- `ZkDai.sol` - input[2,3] → input[3,4]
- `ZkDex.sol` - all functions (convertNote, makeOrder, takeOrder, settleOrder) index fixes

**Solution**: Updated all contract input array indices to match snarkjs order

### 4. SHA256 Hash Format Compatibility ✓

**Problem**: Needed to verify circom circuit SHA256 input format matches JavaScript implementation

**Solution**: Verified in `test/sha256-hash-test.js`
- Confirmed JavaScript Note.hash() matches circom SHA256_1536bit output

### 5. SettleOrder Price and Division Witness ✓

**Problem**: Needed to understand SettleOrder circuit price calculation formulas

**Circuit Constraints**:
```
// Line 160: o0Value * price = q0 * 10^18 + r0
// Line 174: o1Value = q1 * price + r1
```

**Price Semantics**:
- `price` = "target token per source token" (no scaling)
- Example: "10 DAI per ETH" → price = 10

**Division Witness Calculation**:
```javascript
// For q0, r0: o0Value * price = q0 * SCALING + r0
const o0ValueTimesPrice = makerValue * price;
const q0 = o0ValueTimesPrice / SCALING_FACTOR;
const r0 = o0ValueTimesPrice % SCALING_FACTOR;

// For q1, r1: o1Value = q1 * price + r1
const q1 = takerStakeValue / price;
const r1 = takerStakeValue % price;
```

**Solution**: Fixed `noteProofHelper.js` `generateSettleOrderProof` and test code

### 6. Smart Note Output Verification ✓

**Problem**: SettleOrder reward, payment, change notes must all be smart notes

**Solution**: Added `createSmartNote` function to `noteProofHelper.js`
- owner = hash of another note (split into 128-bit parts)
- reward note: owner = taker's parent note
- payment note: owner = maker note
- change note: owner = taker's parent note

## Known Issues

No known issues at this time.

## Test Suites

### Node.js Tests

```bash
node test/integration-test.js
```

### Node.js Test Results (21/21 passing)

| Test Suite | Result |
|------------|--------|
| Note Creation | 6/6 ✓ |
| Circuit Files | 6/6 ✓ |
| snarkjsUtils | 2/2 ✓ |
| Hash Computation | 3/3 ✓ |
| Verifier Interface | 2/2 ✓ |
| Dummy Proof Flow | 2/2 ✓ |

### Truffle Tests

```bash
# Development mode (skip proof verification)
npx truffle test test/ZkDex.groth16.test.js

# Production mode (real Groth16 verification)
npx truffle test test/ZkDex.production.test.js
```

### Truffle Test Results (19/19 passing)

#### Development Mode (8/8)

| Test Suite | Result |
|------------|--------|
| Contract Deployment | 4/4 ✓ |
| Note Minting (ETH) | 1/1 ✓ |
| Note Minting (DAI) | 1/1 ✓ |
| Note State Management | 1/1 ✓ |
| Groth16 Proof Format | 1/1 ✓ |

#### Production Mode (11/11) - Real Groth16 Verification

| Test Suite | Result | Duration |
|------------|--------|----------|
| Deploy in Production Mode | 1/1 ✓ | - |
| Mint ETH (Real Proof) | 1/1 ✓ | ~4.2s |
| Reject Invalid Proof | 1/1 ✓ | ~2.6s |
| Mint DAI (Real Proof) | 1/1 ✓ | ~3.4s |
| MakeOrder (Real Proof) | 1/1 ✓ | ~6.6s |
| TransferNote/Spend (Real Proof) | 1/1 ✓ | ~13.9s |
| Liquidate (Real Proof) | 1/1 ✓ | ~6.6s |
| **E2E Step 1: MakeOrder** | 1/1 ✓ | ~6.7s |
| **E2E Step 2: TakeOrder** | 1/1 ✓ | ~9.0s |
| **E2E Step 3: SettleOrder** | 1/1 ✓ | ~16.5s |
| **E2E Step 4: ConvertNote** | 1/1 ✓ | ~9.0s |

### Test Files

- `test/integration-test.js` - Comprehensive integration tests
- `test/circom-test.js` - Circuit file verification and proof generation tests
- `test/ZkDex.groth16.test.js` - Truffle development mode tests
- `test/ZkDex.production.test.js` - Truffle production mode tests (real proof verification)
- `test/proof-generation-test.js` - Proof generation unit tests
- `test/sha256-hash-test.js` - SHA256 hash compatibility tests
- `test/frontend-integration.test.js` - Frontend integration tests (20 tests)
- `test/boundary-edge-cases.test.js` - Boundary value and edge case tests (33 tests)
- `test/util.js` - Test utilities

## Added Files

### JavaScript Utilities

| File | Description |
|------|-------------|
| `scripts/lib/circomlibBabyJub.js` | circomlib-compatible BabyJubJub wrapper |
| `scripts/lib/noteProofHelper.js` | Note.js and snarkjsUtils.js integration helper, smart note creation |
| `scripts/lib/snarkjsUtils.js` | snarkjs-based proof generation (replaces dockerUtils.js) |

### snarkjsUtils.js Key Functions

```javascript
// Proof generation functions
getMintNBurnProof(note, sk)           // Note minting/burning
getTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1)
getConvertProof(smartNote, originNote, newNote, sk)
getMakeOrderProof(makerNote, sk)      // Order creation
getTakeOrderProof(parentNote, stakeNote, sk)
getSettleOrderProof(makerNote, takerStakeNote, rewardNote, paymentNote, changeNote, price, sk, q0, r0, q1, r1)

// Utility functions
formatProofForContract(proof, publicSignals)  // Format for contract
verifyProofLocal(circuitName, proof, publicSignals)  // Local verification
```

### noteProofHelper.js Key Functions

```javascript
// Key management
generateKeypair()                      // circomlib-compatible key pair generation
derivePublicKey(sk)                    // sk → pk derivation

// Note creation
createNote(sk, value, tokenType, viewingKey, salt)    // Normal note creation
createSmartNote(ownerNote, value, tokenType, ...)     // Smart note creation (E2E trading)
createEmptyNote()                      // Empty note

// Proof generation (snarkjsUtils wrappers)
generateMintProof(note, sk)
generateTransferProof(oldNote0, oldNote1, newNote, changeNote, sk0, sk1)
generateMakeOrderProof(makerNote, sk)
generateTakeOrderProof(parentNote, stakeNote, sk)
generateConvertProof(smartNote, originNote, newNote, sk)
generateSettleOrderProof(makerNote, takerStakeNote, rewardNote, paymentNote, changeNote, price, sk)
```

## Completed Tasks

1. ✅ SHA256 hash format verification
   - Confirmed circom circuit SHA256 input format matches JavaScript implementation
   - Real proof generation tests completed

2. ✅ Production tests
   - Real proof verification in development=false mode
   - MintNBurnNote, MakeOrder, TransferNote, Liquidate tests passing

3. ✅ Contract index fixes
   - All contracts updated to match snarkjs public signal order

4. ✅ Core functionality production verification
   - Mint (ETH/DAI), Transfer, MakeOrder, Liquidate - 7 tests passing

5. ✅ **E2E trading flow tests completed**
   - TakeOrder production test added
   - SettleOrder production test added
   - Full trading flow (Make → Take → Settle) verified
   - Smart note creation function (`createSmartNote`) added

6. ✅ **Price calculation logic verified**
   - settle_order circuit division witness calculation formulas confirmed
   - `o0Value * price = q0 * 10^18 + r0`
   - `o1Value = q1 * price + r1`
   - noteProofHelper.js generateSettleOrderProof fixed

7. ✅ **ConvertNote production test added**
   - Smart note → normal note conversion test completed
   - Added as E2E trading flow Step 4 (Make → Take → Settle → Convert)
   - All 11 production tests passing

8. ✅ **Frontend integration tests completed**
   - `test/frontend-integration.test.js` - 20 tests all passing
   - `examples/frontend-usage.js` - Frontend usage example code

### Frontend Integration Test Results (20/20 passing)

| Test Category | Test Items | Result |
|---------------|------------|--------|
| Key Generation | Initialize, Generate, Derive, Multiple | 4/4 ✓ |
| Note Creation | ETH, DAI, BigInt, Empty, Smart, Deterministic | 6/6 ✓ |
| Mint Proof | Generate ETH, Verify, Generate DAI | 3/3 ✓ |
| Transfer Proof | Generate (1 input) | 1/1 ✓ |
| MakeOrder Proof | Generate | 1/1 ✓ |
| TakeOrder Proof | Generate | 1/1 ✓ |
| ConvertNote Proof | Generate | 1/1 ✓ |
| SettleOrder Proof | Generate | 1/1 ✓ |
| Proof Format | Contract compatibility, Array helper | 2/2 ✓ |

### Boundary Value and Edge Case Tests (45/45 passing)

```bash
node test/boundary-edge-cases.test.js
```

| Test Category | Test Items | Result |
|---------------|------------|--------|
| Boundary Values | value=0, 1 wei, 1 ETH, 2^128-1, 10^30, token types, salt boundaries | 9/9 ✓ |
| Edge Cases | Empty note hash, same value notes, self-transfer, equal split, full transfer, two inputs | 7/7 ✓ |
| Price Calculation | price=1 (1:1), exact division, large price (100), partial fill | 4/4 ✓ |
| Smart Notes | Create smart note, ownerAddress derivation, convert note | 3/3 ✓ |
| Hash Consistency | Deterministic, value change, token change, owner change, 128-bit split | 5/5 ✓ |
| Proof Format | Structure validation, hex values, circuit differences | 3/3 ✓ |
| MakeOrder/TakeOrder | Minimum value, stake note creation | 2/2 ✓ |
| Viewing Key Relationship | Normal note vk↔address, smart note vk↔parentHash, different keys | 4/4 ✓ |
| SettleOrder Security | Stake owner, payment owner, change owner (bit=1), negative tests | 6/6 ✓ |
| SettleOrder bit=0 | Taker excess scenario, change owner constraint | 2/2 ✓ |

### Frontend Integration Example (`examples/frontend-usage.js`)

```javascript
// Initialize
await initialize();

// Create wallet
const wallet = await createNewWallet();

// Mint ETH (deposit)
const mintResult = await mintETH(wallet, 1n * 10n ** 18n);

// Contract call
await zkdex.mint(
    mintResult.proof.a,
    mintResult.proof.b,
    mintResult.proof.c,
    mintResult.proof.input,
    mintResult.encryptedNote,
    { value: '1000000000000000000' }
);
```

9. ✅ **Docker environment setup completed**
   - `Dockerfile` - Conditional build (uses local build if available, otherwise downloads)
   - `docker-compose.yml` - Ganache + ZK-DEX service configuration
   - `.dockerignore` - Excludes unnecessary files
   - All tests passing in Docker environment

10. ✅ **Boundary value and edge case tests added**
   - `test/boundary-edge-cases.test.js` - 45 tests all passing
   - Covers circuit behavior at boundary values and edge cases

11. ✅ **Viewing key ↔ ownerAddress relationship established**
    - Normal notes: ownerAddress = viewingKey[96:256] (last 160 bits)
    - Smart notes: ownerAddress = truncated(parentNoteHash), viewingKey = parentNoteHash
    - Added 4 new relationship tests

12. ✅ **SettleOrder security fixes implemented**
    - Security Fix 1: Stake note owner verification
    - Security Fix 2: Payment note owner verification
    - Security Fix 3: Change note owner verification (bit-dependent)
    - Added 6 new security tests (3 positive, 3 negative)

13. ✅ **SettleOrder bit=0 scaling fix**
    - Fixed payment calculation: `o0ValuePrice = q0 * DECIMALS`
    - bit=0 (taker excess) now correctly scales DAI payment to wei
    - Added 2 new bit=0 tests

## Docker Environment

### File Structure

```
Dockerfile              # Conditional build (uses local artifacts if available)
docker-compose.yml      # Service configuration
.dockerignore           # Excluded files list
```

### Dockerfile Features

- **Conditional build**: Uses local `circuits-circom/build/*.zkey` files if present
- Falls back to automatic ptau download + circuit compilation + trusted setup
- Circom compiler built from Rust (multi-stage build)

### Service Configuration

| Service | Description | Profile |
|---------|-------------|---------|
| `ganache` | Local Ethereum blockchain | default |
| `zkdex` | Run tests | default |
| `zkdex-dev` | Development shell | dev |
| `test-frontend` | Frontend tests | test |
| `test-production` | Production tests | test |

### Usage

```bash
# Build (fast with local build artifacts)
docker compose build zkdex

# Run tests
docker compose up zkdex

# Development mode (shell access)
docker compose --profile dev up zkdex-dev

# Frontend tests
docker compose --profile test up test-frontend

# Production tests
docker compose --profile test up test-production

# Cleanup
docker compose down -v
```

### Ganache Configuration

- Network ID: 5777
- Accounts: 10 (1000 ETH each)
- Gas Limit: 12,000,000
- Mnemonic: `candy maple cake sugar pudding cream honey rich smooth crumble sweet treat`

### truffle-config.js Docker Network

```javascript
docker: {
  host: process.env.GANACHE_HOST || 'ganache',
  port: process.env.GANACHE_PORT || 8545,
  network_id: '5777',
  websockets: true,
  gas: 12000000,
  gasPrice: 20000000000,
}
```

## Address-Based Ownership Migration (Phase 2)

### Overview

Migrated note ownership from BabyJubJub public key coordinates (owner0, owner1) to a 160-bit address derived from SHA256.

**Migration Date:** 2026-01-25
**Status:** ✅ Complete (All tests passing)

### Key Changes

#### Note Structure

| Field | Before | After |
|-------|--------|-------|
| Owner | owner0 (256-bit) + owner1 (256-bit) = 512-bit | ownerAddress (160-bit) |
| Note Hash Input | 1536 bits | 1184 bits |

#### Address Derivation

```
ownerAddress = SHA256(pk.x || pk.y)[96:256]  // Last 160 bits
```

- pk.x and pk.y are 256-bit BabyJubJub public key coordinates
- Address = last 160 bits of SHA256 hash
- Provides ~2^80 collision resistance (sufficient for practical security)

#### Note Hash Format (1184 bits)

```
SHA256(
  ownerAddress (160 bits) ||
  value (256 bits) ||
  tokenType (256 bits) ||
  vk0 (128 bits) ||
  vk1 (128 bits) ||
  salt (256 bits)
)
```

### Circuit Changes

#### New Files

| File | Description |
|------|-------------|
| `circuits-circom/utils/sha256/sha256_note_address.circom` | Note hash with 160-bit address |
| `circuits-circom/utils/babyjubjub/get_address.circom` | Address derivation from public key |

#### Modified Main Circuits

All 6 main circuits updated to use ownerAddress instead of owner0/owner1:
- `mint_burn_note.circom` - Uses VerifyOwnershipByAddressStrict
- `transfer_note.circom` - Uses ownerAddress for all notes
- `make_order.circom` - Uses VerifyOwnershipByAddressStrict
- `take_order.circom` - Uses ownerAddress
- `settle_order.circom` - Uses ownerAddress
- `convert_note.circom` - Uses ownerAddress

### Constraint Count Changes

| Circuit | Before | After | Change |
|---------|--------|-------|--------|
| mint_burn_note | 125,679 | 154,900 | +23% |
| make_order | 125,679 | 154,900 | +23% |
| take_order | 247,664 | 246,040 | -0.7% |
| convert_note | 369,396 | 337,437 | -8.6% |
| transfer_note | 494,825 | 492,085 | -0.6% |
| settle_order | 614,380 | 520,481 | -15% |

**Note:** mint_burn_note and make_order constraints increased due to address derivation (SHA256 of public key). Other circuits decreased due to smaller note hash input (1184 vs 1536 bits). settle_order includes security fixes (Phase 2.2-2.3).

### Backend Changes

#### Note.js

```javascript
class Note {
  // Before
  constructor(owner0, owner1, value, type, viewingKey, salt)

  // After
  constructor(ownerAddress, value, type, viewingKey, salt)
  // ownerAddress: 160-bit hex string (40 characters)
  // viewingKey: { vk0, vk1 } two 128-bit values
}
```

#### noteProofHelper.js

```javascript
// Before
const { secretKey, owner0, owner1 } = await generateKeypair();

// After
const { secretKey, ownerAddress } = await generateKeypair();
```

#### Smart Note Owner

For smart notes, the owner is derived from the parent note hash:

```javascript
// Before: owner = parentNote.hashArr() → [nh0, nh1] (256-bit split to two 128-bit)

// After: owner = SHA256(parentNoteHash)[96:256] (160-bit truncation)
function getSmartNoteOwner(parentNoteHash) {
    const hash = crypto.createHash('sha256')
        .update(Buffer.from(parentNoteHash.slice(2), 'hex'))
        .digest('hex');
    return hash.slice(-40);  // Last 160 bits
}
```

### Test Results

All circuit tests passing:
- ✅ mint_burn_note proof generation
- ✅ make_order proof generation
- ✅ (Other circuits pending full integration)

### Migration Benefits

1. **Reduced Note Size:** 512-bit → 160-bit owner representation
2. **Smaller Hash Input:** 1536-bit → 1184-bit note hash
3. **Ethereum Compatibility:** 160-bit address matches Ethereum format
4. **Unified Structure:** Normal and smart notes use same owner format

---

## Viewing Key ↔ OwnerAddress Relationship (Phase 2.1)

### Overview

Established a clear derivation relationship between viewing key and owner address for both normal and smart notes.

**Date:** 2026-01-26
**Status:** ✅ Complete

### Normal Notes

```
viewingKey = SHA256(pk.x || pk.y) = 256 bits
ownerAddress = viewingKey[96:256] = last 160 bits
```

- pk.x and pk.y are BabyJubJub public key coordinates (256 bits each)
- viewingKey is the full 256-bit hash
- ownerAddress is derived from viewingKey (last 160 bits)

### Smart Notes

```
viewingKey = parentNoteHash = 256 bits
ownerAddress = truncated(parentNoteHash) = h0[0:32 bits] + h1[all 128 bits] = 160 bits
```

- parentNoteHash is split into h0 (first 128 bits) and h1 (last 128 bits)
- ownerAddress = h0[96:128] (32 bits) + h1 (128 bits) = 160 bits
- This maintains the relationship: ownerAddress is embedded within viewingKey

### Backend Implementation

**noteProofHelper.js:**
```javascript
// Normal note creation
async function createNote(sk, value, tokenType, viewingKey = null, salt = null) {
    const pk = await derivePublicKey(sk);
    const ownerAddress = deriveAddressFromPK(pk);  // SHA256(pk)[96:256]

    if (!viewingKey) {
        const vkData = snarkjsUtils.getViewingKeyFromPublicKey(pk);
        viewingKey = vkData.fullHash;  // SHA256(pk) = 256 bits
    }
    // ...
}

// Smart note creation
function createSmartNote(ownerNote, value, tokenType, viewingKey = null, salt = null) {
    const ownerHash = ownerNote.hash();
    const ownerAddress = snarkjsUtils.getSmartNoteOwnerAddress(ownerHash);

    if (!viewingKey) {
        viewingKey = ownerHash;  // parentNoteHash = 256 bits
    }
    // ...
}
```

---

## SettleOrder Security Fixes (Phase 2.2)

### Overview

Fixed critical security issues and a scaling bug in the settle_order circuit.

**Date:** 2026-01-26
**Status:** ✅ Complete

### Security Fix 1: Stake Note Owner Verification

**Problem:** Stake note owner was not verified to match the truncated maker note hash.

**Solution:** Added constraint in `settle_order.circom`:
```circom
// SECURITY FIX 1: Verify stake note (o1) owner == truncated(makerNote.hash)
component stakeOwnerCheck = IsEqual();
stakeOwnerCheck.in[0] <== o1OwnerAddress;
stakeOwnerCheck.in[1] <== packMakerAddr.out;  // truncated maker hash
stakeOwnerCheck.out === 1;
```

### Security Fix 2: Payment Note Owner Verification

**Problem:** Payment note owner was not verified.

**Solution:** Added constraint:
```circom
// SECURITY FIX 2: Verify payment note (n1) owner == truncated(makerNote.hash)
component paymentOwnerCheck = IsEqual();
paymentOwnerCheck.in[0] <== n1OwnerAddress;
paymentOwnerCheck.in[1] <== packMakerAddr.out;
paymentOwnerCheck.out === 1;
```

### Security Fix 3: Change Note Owner Verification

**Problem:** Change note owner was not verified based on settlement direction (bit).

**Solution:** Added constraint:
```circom
// SECURITY FIX 3: Verify change note (n2) owner
// bit=1: change to maker, bit=0: change to taker
component muxChangeOwner = Mux1();
muxChangeOwner.c[0] <== n0OwnerAddress;      // if bit=0, taker
muxChangeOwner.c[1] <== packMakerAddr.out;   // if bit=1, maker
muxChangeOwner.s <== bit;

component changeOwnerCheck = IsEqual();
changeOwnerCheck.in[0] <== n2OwnerAddress;
changeOwnerCheck.in[1] <== muxChangeOwner.out;
changeOwnerCheck.out === 1;
```

---

## SettleOrder bit=0 Scaling Fix (Phase 2.3)

### Overview

Fixed a critical scaling bug in the bit=0 case (taker has excess) of the settle_order circuit.

**Date:** 2026-01-26
**Status:** ✅ Complete

### Problem

When bit=0, the payment calculation used `q0` directly, which loses the wei scaling:

```circom
// Before (BUG)
signal o0ValuePrice;
o0ValuePrice <== q0;  // q0 = 50, not 50×10^18!
```

**Example:**
- makerValue = 5 ETH = 5×10^18 wei
- price = 10 (10 DAI per ETH)
- q0 = (5×10^18 × 10) / 10^18 = 50
- **Wrong:** payment = 50 wei (essentially 0 DAI)
- **Correct:** payment = 50×10^18 wei (50 DAI)

### Solution

Scale up `o0ValuePrice` by multiplying with DECIMALS (10^18):

```circom
// After (FIXED)
signal o0ValuePrice;
o0ValuePrice <== q0 * DECIMALS;  // q0 * 10^18 = 50×10^18
```

### bit=0 vs bit=1 Comparison

| Scenario | bit=1 (Maker Excess) | bit=0 (Taker Excess) |
|----------|----------------------|----------------------|
| Condition | makerValue ≥ q1 | makerValue < q1 |
| Reward (to taker) | q1 (ETH equiv) | makerValue (all ETH) |
| Payment (to maker) | takerValue (full DAI) | q0 × 10^18 (DAI equiv) |
| Change | makerValue - q1 | takerValue - payment |
| Change Owner | Maker | Taker |

### Verified Example (bit=0)

| Value | Amount |
|-------|--------|
| makerValue | 5 ETH = 5×10^18 wei |
| takerValue | 100 DAI = 100×10^18 wei |
| price | 10 (10 DAI/ETH) |
| q1 | 10×10^18 (10 ETH equiv) |
| q0 | 50 |
| **reward** | 5×10^18 (5 ETH to taker) ✓ |
| **payment** | 50×10^18 (50 DAI to maker) ✓ |
| **change** | 50×10^18 (50 DAI to taker) ✓ |

---

## Next Steps

1. Performance optimization (planned - reduce proof generation time)

## Dependencies

### circuits-circom/package.json
```json
{
  "dependencies": {
    "circomlib": "^2.0.5",
    "snarkjs": "^0.7.4"
  }
}
```

### Root package.json (added)
```json
{
  "dependencies": {
    "snarkjs": "^0.7.6",
    "circomlibjs": "^0.1.7",
    "ffjavascript": "^0.3.1",
    "@openzeppelin/contracts": "^4.9.3"
  }
}
```

## References

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs GitHub](https://github.com/iden3/snarkjs)
- [circomlib GitHub](https://github.com/iden3/circomlib)
- [Hermez Powers of Tau](https://github.com/hermeznetwork/phase2ceremony_4)
