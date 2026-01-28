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

### Note Structure (7 Fields)

| Field | Size | Description |
|-------|------|-------------|
| `owner0` | 254 bits | Owner's BabyJubJub public key x-coordinate (pkX) |
| `owner1` | 254 bits | Owner's BabyJubJub public key y-coordinate (pkY) |
| `value` | 254 bits | Token balance (in wei) |
| `tokenType` | 256 bits | Token type (0 = ETH, 1 = DAI) |
| `vk0` | 254 bits | Viewing key x-coordinate (= pkX for normal notes) |
| `vk1` | 254 bits | Viewing key y-coordinate (= pkY for normal notes) |
| `salt` | 254 bits | Random value preventing identical notes from producing the same hash |

For normal notes, the viewing key equals the public key: `vk0 = owner0 = pkX` and `vk1 = owner1 = pkY`.

### Empty Note

A special note with all fields set to 0. Used to fill the second input slot when the transfer circuit has only one input note.

```
EMPTY_NOTE_HASH = Poseidon(0, 0, 0, 0, 0, 0, 0)
                = <computed at circuit setup>
```

---

## 2. Note Hash

The 7 fields of a note are fed into the Poseidon hash function to produce a single field element (254 bits). Only this hash is stored on-chain, so the note's contents cannot be determined without knowing the original fields.

```
noteHash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
```

Where:
- `owner0` = pkX (owner's BabyJubJub public key x-coordinate)
- `owner1` = pkY (owner's BabyJubJub public key y-coordinate)
- `vk0` = pkX (viewing key x-coordinate, equals owner0 for normal notes)
- `vk1` = pkY (viewing key y-coordinate, equals owner1 for normal notes)

This 7-input Poseidon hash directly commits the full public key coordinates into the note, eliminating the need for address derivation via truncation.

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

A user can hold both accounts together or separately. The Ethereum account is used for submitting transactions, and the ZK account for note ownership and encryption.

---

## 5. ZK Account

A ZK account is a key system based on the BabyJubJub elliptic curve. Key components:

### Independence from Ethereum Accounts

**Critical concept: ZK accounts are completely independent from Ethereum accounts.**

- A ZK account (BabyJubJub key pair) has no cryptographic relationship with an Ethereum account (secp256k1 key pair)
- Note ownership is determined solely by the ZK secret key (z-sk), not by any Ethereum address
- **Any Ethereum account can submit transactions on behalf of a ZK account** — what matters is the validity of the ZK proof, not which Ethereum address sent the transaction

This means:
- If Alice knows the z-sk, she can control the notes from any Ethereum wallet (MetaMask, hardware wallet, or even a third-party relayer)
- The Ethereum account only pays gas fees and submits the transaction — it has no authority over note ownership
- Even if Alice's Ethereum private key is compromised, her ZK notes remain secure as long as z-sk is safe
- Conversely, if z-sk is compromised, the attacker can control the notes from any Ethereum account

| Key Type | Controls | Compromise Impact |
|----------|----------|-------------------|
| Ethereum private key | Gas payment, transaction submission | Cannot access ZK notes |
| ZK secret key (z-sk) | Note ownership, proof generation | Full control of all notes owned by this z-sk |

This design enables use cases like:
- **Meta-transactions**: A relayer can submit proofs on behalf of users
- **Account abstraction**: Notes can be controlled through smart contract wallets
- **Key rotation**: Users can change their Ethereum account without affecting their ZK notes

### Secret Key (sk)
- 254-bit random scalar
- Must be valid within the BN128 field (less than the subgroup order `l`)
- The sole means of proving note ownership

### Public Key (pk)
- A point `(pkX, pkY)` on the BabyJubJub curve
- Derived from the secret key: `pk = sk * G` (G is the generator point BASE8)
- **Directly used as the note owner** — no address derivation needed

### Owner (pk-based)

In the new architecture, note ownership is represented directly by the public key coordinates:
- `owner0 = pkX` (public key x-coordinate)
- `owner1 = pkY` (public key y-coordinate)

There is no longer a truncated 160-bit `ownerAddress`. The full public key is committed directly into the note hash.

### Viewing Key

**Key point: For normal notes, vk0/vk1 can be any arbitrary value — they are not used for ownership verification. The viewing key only has meaningful constraints in smart notes.**

#### Viewing Key in Normal Notes vs Smart Notes

| Note Type | vk0, vk1 Value | Circuit Verification | Purpose |
|-----------|----------------|---------------------|---------|
| Normal note | Any value (convention: pkX, pkY) | None | Only included in note hash |
| Smart note | `parentHash >> 128`, `parentHash & MASK_128` | **Required** | Enforces parent-child linkage |

#### Why Viewing Key Is Unconstrained in Normal Notes

In the ZK circuit, ownership verification uses **only `owner0` and `owner1`**:

```
sk → pk = sk * G → (pkX, pkY)
owner0 == pkX && owner1 == pkY check  ← This is the entirety of ownership verification
```

`vk0` and `vk1` are only included in the note hash calculation and are not separately verified in the circuit:

```
noteHash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)
                                                      ^^^  ^^^
                                         Hash input only, not verified
```

Therefore, for normal notes, any value can be used for vk0/vk1 and the note remains valid. The current implementation conventionally uses `vk0 = pkX`, `vk1 = pkY`, but this is not a protocol requirement.

#### Why Viewing Key Is Required in Smart Notes

Smart notes are created in the order protocol (takeOrder, settleOrder) and must **cryptographically enforce linkage to a parent note**. In this case, `owner0` and `owner1` are derived from the parent note hash, and this relationship is verified in both the circuit and the on-chain contract.

#### Primary Uses of Viewing Key

**Use 1: Note Discovery**

A party who knows the viewing key (i.e., the public key) can identify their notes:

```
1. Listen for on-chain NoteStateChange events
2. Retrieve encrypted data from encryptedNotes[noteHash]
3. Attempt ECDH decryption (using own secret key)
4. On successful decryption -> recover note fields (owner0, owner1, value, token, vk0, vk1, salt)
5. If recovered vk0/vk1 matches own public key -> this is their note
```

**Use 2: Selective Disclosure**

> **Note: Limitation of the Current Implementation**
>
> On-chain note data is encrypted with ECDH + AES-256-GCM, and decryption requires the secret key (sk). The viewing key (public key) alone cannot decrypt on-chain ciphertext.
>
> Selective disclosure is only possible via an **off-chain** workflow:
>
> 1. The note owner decrypts on-chain data using their secret key
> 2. The decrypted note data `(owner0, owner1, value, tokenType, vk0, vk1, salt)` is shared directly with a third party
> 3. The third party recomputes `noteHash = Poseidon(...)` from the received data and verifies it against the on-chain state
> 4. The viewing key (public key) confirms that the note belongs to a specific account

| Recipient | Can Do | Cannot Do |
|-----------|--------|-----------|
| Public key + off-chain note data holder | Verify note balances, cross-check on-chain state | Directly decrypt on-chain ciphertext, transfer/spend/create orders |
| Secret key holder | Decrypt on-chain data + transfer/spend/create orders | — |

**Use 3: Order Metadata**

When a maker creates an order, the maker's public key (as viewing key) is stored on-chain:

```solidity
struct Order {
    bytes32 makerVk0;  // maker's pkX
    bytes32 makerVk1;  // maker's pkY
    bytes32 makerNote;
    ...
}
```

**Use 4: Smart Note Linking (Required)**

For smart notes, the viewing key is derived from the **parent note's hash**:

```
Normal note:  vk0 = pkX, vk1 = pkY
Smart note:   vk0 = parentNoteHash >> 128     (upper 128 bits)
              vk1 = parentNoteHash & MASK_128 (lower 128 bits)
```

This establishes cryptographic linkage between smart notes and their parent notes.

**Use 5: Encrypted Note Payload**

When a note is ECDH-encrypted and stored on-chain, the viewing key is included:

```
Plaintext before encryption: RLP([owner0, owner1, value, tokenType, vk0, vk1, salt])
After encryption:            0x01 || epk || nonce || AES-GCM(plaintext) || authTag
```

### Key Derivation Chain

```
sk (254-bit random)
  |
  v BabyJubJub scalar multiplication (sk * G)
pk (pkX, pkY) — point on the BabyJubJub curve
  |
  |-- owner0 = pkX (note owner x-coordinate)
  |-- owner1 = pkY (note owner y-coordinate)
  |-- vk0 = pkX    (viewing key x-coordinate)
  +-- vk1 = pkY    (viewing key y-coordinate)
```

No truncation or hashing is required for address derivation — the public key is used directly.

---

## 6. Ownership Model

ZK-DEX uses a **pk-based ownership** model. To prove note ownership, the following is verified inside the ZK circuit:

1. Derive public key `pk` from secret key `sk`: `pk = sk * G`
2. Verify that the derived public key matches the note's owner: `pk.x == owner0` and `pk.y == owner1`

This process is performed inside the circuit, so `sk` is never revealed externally. On-chain, only the validity of the ZK proof needs to be checked, preserving the owner's identity.

### VerifyOwnershipByPk (Circuit Component)

```
Input: sk, expectedOwner0, expectedOwner1
Internal: pk = sk * G
Output: result = (pk.x == expectedOwner0 && pk.y == expectedOwner1) ? 1 : 0
```

This is simpler than the previous address-based model, as it eliminates the Poseidon hash and 160-bit truncation steps. The full public key coordinates are directly compared.

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

**Private inputs**: owner0, owner1, vk0, vk1, salt, sk

**Verification**:
1. Prove ownership: derive pk from sk, verify `pk.x == owner0` and `pk.y == owner1`
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
- Full fields of input notes 0, 1 (owner0, owner1, value, tokenType, vk0, vk1, salt)
- Full fields of 2 output notes
- Secret keys sk0, sk1

**Verification**:
1. Prove ownership of input note 0 (`sk0` -> pk match with owner0/owner1)
2. Prove ownership of input note 1 (if not an empty note)
3. All 4 note hashes match their respective public inputs
4. **Value conservation**: `input0.value + input1.value == new.value + change.value`
5. **Token consistency**: All notes have the same `tokenType`

### Key Properties

- `value` is not included in public inputs, so the transfer amount is private
- `owner0/owner1` are not included in public inputs, so the recipient is private
- Value conservation is verified only inside the circuit — externally only hashes are visible

---

## 10. Smart Note

A **smart note** is a special note whose owner is derived not from a user's public key but from **another note's hash**. It is used in the order protocol to cryptographically enforce linkage relationships between notes.

### Normal Note vs Smart Note

| Property | Normal Note | Smart Note |
|----------|-------------|------------|
| owner0 | `pkX` | `parentNoteHash >> 128` (upper 128 bits) |
| owner1 | `pkY` | `parentNoteHash & MASK_128` (lower 128 bits) |
| vk0 | `pkX` | `owner0` (= `parentNoteHash >> 128`) |
| vk1 | `pkY` | `owner1` (= `parentNoteHash & MASK_128`) |
| Created during | mint, transfer | takeOrder, settleOrder |
| Ownership proof | Directly proved with secret key | Only the parent note's owner can convert via convertNote |

### Smart Note Derivation

For a smart note linked to a parent note:

```
parentNoteHash = Poseidon(parent.owner0, parent.owner1, parent.value, parent.tokenType, parent.vk0, parent.vk1, parent.salt)

smartNote.owner0 = parentNoteHash >> 128       (upper 128 bits)
smartNote.owner1 = parentNoteHash & MASK_128   (lower 128 bits)
smartNote.vk0 = smartNote.owner0
smartNote.vk1 = smartNote.owner1
```

### Smart Note Detection

The circuit can distinguish smart notes from normal notes by checking the range of owner values. Normal notes have owner values that are valid BabyJubJub curve coordinates (254-bit field elements), while smart notes have owners derived from 128-bit hash splits.

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
1. `smartNote.owner0 == originHash >> 128` and `smartNote.owner1 == originHash & MASK_128` (linkage verification)
2. Prove ownership of the origin note (`sk` -> pk match with origin owner0/owner1)
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

**Private inputs**: owner0, owner1, value, vk0, vk1, salt, sk

**Verification**:
1. Prove ownership of the maker note (`sk` -> pk match with owner0/owner1)
2. Verify note hash match
3. `value` remains private

### On-chain Behavior

```solidity
function makeOrder(makerVk0, makerVk1, targetToken, price, a, b, c, input) external {
    // Create Order struct:
    //   - makerVk0, makerVk1: maker's public key (viewing key) for order lookup
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
    bytes32 makerVk0;           // Maker public key x (viewing key)
    bytes32 makerVk1;           // Maker public key y (viewing key)
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
| 4 | stakeNoteOwner0 | Upper 128 bits of maker note hash (owner0) |
| 5 | stakeNoteType | Stake note's token type |

**Private inputs**: Parent note fields, stake note fields (excluding owner0/owner1), sk

**Verification**:
1. Prove ownership of the parent note (`sk` -> pk match with owner0/owner1)
2. Parent note hash match
3. Stake note hash match
4. **Value conservation**: `parentNote.value == stakeNote.value`
5. **Smart note linkage**: `stakeNote.owner0 == makerNoteHash >> 128` and `stakeNote.owner1 == makerNoteHash & MASK_128`

### On-chain Behavior

```solidity
function takeOrder(orderId, a, b, c, input, encryptedStakingNote) external {
    // Verify order state: Created
    // Verify token type match: order.targetToken == input[2] == input[5]
    // Verify owner linkage: makerNoteHash split into owner0/owner1 matches input[4]/input[5]
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
| 6 | n0Owner0 | Reward note owner0 (upper 128 bits of parentNote hash) |
| 7 | n0Type | Reward note token type |
| 8 | n1Hash | Payment note hash (to maker) |
| 9 | n1Owner0 | Payment note owner0 (upper 128 bits of makerNote hash) |
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
| Reward (n0) | Taker | `owner0 = parentNoteHash >> 128`, `owner1 = parentNoteHash & MASK_128` (smart note) |
| Payment (n1) | Maker | `owner0 = makerNoteHash >> 128`, `owner1 = makerNoteHash & MASK_128` (smart note) |
| Change (n2) | Depends on direction | bit==1: derived from makerNote hash, bit==0: derived from parentNote hash |

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
| Note hash | (owner0, owner1, value, tokenType, vk0, vk1, salt) | 254-bit hash |

In the new architecture, address derivation and viewing key computation are no longer needed — the public key coordinates are used directly as owner0/owner1 and vk0/vk1.

**Cost comparison**:
| Hash | Circuit Constraints |
|------|-------------------|
| Poseidon(7) | ~1,700 |
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

Third parties can read the encrypted bytes but cannot recover the original `{owner0, owner1, value, tokenType, vk0, vk1, salt}` without the secret key.

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
| TakeOrder | Private | Partially public (128-bit hash splits) | Public |
| SettleOrder | Private (only price is public) | Partially public (128-bit hash splits) | Public |

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

- Stake note owner: `owner0 = makerNoteHash >> 128`, `owner1 = makerNoteHash & MASK_128`
- Payment note owner: `owner0 = makerNoteHash >> 128`, `owner1 = makerNoteHash & MASK_128`
- Reward note owner: `owner0 = parentNoteHash >> 128`, `owner1 = parentNoteHash & MASK_128`
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
sk -> pk = sk * G -> verify pk.x == owner0 && pk.y == owner1
```

However, generating a ZK proof also requires reconstructing the note hash, so the remaining note fields must be provided to the circuit alongside sk:

| Data | Purpose |
|------|---------|
| **sk** (secret key) | Core of ownership proof — derives pk from sk and matches it to owner0/owner1 |
| owner0 | Owner's public key x-coordinate (pkX) |
| owner1 | Owner's public key y-coordinate (pkY) |
| value | Note balance |
| tokenType | Token type |
| vk0 | Viewing key x-coordinate (= pkX for normal notes) |
| vk1 | Viewing key y-coordinate (= pkY for normal notes) |
| salt | Ensures note uniqueness |

These 7 fields are used to recompute `noteHash = Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)`, which is then verified inside the circuit against the noteHash recorded on-chain.

### Q2. If I have the sk but lose the remaining note data (owner0, owner1, value, tokenType, vk0, vk1, salt), can I still use the note?

**If only the local data is lost, recovery is possible.** When a note is created, its 7 fields are ECDH-encrypted and stored on-chain:

```solidity
mapping(bytes32 => bytes) public encryptedNotes;  // noteHash -> ECDH-encrypted bytes
```

Recovery process:

1. Retrieve `encryptedNotes[noteHash]` data from on-chain
2. Perform ECDH decryption with sk: `shared = sk * epk` -> derive AES key -> decrypt
3. RLP-decode to recover `[owner0, owner1, value, tokenType, vk0, vk1, salt]`
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

- **Key**: `noteHash` (bytes32) — `Poseidon(owner0, owner1, value, tokenType, vk0, vk1, salt)`
- **Value**: ECDH-encrypted byte sequence — `ECDH_Encrypt(RLP(owner0, owner1, value, tokenType, vk0, vk1, salt))`

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

In the new architecture, the viewing key is simply the owner's public key:

```
vk0 = pkX (public key x-coordinate)
vk1 = pkY (public key y-coordinate)
```

For normal notes, `vk0 = owner0` and `vk1 = owner1`.

The viewing key's purposes:

1. **Public key commitment**: The viewing key commits the full public key coordinates into the note hash, providing redundant verification.
2. **Note discovery**: After decryption, the viewing key (public key) is compared to identify whether a note belongs to the user.
3. **Smart note linking**: For smart notes, `vk0 = parentNoteHash >> 128` and `vk1 = parentNoteHash & MASK_128` establishes the linkage to the parent note.

See [Section 5: Viewing Key](#viewing-key) for details.

### Q5. Can the viewing key alone decrypt on-chain note data?

**No.** The viewing key is now simply the public key (pkX, pkY), and on-chain note data is encrypted with ECDH + AES-256-GCM. Decryption requires computing `shared = sk * epk`, which requires the secret key.

When selective disclosure is needed, the note owner decrypts the data with sk and shares it off-chain with a third party, who then recomputes the noteHash and verifies it against the on-chain state. See [Section 5, Role 3: Selective Disclosure](#purpose-of-the-viewing-key) for details.
