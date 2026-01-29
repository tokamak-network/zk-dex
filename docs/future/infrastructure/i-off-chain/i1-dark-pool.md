# I1. Dark Pool Matching

Privacy-preserving order matching engine using secure multi-party computation (MPC) to enable large trades without information leakage.

**Requirements**: MPC infrastructure | Encrypted order submission | Threshold decryption | Settlement integration

---

## Background

Large orders face significant execution challenges in transparent markets:

- **Market Impact**: Visible large orders move prices against the trader before execution
- **Front-Running**: MEV extractors copy or front-run detected large trades
- **Information Leakage**: Order flow reveals trading intentions to competitors
- **Predatory Trading**: Sophisticated actors exploit predictable large order behavior

Dark pools address these challenges by:
- Hiding order details until after matching
- Matching orders without revealing individual intentions
- Executing at mid-market prices to ensure fairness
- Preventing information-based trading advantages

For ZK-DEX, dark pool matching enables institutional-grade execution for large orders.

## Technical Specification

### Architecture Overview

```
Traders                        MPC Matching Engine                Settlement
+--------+                     +------------------------+         +---------+
|        |  Encrypted Order    |                        |         |         |
|Trader A|-------------------->|  MPC Node 1            |         | ZK-DEX  |
|        |                     |  MPC Node 2            |  Match  | Smart   |
+--------+                     |  MPC Node 3            |-------->|Contract |
|        |  Encrypted Order    |         |              |         |         |
|Trader B|-------------------->|         v              |         +---------+
|        |                     |  +----------------+    |
+--------+                     |  | Secure Match   |    |
                               |  | Computation    |    |
                               |  +----------------+    |
                               |         |              |
                               |         v              |
                               |  Match Result          |
                               |  (no order details)    |
                               +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Order Encryption** | Encrypts orders for MPC threshold decryption |
| **MPC Nodes** | Distributed nodes performing secure matching computation |
| **Matching Protocol** | Price-time priority matching over encrypted orders |
| **Settlement Bridge** | Connects matched orders to ZK-DEX for execution |
| **Fairness Verifier** | Ensures matching followed stated rules |
| **Audit Trail** | Privacy-preserving record for compliance |

### Data Flows

1. **Order Submission**
   - Trader encrypts order (price, size, direction) with threshold encryption
   - Encrypted order submitted to MPC network
   - Order acknowledged; trader receives commitment

2. **Matching Phase**
   - MPC nodes jointly compute order matching
   - No single node learns order details
   - Crossed orders identified without revealing uncrossed

3. **Settlement Phase**
   - Matched orders decrypted for settlement
   - Unmatched orders remain encrypted
   - ZK-DEX settles trades atomically

### MPC Matching Protocol

```
Protocol: Secure Order Matching (simplified)

Setup:
- N MPC nodes, threshold T (e.g., 3-of-5)
- Each order encrypted with threshold scheme

Matching Round:
1. Each node receives share of encrypted orders
2. Nodes jointly compute crossing logic:
   - Sort buy orders descending by price
   - Sort sell orders ascending by price
   - Find intersection point
3. Output: List of matched pairs (no prices revealed for unmatched)

Security Properties:
- T-1 colluding nodes learn nothing
- Matched orders revealed only to counterparties
- Unmatched orders remain fully private
```

### Order Commitment Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template DarkPoolOrder() {
    // Public inputs
    signal input orderCommitment;    // Commitment to order
    signal input nullifier;          // Prevents double-submission
    signal input traderCommitment;   // Hidden trader identity

    // Private inputs
    signal input price;              // Limit price (hidden)
    signal input amount;             // Order size (hidden)
    signal input side;               // Buy(1) or Sell(0)
    signal input traderPk;           // Trader public key
    signal input salt;               // Randomness

    // Verify order commitment
    component orderHash = Poseidon(5);
    orderHash.inputs[0] <== price;
    orderHash.inputs[1] <== amount;
    orderHash.inputs[2] <== side;
    orderHash.inputs[3] <== traderPk;
    orderHash.inputs[4] <== salt;
    orderHash.out === orderCommitment;

    // Verify trader commitment
    component traderHash = Poseidon(2);
    traderHash.inputs[0] <== traderPk;
    traderHash.inputs[1] <== salt;
    traderHash.out === traderCommitment;

    // Verify side is valid (0 or 1)
    side * (1 - side) === 0;
}

component main {public [orderCommitment, nullifier, traderCommitment]} = DarkPoolOrder();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Market Impact** | Eliminated; orders hidden until settlement |
| **Information Leakage** | Zero knowledge of unmatched orders |
| **Execution Quality** | Mid-market pricing ensures fairness |
| **MEV Protection** | Orders invisible to searchers |
| **Price Discovery** | Preserved through crossing mechanism |
| **Institutional Access** | Enables large order execution |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **MPC Node Collusion** | Threshold security; diverse node operators |
| **Order Replay** | Nullifier tracking; timestamps |
| **Timing Attacks** | Batched matching rounds; randomized timing |
| **Denial of Service** | Rate limiting; deposit requirements |
| **Settlement Failure** | Atomic settlement; timeout refunds |
| **Operator Front-Running** | Threshold decryption; no single operator sees orders |

## Implementation Challenges

1. **MPC Performance**
   - Secure computation is slower than plaintext
   - Large order books require efficient protocols
   - Consider optimized MPC frameworks (MP-SPDZ, SCALE-MAMBA)

2. **Node Coordination**
   - Distributed nodes must agree on matching rounds
   - Network partitions can delay matching
   - Byzantine fault tolerance needed

3. **Fairness Verification**
   - Users must trust matching was fair
   - Consider ZK proofs of correct matching
   - Audit mechanisms without revealing orders

4. **Liquidity Fragmentation**
   - Dark pool separate from lit market
   - Need critical mass for effective matching
   - Consider hybrid lit/dark execution

5. **Regulatory Compliance**
   - Dark pools face regulatory scrutiny
   - Need selective disclosure for regulators
   - Audit trail without breaking privacy

## Derivatives

1. **Size-Based Matching** - Minimum order sizes for dark pool access. Prevents information leakage from small probing orders. Tiered access based on trade size.

2. **Time-Priority Matching** - Orders matched in submission time order at crossing price. Fair treatment of all participants. Prevents time-based gaming.

3. **Price Improvement** - Matched orders execute at mid-market rather than limit. Both sides benefit from spread savings. Incentivizes dark pool usage.

4. **Block Trading** - Scheduled matching sessions for very large orders. Aggregated liquidity at specific times. Reduces market impact of mega-orders.

5. **Iceberg Orders** - Show small portion; hide full size. Executes in tranches without revealing total. Mimics traditional iceberg functionality privately.

## Use Cases

1. **Institutional Portfolio Rebalancing**
   - Fund needs to sell $10M of ETH
   - Open market execution would move price 2-3%
   - Dark pool matches against buyer seeking ETH
   - Both execute at mid-market; zero market impact

2. **Treasury Management**
   - Protocol treasury diversifying holdings
   - Public sales would signal lack of confidence
   - Dark pool enables private diversification
   - Market never sees selling pressure

3. **Merger Arbitrage**
   - Arbitrageur accumulating position in target company
   - Visible buying would alert market
   - Dark pool hides accumulation strategy
   - Position built without signaling

4. **Index Fund Rebalancing**
   - Index reconstitution requires large trades
   - Predictable trades exploited by traders
   - Dark pool execution hides rebalancing
   - Better execution for fund holders


## Real-World Products & User Experience

See: [../../../product/i-off-chain/i1-dark-pool-products.md](../../../product/i-off-chain/i1-dark-pool-products.md)

---

[Back to Index](../../README.md)
