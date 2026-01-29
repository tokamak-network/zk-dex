# F2. Blind Auction Bid

Sealed-bid auction mechanism where bid amounts remain hidden until reveal phase, preventing bid manipulation and sniping.

**Constraints**: ~150K | **Complexity**: Medium

---

## Background

Blind auctions solve critical issues in on-chain NFT sales:

- **Bid Privacy**: Open auctions allow competitors to see and outbid by minimal amounts; sealed bids force genuine valuation
- **Anti-Sniping**: Last-second bids cannot be calculated based on current highest bid when bids are hidden
- **Strategy Protection**: Bidding patterns reveal collector preferences and budgets; sealed bids hide this information
- **Price Discovery**: True market value emerges when bidders cannot anchor on visible bids

Traditional auction houses use sealed-bid formats for high-value items. ZK blind auctions bring cryptographic guarantees to this model, ensuring bids cannot be revealed before the designated time.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bidCommitment` | field | Hash commitment to bid details |
| `auctionId` | uint | Unique identifier for the auction |
| `collateralHash` | field | Hash of locked collateral note |
| `nullifier` | field | Nullifier for the collateral note |
| `minBid` | uint | Minimum bid required (public auction parameter) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bidAmount` | uint | Actual bid value (hidden) |
| `bidderPkX, bidderPkY` | field | Bidder's public key |
| `bidderSk` | field | Bidder's secret key |
| `bidSalt` | field | Randomness for bid commitment |
| `collateralValue` | uint | Value of locked collateral |
| `collateralSalt` | field | Collateral note randomness |
| `tokenType` | uint | Token type of collateral |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template BlindAuctionBid() {
    // ===== Public Inputs =====
    signal input bidCommitment;
    signal input auctionId;
    signal input collateralHash;
    signal input nullifier;
    signal input minBid;

    // ===== Private Inputs =====
    signal input bidAmount;
    signal input bidderPkX, bidderPkY, bidderSk;
    signal input bidSalt;
    signal input collateralValue, collateralSalt, tokenType;

    // ===== 1. Verify Bid Commitment =====
    // Commitment = Hash(auctionId, bidAmount, bidderPkX, bidderPkY, bidSalt)
    component bidHash = Poseidon(5);
    bidHash.inputs[0] <== auctionId;
    bidHash.inputs[1] <== bidAmount;
    bidHash.inputs[2] <== bidderPkX;
    bidHash.inputs[3] <== bidderPkY;
    bidHash.inputs[4] <== bidSalt;
    bidHash.out === bidCommitment;

    // ===== 2. Verify Bidder Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== bidderSk;
    ownership.pkX <== bidderPkX;
    ownership.pkY <== bidderPkY;

    // ===== 3. Verify Collateral Note =====
    // Collateral note: Hash(pkX, pkY, value, tokenType, salt)
    component collateral = Poseidon(5);
    collateral.inputs[0] <== bidderPkX;
    collateral.inputs[1] <== bidderPkY;
    collateral.inputs[2] <== collateralValue;
    collateral.inputs[3] <== tokenType;
    collateral.inputs[4] <== collateralSalt;
    collateral.out === collateralHash;

    // ===== 4. Compute Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== collateralSalt;
    nullifierCalc.inputs[1] <== bidderSk;
    nullifierCalc.inputs[2] <== auctionId;
    nullifierCalc.out === nullifier;

    // ===== 5. Bid >= Minimum Bid =====
    component minCheck = GreaterEqThan(64);
    minCheck.in[0] <== bidAmount;
    minCheck.in[1] <== minBid;
    minCheck.out === 1;

    // ===== 6. Collateral >= Bid Amount =====
    component collateralCheck = GreaterEqThan(64);
    collateralCheck.in[0] <== collateralValue;
    collateralCheck.in[1] <== bidAmount;
    collateralCheck.out === 1;
}

component main {public [bidCommitment, auctionId, collateralHash, nullifier, minBid]} =
    BlindAuctionBid();
```

### Key Constraints

1. **Bid Commitment Binding**: Bid amount is cryptographically bound to commitment; cannot be changed after submission
2. **Ownership Verification**: Only the key holder can create bids using their collateral
3. **Sufficient Collateral**: Locked collateral must cover the bid amount
4. **Minimum Bid Compliance**: Bid must meet auction minimum threshold
5. **Single Bid Per Collateral**: Nullifier prevents using same collateral for multiple bids

## Effects

| Aspect | Impact |
|--------|--------|
| **Bid Privacy** | Bid amounts hidden until reveal phase |
| **Fair Competition** | No ability to incrementally outbid |
| **Anti-Sniping** | Last-second bids cannot be calculated |
| **Collateral Security** | Funds locked during auction; no fake bids |
| **Bidder Anonymity** | Identity hidden in bid commitment |
| **Gas Efficiency** | Single proof for bid + collateral lock |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Early Reveal** | Commitment scheme prevents extraction; use strong randomness |
| **Bid Grinding** | High-entropy salt prevents brute-force discovery of bids |
| **Collateral Reuse** | Nullifier tied to auction prevents multi-auction collateral reuse |
| **Fake Bids** | Collateral lock ensures bid can be honored |
| **Reveal Phase Griefing** | Penalty for non-reveal; forfeit portion of collateral |
| **Auction Manipulation** | Commit-reveal timeline enforced by smart contract |

## Implementation Challenges

1. **Two-Phase Protocol**
   - Bid submission phase: collect commitments
   - Reveal phase: bidders submit reveal proofs
   - Winner determination: compare revealed bids
   - Settlement: transfer NFT and collateral

2. **Reveal Incentives**
   - Losing bidders may not bother to reveal
   - Consider automatic refund mechanism
   - Penalty for non-reveal may be necessary

3. **Tie Breaking**
   - Multiple bids at same amount need resolution
   - Options: earliest timestamp, random selection, or secondary criteria
   - Must be deterministic and verifiable

4. **Gas Costs**
   - Each bid requires proof verification
   - Reveal phase adds additional verification
   - Consider batch verification for large auctions

## Derivatives

1. **Second-Price Sealed Bid (Vickrey)** - Winner pays second-highest bid amount, incentivizing truthful bidding. Circuit proves bid ordering without revealing all amounts. Requires additional reveal logic to identify second price.

2. **Multi-Item Auctions** - Auction multiple NFTs simultaneously with single bid for the lot. Bidders specify combinations they want; circuit matches optimal allocation. Useful for collection sales.

3. **Reserve Price Verification** - Prove bid meets hidden reserve without revealing reserve. Seller commits to reserve; circuit verifies bid >= reserve. Auction fails if no qualifying bids.

4. **Bid Staking with Rewards** - Bidders earn yield on locked collateral during auction period. Integration with lending protocol for collateral. Reduces opportunity cost of participation.

5. **Anti-Shill Bidding** - Prevent seller from bidding on own auction. Seller commits to identity; circuit proves bidder != seller. Requires identity framework but maintains bid privacy.

## Use Cases

1. **High-Value Art Auctions**
   - Artist releases 1/1 piece via blind auction
   - Collectors submit sealed bids over 7-day period
   - No one knows competing bid amounts
   - Reveal phase determines winner; ensures fair market price discovery

2. **Domain Name Sales**
   - Valuable ENS domain goes to auction
   - Speculators cannot see competitor valuations
   - Prevents strategic underbidding or overbidding
   - True demand revealed only at conclusion

3. **Limited Edition Drops**
   - Project releases 100 NFTs via auction
   - Each bidder commits to price willing to pay
   - Top 100 bids win; 101st price sets floor
   - Prevents whale manipulation of public auctions

4. **Real Estate NFT Sales**
   - Tokenized property sold via sealed bid
   - Serious buyers submit genuine offers
   - Seller cannot selectively reveal to create bidding war
   - Compliant with traditional real estate sealed-bid practices

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F2. Blind Auction Bid - Products](../../product/f-nft-gaming/f2-blind-auction-products.md)

---

[Back to Index](../../README.md)
