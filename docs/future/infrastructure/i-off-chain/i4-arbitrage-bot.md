# I4. Arbitrage Bot

Privacy-preserving arbitrage infrastructure that hides trading strategies, execution logic, and profits from competitors and observers.

**Requirements**: Strategy encryption | Private execution paths | MEV protection | Profit obfuscation

---

## Background

Arbitrage trading in DeFi faces unique privacy challenges:

- **Strategy Visibility**: On-chain execution reveals profitable strategies instantly
- **Competition**: Visible alpha attracts copycats within blocks
- **MEV Extraction**: Searchers front-run detected arbitrage opportunities
- **Profit Transparency**: All gains visible; tax and competitive implications

Private arbitrage infrastructure addresses these by:
- Hiding strategy logic and parameters
- Executing through privacy-preserving channels
- Protecting against MEV through encryption
- Obscuring profit accumulation

For ZK-DEX, this enables sophisticated trading strategies with protected intellectual property.

## Technical Specification

### Architecture Overview

```
Market Data                   Arbitrage Engine                  Execution Layer
+------------+                +------------------------+        +-------------+
|            |  Private       |                        |        |             |
| DEX 1      |  Price Feed    |  Strategy Module       |        | Flashbots   |
|            |--------------->|  (encrypted logic)     |------->| Protect     |
+------------+                |         |              |        +-------------+
|            |  Private       |         v              |        |             |
| DEX 2      |  Price Feed    |  +----------------+   |        | Private     |
|            |--------------->|  | Opportunity    |   |------->| Mempool     |
+------------+                |  | Detector       |   |        +-------------+
|            |  Private       |  +----------------+   |        |             |
| DEX 3      |  Price Feed    |         |             |        | ZK-DEX      |
|            |--------------->|         v             |------->| Settlement  |
+------------+                |  Execution Router     |        +-------------+
                              |  (hidden paths)       |
                              +------------------------+
                                       |
                                       v
                              +------------------------+
                              |  Profit Vault          |
                              |  (private accounting)  |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Price Aggregator** | Collects prices privately from multiple sources |
| **Strategy Engine** | Encrypted arbitrage logic and parameters |
| **Opportunity Detector** | Identifies profitable trades privately |
| **Execution Router** | Selects optimal execution path |
| **MEV Shield** | Protects transactions from front-running |
| **Profit Vault** | Accumulates gains in private notes |

### Data Flows

1. **Price Monitoring**
   - Collect prices from multiple DEXs privately
   - Normalize and compare across venues
   - Identify price discrepancies

2. **Opportunity Evaluation**
   - Calculate potential profit including costs
   - Assess execution risk and slippage
   - Decide execution based on private thresholds

3. **Private Execution**
   - Route through privacy-preserving channels
   - Submit encrypted transactions
   - Settle profits to private vault

### Arbitrage Proof Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/comparators.circom";

template ArbitrageExecution() {
    // Public inputs
    signal input executionHash;      // Commitment to execution
    signal input profitCommitment;   // Hidden profit amount
    signal input nullifier;          // Prevents double-counting

    // Private inputs
    signal input buyVenue;           // Where to buy (hidden)
    signal input sellVenue;          // Where to sell (hidden)
    signal input buyPrice;           // Purchase price
    signal input sellPrice;          // Sale price
    signal input amount;             // Trade size
    signal input gasCost;            // Execution gas
    signal input profit;             // Net profit
    signal input salt;

    // Verify profit calculation
    signal grossProfit;
    grossProfit <== (sellPrice - buyPrice) * amount;

    signal netProfit;
    netProfit <== grossProfit - gasCost;

    // Verify claimed profit matches calculation
    profit === netProfit;

    // Verify execution commitment
    component execHash = Poseidon(6);
    execHash.inputs[0] <== buyVenue;
    execHash.inputs[1] <== sellVenue;
    execHash.inputs[2] <== buyPrice;
    execHash.inputs[3] <== sellPrice;
    execHash.inputs[4] <== amount;
    execHash.inputs[5] <== salt;
    execHash.out === executionHash;

    // Verify profit commitment
    component profitHash = Poseidon(2);
    profitHash.inputs[0] <== profit;
    profitHash.inputs[1] <== salt;
    profitHash.out === profitCommitment;
}

component main {public [executionHash, profitCommitment, nullifier]} = ArbitrageExecution();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Strategy Privacy** | Trading logic hidden from competitors |
| **Profit Privacy** | Accumulated gains not visible on-chain |
| **MEV Protection** | Front-running prevented through encryption |
| **Competitive Moat** | Alpha preserved; not copied immediately |
| **Tax Privacy** | Gains not easily traced; privacy preserved |
| **Market Efficiency** | Arbitrage still provides price convergence |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Strategy Leakage** | Encrypted execution; trusted compute environments |
| **Execution Failure** | Atomic transactions; automatic fallback |
| **Capital Lock-up** | Time-bounded operations; emergency withdrawal |
| **Price Manipulation** | Multiple price sources; manipulation detection |
| **Infrastructure Attacks** | Redundant systems; decentralized execution |
| **Insider Trading** | Separation of strategy and execution teams |

## Implementation Challenges

1. **Latency vs. Privacy**
   - Privacy adds computational overhead
   - Arbitrage rewards speed
   - Need optimized privacy primitives

2. **Multi-Venue Coordination**
   - Atomic execution across venues is difficult
   - Non-atomic risks partial execution
   - Consider HTLC-style coordination

3. **Gas Price Uncertainty**
   - Gas costs affect profitability
   - Need dynamic gas estimation
   - Consider gas price hedging

4. **Capital Efficiency**
   - Privacy may require pre-positioned capital
   - Flash loans partially solve but are visible
   - Private flash loan protocols needed

5. **Strategy Complexity**
   - Simple arbitrage saturated
   - Complex strategies need sophisticated infrastructure
   - Balance complexity with execution speed

## Derivatives

1. **DEX Aggregation** - Find best execution across multiple DEXs privately. Route trades for optimal pricing. Hide routing strategy from competitors.

2. **Cross-Chain Arb** - Arbitrage across different blockchains. Use private bridges and messaging. Higher complexity; higher alpha potential.

3. **Liquidation Bots** - Private liquidation detection and execution. Capture liquidation bonuses privately. Hide liquidation strategy.

4. **MEV Extraction** - Private MEV strategies beyond simple arbitrage. Sandwich protection through encryption. Ethical MEV extraction.

5. **Statistical Arbitrage** - Long-term statistical relationships privately. Mean reversion strategies hidden. More sustainable alpha.

## Use Cases

1. **DEX-to-DEX Arbitrage**
   - Price difference between Uniswap and ZK-DEX
   - Bot detects opportunity privately
   - Executes through private channels
   - Profit accumulated in private vault

2. **CEX-DEX Arbitrage**
   - Price differs between Binance and on-chain DEX
   - Bot coordinates trades privately
   - Settlement on ZK-DEX hides DEX-side profits
   - Strategy not visible to competitors

3. **Liquidation Capture**
   - Under-collateralized position detected
   - Liquidation executed privately
   - Bonus captured without revealing monitoring
   - Sustainable liquidation bot operation

4. **Flash Loan Arbitrage**
   - Zero-capital arbitrage opportunity
   - Flash loan execution through private relay
   - Profit hidden from observers
   - Strategy protected from copying


## Real-World Products & User Experience

See: [../../product/i-off-chain/i4-arbitrage-bot-products.md](../../product/i-off-chain/i4-arbitrage-bot-products.md)

---

[Back to Index](../../README.md)
