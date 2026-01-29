# A3. Stop-Loss Order

Automatic execution when price drops below threshold, enabling risk management without exposing position details.

**Constraints**: ~150K | **Complexity**: Low

---

## Background

Stop-loss orders are fundamental to responsible trading and risk management:

- **Automated Protection**: Traders cannot monitor markets 24/7; automated loss limits are essential
- **Emotional Discipline**: Pre-committed exits prevent panic selling at worse prices or holding through catastrophic losses
- **Position Sizing**: Risk management requires known maximum loss per trade
- **Privacy Preservation**: Manual stop-loss execution reveals trigger prices to market observers
- **MEV Protection**: Hidden trigger prices prevent front-running and stop-hunting by MEV searchers

In traditional finance, stop-loss orders are standard risk management tools. In DeFi, most implementations are transparent, enabling sophisticated actors to trigger stop-losses for profit (stop-hunting). ZK stop-loss orders hide the trigger price until execution.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the note being protected |
| `outputHash` | field | Hash of the output note after execution |
| `triggerPrice` | uint | Price at or below which order executes |
| `currentPrice` | uint | Oracle-provided current market price |
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
| `outToken` | uint | Output token type (typically stablecoin) |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template StopLoss() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input triggerPrice;
    signal input currentPrice;
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

    // ===== 3. Price Condition: currentPrice <= triggerPrice =====
    component priceCheck = LessEqThan(64);
    priceCheck.in[0] <== currentPrice;
    priceCheck.in[1] <== triggerPrice;
    priceCheck.out === 1;

    // ===== 4. Value Calculation =====
    // Output value = input value * currentPrice / PRICE_PRECISION
    // This ensures user receives fair value at execution price
    signal expectedMinOutput;
    expectedMinOutput <== value * currentPrice;

    // Output must be at least expected value (minus small slippage tolerance)
    component outputCheck = GreaterEqThan(128);
    outputCheck.in[0] <== outValue * 1000000 + 1000000;  // PRICE_PRECISION + tolerance
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

    // ===== 6. Output Token Validation =====
    // Ensure output is different token (actual swap occurred)
    component tokenDiff = IsZero();
    tokenDiff.in <== tokenType - outToken;
    tokenDiff.out === 0;  // Must be different tokens
}

component main {public [noteHash, outputHash, triggerPrice, currentPrice, tokenType]} =
    StopLoss();
```

### Key Constraints

1. **Ownership Verification**: Only note owner can create stop-loss order
2. **Price Trigger**: `currentPrice <= triggerPrice` must hold for execution
3. **Minimum Output**: Output value must meet expected conversion at current price
4. **Note Format Compliance**: Both input and output notes follow standard format
5. **Token Swap**: Output must be different token type (preventing no-op)

## Effects

| Aspect | Impact |
|--------|--------|
| **Risk Management** | Automated loss protection with defined limits |
| **Privacy** | Trigger price hidden until execution |
| **UX** | Set-and-forget position protection |
| **MEV Protection** | Stop-hunting becomes unprofitable |
| **Capital Preservation** | Prevents catastrophic losses |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP, multiple oracle sources, or commit-reveal schemes |
| **Stale Price Data** | Include timestamp validation; reject execution if price data too old |
| **Flash Loan Attacks** | TWAP oracles resist single-block manipulation |
| **Stop Hunting** | Trigger price hidden; attackers cannot profitably target stops |
| **Execution Griefing** | Require executor bond; refund on successful execution |
| **Replay Attack** | Nullifier prevents double-spend of source note |

## Implementation Challenges

1. **Oracle Integration**
   - Need reliable, manipulation-resistant price feeds
   - Chainlink, Uniswap V3 TWAP, or multiple sources
   - Price precision and scaling must be standardized
   - Consider oracle latency vs. execution speed tradeoffs

2. **Execution Incentives**
   - Who monitors prices and submits proofs when triggered?
   - Executor reward mechanism (small percentage of output)
   - Integration with keeper networks (Gelato, Chainlink Automation)
   - Gas cost recovery for executors

3. **Slippage Protection**
   - Market may gap through trigger price
   - Consider maximum slippage parameter
   - Fallback to limit order if slippage exceeded

4. **Order Cancellation**
   - Users need ability to cancel before trigger
   - Cancellation proof nullifies order without execution
   - Consider time-locked cancellation to prevent abuse

5. **Multi-Trigger Scenarios**
   - Price may oscillate around trigger
   - First valid execution consumes order
   - Consider cooldown periods for re-entry

## Derivatives

1. **Trailing Stop-Loss** - Stop price automatically adjusts upward as market rises, locking in gains while allowing further upside. Requires tracking highest price since order creation. Circuit includes high-water mark commitment and adjustment percentage.

2. **Conditional Stop with Time Decay** - Stop price tightens over time to force earlier exit if price stagnates. Useful for options-like strategies where time value matters. Adds timestamp-based trigger adjustment calculation.

3. **Multi-Asset Stop Cascade** - Single trigger liquidates multiple correlated positions simultaneously. When BTC stop triggers, ETH and other correlated assets also exit. Batched execution with combined proof reduces gas costs.

4. **Stop-Loss with Partial Exit** - Progressive exit as price drops through multiple trigger levels. Sell 25% at -5%, another 25% at -10%, etc. Combines stop-loss with partial fill for controlled position reduction.

5. **Guaranteed Stop-Loss (Oracle-Backed)** - Insurance-like product where oracle provider guarantees execution at trigger price regardless of slippage. Premium paid upfront compensates oracle for gap risk. Circuit includes insurance commitment verification.

## Use Cases

1. **Position Protection**
   - Trader buys ETH at $2000, sets stop-loss at $1800
   - Maximum loss limited to 10% regardless of market crash
   - Can sleep peacefully knowing worst case is defined
   - No need to monitor charts constantly

2. **Profit Protection**
   - Trade already profitable; ETH now at $2500 from $2000 entry
   - Move stop-loss to $2200 to lock in minimum 10% profit
   - If market reverses, profit secured automatically
   - Allows position to run while guaranteeing gains

3. **Portfolio Risk Management**
   - Investment portfolio across 10 different tokens
   - Each position has individual stop-loss at -15%
   - Total portfolio drawdown limited regardless of which asset crashes
   - Automated rebalancing as stops execute

4. **Leveraged Position Management**
   - Borrowed against collateral for leveraged position
   - Stop-loss prevents liquidation cascade
   - Exit at 80% of liquidation price gives safety buffer
   - Preserves credit rating and prevents forced selling

## Real-World Products & User Experience

See dedicated product documentation: [Product Applications](../../../product/a-core-trading/a3-stop-loss-products.md)

---

[Back to Index](../../README.md)
