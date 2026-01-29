# F9. NFT Rental Create

Create time-limited NFT rental agreements with private terms, automatic expiration, and collateral protection for owners.

**Constraints**: ~180K | **Complexity**: Medium

---

## Background

NFT rentals enable utility sharing without permanent transfer:

- **Utility Access**: High-value NFTs provide access to experiences; renting democratizes access
- **Owner Revenue**: NFT owners can monetize assets without selling; passive income stream
- **Renter Privacy**: Hide which NFTs are rented and by whom; prevent targeting of renters
- **Term Privacy**: Rental duration and price remain confidential; competitive information

Gaming NFTs, metaverse land, and membership NFTs have utility beyond ownership. Rental markets allow owners to earn while renters access benefits. ZK rentals hide the terms while enforcing them cryptographically.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `rentalCommitment` | field | Commitment to rental agreement |
| `nftNoteHash` | field | Hash of NFT being rented |
| `usageNoteHash` | field | Hash of renter's usage rights note |
| `collateralNoteHash` | field | Hash of renter's collateral |
| `expirationBlock` | uint | Block number when rental expires |
| `nullifier` | field | Prevents double-renting |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | NFT owner's public key |
| `ownerSk` | field | Owner's secret key |
| `renterPkX, renterPkY` | field | Renter's public key |
| `nftId` | uint | NFT identifier |
| `collectionAddress` | address | NFT collection contract |
| `nftSalt` | field | NFT note randomness |
| `rentalPrice` | uint | Agreed rental price |
| `collateralAmount` | uint | Required collateral |
| `duration` | uint | Rental duration in blocks |
| `rentalSalt` | field | Rental agreement randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template NFTRentalCreate() {
    // ===== Public Inputs =====
    signal input rentalCommitment;
    signal input nftNoteHash;
    signal input usageNoteHash;
    signal input collateralNoteHash;
    signal input expirationBlock;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, ownerSk;
    signal input renterPkX, renterPkY;
    signal input nftId, collectionAddress, nftSalt;
    signal input rentalPrice, collateralAmount, duration;
    signal input rentalSalt, usageSalt, collateralSalt;
    signal input collateralToken;
    signal input startBlock;

    // ===== 1. Verify NFT Ownership =====
    component nftNote = Poseidon(5);
    nftNote.inputs[0] <== ownerPkX;
    nftNote.inputs[1] <== ownerPkY;
    nftNote.inputs[2] <== nftId;
    nftNote.inputs[3] <== collectionAddress;
    nftNote.inputs[4] <== nftSalt;
    nftNote.out === nftNoteHash;

    // ===== 2. Verify Owner Identity =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== ownerSk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== 3. Compute Nullifier =====
    // Prevents same NFT being rented twice simultaneously
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== nftId;
    nullifierCalc.inputs[1] <== nftSalt;
    nullifierCalc.inputs[2] <== ownerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Create Rental Agreement Commitment =====
    // Agreement includes all terms hidden
    component rentalHash = Poseidon(7);
    rentalHash.inputs[0] <== nftId;
    rentalHash.inputs[1] <== renterPkX;
    rentalHash.inputs[2] <== renterPkY;
    rentalHash.inputs[3] <== rentalPrice;
    rentalHash.inputs[4] <== collateralAmount;
    rentalHash.inputs[5] <== duration;
    rentalHash.inputs[6] <== rentalSalt;
    rentalHash.out === rentalCommitment;

    // ===== 5. Create Usage Rights Note =====
    // Renter gets usage note valid until expiration
    component usageNote = Poseidon(6);
    usageNote.inputs[0] <== renterPkX;
    usageNote.inputs[1] <== renterPkY;
    usageNote.inputs[2] <== nftId;
    usageNote.inputs[3] <== collectionAddress;
    usageNote.inputs[4] <== expirationBlock;
    usageNote.inputs[5] <== usageSalt;
    usageNote.out === usageNoteHash;

    // ===== 6. Verify Collateral Note =====
    // Collateral locked for rental period
    component collateral = Poseidon(5);
    collateral.inputs[0] <== renterPkX;
    collateral.inputs[1] <== renterPkY;
    collateral.inputs[2] <== collateralAmount;
    collateral.inputs[3] <== collateralToken;
    collateral.inputs[4] <== collateralSalt;
    collateral.out === collateralNoteHash;

    // ===== 7. Verify Expiration Calculation =====
    signal computedExpiration;
    computedExpiration <== startBlock + duration;
    computedExpiration === expirationBlock;

    // ===== 8. Verify Collateral Sufficient =====
    // Collateral should cover potential damages (e.g., >= rental price)
    component collateralCheck = GreaterEqThan(64);
    collateralCheck.in[0] <== collateralAmount;
    collateralCheck.in[1] <== rentalPrice;
    collateralCheck.out === 1;
}

component main {public [rentalCommitment, nftNoteHash, usageNoteHash, collateralNoteHash, expirationBlock, nullifier]} =
    NFTRentalCreate();
```

### Key Constraints

1. **Owner Verification**: Only NFT owner can create rental agreements
2. **Term Commitment**: All rental terms cryptographically bound
3. **Usage Rights**: Renter receives time-limited usage note
4. **Collateral Lock**: Renter's collateral locked for rental period
5. **Expiration Correctness**: Expiration block correctly calculated from start and duration

## Effects

| Aspect | Impact |
|--------|--------|
| **Utility Democratization** | Expensive NFTs accessible through rental |
| **Passive Income** | NFT owners earn without selling |
| **Term Privacy** | Rental price and duration hidden |
| **Collateral Security** | Owner protected against renter default |
| **Automatic Expiration** | No trust required for rental return |
| **Flexible Terms** | Any duration and price negotiable |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Double Rental** | Nullifier prevents concurrent rentals of same NFT |
| **Non-Return** | Usage note automatically expires; no action needed |
| **Undercollateralized** | Minimum collateral requirements enforced |
| **Term Manipulation** | Terms committed before rental starts |
| **Early Termination** | Consider penalty mechanisms or term insurance |
| **Collateral Volatility** | Use stablecoins or over-collateralize |

## Implementation Challenges

1. **Rental Discovery**
   - How do renters find available NFTs?
   - Hidden listings with attribute hints
   - Encrypted communication for negotiation

2. **Usage Verification**
   - How do services verify valid rental?
   - Renter proves usage note ownership
   - On-chain expiration check

3. **Return Process**
   - What happens at expiration?
   - Usage note becomes invalid; collateral released
   - Owner NFT note remains unchanged

4. **Damage Assessment**
   - For consumable or damageable NFTs
   - How to assess and claim from collateral
   - Arbiter system for disputes

## Derivatives

1. **Time-Limited Rentals** - Rentals with specific start and end times rather than block-based. Circuit verifies timestamp ranges. Useful for event-based access (concerts, conferences).

2. **Revenue Sharing** - Rental income split between multiple owners. Circuit distributes payment according to ownership percentages. Enables fractional NFT rentals.

3. **Rental Extensions** - Extend active rental without re-collateralizing. Circuit verifies additional payment covers extension. Continuous rental without gaps.

4. **Subleasing** - Renter can sublease to third party. Original owner still protected by collateral. Creates rental markets within rental markets.

5. **Rental Insurance** - Third party insures against rental defaults. Insurance pool covers owner if renter absconds. Reduces collateral requirements.

## Use Cases

1. **Gaming Asset Rentals**
   - Player owns legendary weapon worth $10,000
   - Rents to newer player for $100/week
   - Renter deposits $500 collateral
   - Weapon automatically returns after rental period
   - Both parties' identities remain private

2. **Metaverse Land Rental**
   - Virtual land owner rents plot for event
   - Event organizer gets temporary building rights
   - Rental terms (price, duration) hidden from competitors
   - Land returns to owner post-event

3. **Membership NFT Access**
   - Exclusive club membership NFT
   - Owner rents access for specific dates
   - Renter gains temporary membership benefits
   - No permanent transfer of membership

4. **Scholarship Programs**
   - Guild rents gaming NFTs to scholars
   - Scholars play-to-earn with borrowed assets
   - Revenue sharing through rental terms
   - Scholars build toward ownership

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F9. NFT Rental Create - Products](../../product/f-nft-gaming/f9-rental-products.md)

---

[Back to Index](../../README.md)
