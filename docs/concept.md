# ZK-DEX Core Concepts Guide

A comprehensive reference of all conceptual elements used in the ZK-DEX implementation.

---

## Table of Contents

1. [Note](#1-note)
2. [Note Hash](#2-note-hash)
3. [Note State](#3-note-state)
4. [Account](#4-account)
5. [ZK Account](#5-zk-account)
6. [Ownership Model](#6-ownership-model)
7. [Note Creation — Mint](#7-note-creation--mint)
8. [Note Destruction — Liquidate](#8-note-destruction--liquidate)
9. [Note Transfer — Transfer (Spend)](#9-note-transfer--transfer-spend)
10. [Smart Note](#10-smart-note)
11. [Note Conversion — Convert](#11-note-conversion--convert)
12. [Order Creation — Make Order](#12-order-creation--make-order)
13. [Order Acceptance — Take Order](#13-order-acceptance--take-order)
14. [Order Settlement — Settle Order](#14-order-settlement--settle-order)
15. [Cryptographic Primitives](#15-cryptographic-primitives)
16. [Note Encryption (ECDH)](#16-note-encryption-ecdh)
17. [Privacy Model](#17-privacy-model)
18. [Security Properties](#18-security-properties)
19. [FAQ](#19-faq)

---

## 1. Note

A **note** is the fundamental unit of value in ZK-DEX, analogous to Bitcoin's UTXO. Each note is a cryptographic commitment representing ownership of a specific amount of a specific token.

### Note Structure (5 Fields)

| Field | Size | Description |
|-------|------|-------------|
| `ownerAddress` | 160 bits | Address derived from the owner's BabyJubJub public key via Poseidon hash |
| `value` | 254 bits | Token balance (in wei) |
| `tokenType` | 256 bits | Token type (0 = ETH, 1 = DAI) |
| `viewingKey` | 256 bits | Derived from the owner's public key; split into two 128-bit halves for circuit input |
| `salt` | 254 bits | Random value preventing identical notes from producing the same hash |

### Empty Note

A special note with all fields set to 0. Used to fill the second input slot when the transfer circuit has only one input note.

```
EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0)
                = 0x1fdb1d1757a3a3502bec7084abc047ae86a4f442b8a073d5b3482bb02eb353d5
```

---

## 2. Note Hash

The 5 fields of a note are fed into the Poseidon hash function to produce a single field element (254 bits). Only this hash is stored on-chain, so the note's contents cannot be determined without knowing the original fields.

```
noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
```

Here `vk0` and `vk1` are the viewing key split into 128-bit halves:
```
vk0 = viewingKey >> 128      (upper 128 bits)
vk1 = viewingKey & (2^128-1) (lower 128 bits)
```

Reason for splitting: Circom circuits operate over a 254-bit field, so a 256-bit value cannot be handled directly and must be split into two pieces.

---

## 3. Note State

A state machine on the on-chain contract that tracks the lifecycle of each note hash:

```
Invalid ──(mint/transfer)──> Valid ──(spend)──> Spent
                               |
                               └──(makeOrder/takeOrder)──> Trading
```

| State | Value | Description |
|-------|-------|-------------|
| `Invalid` | 0 | Does not exist or has already been consumed |
| `Valid` | 1 | Active note; can be transferred, liquidated, or used in orders |
| `Trading` | 2 | Locked in an order; cannot be transferred directly |
| `Spent` | 3 | Consumed; cannot be reused |

### State Transition Rules

- **Mint**: `Invalid -> Valid` (new note created)
- **Transfer**: inputs `Valid -> Spent`, outputs `Invalid -> Valid`
- **Liquidate**: `Valid -> Spent` (note destroyed)
- **MakeOrder**: `Valid -> Trading` (locked for trading)
- **SettleOrder**: inputs `Trading -> Spent`, outputs `Invalid -> Valid`
- **ConvertNote**: smart note `Valid -> Invalid`, new note `Invalid -> Valid`

---

## 4. Account

In ZK-DEX, an "account" encompasses two key systems:

### Ethereum Account (MetaMask)
- Standard secp256k1 key pair
- Used for contract calls and ETH/DAI deposits/withdrawals
- Managed via MetaMask wallet

### ZK Account (BabyJubJub)
- Key pair on the BabyJubJub curve
- Used for note ownership proofs and privacy guarantees
- Stored locally as a scrypt-based keystore (JSON)

A single user holds both accounts: the Ethereum account for submitting transactions, and the ZK account for note ownership and encryption.

---

## 5. ZK Account

A ZK account is a key system based on the BabyJubJub elliptic curve. Key components:

### Secret Key (sk)
- 254-bit random scalar
- Must be valid within the BN128 field (less than the subgroup order `l`)
- The sole means of proving note ownership

### Public Key (pk)
- A point `(x, y)` on the BabyJubJub curve
- Derived from the secret key: `pk = sk * G` (G is the generator point BASE8)
- Never directly exposed — used only for address derivation

### Owner Address
- A 160-bit value derived from the public key via Poseidon hash
- `ownerAddress = Poseidon(pk.x, pk.y) & MASK_160`
- Same size as an Ethereum address (160 bits)

### Viewing Key

The full 254-bit value derived from the public key via Poseidon hash.

```
viewingKey = Poseidon(pk.x, pk.y)
```

#### Why Is the Viewing Key Needed?

The ZK-DEX note hash is a Poseidon hash of 6 fields:
```
noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
```

The `ownerAddress` (160 bits) alone is insufficient to uniquely identify a note. Multiple notes can exist with the same address, amount, and token type. While `salt` ensures uniqueness, it alone does not commit the owner's full public key information into the hash.

**The viewing key binds the full public key (254 bits) into the note hash.** Using only the 160-bit address would lose 94 bits of public key information; the viewing key includes this information in the hash.

#### Seven Roles of the Viewing Key

**Role 1: Note Hash Commitment**

The viewing key is split into 128-bit halves (vk0, vk1) and enters as the 4th and 5th inputs of the note hash. This cryptographically binds the note hash to the owner's public key.

```
vk0 = viewingKey >> 128      (upper 128 bits)
vk1 = viewingKey & (2^128-1) (lower 128 bits)

noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)
                                                    ^^^  ^^^
                                       public key info committed here
```

Without the viewing key, using only `Poseidon(ownerAddress, value, tokenType, salt)` would allow a different public key with the same address to generate the same hash, enabling ownership forgery.

**Role 2: Address Embedding**

The owner address is exactly the lower 160 bits of the viewing key:

```
ownerAddress = viewingKey & MASK_160
```

Therefore, knowing the viewing key allows recovering the owner address, and conversely the owner address is a subset of the viewing key. This relationship is automatically enforced inside the circuit.

**Role 3: Note Discovery**

A party who knows the viewing key can identify which of the encrypted notes stored on-chain belong to them:

```
1. Listen for on-chain NoteStateChange events
2. Retrieve encrypted data from encryptedNotes[noteHash]
3. Attempt ECDH decryption (using own secret key)
4. On successful decryption -> recover note fields (ownerAddress, value, token, vk, salt)
5. If recovered vk matches own viewing key -> this is their note
```

The wallet automates this process to track all of a user's notes.

**Role 4: Selective Disclosure**

> **Note: Limitation of the Current Implementation**
>
> In Zcash, the viewing key alone can directly decrypt on-chain encrypted data thanks to a dedicated encryption layer (in-band secret distribution). However, **in ZK-DEX's current implementation, on-chain note data is encrypted with a single ECDH + AES-256-GCM layer, and decryption requires the secret key (sk).** The viewing key alone cannot decrypt on-chain ciphertext.
>
> Therefore, selective disclosure is only possible via an **off-chain** workflow:
>
> 1. The note owner decrypts on-chain data using their secret key
> 2. The decrypted note data `(ownerAddress, value, tokenType, viewingKey, salt)` is shared directly with a third party
> 3. The third party recomputes `noteHash = Poseidon(...)` from the received data and verifies it against the on-chain state
> 4. The viewing key confirms that the note belongs to a specific account

In this workflow, the viewing key serves not as a decryption key but as an **owner identity verification marker**. The third party can verify that the viewing key in the received data was derived from the owner's public key, thus confirming note ownership.

| Recipient | Can Do | Cannot Do |
|-----------|--------|-----------|
| Viewing key + off-chain note data holder | Verify note balances, cross-check on-chain state | Directly decrypt on-chain ciphertext, transfer/spend/create orders |
| Secret key holder | Decrypt on-chain data + transfer/spend/create orders | — |

Example: Sharing the viewing key along with decrypted note data with an auditor allows them to verify assets but not move them.

**Role 5: Order Metadata**

When a maker creates an order, the `makerViewingKey` is stored on-chain:

```solidity
struct Order {
    bytes32 makerViewingKey;  // <- viewing key stored
    bytes32 makerNote;
    ...
}
```

This enables:
- The taker to understand the maker's note structure and correctly create the stake note
- The order hash (`hashOrder`) includes the viewing key, ensuring order uniqueness
- The maker's identity (secret key) remains hidden while the counterparty can verify the order

**Role 6: Smart Note Linking**

For smart notes, the viewing key is set to the **parent note's hash** instead of the usual `Poseidon(pk.x, pk.y)`:

```
Normal note:  viewingKey = Poseidon(pk.x, pk.y)
Smart note:   viewingKey = parentNoteHash
```

This design ensures:
- Smart note owner address = `parentNoteHash & MASK_160`
- Only the parent note's owner can convert the smart note to a normal note via `convertNote`
- Order settlement (settle) outputs are guaranteed to belong to the correct parties

**Role 7: Encrypted Note Payload**

When a note is ECDH-encrypted and stored on-chain, the viewing key is included as part of the encrypted payload:

```
Plaintext before encryption: RLP([ownerAddress, value, tokenType, viewingKey, salt])
After encryption:            0x01 || epk || nonce || AES-GCM(plaintext) || authTag
```

Upon decryption, the recipient recovers the viewing key and can recompute the complete note hash to verify against the on-chain state.

#### What If There Were No Viewing Key?

Issues that would arise using only `ownerAddress` (160 bits) without a viewing key:

1. **Loss of public key binding**: A theoretical possibility of 160-bit address collisions exists. When different public keys produce the same address, without the viewing key the note hashes become identical, causing ownership confusion.
2. **Note discovery failure**: Identifying which notes belong to whom requires the full public key information. With only 160 bits of address, confidence in the post-decryption verification step is reduced.
3. **Smart notes become impossible**: The `viewingKey = parentNoteHash` mechanism for smart notes would not work, leaving no means to enforce inter-note linkage during order settlement.

### Key Derivation Chain

```
sk (254-bit random)
  |
  v BabyJubJub scalar multiplication (sk * G)
pk (x, y) — point on the BabyJubJub curve
  |
  v Poseidon(pk.x, pk.y)
viewingKey (254 bits)
  |
  |-- vk0 = viewingKey >> 128     (upper 128 bits)
  |-- vk1 = viewingKey & MASK_128 (lower 128 bits)
  |
  v lower 160-bit truncation
ownerAddress (160 bits)
```

---

## 6. Ownership Model

ZK-DEX uses an **address-based ownership** model. To prove note ownership, the following is verified inside the ZK circuit:

1. Derive public key `pk` from secret key `sk`: `pk = sk * G`
2. Derive address from public key: `addr = Poseidon(pk.x, pk.y) & MASK_160`
3. Verify that the derived address matches the note's `ownerAddress`

This process is performed inside the circuit, so `sk` and `pk` are never revealed externally. On-chain, only the validity of the ZK proof needs to be checked, preserving the owner's identity.

### VerifyOwnershipByAddress (Circuit Component)

```
Input: sk, expectedAddress
Internal: pk = sk * G
          addr = Poseidon(pk.x, pk.y) truncated to 160-bit
Output: result = (addr == expectedAddress) ? 1 : 0
```

---

## 7. Note Creation — Mint

An operation that deposits ETH or DAI into the contract and creates a new note for the deposited amount.

### Circuit: MintNBurnNote

**Public inputs (4)**:
| Index | Name | Description |
|-------|------|-------------|
| 0 | output | Always 1 (validity marker) |
| 1 | noteHash | Hash of the note to be created |
| 2 | value | Deposit amount (public — required for `msg.value` verification) |
| 3 | tokenType | Token type (public) |

**Private inputs**: ownerAddress, vk0, vk1, salt, sk

**Verification**:
1. Prove ownership of `ownerAddress` from `sk`
2. Verify note hash matches the public input `noteHash`
3. Verify note's `value` and `tokenType` match the public inputs

### On-chain Behavior

```solidity
function mint(a, b, c, input, encryptedNote) external payable {
    // ETH: verify msg.value == input[2]
    // DAI: transferFrom(msg.sender, address(this), input[2])
    // After proof verification: notes[noteHash] = Valid
    // Store encrypted note data
}
```

**Key point**: The reason `value` is a public input is that the contract must verify the actual deposit (`msg.value` or DAI transfer amount) matches the note's value. This is an unavoidable information disclosure at the system boundary (external assets <-> ZK notes).

---

## 8. Note Destruction — Liquidate

An operation that destroys a note and withdraws the equivalent amount of ETH or DAI to a specified address.

### Circuit: MintNBurnNote (Same circuit reused from Mint)

**Public inputs (4)**: output, noteHash, value, tokenType (same structure as Mint)

**Verification**: Same as Mint — ownership proof + hash match + value/token match

### On-chain Behavior

```solidity
function liquidate(to, a, b, c, input) external {
    // After proof verification: notes[noteHash] = Spent
    // ETH: to.transfer(value) or DAI: dai.transfer(to, value)
}
```

**State change**: `Valid -> Spent`

---

## 9. Note Transfer — Transfer (Spend)

An operation that consumes 1-2 input notes and creates 2 output notes (recipient + change). Both amount and owner are kept fully private.

### Circuit: TransferNote

**Public inputs (5)**:
| Index | Name | Description |
|-------|------|-------------|
| 0 | output | Always 1 |
| 1 | o0Hash | Input note 0 hash |
| 2 | o1Hash | Input note 1 hash (EMPTY_NOTE_HASH when transferring only 1) |
| 3 | newHash | Recipient note hash |
| 4 | changeHash | Change note hash |

**Private inputs**:
- Full fields of input notes 0, 1 (ownerAddress, value, tokenType, vk0, vk1, salt)
- Full fields of 2 output notes
- Secret keys sk0, sk1

**Verification**:
1. Prove ownership of input note 0 (`sk0` -> address match)
2. Prove ownership of input note 1 (if not an empty note)
3. All 4 note hashes match their respective public inputs
4. **Value conservation**: `input0.value + input1.value == new.value + change.value`
5. **Token consistency**: All notes have the same `tokenType`

### Key Properties

- `value` is not included in public inputs, so the transfer amount is private
- `ownerAddress` is not included in public inputs, so the recipient is private
- Value conservation is verified only inside the circuit — externally only hashes are visible

---

## 10. Smart Note

A **smart note** is a special note whose owner is derived not from a user's public key but from **another note's hash**. It is used in the order protocol to cryptographically enforce linkage relationships between notes.

### Normal Note vs Smart Note

| Property | Normal Note | Smart Note |
|----------|-------------|------------|
| ownerAddress | `Poseidon(pk.x, pk.y) & MASK_160` | `parentNoteHash & MASK_160` |
| viewingKey | `Poseidon(pk.x, pk.y)` | `parentNoteHash` |
| Created during | mint, transfer | takeOrder, settleOrder |
| Ownership proof | Directly proved with secret key | Only the parent note's owner can convert via convertNote |

### Smart Note Detection

Since a smart note's owner address is the lower 160 bits of a 254-bit hash, the upper bits are likely non-zero. The circuit distinguishes smart notes by checking whether `ownerAddress < 2^128`.

### Purpose

A mechanism to cryptographically prove that "this note is linked to a specific other note" within orders. For example, a taker's stake note has its owner derived from the maker note hash, so only the maker can ultimately use that stake.

---

## 11. Note Conversion — Convert

An operation that converts a smart note into a normal note. Only the owner of the smart note's origin note can perform this.

### Circuit: ConvertNote

**Public inputs (4)**:
| Index | Name | Description |
|-------|------|-------------|
| 0 | output | Always 1 |
| 1 | smartHash | Hash of the smart note to be converted |
| 2 | originHash | Hash of the origin note (the smart note's parent) |
| 3 | newHash | Hash of the resulting normal note |

**Private inputs**: Full fields of smart/origin/new notes + sk

**Verification**:
1. `smartNote.ownerAddress == originHash & MASK_160` (linkage verification)
2. Prove ownership of the origin note (`sk` -> address match)
3. All 3 note hashes match their public inputs
4. **Value conservation**: `smartNote.value == newNote.value`
5. **Token conservation**: `smartNote.tokenType == newNote.tokenType`

### On-chain Behavior

```solidity
function convertNote(a, b, c, input, encryptedNote) external {
    // notes[smartHash] = Invalid (smart note destroyed)
    // notes[newHash] = Valid (new normal note created)
}
```

---

## 12. Order Creation — Make Order

An operation where a maker creates a trade order based on a note they hold.

### Circuit: MakeOrder

**Public inputs (3)**:
| Index | Name | Description |
|-------|------|-------------|
| 0 | output | Always 1 |
| 1 | noteHash | Maker note hash |
| 2 | tokenType | Token type the maker offers (public) |

**Private inputs**: ownerAddress, value, vk0, vk1, salt, sk

**Verification**:
1. Prove ownership of the maker note
2. Verify note hash match
3. `value` remains private

### On-chain Behavior

```solidity
function makeOrder(makerViewingKey, targetToken, price, a, b, c, input) external {
    // Create Order struct:
    //   - makerViewingKey: maker's viewing key (for order lookup)
    //   - makerNote: maker note hash
    //   - sourceToken: token the maker offers (input[2])
    //   - targetToken: token the maker wants
    //   - price: exchange rate
    //   - state: Created
    // notes[makerNote] = Trading (locked for trading)
}
```

### Order Struct

```solidity
struct Order {
    bytes32 makerViewingKey;    // Maker viewing key
    bytes32 makerNote;          // Maker note hash
    uint256 sourceToken;        // Maker token type
    uint256 targetToken;        // Desired token type
    uint256 price;              // Exchange rate (10^18 units)
    bytes32 takerNoteToMaker;   // Taker stake note
    bytes32 parentNote;         // Taker parent note
    OrderState state;           // Created -> Taken -> Settled
}
```

---

## 13. Order Acceptance — Take Order

An operation where a taker accepts a maker's order by staking assets. Creates a **smart note** from the taker's note linked to the maker.

### Circuit: TakeOrder

**Public inputs (6)**:
| Index | Name | Description |
|-------|------|-------------|
| 0 | output | Always 1 |
| 1 | parentNoteHash | Taker's parent (original) note hash |
| 2 | parentNoteType | Parent note's token type |
| 3 | stakeNoteHash | Hash of the stake note (smart note) being created |
| 4 | stakeNoteOwner | Lower 160 bits of maker note hash |
| 5 | stakeNoteType | Stake note's token type |

**Private inputs**: Parent note fields, stake note fields (excluding ownerAddress), sk

**Verification**:
1. Prove ownership of the parent note (`sk` -> address match)
2. Parent note hash match
3. Stake note hash match
4. **Value conservation**: `parentNote.value == stakeNote.value`
5. **Smart note linkage**: `stakeNote.ownerAddress == makerNoteHash & MASK_160`

### On-chain Behavior

```solidity
function takeOrder(orderId, a, b, c, input, encryptedStakingNote) external {
    // Verify order state: Created
    // Verify token type match: order.targetToken == input[2] == input[5]
    // Verify owner linkage: lower 160 bits of makerNote == input[4]
    // notes[parentNote] = Trading
    // notes[stakeNote] = Trading
    // order.state = Taken
}
```

---

## 14. Order Settlement — Settle Order

An operation that atomically exchanges the maker's and taker's notes according to the price. The most complex circuit in ZK-DEX.

### Circuit: SettleOrder

**Public inputs (14)**:
| Index | Name | Description |
|-------|------|-------------|
| 0 | output | Always 1 |
| 1 | o0Hash | Maker note hash |
| 2 | o0Type | Maker note token type |
| 3 | o1Hash | Taker stake note hash |
| 4 | o1Type | Taker stake note token type |
| 5 | n0Hash | Reward note hash (to taker) |
| 6 | n0Owner | Reward note owner (lower 160 bits of parentNote hash) |
| 7 | n0Type | Reward note token type |
| 8 | n1Hash | Payment note hash (to maker) |
| 9 | n1Owner | Payment note owner (lower 160 bits of makerNote hash) |
| 10 | n1Type | Payment note token type |
| 11 | n2Hash | Change note hash |
| 12 | n2Type | Change note token type |
| 13 | price | Exchange rate |

### Price Calculation Logic

The circuit uses **non-deterministic division verification** (division witness):

```
o0Value * price = q0 * 10^18 + r0    (maker value converted at price)
o1Value = q1 * price + r1            (taker value reverse-converted at price)

Conditions: r0 < 10^18, r1 < price
```

`q0`, `r0`, `q1`, `r1` are provided as private inputs, and the circuit only verifies the above relationships hold. This is a standard technique for handling division in ZK circuits.

### Settlement Direction (Who Provided More Value)

```
bit = (o0Value >= o1Value / price) ? 1 : 0

bit == 1 (maker value >= taker value):
  reward(n0) = o1Value / price      -> to taker (maker's token)
  payment(n1) = o1Value             -> to maker (taker's token)
  change(n2) = o0Value - reward     -> returned to maker

bit == 0 (taker value > maker value):
  reward(n0) = o0Value              -> to taker (all of maker's token)
  payment(n1) = o0Value * price     -> to maker (price-converted amount)
  change(n2) = o1Value - payment    -> returned to taker
```

### Output Note Owner Rules

| Note | Owner | Derivation |
|------|-------|------------|
| Reward (n0) | Taker | `parentNote hash & MASK_160` (smart note) |
| Payment (n1) | Maker | `makerNote hash & MASK_160` (smart note) |
| Change (n2) | Depends on direction | bit==1: `makerNote hash & MASK_160`, bit==0: `parentNote hash & MASK_160` |

### On-chain Behavior

```solidity
function settleOrder(orderId, a, b, c, input, encDatas) external {
    // Verify order data match (makerNote, takerNote, token types, price)
    // Verify owner linkage (reward -> parentNote, payment -> makerNote)
    // notes[makerNote] = Spent
    // notes[parentNote] = Spent
    // notes[takerNoteToMaker] = Spent
    // notes[rewardNote] = Valid
    // notes[paymentNote] = Valid
    // notes[changeNote] = Valid
    // order.state = Settled
}
```

### After Settlement

The reward, payment, and change notes are all **smart notes**, so recipients must call `convertNote` to convert them into normal notes before they can be freely used.

---

## 15. Cryptographic Primitives

### Poseidon Hash

A ZK-friendly hash function. Approximately 100x cheaper inside circuits compared to SHA256.

| Purpose | Input | Output |
|---------|-------|--------|
| Note hash | (ownerAddress, value, tokenType, vk0, vk1, salt) | 254-bit hash |
| Address derivation | (pk.x, pk.y) | 254-bit hash -> 160-bit truncation |
| Viewing key | (pk.x, pk.y) | 254-bit hash (no truncation) |

**Cost comparison**:
| Hash | Circuit Constraints |
|------|-------------------|
| Poseidon(6) | ~1,500 |
| Poseidon(2) | ~350 |
| SHA256 | ~30,000 |

### BabyJubJub Elliptic Curve

- **Type**: Twisted Edwards curve (ax^2 + y^2 = 1 + dx^2y^2)
- **Field**: 254-bit (over the BN128 scalar field)
- **Purpose**: Public key derivation (sk * G), ECDH key exchange
- **Generator point**: BASE8 (hardcoded in circomlib)

**Cost**: `EscalarMulFix(254)` (scalar multiplication) ~ 128,000 constraints — accounts for 97%+ of circuit cost

### Groth16 Proof System

- **Curve**: BN128
- **Proof size**: 3 elements (a[2], b[2][2], c[2]) — approximately 256 bytes
- **Verification cost**: ~200K gas on-chain
- **Proof generation**: Performed in the browser (WASM) or Node.js via snarkjs

---

## 16. Note Encryption (ECDH)

Note data is encrypted with ECDH + AES-256-GCM so that only the recipient can decrypt it, then stored on-chain.

### Encryption Process

```
1. Generate ephemeral key pair: (esk, epk) — BabyJubJub
2. Compute shared secret: sharedSecret = esk * recipientPk
3. Derive AES key: aesKey = SHA256(sharedSecret.x || sharedSecret.y)
4. Generate random nonce: nonce (12 bytes)
5. Encrypt: ciphertext = AES-256-GCM(aesKey, nonce, plaintext)
```

### On-chain Storage Format

```
0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
```

### Decryption

The recipient computes `sharedSecret = sk * epk` using their secret key, derives the same AES key, and decrypts.

### On-chain Mapping

```solidity
mapping(bytes32 => bytes) public encryptedNotes;  // noteHash -> encrypted bytes
```

Third parties can read the encrypted bytes but cannot recover the original `{ownerAddress, value, tokenType, viewingKey, salt}` without the secret key.

---

## 17. Privacy Model

### Information Disclosure by Operation

| Operation | Value | Owner | Token Type |
|-----------|-------|-------|------------|
| Mint | **Public** (deposit verification required) | Private | Public |
| Liquidate | **Public** (withdrawal verification required) | Private | Public |
| Transfer | **Private** | **Private** | Private |
| ConvertNote | **Private** | **Private** | Private |
| MakeOrder | Private | Private | Public (needed for matching) |
| TakeOrder | Private | Partially public (160-bit address) | Public |
| SettleOrder | Private (only price is public) | Partially public (160-bit address) | Public |

### Protection by Layer

| Layer | Protection Level | Description |
|-------|-----------------|-------------|
| ZK circuit | Partial | Transfer/Convert are fully private; Mint exposes value |
| On-chain storage (ECDH) | Protected | Only the owner can decrypt |
| On-chain storage (legacy) | Unprotected | Pre-migration notes stored as plaintext RLP |
| Ownership | Protected | Secret key + ZK proof required |

---

## 18. Security Properties

### Double-Spend Prevention

The on-chain state machine tracks each note's lifecycle. Only notes in `Valid` state can be spent, and consumed notes transition to `Spent`, making reuse impossible.

### Value Conservation

- **Mint/Liquidate**: Verifies that `msg.value` or DAI transfer amount matches the note value during external asset deposits/withdrawals
- **Transfer**: Enforces `sum of inputs == sum of outputs` constraint inside the circuit
- **Settle**: Verifies the price-based exchange formula holds exactly inside the circuit

### Note Uniqueness

Each note includes a random `salt`, so even identical owner/amount/token combinations produce different hashes. This prevents preimage attacks via hash collisions.

### Smart Note Linkage Integrity

- Stake note owner = lower 160 bits of maker note hash
- Payment note owner = lower 160 bits of maker note hash
- Reward note owner = lower 160 bits of taker parent note hash
- These relationships are verified both in the circuit and on-chain, preventing third parties from intercepting notes.

### Order Atomicity

`settleOrder` atomically changes the states of 5 notes in a single transaction:
- 3 inputs (makerNote, parentNote, stakeNote) -> Spent
- 3 outputs (reward, payment, change) -> Valid

Partial execution is impossible; if the proof is invalid, the entire transaction fails.

---

## Circuit Complexity Summary

| Circuit | Constraints | Key Operations |
|---------|-------------|----------------|
| MintNBurnNote | ~131K | 1 ownership proof, 1 note hash |
| TransferNote | ~516K | 2 ownership proofs, 4 note hashes, value conservation |
| MakeOrder | ~131K | 1 ownership proof, 1 note hash |
| TakeOrder | ~258K | 1 ownership proof, 2 note hashes, value conservation |
| ConvertNote | ~385K | 1 ownership proof, 3 note hashes, hash truncation |
| SettleOrder | ~641K | 1 ownership proof, 5 note hashes, division verification, conditional branching |

**Dominant cost factor**: BabyJubJub scalar multiplication (`EscalarMulFix`) ~ 128K constraints accounts for 97%+ of each ownership proof.

---

## Complete Trading Flow

```
[User A: holds ETH]                     [User B: holds DAI]
      |                                        |
  (1) mint(ETH)                            (1) mint(DAI)
      |                                        |
      v                                        v
  NoteA (ETH, Valid)                    NoteB (DAI, Valid)
      |                                        |
  (2) makeOrder(ETH->DAI, price)               |
      |                                        |
      v                                        |
  NoteA (Trading)                              |
  Order(Created)                               |
      |                                        |
      |<------------- (3) takeOrder(orderId) --+
      |                                        |
      v                                        v
  Order(Taken)                          NoteB (Trading)
  StakeNote (Trading, smart note)
      |
  (4) settleOrder(orderId)
      |
      |---> RewardNote (ETH->B, smart note, Valid)
      |---> PaymentNote (DAI->A, smart note, Valid)
      +---> ChangeNote (change, smart note, Valid)
              |
  (5) convertNote (each recipient converts their smart note to a normal note)
              |
              v
      NormalNote (Valid, freely transferable/liquidatable)
```

---

## 19. FAQ

### Q1. What data is required to prove ownership of a note?

**The core requirement is the secret key (sk).** Inside the ZK circuit, ownership is verified through the following derivation:

```
sk -> pk = sk * G -> viewingKey = Poseidon(pk.x, pk.y) -> ownerAddress = viewingKey & MASK_160
```

However, generating a ZK proof also requires reconstructing the note hash, so the remaining note fields must be provided to the circuit alongside sk:

| Data | Purpose |
|------|---------|
| **sk** (secret key) | Core of ownership proof — derives ownerAddress from sk and matches it to the note |
| ownerAddress | Owner address recorded in the note |
| value | Note balance |
| tokenType | Token type |
| viewingKey (vk0, vk1) | Public key binding |
| salt | Ensures note uniqueness |

These 6 fields are used to recompute `noteHash = Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)`, which is then verified inside the circuit against the noteHash recorded on-chain.

### Q2. If I have the sk but lose the remaining note data (ownerAddress, value, tokenType, viewingKey, salt), can I still use the note?

**If only the local data is lost, recovery is possible.** When a note is created, its 5 fields are ECDH-encrypted and stored on-chain:

```solidity
mapping(bytes32 => bytes) public encryptedNotes;  // noteHash -> ECDH-encrypted bytes
```

Recovery process:

1. Retrieve `encryptedNotes[noteHash]` data from on-chain
2. Perform ECDH decryption with sk: `shared = sk * epk` -> derive AES key -> decrypt
3. RLP-decode to recover `[ownerAddress, value, tokenType, viewingKey, salt]`
4. Use the recovered data to generate a ZK proof

Therefore:
- **Local data lost + sk retained**: Recoverable from on-chain encrypted data -> note is usable
- **sk lost**: Neither decryption nor ownership proof is possible -> **note is permanently lost**
- **On-chain data lost**: Cannot happen due to the nature of blockchain

**Conclusion: The only thing you must never lose is sk.**

### Q3. How is the encrypted note key-value pair structured on-chain?

```solidity
mapping(bytes32 => bytes) public encryptedNotes;
```

- **Key**: `noteHash` (bytes32) — `Poseidon(ownerAddress, value, tokenType, vk0, vk1, salt)`
- **Value**: ECDH-encrypted byte sequence — `ECDH_Encrypt(RLP(ownerAddress, value, tokenType, viewingKey, salt))`

On-chain byte format of the value:

```
0x01 || epk_x(32B) || epk_y(32B) || nonce(12B) || ciphertext || authTag(16B)
```

| Field | Size | Description |
|-------|------|-------------|
| version | 1 byte | Always `0x01` |
| epk_x | 32 bytes | Ephemeral public key x-coordinate |
| epk_y | 32 bytes | Ephemeral public key y-coordinate |
| nonce | 12 bytes | AES-GCM IV (random) |
| ciphertext | variable | Encrypted RLP-encoded note fields |
| authTag | 16 bytes | AES-GCM authentication tag |

In other words, the **Poseidon hash of the original data is the key**, and the **ECDH-encrypted version is the value**.

### Q4. What is the Viewing Key and why is it needed?

The viewing key is a 254-bit value derived from the public key via Poseidon hash:

```
viewingKey = Poseidon(pk.x, pk.y)
ownerAddress = viewingKey & MASK_160  (lower 160 bits)
```

Why ownerAddress (160 bits) alone is insufficient:

1. **Public key binding**: 160-bit address collisions are theoretically possible. The viewing key commits the full 254 bits into the note hash, preventing ownership forgery.
2. **Note discovery**: After decryption, the viewing key is compared to identify whether a note belongs to the user.
3. **Smart note linking**: For smart notes, `viewingKey = parentNoteHash` establishes the linkage to the parent note.

See [Section 5: Viewing Key](#viewing-key) for details.

### Q5. Can the viewing key alone decrypt on-chain note data?

**No.** This is not possible in the current ZK-DEX implementation.

On-chain note data is encrypted with ECDH + AES-256-GCM, and decryption requires computing `shared = sk * epk`. The viewing key `Poseidon(pk.x, pk.y)` is a one-way hash, so the public key coordinates `(pk.x, pk.y)` cannot be recovered from it, making it impossible to compute the ECDH shared secret.

In Zcash, the viewing key can directly decrypt on-chain data thanks to a dedicated encryption layer (in-band secret distribution), but ZK-DEX uses only a single ECDH layer and does not support this feature.

When selective disclosure is needed, the note owner decrypts the data with sk and shares it off-chain with a third party, who then recomputes the noteHash and verifies it against the on-chain state. See [Section 5, Role 4: Selective Disclosure](#seven-roles-of-the-viewing-key) for details.
