# I2. RFQ System

Request-for-quote infrastructure enabling customized pricing through off-chain negotiation with privacy-preserving on-chain settlement.

**Requirements**: Encrypted RFQ broadcast | Dealer quote aggregation | Best execution selection | ZK settlement proofs

---

## Background

Standard order book trading is inefficient for many trade types:

- **Large Orders**: Market orders cause excessive slippage; limit orders signal intentions
- **Exotic Pairs**: Illiquid markets have wide spreads and poor execution
- **Custom Terms**: Non-standard settlement, partial fills, or conditions not supported
- **Relationship Value**: Institutional traders value dealer relationships invisible in anonymous markets

RFQ (Request-for-Quote) systems address these by:
- Allowing traders to request customized quotes from multiple dealers
- Enabling competition among market makers for best pricing
- Supporting negotiation without public information leakage
- Preserving privacy while ensuring best execution

For ZK-DEX, RFQ enables sophisticated trading with privacy-preserving settlement.

## Technical Specification

### Architecture Overview

```
Requester                     RFQ Network                       Dealers
+--------+                    +------------------+               +--------+
|        |  Encrypted RFQ     |                  |  Broadcast    |        |
|Trader  |------------------>|  RFQ             |-------------->|Dealer 1|
|        |                    |  Aggregator      |               |        |
+--------+                    |                  |               +--------+
    ^                         |  +------------+  |               |        |
    |                         |  | Quote      |  |  Quote        |Dealer 2|
    |                         |  | Collector  |<----------------|        |
    |                         |  +------------+  |               +--------+
    |    Best Quote           |        |         |               |        |
    |<------------------------|        v         |  Quote        |Dealer 3|
    |                         |  Best Execution  |<--------------|        |
    |                         |  Selection       |               +--------+
    v                         +------------------+
+--------+
|ZK-DEX  |  Settlement
|Settle  |<------------------
+--------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **RFQ Broadcaster** | Distributes encrypted RFQ to qualified dealers |
| **Quote Aggregator** | Collects and compares dealer quotes |
| **Best Execution Engine** | Selects optimal quote based on criteria |
| **Quote Commitment** | ZK proof that quote was valid at submission |
| **Settlement Contract** | Executes trade at quoted terms |
| **Dealer Registry** | Tracks authorized market makers and reputation |

### Data Flows

1. **RFQ Broadcast**
   - Trader creates RFQ: asset pair, size, direction, terms
   - RFQ encrypted to authorized dealers only
   - Dealers see RFQ; market does not

2. **Quote Collection**
   - Dealers respond with binding quotes
   - Quotes committed with ZK proof of terms
   - Aggregator collects quotes within time window

3. **Selection & Settlement**
   - Trader selects best quote (or auto-selects)
   - Selected quote revealed for settlement
   - Trade executes on ZK-DEX atomically

### RFQ Protocol Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/signatures/eddsa.circom";

template RFQQuote() {
    // Public inputs
    signal input quoteCommitment;    // Commitment to dealer quote
    signal input rfqHash;            // Reference to original RFQ
    signal input dealerCommitment;   // Hidden dealer identity
    signal input expiry;             // Quote expiration time

    // Private inputs
    signal input price;              // Quoted price (hidden until accepted)
    signal input size;               // Maximum fillable size
    signal input dealerPk;           // Dealer public key
    signal input dealerSk;           // Dealer signature key
    signal input salt;               // Randomness

    // Verify quote commitment
    component quoteHash = Poseidon(5);
    quoteHash.inputs[0] <== price;
    quoteHash.inputs[1] <== size;
    quoteHash.inputs[2] <== rfqHash;
    quoteHash.inputs[3] <== expiry;
    quoteHash.inputs[4] <== salt;
    quoteHash.out === quoteCommitment;

    // Verify dealer commitment
    component dealerHash = Poseidon(2);
    dealerHash.inputs[0] <== dealerPk;
    dealerHash.inputs[1] <== salt;
    dealerHash.out === dealerCommitment;

    // Signature verification for binding quote
    // (simplified - full EdDSA verification would be here)
}

component main {public [quoteCommitment, rfqHash, dealerCommitment, expiry]} = RFQQuote();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Price Discovery** | Competitive quotes reveal fair market price |
| **Execution Quality** | Best-of-N quotes ensures optimal pricing |
| **Privacy** | RFQ details hidden from general market |
| **Customization** | Non-standard terms negotiable off-chain |
| **Market Impact** | Zero leakage until trade settles |
| **Dealer Competition** | Multiple quotes ensure tight spreads |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Quote Shopping** | Quotes are binding; penalize non-execution |
| **Information Leakage** | Encrypted RFQ; authorized dealers only |
| **Last Look Abuse** | Eliminate or time-bound last look window |
| **Dealer Collusion** | Reputation tracking; diverse dealer set |
| **Quote Stuffing** | Rate limiting; dealer bonds |
| **Settlement Failure** | Atomic settlement; collateral requirements |

## Implementation Challenges

1. **Dealer Authorization**
   - Which dealers receive RFQs?
   - Balance between competition and information leakage
   - Consider reputation-based tiering

2. **Quote Validity**
   - Markets move during RFQ process
   - Quotes must be time-bounded
   - Consider streaming quotes for volatile markets

3. **Last Look Controversy**
   - Dealers may want option to reject after seeing acceptance
   - Trader disadvantage; potential for abuse
   - ZK commitments make last look cryptographically bounded

4. **Partial Fills**
   - Dealer may not have full size
   - Need protocol for partial execution
   - Consider aggregating across dealers

5. **Latency Fairness**
   - Faster dealers see RFQ first
   - Need fair distribution mechanism
   - Consider batch reveal of RFQs

## Derivatives

1. **Multi-Dealer RFQ** - Simultaneous quotes from multiple dealers. Best price wins automatically. Dealers compete without seeing each other's quotes.

2. **Streaming Quotes** - Dealers provide continuous quote updates. Real-time pricing for volatile markets. Auto-execution when spread tightens.

3. **Last Look** - Optional dealer review before final execution. Time-bounded to prevent abuse. Configurable by requester (affects spread).

4. **Voice Trading Integration** - Hybrid RFQ with traditional voice negotiation. Complex terms discussed off-system. Settlement on ZK-DEX for privacy.

5. **RFQ Aggregation** - Combine multiple small RFQs into single dealer query. Better pricing through size aggregation. Coordinated settlement.

## Use Cases

1. **Large Block Trade**
   - Trader needs to buy $5M of illiquid token
   - Order book has only $500K visible liquidity
   - RFQ to dealers finds $5M at 0.5% premium
   - Single execution vs. multi-day accumulation

2. **Custom Settlement Terms**
   - Trader wants T+2 settlement instead of instant
   - Standard DEX doesn't support delayed settlement
   - RFQ negotiates terms with dealer
   - Settlement contract enforces agreed terms

3. **Cross-Asset Package**
   - Fund rebalancing requires selling A and buying B
   - Wants single quote for package to avoid slippage
   - Dealer quotes spread for combined trade
   - Atomic execution of both legs

4. **Illiquid Market Making**
   - New token with no order book liquidity
   - Traders use RFQ to find willing counterparties
   - Dealers provide liquidity without continuous quotes
   - Market develops through bilateral trades


## Real-World Products & User Experience

See: [../../product/i-off-chain/i2-rfq-products.md](../../product/i-off-chain/i2-rfq-products.md)

---

[Back to Index](../../README.md)
