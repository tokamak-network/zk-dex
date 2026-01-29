# A7. Auction (Dutch/English)

Time-based price discovery through descending (Dutch) or ascending (English) auction mechanisms with hidden bid parameters.

**Constraints**: ~250K | **Complexity**: Medium

---

## Background

Auction mechanisms provide efficient price discovery for unique or illiquid assets:

- **Price Discovery**: Find fair market value without requiring continuous liquidity
- **Unique Asset Sales**: NFTs, large token blocks, and illiquid assets need auction-style selling
- **Reduced Information Leakage**: Sealed bids prevent sniping and strategic underbidding
- **Time-Structured Sales**: Organized selling process with clear start/end times
- **MEV Resistance**: Hidden bids prevent front-running and sandwich attacks

In traditional finance, auctions are used for IPOs, treasury sales, and rare assets. In DeFi, most auctions are transparent, enabling sophisticated bidders to wait until last moment (sniping) or view competing bids. ZK auctions hide bid amounts until settlement.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `auctionId` | field | Unique identifier for the auction |
| `itemNoteHash` | field | Hash of the item being auctioned |
| `bidNoteHash` | field | Hash of winning bid note |
| `sellerOutputHash` | field | Hash of seller's payment note |
| `bidderOutputHash` | field | Hash of bidder's item note |
| `startPrice` | uint | Starting price (highest for Dutch, lowest for English) |
| `endPrice` | uint | Ending price (lowest for Dutch, reserve for English) |
| `startTime` | uint | Auction start timestamp |
| `endTime` | uint | Auction end timestamp |
| `currentTime` | uint | Current timestamp for price calculation |
| `tokenType` | uint | Token type for payment |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX, sellerPkY` | field | Seller's public key |
| `sellerSk` | field | Seller's secret key |
| `itemValue` | uint | Item note value (for fungible quantity) |
| `itemSalt` | field | Item note randomness |
| `bidderPkX, bidderPkY` | field | Bidder's public key |
| `bidValue` | uint | Actual bid amount |
| `bidSalt` | field | Bid note randomness |
| `outSellerValue` | uint | Payment to seller |
| `outSellerSalt` | field | Seller output randomness |
| `outBidderSalt` | field | Bidder output randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/math/safe_div.circom";

template DutchAuction() {
    // ===== Public Inputs =====
    signal input auctionId;
    signal input itemNoteHash;
    signal input bidNoteHash;
    signal input sellerOutputHash;
    signal input bidderOutputHash;
    signal input startPrice;
    signal input endPrice;
    signal input startTime;
    signal input endTime;
    signal input currentTime;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY, sellerSk;
    signal input itemValue, itemToken, itemSalt;
    signal input bidderPkX, bidderPkY;
    signal input bidValue, bidSalt;
    signal input outSellerValue, outSellerSalt;
    signal input outBidderSalt;

    // ===== 1. Verify Seller Owns Item =====
    component itemNote = PoseidonRegularNote();
    itemNote.pkX <== sellerPkX;
    itemNote.pkY <== sellerPkY;
    itemNote.value <== itemValue;
    itemNote.tokenType <== itemToken;
    itemNote.salt <== itemSalt;
    itemNote.out === itemNoteHash;

    component sellerOwn = ProofOfOwnershipStrict();
    sellerOwn.sk <== sellerSk;
    sellerOwn.pkX <== sellerPkX;
    sellerOwn.pkY <== sellerPkY;

    // ===== 2. Time Validation =====
    // currentTime must be in [startTime, endTime]
    component timeStart = GreaterEqThan(64);
    timeStart.in[0] <== currentTime;
    timeStart.in[1] <== startTime;
    timeStart.out === 1;

    component timeEnd = LessEqThan(64);
    timeEnd.in[0] <== currentTime;
    timeEnd.in[1] <== endTime;
    timeEnd.out === 1;

    // ===== 3. Calculate Current Price (Dutch Auction: Linear Decrease) =====
    // currentPrice = startPrice - (elapsed * priceRange / duration)
    signal elapsed;
    elapsed <== currentTime - startTime;

    signal duration;
    duration <== endTime - startTime;

    signal priceRange;
    priceRange <== startPrice - endPrice;

    // Price decrease = elapsed * priceRange / duration
    signal priceDecrease;
    component divPrice = SafeDiv(128);
    divPrice.dividend <== elapsed * priceRange;
    divPrice.divisor <== duration;
    priceDecrease <== divPrice.quotient;

    signal currentPrice;
    currentPrice <== startPrice - priceDecrease;

    // ===== 4. Verify Bid Note =====
    component bidNote = PoseidonRegularNote();
    bidNote.pkX <== bidderPkX;
    bidNote.pkY <== bidderPkY;
    bidNote.value <== bidValue;
    bidNote.tokenType <== tokenType;
    bidNote.salt <== bidSalt;
    bidNote.out === bidNoteHash;

    // ===== 5. Bid Must Meet Current Price =====
    component bidCheck = GreaterEqThan(64);
    bidCheck.in[0] <== bidValue;
    bidCheck.in[1] <== currentPrice;
    bidCheck.out === 1;

    // ===== 6. Create Seller Output (Payment) =====
    // Seller receives bid amount (or currentPrice if bid exceeds)
    signal sellerReceives;
    sellerReceives <== currentPrice;  // Dutch: seller gets current price, not bid

    component sellerOut = PoseidonRegularNote();
    sellerOut.pkX <== sellerPkX;
    sellerOut.pkY <== sellerPkY;
    sellerOut.value <== outSellerValue;
    sellerOut.tokenType <== tokenType;
    sellerOut.salt <== outSellerSalt;
    sellerOut.out === sellerOutputHash;

    // Verify seller receives current price
    outSellerValue === currentPrice;

    // ===== 7. Create Bidder Output (Item) =====
    component bidderOut = PoseidonRegularNote();
    bidderOut.pkX <== bidderPkX;
    bidderOut.pkY <== bidderPkY;
    bidderOut.value <== itemValue;
    bidderOut.tokenType <== itemToken;
    bidderOut.salt <== outBidderSalt;
    bidderOut.out === bidderOutputHash;

    // ===== 8. Refund Excess Bid =====
    // If bidValue > currentPrice, create refund note
    signal refundAmount;
    refundAmount <== bidValue - currentPrice;
    // Refund handling would create additional output note if refundAmount > 0
}

component main {public [auctionId, itemNoteHash, bidNoteHash, sellerOutputHash,
    bidderOutputHash, startPrice, endPrice, startTime, endTime, currentTime,
    tokenType]} = DutchAuction();
```

### Key Constraints

1. **Seller Ownership**: Seller must prove ownership of item being auctioned
2. **Time Window**: Current time must be within auction period
3. **Price Calculation**: Current price computed from linear interpolation
4. **Minimum Bid**: Bid must meet or exceed current price
5. **Value Transfer**: Seller receives payment; bidder receives item
6. **Refund Handling**: Excess bid amount returned to bidder

## Effects

| Aspect | Impact |
|--------|--------|
| **Price Discovery** | Fair market value through competitive bidding |
| **Liquidity** | Sell illiquid assets without continuous market |
| **Privacy** | Bid amounts hidden until settlement |
| **Time Structure** | Clear auction duration with predictable end |
| **MEV Protection** | Hidden bids prevent last-second sniping |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Timestamp Manipulation** | Use block timestamp; circuit validates bounds |
| **Bid Sniping** | Sealed bids prevent seeing others' amounts |
| **Seller Collusion** | Auction ID commitment prevents bid selection |
| **Price Curve Manipulation** | Linear curve is deterministic and verifiable |
| **Double Spending** | Bid note nullified on winning |
| **Reserve Not Met** | Circuit enforces minimum price (endPrice) |

## Implementation Challenges

1. **Division Circuit**
   - Integer division in circuits requires careful implementation
   - SafeDiv component handles division with remainder
   - Precision loss must be bounded and documented

2. **Time Source Reliability**
   - Block timestamps can be manipulated by miners (~15 seconds)
   - Consider commit-reveal for time-sensitive auctions
   - Multi-block confirmation for high-value auctions

3. **English Auction Variant**
   - Requires bid comparison between multiple bidders
   - More complex state management for increasing bids
   - Consider separate circuit or multi-round protocol

4. **Auction Discovery**
   - How do bidders find active auctions without revealing interest?
   - Off-chain indexing with on-chain settlement
   - Consider commitment schemes for bid privacy

5. **Refund Complexity**
   - Excess bids need refund notes
   - Multiple outputs increase circuit complexity
   - Consider requiring exact bids (no refunds)

## Derivatives

1. **Sealed-Bid Second-Price Auction (Vickrey)** - Winner pays second-highest bid, not their own. Encourages truthful bidding as overbidding has no penalty. Requires commit-reveal phase to collect all bids before revealing. More complex multi-party circuit for comparison.

2. **Reserve Price Auctions** - Hidden minimum price below which item will not sell. If highest bid below reserve, auction fails and item returns to seller. Prevents selling below floor without revealing reserve. Circuit includes reserve check with conditional settlement.

3. **Batch Auctions** - Multiple items or multiple units auctioned simultaneously. All successful bidders pay same clearing price. Uniform price discovery similar to IPO book-building. Aggregates demand for efficient price finding.

4. **Auction with Minimum Participation** - Auction only settles if minimum number of bidders participate. Prevents thin auctions with artificially low prices. Commit-reveal phase counts participants before bid reveal. Circuit includes participation count check.

5. **Time-Extended Auctions (Anti-Sniping)** - If bid placed in last N minutes, auction extends by M minutes. Prevents last-second sniping in English auctions. Encourages genuine price discovery rather than timing games. Extension logic adds complexity to time handling.

## Use Cases

1. **NFT Sales**
   - Artist creates unique digital artwork as NFT
   - Dutch auction starts at high price, decreases over 24 hours
   - First buyer willing to pay current price wins
   - No bidding wars or gas auctions
   - Price reflects genuine willingness to pay

2. **Large Token Block Sales**
   - Protocol treasury needs to sell 1M tokens
   - Auction prevents market impact of single large sale
   - Institutional buyers bid for entire block
   - Price discovery without affecting spot markets
   - Seller receives fair price; buyer avoids slippage

3. **Protocol Fee Distribution**
   - Protocol collects fees in various tokens
   - Monthly auction sells fee tokens for ETH
   - Community members bid for discount
   - Fair distribution without preferential access
   - Transparent process with hidden bid amounts

4. **Liquidation Auctions**
   - Undercollateralized position needs liquidation
   - Dutch auction for collateral at decreasing price
   - First bidder to accept price wins collateral
   - Faster than English auction for time-sensitive liquidations
   - Ensures fair price while maintaining protocol safety

## Real-World Products & User Experience

See dedicated product documentation: [Product Applications](../../../product/a-core-trading/a7-auction-products.md)

---

[Back to Index](../../README.md)
