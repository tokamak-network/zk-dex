# A4. Take-Profit Order

Automatic execution when price rises above threshold, enabling profit realization without constant monitoring.

**Constraints**: ~150K | **Complexity**: Low

---

## Background

Take-profit orders are essential for effective trading strategies:

- **Discipline Enforcement**: Prevents emotional trading and ensures systematic profit-taking
- **Continuous Monitoring Impossible**: Traders cannot watch markets 24/7; automation is essential
- **Privacy Leak Prevention**: Manual exits at target prices reveal trading strategies
- **MEV Protection**: Pre-committed triggers prevent front-running of predictable exits

In traditional finance, take-profit orders are standard. In DeFi, most implementations are transparent, exposing trader intentions. ZK take-profit orders hide the target price until execution.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the note being sold |
| `outputHash` | field | Hash of the output note (in different token) |
| `targetPrice` | uint | Minimum price for execution (hidden until triggered) |
| `currentPrice` | uint | Oracle-provided current price |
| `tokenType` | uint | Token type being sold |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key |
| `value` | uint | Note value |
| `salt` | field | Note randomness |
| `sk` | field | Secret key for ownership proof |
| `outPkX, outPkY` | field | Output note owner (can be same or different) |
| `outValue` | uint | Output value after conversion |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template TakeProfit() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input targetPrice;      // Minimum acceptable price
    signal input currentPrice;     // From oracle
    signal input tokenType;

    // ===== Private Inputs =====
    signal input pkX, pkY, value, salt, sk;
    signal input outPkX, outPkY, outValue, outToken, outSalt;

    // ===== 1. Verify Input Note =====
    component inputNote = PoseidonRegularNote();
    inputNote.pkX <== pkX;
    inputNote.pkY <== pkY;
    inputNote.value <== value;
    inputNote.tokenType <== tokenType;
    inputNote.salt <== salt;
    inputNote.out === noteHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 3. Price Condition: currentPrice >= targetPrice =====
    component priceCheck = GreaterEqThan(64);
    priceCheck.in[0] <== currentPrice;
    priceCheck.in[1] <== targetPrice;
    priceCheck.out === 1;

    // ===== 4. Value Calculation (price * quantity) =====
    // outValue should equal value * currentPrice / PRICE_PRECISION
    // This is verified off-chain; circuit only checks bounds
    signal expectedMinOutput;
    expectedMinOutput <== value * targetPrice;

    component outputCheck = GreaterEqThan(128);
    outputCheck.in[0] <== outValue * 1000000;  // PRICE_PRECISION
    outputCheck.in[1] <== expectedMinOutput;
    outputCheck.out === 1;

    // ===== 5. Verify Output Note =====
    component outputNote = PoseidonRegularNote();
    outputNote.pkX <== outPkX;
    outputNote.pkY <== outPkY;
    outputNote.value <== outValue;
    outputNote.tokenType <== outToken;
    outputNote.salt <== outSalt;
    outputNote.out === outputHash;
}

component main {public [noteHash, outputHash, targetPrice, currentPrice, tokenType]} =
    TakeProfit();
```

### Key Constraints

1. **Ownership Verification**: Only note owner can create take-profit order
2. **Price Threshold**: `currentPrice >= targetPrice` must hold
3. **Minimum Output**: Output value must meet expected conversion at target price
4. **Note Format Compliance**: Both input and output notes follow standard format

## Effects

| Aspect | Impact |
|--------|--------|
| **Profit Capture** | Automated profit realization at optimal levels |
| **Capital Efficiency** | Funds auto-rotate to quote currency |
| **Privacy** | Target price hidden until execution |
| **MEV Protection** | Execution parameters unpredictable to searchers |
| **Gas Efficiency** | Single proof vs. monitoring + manual execution |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP, multiple oracle sources, or commit-reveal |
| **Stale Price** | Include timestamp check; reject if price too old |
| **Execution Griefing** | Require executor bond; refund on successful execution |
| **Front-running** | Price already triggered means execution is valid regardless |
| **Replay Attack** | Nullifier prevents double-spend of source note |

## Implementation Challenges

1. **Oracle Integration**
   - Need reliable, manipulation-resistant price feeds
   - Consider Chainlink, Uniswap TWAP, or multiple sources
   - Price precision and scaling must be standardized

2. **Execution Incentives**
   - Who monitors prices and submits proofs?
   - Executor reward mechanism needed (small fee from output)
   - Keeper network integration (Gelato, Chainlink Keepers)

3. **Partial Fills**
   - Current design is all-or-nothing
   - Consider extension for partial execution at different price levels

4. **Gas Costs on Trigger**
   - Proof verification cost (~200K gas) may exceed profit on small orders
   - Batch execution could amortize costs

## Derivatives

1. **Trailing Take-Profit** - Target price moves up with market, locks in gains while allowing further upside. Requires historical price tracking in circuit.

2. **Scaled Take-Profit** - Multiple target levels (e.g., sell 25% at 2x, 25% at 3x, 50% at 5x). Single proof commits to multiple output notes.

3. **Time-Weighted Take-Profit** - Target price increases over time to compensate for opportunity cost. Adds timestamp-based price adjustment.

4. **Take-Profit with Reinvestment** - Output automatically enters new position (e.g., sell ETH for USDC, then LP into pool). Atomic multi-step execution.

5. **Percentage-Based Take-Profit** - Target specified as +X% from entry price rather than absolute value. Requires entry price commitment.

## Use Cases

1. **Swing Trading**
   - Buy token at $100, set take-profit at $150
   - Walk away; order executes automatically when target reached
   - No information leakage about exit strategy

2. **DCA Exit Strategy**
   - Investor accumulated position over time
   - Sets multiple take-profit levels to gradually exit
   - Reduces market impact of large exits

3. **Arbitrage Protection**
   - Bot identifies arbitrage opportunity
   - Sets take-profit to lock in profit if price moves favorably
   - Limits downside if market reverses

4. **Institutional Execution**
   - Fund needs to exit large position
   - Take-profit orders at various levels avoid single-point-of-failure
   - Privacy prevents market from front-running institutional flows

## Real-World Products & User Experience

See dedicated product documentation: [Product Applications](../../product/a-core-trading/a4-take-profit-products.md)

---

[Back to Index](../../README.md)
