# HC3. Private Order Book Matching

Match multiple orders from an encrypted order book in a single proof.

**Constraints**: ~1M | **Complexity**: Very High

---

## Background

Traditional order books expose critical information:
- Order prices reveal trading intent and market sentiment
- Order sizes enable front-running and sandwich attacks
- Order timing creates information asymmetry
- Dark pools exist but lack transparency/verifiability

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| Transparent order books | Full MEV exposure; front-running endemic |
| Commit-reveal schemes | Timing attacks; griefing by non-reveal |
| Traditional dark pools | Trusted operator; no verifiability; regulatory concerns |
| AMMs | No price discovery; always trading against LPs |

Private order book matching enables verifiable fair matching without revealing individual order details until settlement. The matching engine proves correct execution without exposing the order book state.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bidCommitments` | field[N_BIDS] | Commitments to bid orders |
| `askCommitments` | field[N_ASKS] | Commitments to ask orders |
| `matchResultHash` | field | Commitment to fill results |
| `clearedVolume` | uint | Total matched volume |
| `clearingPrice` | uint | Uniform clearing price |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bidPkX/Y, bidAmount, bidMaxPrice, bidSalt` | arrays | Bid order details |
| `askPkX/Y, askAmount, askMinPrice, askSalt` | arrays | Ask order details |
| `bidIsActive, askIsActive` | bool arrays | Which order slots are active |
| `bidFilled, askFilled` | uint arrays | Fill amounts per order |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Front-running** | Eliminated - orders hidden until matched |
| **Information Leakage** | Minimal - only clearing price/volume revealed |
| **Fairness** | Mathematically provable price-time priority |
| **Institutional Adoption** | Enables institutional-grade dark pool on-chain |
| **Market Quality** | Better price discovery without adverse selection |
| **Latency** | Batch auctions trade latency for fairness (e.g., 1 block = 12s) |

## Derivatives

1. **Frequent Batch Auction (FBA)** - Match orders at fixed intervals (e.g., every block). All orders in batch receive same clearing price. Eliminates speed advantage and HFT arms race. Used by CowSwap, Gnosis Protocol.

2. **Mid-Point Matching** - Match at mid-point of best bid and best ask for zero spread. Requires reference price from external source or previous auction. Benefits both sides equally.

3. **Pro-Rata Matching** - Distribute fills proportionally among orders at same price level. Alternative to price-time priority. Fairer for large orders competing at same price.

4. **Iceberg Order Support** - Hidden size with visible tip. Only tip amount revealed; rest hidden. Executes tip first, then reveals next tranche. Reduces market impact for large orders.

5. **Stop-Limit Order Book** - Trigger orders based on oracle price crossing threshold. Combines order book with conditional execution. Enables complex trading strategies.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/comparators.circom";

template PrivateOrderBookMatch(N_BIDS, N_ASKS) {
    // ===== Public Inputs =====
    signal input bidCommitments[N_BIDS];
    signal input askCommitments[N_ASKS];
    signal input matchResultHash;
    signal input clearedVolume;
    signal input clearingPrice;

    // ===== Private Inputs =====
    signal input bidPkX[N_BIDS], bidPkY[N_BIDS];
    signal input bidAmount[N_BIDS];
    signal input bidMaxPrice[N_BIDS];
    signal input bidSalt[N_BIDS];
    signal input bidIsActive[N_BIDS];

    signal input askPkX[N_ASKS], askPkY[N_ASKS];
    signal input askAmount[N_ASKS];
    signal input askMinPrice[N_ASKS];
    signal input askSalt[N_ASKS];
    signal input askIsActive[N_ASKS];

    signal input bidFilled[N_BIDS];
    signal input askFilled[N_ASKS];

    // ===== Component Declarations =====
    component bidHash[N_BIDS];
    component askHash[N_ASKS];
    component bidPriceCheck[N_BIDS];
    component askPriceCheck[N_ASKS];
    component bidFillCheck[N_BIDS];
    component askFillCheck[N_ASKS];
    component resultHash;

    // Intermediate signals
    signal bidFilledActive[N_BIDS];
    signal askFilledActive[N_ASKS];

    // ===== Verify Bid Commitments =====
    for (var i = 0; i < N_BIDS; i++) {
        bidHash[i] = Poseidon(6);
        bidHash[i].inputs[0] <== bidPkX[i];
        bidHash[i].inputs[1] <== bidPkY[i];
        bidHash[i].inputs[2] <== bidAmount[i];
        bidHash[i].inputs[3] <== bidMaxPrice[i];
        bidHash[i].inputs[4] <== bidSalt[i];
        bidHash[i].inputs[5] <== 0;  // order type = bid

        (bidHash[i].out - bidCommitments[i]) * bidIsActive[i] === 0;
    }

    // ===== Verify Ask Commitments =====
    for (var i = 0; i < N_ASKS; i++) {
        askHash[i] = Poseidon(6);
        askHash[i].inputs[0] <== askPkX[i];
        askHash[i].inputs[1] <== askPkY[i];
        askHash[i].inputs[2] <== askAmount[i];
        askHash[i].inputs[3] <== askMinPrice[i];
        askHash[i].inputs[4] <== askSalt[i];
        askHash[i].inputs[5] <== 1;  // order type = ask

        (askHash[i].out - askCommitments[i]) * askIsActive[i] === 0;
    }

    // ===== Verify Price Validity =====
    // Matched bids: maxPrice >= clearingPrice
    for (var i = 0; i < N_BIDS; i++) {
        bidPriceCheck[i] = LessThan(64);
        bidPriceCheck[i].in[0] <== clearingPrice;
        bidPriceCheck[i].in[1] <== bidMaxPrice[i] + 1;

        bidFilledActive[i] <== bidFilled[i] * bidIsActive[i];
        (1 - bidPriceCheck[i].out) * bidFilledActive[i] === 0;
    }

    // Matched asks: minPrice <= clearingPrice
    for (var i = 0; i < N_ASKS; i++) {
        askPriceCheck[i] = LessThan(64);
        askPriceCheck[i].in[0] <== askMinPrice[i];
        askPriceCheck[i].in[1] <== clearingPrice + 1;

        askFilledActive[i] <== askFilled[i] * askIsActive[i];
        (1 - askPriceCheck[i].out) * askFilledActive[i] === 0;
    }

    // ===== Verify Fill Constraints =====
    for (var i = 0; i < N_BIDS; i++) {
        bidFillCheck[i] = LessThan(64);
        bidFillCheck[i].in[0] <== bidFilled[i];
        bidFillCheck[i].in[1] <== bidAmount[i] + 1;
        bidFillCheck[i].out === 1;
    }

    for (var i = 0; i < N_ASKS; i++) {
        askFillCheck[i] = LessThan(64);
        askFillCheck[i].in[0] <== askFilled[i];
        askFillCheck[i].in[1] <== askAmount[i] + 1;
        askFillCheck[i].out === 1;
    }

    // ===== Verify Volume Balance =====
    var totalBidFilled = 0;
    var totalAskFilled = 0;

    for (var i = 0; i < N_BIDS; i++) {
        totalBidFilled += bidFilled[i] * bidIsActive[i];
    }
    for (var i = 0; i < N_ASKS; i++) {
        totalAskFilled += askFilled[i] * askIsActive[i];
    }

    totalBidFilled === totalAskFilled;
    totalBidFilled === clearedVolume;

    // ===== Compute Match Result Hash =====
    resultHash = Poseidon(N_BIDS + N_ASKS + 2);
    for (var i = 0; i < N_BIDS; i++) {
        resultHash.inputs[i] <== bidFilled[i];
    }
    for (var i = 0; i < N_ASKS; i++) {
        resultHash.inputs[N_BIDS + i] <== askFilled[i];
    }
    resultHash.inputs[N_BIDS + N_ASKS] <== clearingPrice;
    resultHash.inputs[N_BIDS + N_ASKS + 1] <== clearedVolume;
    resultHash.out === matchResultHash;
}

component main {public [bidCommitments, askCommitments, matchResultHash,
    clearedVolume, clearingPrice]} = PrivateOrderBookMatch(32, 32);
```

### Key Constraints

1. **Commitment Integrity**: All orders verified against their commitments
2. **Price-Fill Consistency**: Only orders with valid prices can be filled
3. **Fill Bounds**: Cannot fill more than order amount
4. **Volume Balance**: Total bid fills equals total ask fills
5. **Result Binding**: Match result hash commits to specific fills

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Order Book Manipulation** | See detailed analysis below |
| **Matching Engine Collusion** | Decentralized matcher selection; multiple competing provers |
| **Front-Running** | Orders committed before matching; no visibility into book |
| **Price Manipulation** | Uniform clearing price; all trades at same price |
| **Selective Matching** | Proof must show optimal matching; can be verified |
| **Information Leakage** | Only clearing price and volume revealed |
| **Sybil Orders** | Rate limiting; stake-based order submission |
| **Griefing (Submit & Cancel)** | Cancellation fee; time-lock on orders |

### Order Book Manipulation Prevention

The circuit design addresses manipulation through several mechanisms:

**1. Uniform Clearing Price**
- All matched orders execute at the same clearing price
- Prevents price discrimination or layering attacks
- Manipulation attempts affect all participants equally

**2. Commitment Binding**
- Orders are committed before the matching round
- Cannot see other orders before committing
- Prevents reactive order placement

**3. Provable Optimality**
- Matching engine must prove the clearing price maximizes volume
- Suboptimal matching (favoring certain orders) is detectable
- Anyone can verify matching quality off-chain

**4. Decentralized Matching**
- Multiple entities can compete to be the matcher
- If one matcher produces suboptimal match, another can challenge
- Economic incentive to produce optimal matches

**5. Time-Priority Extensions**
For implementations requiring price-time priority:
```
// Add timestamp to order commitment
bidHash.inputs[6] <== bidTimestamp[i];

// Verify earlier timestamps filled first at same price
// (Requires sorting proof - significantly increases constraints)
```

## Implementation Challenges

1. **Optimal Matching Algorithm**
   - Finding maximum volume clearing price is O(n log n) off-chain
   - Circuit only verifies, doesn't compute
   - Need efficient witness generation for matching

2. **Price-Time Priority in ZK**
   - Proving correct priority ordering adds ~200K constraints
   - Alternative: batch auctions where all orders are equal
   - Trade-off between fairness model and circuit complexity

3. **Partial Fills**
   - Current design supports partial fills naturally
   - Need mechanism for residual order tracking
   - Consider order-splitting vs. continuous matching

4. **Order Cancellation**
   - How to cancel committed order before matching?
   - Need separate cancellation proof or timeout
   - Balance between flexibility and griefing prevention

5. **Scalability**
   - 32 bids + 32 asks = ~1M constraints
   - Larger books need hierarchical matching
   - Consider batched matching with carry-over orders

6. **MEV in Proof Submission**
   - Who submits the proof? They see the match result
   - Encrypt match result until on-chain
   - Or use commit-reveal for proof submission

## Use Cases

1. **Institutional Dark Pool**
   - Match 32 bids against 32 asks without revealing order details
   - Only clearing price and volume are public
   - Regulatory-compliant verifiable execution

2. **DEX Batch Auctions**
   - Collect orders for fixed time window
   - Match at uniform clearing price
   - Eliminates front-running entirely

3. **RFQ (Request for Quote) Markets**
   - Multiple market makers submit quotes
   - Best quote selected provably
   - Taker doesn't reveal size until match

4. **Primary Market Issuance**
   - Book-building for token sales
   - Fair price discovery without manipulation
   - All participants treated equally

5. **Cross-Exchange Matching**
   - Aggregate order books from multiple venues
   - Match across exchanges atomically
   - Best execution proof for regulators

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/high-complexity/hc3-private-order-book-match-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
