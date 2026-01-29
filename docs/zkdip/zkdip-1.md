# ZKDIP-1: Fungible Smart Notes

| Field | Value |
|-------|-------|
| **ZKDIP** | 1 |
| **Title** | Fungible Smart Notes |
| **Author** | ZK-DEX Team |
| **Status** | Draft |
| **Type** | Standards Track |
| **Created** | 2026-01-29 |
| **Related Issues** | Security Report 2.5 (Field Overflow), 2.6 (Division Remainder) |

---

## Abstract

Make smart notes **fungible** with regular notes - they should be transferable to any user, not just usable within DEX operations.

---

## Motivation

### Current Design Problems

```
// Current smart note structure (7 inputs)
smartNote = {
  owner0: parentHash_hi,    // Upper 128 bits of parent hash
  owner1: parentHash_lo,    // Lower 128 bits of parent hash
  value, tokenType,
  vk0: parentHash_hi,       // Duplicate
  vk1: parentHash_lo,       // Duplicate
  salt
}
```

**Problems**:
1. **Overflow Risk**: `owner0 * 2^128 + owner1` operation overflows BN128 field when owner0 >= 2^126
2. **Non-fungible**: Only parent note owner can claim (no recipient specification)
3. **Non-transferable**: Smart notes cannot be "sent" to other users

### Security Issue Reference

**Issue 2.5 (High Severity)**: Field overflow possible during parentHash reconstruction at `convert_note.circom:70-72`, `settle_order.circom:141-143`.

```circom
signal smartParentReconstructed;
smartParentReconstructed <== smartOwner0 * (2**128) + smartOwner1;  // Overflow!
smartParentReconstructed === originHash;
```

---

## Specification

### Regular Note (5 inputs)

```circom
// PoseidonRegularNote
noteHash = Poseidon(pkX, pkY, value, tokenType, salt)
```

| Field | Type | Description |
|-------|------|-------------|
| `pkX` | Field (254-bit) | Owner's BabyJubJub public key X coordinate |
| `pkY` | Field (254-bit) | Owner's BabyJubJub public key Y coordinate |
| `value` | Field | Note amount |
| `tokenType` | Field | Token type (0=ETH, 1=DAI, ...) |
| `salt` | Field (254-bit) | Random salt |

**Ownership Proof**: `sk → pk` verification (ProofOfOwnershipStrict)

### Smart Note (6 inputs)

```circom
// PoseidonSmartNote
smartNoteHash = Poseidon(parentHash, recipientPkX, recipientPkY, value, tokenType, salt)
```

| Field | Type | Description |
|-------|------|-------------|
| `parentHash` | Field (254-bit) | Full hash of origin note (provenance tracking) |
| `recipientPkX` | Field (254-bit) | Recipient's BabyJubJub public key X coordinate |
| `recipientPkY` | Field (254-bit) | Recipient's BabyJubJub public key Y coordinate |
| `value` | Field | Note amount |
| `tokenType` | Field | Token type |
| `salt` | Field (254-bit) | Random salt |

**Ownership Proof**: `sk → recipientPk` verification (ProofOfOwnershipStrict)

---

## Rationale

### Overflow Resolution

**Before**:
```circom
// convert_note.circom:70-72 - Overflow risk
signal smartParentReconstructed;
smartParentReconstructed <== smartOwner0 * (2**128) + smartOwner1;
smartParentReconstructed === originHash;
```

**After**:
```circom
// Direct comparison - no overflow possible
smartNote.parentHash === originHash;
```

### Fungibility

**Before**: Smart notes can only be claimed by parent note owner
```
Bob creates smart note from his note → Only Bob can claim
Cannot send to Alice
```

**After**: Smart notes can be sent to anyone
```
Bob creates smart note with recipientPk = Alice's pk → Alice can claim
Fully fungible with regular notes
```

### DEX Compatibility

```
takeOrder:
  - Taker creates stake note
  - parentHash = maker's note hash (links to order)
  - recipientPk = maker's pk (maker can claim)

settleOrder:
  - Verify stake.parentHash == makerNoteHash (correct order)
  - Maker proves ownership via sk → stake.recipientPk
```

---

## Circuit Changes

### Utility Templates

#### `circuits-circom/utils/poseidon/poseidon_note.circom`

```circom
// Regular note hash (5 inputs)
template PoseidonRegularNote() {
    signal input pkX;
    signal input pkY;
    signal input value;
    signal input tokenType;
    signal input salt;
    signal output out;

    component hasher = Poseidon(5);
    hasher.inputs[0] <== pkX;
    hasher.inputs[1] <== pkY;
    hasher.inputs[2] <== value;
    hasher.inputs[3] <== tokenType;
    hasher.inputs[4] <== salt;
    out <== hasher.out;
}

// Smart note hash (6 inputs)
template PoseidonSmartNote() {
    signal input parentHash;
    signal input recipientPkX;
    signal input recipientPkY;
    signal input value;
    signal input tokenType;
    signal input salt;
    signal output out;

    component hasher = Poseidon(6);
    hasher.inputs[0] <== parentHash;
    hasher.inputs[1] <== recipientPkX;
    hasher.inputs[2] <== recipientPkY;
    hasher.inputs[3] <== value;
    hasher.inputs[4] <== tokenType;
    hasher.inputs[5] <== salt;
    out <== hasher.out;
}

// Empty regular note hash (5 inputs)
template EmptyRegularNoteHash() {
    signal output out;
    component hasher = Poseidon(5);
    for (var i = 0; i < 5; i++) {
        hasher.inputs[i] <== 0;
    }
    out <== hasher.out;
}

// Empty smart note hash (6 inputs)
template EmptySmartNoteHash() {
    signal output out;
    component hasher = Poseidon(6);
    for (var i = 0; i < 6; i++) {
        hasher.inputs[i] <== 0;
    }
    out <== hasher.out;
}
```

### Main Circuits

#### 1. `mint_burn_note.circom`

```
Public:  [noteHash, value, tokenType]
Private: [pkX, pkY, salt, sk]

Changes:
- Remove: ownerAddress, vk0, vk1
- Add: pkX, pkY (full public key)
- Use: PoseidonRegularNote (5 inputs)
- Use: ProofOfOwnershipStrict (sk → pk)
```

#### 2. `transfer_note.circom`

```
Public:  [o0Hash, o1Hash, newHash, changeHash]
Private: 4 notes × (pkX, pkY, value, tokenType, salt) + sk0, sk1

Changes:
- All notes: Use PoseidonRegularNote (5 inputs)
- Remove: ownerAddress, vk0, vk1 from all notes
- Ownership: ProofOfOwnershipStrict
```

#### 3. `make_order.circom`

```
Public:  [noteHash, tokenType]
Private: [pkX, pkY, value, salt, sk]

Changes:
- Use: PoseidonRegularNote (5 inputs)
- Remove: ownerAddress, vk0, vk1
```

#### 4. `take_order.circom`

```
Public:  [oldNoteHash, oldType, stakeNoteHash, parentHash, recipientPkX, recipientPkY, stakeType]
Private: old note (pkX, pkY, value, salt, sk) + stake note (value, salt)

Changes:
- Old note: PoseidonRegularNote (5 inputs)
- Stake note: PoseidonSmartNote (6 inputs)
  - parentHash = maker's note hash (public input - on-chain verification)
  - recipientPk = maker's pk (public input - maker can claim)
```

#### 5. `settle_order.circom`

```
Public:  [o0Hash, o0Type,
          o1Hash, o1ParentHash, o1RecipientPkX, o1RecipientPkY, o1Type,
          n0Hash, n0ParentHash, n0RecipientPkX, n0RecipientPkY, n0Type,
          n1Hash, n1ParentHash, n1RecipientPkX, n1RecipientPkY, n1Type,
          n2Hash, n2Type,
          price]

Changes:
- Maker note (o0): PoseidonRegularNote - proven via sk
- Taker stake (o1): PoseidonSmartNote - verify parentHash == o0Hash
- Output notes (n0, n1): PoseidonSmartNote - specify recipients
- Change note (n2): PoseidonRegularNote
```

**Add division remainder verification (Issue 2.6)**:
```circom
// Enforce r0 < 10^18
component r0Check = LessThan(252);
r0Check.in[0] <== r0;
r0Check.in[1] <== 10**18;
r0Check.out === 1;

// Enforce r1 < price
component r1Check = LessThan(252);
r1Check.in[0] <== r1;
r1Check.in[1] <== price;
r1Check.out === 1;
```

#### 6. `convert_note.circom`

```
Public:  [smartHash, originHash, newHash]
Private: smart note (parentHash, recipientPkX, recipientPkY, value, salt) +
         origin note (pkX, pkY, value, salt) +
         new note (pkX, pkY, value, salt) +
         sk

Changes:
- Smart note: PoseidonSmartNote (6 inputs)
- Origin note: PoseidonRegularNote (5 inputs)
- New note: PoseidonRegularNote (5 inputs)
- Verification:
  - smartNote.parentHash === originHash (provenance check)
  - ProofOfOwnershipStrict(sk, smartNote.recipientPk) (ownership check)
  - ProofOfOwnershipStrict(sk, originNote.pk) (origin ownership - same user)
```

---

## Frontend Changes

### `vapp/src/lib/circuitInputs.ts`

```typescript
// Regular note data
interface RegularNoteData {
  pkX: string;      // hex
  pkY: string;      // hex
  value: string;    // hex
  token: string;    // hex (tokenType)
  salt: string;     // hex
}

// Smart note data
interface SmartNoteData {
  parentHash: string;      // hex (full 254-bit)
  recipientPkX: string;    // hex
  recipientPkY: string;    // hex
  value: string;           // hex
  token: string;           // hex
  salt: string;            // hex
}

// Compute regular note hash
async function computeRegularNoteHash(note: RegularNoteData): Promise<bigint> {
  return poseidonHash([
    hexToBigInt(note.pkX),
    hexToBigInt(note.pkY),
    hexToBigInt(note.value),
    hexToBigInt(note.token),
    hexToBigInt(note.salt)
  ]);
}

// Compute smart note hash
async function computeSmartNoteHash(note: SmartNoteData): Promise<bigint> {
  return poseidonHash([
    hexToBigInt(note.parentHash),
    hexToBigInt(note.recipientPkX),
    hexToBigInt(note.recipientPkY),
    hexToBigInt(note.value),
    hexToBigInt(note.token),
    hexToBigInt(note.salt)
  ]);
}
```

### `vapp/src/stores/note.ts`

```typescript
interface Note {
  hash: string;
  // For regular notes
  pkX?: string;
  pkY?: string;
  // For smart notes
  parentHash?: string;
  recipientPkX?: string;
  recipientPkY?: string;
  // Common
  value: string;
  token: string;
  salt: string;
  state: NoteState;
  isSmart: boolean;
}
```

---

## Security Considerations

### Resolved Issues

| Issue | Severity | Status |
|-------|----------|--------|
| 2.5: Field Overflow in Parent Hash Reconstruction | High | **Resolved** |
| 2.6: Division Remainder Bounds | Medium | **Resolved** |

### Overflow Prevention

- Removed `owner0 * 2^128 + owner1` reconstruction operation
- Store `parentHash` as full 254-bit field element
- Direct comparison: `parentHash === originHash`

### Enhanced Ownership Verification

- Before: Only parent note owner can claim (implicit)
- After: Explicit recipientPk - anyone can receive smart notes
- Ownership verification: Standard `sk → pk` proof

---

## Backwards Compatibility

**Hard Fork Required** - All existing notes invalidated:

1. Regular note: 7 inputs → 5 inputs
2. Smart note: 7 inputs → 6 inputs (different structure)
3. Hash computation method completely changed

### Migration

Existing on-chain notes cannot be converted to new hash format. Redeployment required.

**Deployment Strategy**:
1. Verify new circuits on testnet
2. Community testing period
3. Deploy new instance on mainnet

---

## Tradeoffs

### Pros
- Fungible smart notes (transferable to anyone)
- No overflow risk
- Cleaner architecture
- Standard ownership verification for all notes

### Cons
- Smart note has 6 inputs instead of 4 inputs (more constraints)
- Breaking change (hard fork)
- More public inputs in some circuits

### Constraint Comparison

| Note Type | Current | Proposed |
|-----------|---------|----------|
| Regular | 7 inputs (Poseidon-7) | 5 inputs (Poseidon-5) |
| Smart | 7 inputs (Poseidon-7) | 6 inputs (Poseidon-6) |

Net effect: Slightly fewer constraints overall + security/functionality benefits.

---

## Implementation Order

1. Utility circuits (`poseidon_note.circom`)
2. Main circuits (6 circuits)
3. Compile + trusted setup
4. Solidity contracts (verifiers + ZkDex)
5. Frontend TypeScript (circuitInputs, noteEncryption, stores)
6. Vue components
7. E2E testing

---

## References

- [Security Analysis Report](../security/ZK-DEX_Security_Analysis_Report_EN.md)
- [Circuit Security Analysis](../security/CIRCUIT_SECURITY_ANALYSIS.md)

---

## Copyright

This document is distributed under the MIT License.
