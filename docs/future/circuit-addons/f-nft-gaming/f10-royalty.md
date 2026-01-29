# F10. Royalty Payment

Enforce creator royalties on private NFT sales with hidden sale prices and automatic distribution to creators.

**Constraints**: ~160K | **Complexity**: Medium

---

## Background

NFT royalties face enforcement challenges on public and private sales:

- **Royalty Evasion**: Public marketplaces can bypass royalties; private sales make it worse
- **Creator Compensation**: Artists deserve ongoing compensation for secondary sales
- **Sale Price Privacy**: Revealing sale prices exposes market information; privacy is valuable
- **Multi-Creator Splits**: Collaborative works require complex royalty distribution

Traditional royalty enforcement relies on marketplace cooperation. Private sales could completely evade royalties. ZK royalty proofs enable enforced royalties on private transfers without revealing the sale price, protecting both creator rights and transaction privacy.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `saleCommitment` | field | Commitment to the sale details |
| `royaltyNoteHash` | field | Hash of royalty payment note |
| `nftNullifier` | field | Nullifier of NFT being sold |
| `newNftNoteHash` | field | Hash of new NFT note (buyer) |
| `collectionAddress` | address | NFT collection contract |
| `royaltyBps` | uint | Royalty percentage in basis points |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX, sellerPkY` | field | Seller's public key |
| `sellerSk` | field | Seller's secret key |
| `buyerPkX, buyerPkY` | field | Buyer's public key |
| `creatorPkX, creatorPkY` | field | Creator's public key (royalty recipient) |
| `nftId` | uint | NFT identifier |
| `salePrice` | uint | Sale price (hidden) |
| `royaltyAmount` | uint | Calculated royalty (hidden) |
| `nftSalt` | field | Current NFT note randomness |
| `newNftSalt` | field | New NFT note randomness |
| `royaltySalt` | field | Royalty note randomness |
| `paymentToken` | uint | Token type for payment |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template RoyaltyPayment() {
    // ===== Public Inputs =====
    signal input saleCommitment;
    signal input royaltyNoteHash;
    signal input nftNullifier;
    signal input newNftNoteHash;
    signal input collectionAddress;
    signal input royaltyBps;  // e.g., 500 = 5%

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY, sellerSk;
    signal input buyerPkX, buyerPkY;
    signal input creatorPkX, creatorPkY;
    signal input nftId, nftSalt, newNftSalt;
    signal input salePrice, royaltyAmount;
    signal input royaltySalt, paymentToken;

    // ===== 1. Verify Seller Ownership =====
    component oldNftNote = Poseidon(5);
    oldNftNote.inputs[0] <== sellerPkX;
    oldNftNote.inputs[1] <== sellerPkY;
    oldNftNote.inputs[2] <== nftId;
    oldNftNote.inputs[3] <== collectionAddress;
    oldNftNote.inputs[4] <== nftSalt;

    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sellerSk;
    ownership.pkX <== sellerPkX;
    ownership.pkY <== sellerPkY;

    // ===== 2. Compute NFT Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== nftId;
    nullifierCalc.inputs[1] <== nftSalt;
    nullifierCalc.inputs[2] <== sellerSk;
    nullifierCalc.out === nftNullifier;

    // ===== 3. Create New NFT Note for Buyer =====
    component newNftNote = Poseidon(5);
    newNftNote.inputs[0] <== buyerPkX;
    newNftNote.inputs[1] <== buyerPkY;
    newNftNote.inputs[2] <== nftId;
    newNftNote.inputs[3] <== collectionAddress;
    newNftNote.inputs[4] <== newNftSalt;
    newNftNote.out === newNftNoteHash;

    // ===== 4. Verify Royalty Calculation =====
    // royaltyAmount = salePrice * royaltyBps / 10000
    signal expectedRoyalty;
    expectedRoyalty <== salePrice * royaltyBps;

    // Verify royaltyAmount * 10000 >= expectedRoyalty (handles rounding)
    component royaltyCheck = GreaterEqThan(128);
    royaltyCheck.in[0] <== royaltyAmount * 10000;
    royaltyCheck.in[1] <== expectedRoyalty;
    royaltyCheck.out === 1;

    // Verify not overpaying (royaltyAmount * 10000 < expectedRoyalty + 10000)
    component royaltyMax = LessThan(128);
    royaltyMax.in[0] <== royaltyAmount * 10000;
    royaltyMax.in[1] <== expectedRoyalty + 10000;
    royaltyMax.out === 1;

    // ===== 5. Create Royalty Payment Note =====
    // Payment to creator
    component royaltyNote = Poseidon(5);
    royaltyNote.inputs[0] <== creatorPkX;
    royaltyNote.inputs[1] <== creatorPkY;
    royaltyNote.inputs[2] <== royaltyAmount;
    royaltyNote.inputs[3] <== paymentToken;
    royaltyNote.inputs[4] <== royaltySalt;
    royaltyNote.out === royaltyNoteHash;

    // ===== 6. Create Sale Commitment =====
    // Binds all sale details for verification
    component saleHash = Poseidon(6);
    saleHash.inputs[0] <== nftId;
    saleHash.inputs[1] <== salePrice;
    saleHash.inputs[2] <== royaltyAmount;
    saleHash.inputs[3] <== sellerPkX;
    saleHash.inputs[4] <== buyerPkX;
    saleHash.inputs[5] <== paymentToken;
    saleHash.out === saleCommitment;

    // ===== 7. Verify Sale Price Positive =====
    component priceCheck = GreaterThan(64);
    priceCheck.in[0] <== salePrice;
    priceCheck.in[1] <== 0;
    priceCheck.out === 1;
}

component main {public [saleCommitment, royaltyNoteHash, nftNullifier, newNftNoteHash, collectionAddress, royaltyBps]} =
    RoyaltyPayment();
```

### Key Constraints

1. **Seller Ownership**: Only NFT owner can initiate sale
2. **Royalty Calculation**: Royalty amount matches percentage of sale price
3. **Creator Payment**: Royalty note created for correct recipient
4. **NFT Transfer**: New note created for buyer with correct NFT ID
5. **Price Validity**: Sale price must be positive (prevents zero-royalty transfers)

## Effects

| Aspect | Impact |
|--------|--------|
| **Creator Protection** | Royalties enforced even on private sales |
| **Price Privacy** | Sale amount hidden from public |
| **Automatic Distribution** | No manual royalty collection needed |
| **Bypass Prevention** | Cannot transfer without royalty payment |
| **Collection Compliance** | Per-collection royalty rates honored |
| **Multi-Creator Support** | Extensible to split royalties |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Royalty Underpayment** | Circuit enforces minimum based on declared price |
| **Price Manipulation** | Consider floor price oracles for minimum royalty |
| **Zero-Price Sales** | Require positive sale price or use floor |
| **Creator Key Loss** | Support key rotation or recovery mechanisms |
| **Wrap/Unwrap Bypass** | Apply royalties on wrap and unwrap too |
| **Off-Chain Payments** | Economic incentives; partial enforcement better than none |

## Implementation Challenges

1. **Creator Registry**
   - How to determine creator for each NFT?
   - On-chain registry per collection
   - Merkle tree of creator addresses

2. **Royalty Rate Changes**
   - Can creators change royalty rates?
   - Time-locked changes with notice period
   - Consider max rate caps

3. **Multi-Creator Splits**
   - Collaborative works with multiple creators
   - Split ratios committed on-chain
   - Multiple royalty notes in single proof

4. **Floor Price Enforcement**
   - Prevent zero or trivially low prices
   - Use oracle floor prices
   - Minimum absolute royalty amounts

## Derivatives

1. **Tiered Royalties** - Different royalty rates based on sale price brackets. Circuit checks price range and applies corresponding rate. Higher-value sales can have different rates.

2. **Multi-Creator Splits** - Royalties automatically divided among multiple creators. Circuit creates separate notes for each creator. Supports complex collaboration arrangements.

3. **Secondary Sale Tracking** - Track number of times NFT has been sold. Royalty rate can change based on sale count. Rewards early adopters with lower rates.

4. **Royalty Bypass Prevention** - Detect and penalize royalty evasion attempts. Circuit verifies price against market data. Requires collateral forfeit for suspicious sales.

5. **Retroactive Royalties** - Apply royalties to historical sales made before enforcement. Circuit verifies past sale and calculates owed royalty. Enables creator compensation for past evasion.

## Use Cases

1. **Artist Ongoing Compensation**
   - Digital artist creates generative collection
   - Sets 7.5% royalty on all secondary sales
   - Private sales still pay royalty to artist
   - Sale prices remain confidential
   - Artist receives steady income from collection trading

2. **Collaborative Art Projects**
   - Three artists create collaborative piece
   - Royalties split 40/40/20
   - Each sale creates three royalty notes
   - Individual artist earnings remain private
   - Automatic distribution without coordination

3. **Game Studio Revenue**
   - Studio creates in-game items as NFTs
   - 10% royalty funds continued development
   - Private trading between players still contributes
   - Studio tracks aggregate royalties without seeing individual sales

4. **Music NFT Royalties**
   - Musician releases song as NFT
   - 15% royalty split with producer and label
   - Fans trade privately; royalties still flow
   - Enables artist-friendly secondary markets

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F10. Royalty Payment - Products](../../product/f-nft-gaming/f10-royalty-products.md)

---

[Back to Index](../../README.md)
