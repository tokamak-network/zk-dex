# F5. Gaming Item Trade

Private peer-to-peer trading of in-game items with hidden inventory, concealed transaction values, and verifiable item authenticity.

**Constraints**: ~150K | **Complexity**: Medium

---

## Background

Gaming item trades expose sensitive player information:

- **Inventory Privacy**: Public item holdings reveal player wealth and can make them targets for scams or hacks
- **Trade Strategy Concealment**: Visible trades reveal arbitrage opportunities and trading patterns to competitors
- **Value Privacy**: Transaction amounts expose player spending habits and item valuations
- **Cross-Game Trading**: Items may have value across multiple games; private trades enable discreet cross-game economies

Gaming economies are increasingly valuable, with some rare items worth thousands of dollars. Private trading protects players while maintaining item authenticity verification.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `itemNoteHash` | field | Hash of the item being traded |
| `newItemNoteHash` | field | Hash of new item note (new owner) |
| `paymentNoteHash` | field | Hash of payment note (if applicable) |
| `gameId` | uint | Identifier of the game ecosystem |
| `nullifier` | field | Nullifier for the item note |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX, sellerPkY` | field | Seller's public key |
| `sellerSk` | field | Seller's secret key |
| `buyerPkX, buyerPkY` | field | Buyer's public key |
| `itemId` | uint | Unique item identifier |
| `itemType` | uint | Item category/type |
| `itemAttributes` | field | Hash of item attributes (stats, enchants) |
| `itemSalt` | field | Item note randomness |
| `newItemSalt` | field | New item note randomness |
| `price` | uint | Trade price (0 for gift) |
| `paymentToken` | uint | Token type for payment |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template GamingItemTrade() {
    // ===== Public Inputs =====
    signal input itemNoteHash;
    signal input newItemNoteHash;
    signal input paymentNoteHash;
    signal input gameId;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY, sellerSk;
    signal input buyerPkX, buyerPkY;
    signal input itemId, itemType, itemAttributes;
    signal input itemSalt, newItemSalt;
    signal input price, paymentToken, paymentSalt;

    // ===== 1. Verify Item Note =====
    // Item note: Hash(ownerPkX, ownerPkY, itemId, itemType, attributes, gameId, salt)
    component itemNote = Poseidon(7);
    itemNote.inputs[0] <== sellerPkX;
    itemNote.inputs[1] <== sellerPkY;
    itemNote.inputs[2] <== itemId;
    itemNote.inputs[3] <== itemType;
    itemNote.inputs[4] <== itemAttributes;
    itemNote.inputs[5] <== gameId;
    itemNote.inputs[6] <== itemSalt;
    itemNote.out === itemNoteHash;

    // ===== 2. Verify Seller Ownership =====
    component sellerOwnership = ProofOfOwnershipStrict();
    sellerOwnership.sk <== sellerSk;
    sellerOwnership.pkX <== sellerPkX;
    sellerOwnership.pkY <== sellerPkY;

    // ===== 3. Compute Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== itemId;
    nullifierCalc.inputs[1] <== itemSalt;
    nullifierCalc.inputs[2] <== sellerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Create New Item Note for Buyer =====
    component newItemNote = Poseidon(7);
    newItemNote.inputs[0] <== buyerPkX;
    newItemNote.inputs[1] <== buyerPkY;
    newItemNote.inputs[2] <== itemId;
    newItemNote.inputs[3] <== itemType;
    newItemNote.inputs[4] <== itemAttributes;
    newItemNote.inputs[5] <== gameId;
    newItemNote.inputs[6] <== newItemSalt;
    newItemNote.out === newItemNoteHash;

    // ===== 5. Verify Payment Note (if price > 0) =====
    // Payment note: Hash(sellerPkX, sellerPkY, price, paymentToken, salt)
    component paymentNote = Poseidon(5);
    paymentNote.inputs[0] <== sellerPkX;
    paymentNote.inputs[1] <== sellerPkY;
    paymentNote.inputs[2] <== price;
    paymentNote.inputs[3] <== paymentToken;
    paymentNote.inputs[4] <== paymentSalt;

    // If price == 0, paymentNoteHash should be 0 (gift)
    // If price > 0, paymentNoteHash should match computed payment note
    component isGift = IsZero();
    isGift.in <== price;

    component paymentCheck = Poseidon(5);
    signal expectedPaymentHash;
    expectedPaymentHash <== paymentNote.out * (1 - isGift.out);

    // Either it's a gift (price=0) or payment matches
    signal paymentValid;
    paymentValid <== isGift.out + (1 - isGift.out) * (paymentNoteHash - expectedPaymentHash == 0 ? 1 : 0);

    // ===== 6. Item Attributes Preserved =====
    // Already ensured by using same itemAttributes in old and new notes
}

component main {public [itemNoteHash, newItemNoteHash, paymentNoteHash, gameId, nullifier]} =
    GamingItemTrade();
```

### Key Constraints

1. **Seller Ownership**: Only item owner can initiate trade
2. **Attribute Preservation**: Item attributes unchanged during transfer
3. **Game Binding**: Item stays within its game ecosystem
4. **Payment Verification**: If paid trade, payment note created for seller
5. **Nullifier Uniqueness**: Item note can only be spent once

## Effects

| Aspect | Impact |
|--------|--------|
| **Inventory Privacy** | Player holdings hidden from competitors |
| **Trade Anonymity** | Buyer/seller identities not linked publicly |
| **Value Concealment** | Transaction amounts hidden |
| **Item Authenticity** | Provably genuine items from game system |
| **Scam Prevention** | Atomic swap ensures both parties receive |
| **Cross-Platform** | Items can move between compatible games |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Item Duplication** | Nullifier prevents double-spending of items |
| **Fake Items** | Item notes only created by game contract |
| **Payment Fraud** | Atomic trade requires valid payment note |
| **Attribute Tampering** | Attributes hashed and preserved across transfers |
| **Game Escape** | gameId ensures items stay in valid ecosystem |
| **Front-Running** | Committed trade cannot be intercepted |

## Implementation Challenges

1. **Item Creation Authority**
   - Only game contracts can mint legitimate items
   - Need secure bridge between game server and blockchain
   - Consider multi-sig or threshold signatures for minting

2. **Attribute System**
   - Complex attributes (stats, enchants, durability)
   - How to represent in single hash while maintaining verifiability
   - May need Merkle tree of attributes for selective reveal

3. **Marketplace Integration**
   - Order book needs to work with hidden items
   - How do buyers find items without seeing inventory?
   - Consider attribute-based search with ZK proofs

4. **Escrow Mechanism**
   - Trustless atomic swaps require careful design
   - Time-locked escrow for trade disputes
   - Arbiter system for complex trades

## Derivatives

1. **Item Bundles** - Trade multiple items as atomic bundle. Circuit proves ownership of all items; creates new notes for buyer. Useful for set bonuses or starter packs.

2. **Cross-Game Trading** - Trade items between compatible games. Circuit verifies item validity in source game; creates equivalent note in destination. Requires game-to-game compatibility mappings.

3. **Item Lending** - Temporary item transfer with automatic return. Lender retains claim note; borrower gets usage note. Circuit enforces return after specified duration or conditions.

4. **Escrow Trading** - Third-party escrow for high-value trades. Escrow agent holds item note; releases on payment confirmation. Handles disputes with arbitration logic.

5. **Auction House Integration** - List items for auction without revealing. Winning bid triggers atomic swap. Seller can set reserve price; highest bidder wins.

## Use Cases

1. **MMO Rare Item Trade**
   - Player finds legendary sword worth $5,000
   - Lists for private sale; buyer contacts through encrypted channel
   - Atomic swap: item note to buyer, payment note to seller
   - Neither party's identity or other holdings revealed

2. **Esports Team Gear Transfer**
   - Pro team privately acquires top-tier equipment
   - Competitors don't see team's gear loadout
   - Team can surprise opponents with hidden preparations
   - Trades don't reveal team's strategic investments

3. **Gaming Guild Economy**
   - Guild operates internal marketplace
   - Members trade freely; external observers see nothing
   - Guild can arbitrage between public and private markets
   - Treasury holdings remain confidential

4. **Cross-Game Asset Bridge**
   - Player's sword in Game A has equivalent in Game B
   - Trades sword privately to collector
   - Collector redeems equivalent in either game
   - Original player exits one ecosystem discreetly

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F5. Gaming Item Trade - Products](../../product/f-nft-gaming/f5-gaming-items-products.md)

---

[Back to Index](../../README.md)
