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

| Circuit | Non-linear Constraints | Linear Constraints | Wires |
|---------|------------------------|-------------------|-------|
| mint_burn_note | 125,679 | 5,294 | 129,725 |
| make_order | 125,679 | 5,294 | 129,725 |
| take_order | 247,664 | 10,537 | 255,702 |
| convert_note | 369,396 | 15,657 | 381,303 |
| transfer_note | 494,825 | 20,818 | 510,646 |
| settle_order | 614,380 | 26,275 | 634,399 |

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

### Boundary Value and Edge Case Tests (33/33 passing)

```bash
node test/boundary-edge-cases.test.js
```

| Test Category | Test Items | Result |
|---------------|------------|--------|
| Boundary Values | value=0, 1 wei, 1 ETH, 2^128-1, 10^30, token types, salt boundaries | 9/9 ✓ |
| Edge Cases | Empty note hash, same value notes, self-transfer, equal split, full transfer, two inputs | 7/7 ✓ |
| Price Calculation | price=1 (1:1), exact division, large price (100), partial fill | 4/4 ✓ |
| Smart Notes | Create smart note, identify smart, convert note | 3/3 ✓ |
| Hash Consistency | Deterministic, value change, token change, owner change, 128-bit split | 5/5 ✓ |
| Proof Format | Structure validation, hex values, circuit differences | 3/3 ✓ |
| MakeOrder/TakeOrder | Minimum value, stake note creation | 2/2 ✓ |

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
   - `test/boundary-edge-cases.test.js` - 33 tests all passing
   - Covers circuit behavior at boundary values and edge cases

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
