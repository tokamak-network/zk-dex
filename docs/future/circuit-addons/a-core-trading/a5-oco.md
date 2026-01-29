# A5. OCO Order (One-Cancels-Other)

Combined stop-loss and take-profit in a single order where triggering one automatically cancels the other.

**Constraints**: ~180K | **Complexity**: Low

---

## Background

OCO orders are essential for complete position management:

- **Dual Protection**: Traders need both downside protection (stop-loss) and upside capture (take-profit) simultaneously
- **Capital Lock Prevention**: Without OCO, capital is locked in two separate orders; only one can ever execute
- **Bracket Trading**: Professional traders use OCO to define complete risk/reward parameters before entry
- **Automated Strategy**: Set-and-forget approach eliminates need for constant monitoring
- **Contradiction Prevention**: Manually managing separate orders risks both executing in volatile markets

In traditional finance, OCO (also called bracket orders) is standard. Current DeFi implementations rarely support atomic OCO, forcing users to manage orders separately with associated risks.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the note being traded |
| `outputHash` | field | Hash of the output note after execution |
| `stopLossPrice` | uint | Price at or below which stop-loss triggers |
| `takeProfitPrice` | uint | Price at or above which take-profit triggers |
| `currentPrice` | uint | Oracle-provided current market price |
| `tokenType` | uint | Token type being sold |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key |
| `value` | uint | Note value |
| `salt` | field | Note randomness |
| `sk` | field | Secret key for ownership proof |
| `outPkX, outPkY` | field | Output note owner |
| `outValue` | uint | Output value after conversion |
| `outToken` | uint | Output token type |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template OCOOrder() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input stopLossPrice;
    signal input takeProfitPrice;
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

    // ===== 3. Price Bounds Validation =====
    // stopLossPrice must be < takeProfitPrice (valid bracket)
    component boundsCheck = LessThan(64);
    boundsCheck.in[0] <== stopLossPrice;
    boundsCheck.in[1] <== takeProfitPrice;
    boundsCheck.out === 1;

    // ===== 4. Condition Check: Either Stop-Loss OR Take-Profit =====
    // Stop-Loss: currentPrice <= stopLossPrice
    component stopCheck = LessEqThan(64);
    stopCheck.in[0] <== currentPrice;
    stopCheck.in[1] <== stopLossPrice;

    // Take-Profit: currentPrice >= takeProfitPrice
    component profitCheck = GreaterEqThan(64);
    profitCheck.in[0] <== currentPrice;
    profitCheck.in[1] <== takeProfitPrice;

    // At least one condition must be true
    signal conditionMet;
    conditionMet <== stopCheck.out + profitCheck.out;
    component atLeastOne = GreaterThan(8);
    atLeastOne.in[0] <== conditionMet;
    atLeastOne.in[1] <== 0;
    atLeastOne.out === 1;

    // ===== 5. Value Calculation Based on Trigger Type =====
    // If stop-loss triggered: use stopLossPrice for conversion
    // If take-profit triggered: use takeProfitPrice for conversion
    signal effectivePrice;
    effectivePrice <== stopCheck.out * stopLossPrice + profitCheck.out * takeProfitPrice;

    signal expectedMinOutput;
    expectedMinOutput <== value * effectivePrice;

    // Output must meet expected conversion (with tolerance)
    component outputCheck = GreaterEqThan(128);
    outputCheck.in[0] <== outValue * 1000000 + 1000000;  // PRICE_PRECISION + tolerance
    outputCheck.in[1] <== expectedMinOutput;
    outputCheck.out === 1;

    // ===== 6. Verify Output Note =====
    component outputNote = PoseidonRegularNote();
    outputNote.pkX <== outPkX;
    outputNote.pkY <== outPkY;
    outputNote.value <== outValue;
    outputNote.tokenType <== outToken;
    outputNote.salt <== outSalt;
    outputNote.out === outputHash;

    // ===== 7. Output Token Validation =====
    component tokenDiff = IsZero();
    tokenDiff.in <== tokenType - outToken;
    tokenDiff.out === 0;  // Must be different tokens
}

component main {public [noteHash, outputHash, stopLossPrice, takeProfitPrice,
    currentPrice, tokenType]} = OCOOrder();
```

### Key Constraints

1. **Ownership Verification**: Only note owner can create OCO order
2. **Valid Bracket**: Stop-loss price must be below take-profit price
3. **Trigger Condition**: Either stop-loss OR take-profit condition must be met
4. **Minimum Output**: Output value must meet expected conversion at effective price
5. **Mutual Exclusivity**: Once triggered, the order is consumed; other leg is implicitly cancelled
6. **Token Swap**: Output must be different token type

## Effects

| Aspect | Impact |
|--------|--------|
| **Risk/Reward Definition** | Complete trade parameters set before execution |
| **Capital Efficiency** | Single order covers both scenarios; no double-locking |
| **Strategy Automation** | Full bracket trading without manual management |
| **Privacy** | Both trigger prices hidden until execution |
| **Execution Certainty** | Guaranteed one and only one outcome |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP, multiple sources; circuit validates price reasonableness |
| **Both Triggers Activating** | Price bounds constraint ensures non-overlapping regions |
| **Stale Price Execution** | Include timestamp validation; reject old price data |
| **Front-Running** | Both prices hidden; attackers cannot determine which to target |
| **Replay Attack** | Nullifier prevents double-spend; single execution guaranteed |
| **Value Calculation Exploit** | Effective price determined by which condition triggered |

## Implementation Challenges

1. **Oracle Integration**
   - Need real-time price feeds for trigger detection
   - TWAP oracles for manipulation resistance
   - Multiple oracle fallback for reliability
   - Price staleness checks essential

2. **Trigger Attribution**
   - Must determine which leg triggered for correct pricing
   - Circuit uses conditional assignment based on trigger flags
   - Edge case: rapid price movement may trigger both checks

3. **Execution Priority**
   - When both conditions technically met, which executes?
   - Current design: first valid proof wins
   - Consider explicit priority (e.g., stop-loss first)

4. **Partial Fill Integration**
   - Current design is all-or-nothing
   - Extension needed for partial OCO execution
   - Complex state management for residual brackets

5. **Order Modification**
   - Users may want to adjust trigger prices before execution
   - Cancellation and re-creation is current approach
   - Consider amendment circuit for efficiency

## Derivatives

1. **Asymmetric OCO** - Different position sizes for stop-loss vs. take-profit legs. Sell 100% on stop-loss but only 50% on take-profit (letting winners run). Requires splitting note into portions with different trigger conditions.

2. **Time-Expiring OCO** - Order automatically cancels if neither trigger hit within time window. Useful for time-sensitive strategies like earnings plays. Adds expiration timestamp check to circuit.

3. **OCO with Trailing Component** - Take-profit leg uses trailing logic while stop-loss is fixed. Captures additional upside while maintaining defined downside. Combines static and dynamic price targets.

4. **Multi-Leg OCO** - Multiple take-profit levels (e.g., 25% at +10%, 25% at +20%, 50% at +30%) with single stop-loss. Each take-profit execution reduces stop-loss position proportionally. Complex partial fill state management.

5. **OCO with Partial Fill Handling** - If stop-loss partially fills, take-profit leg auto-adjusts to remaining position size. Maintains bracket integrity across partial executions. Requires residual tracking integration.

## Use Cases

1. **Standard Bracket Trade**
   - Trader buys ETH at $2000
   - Sets OCO: stop-loss at $1800, take-profit at $2400
   - Risk: -10%, Reward: +20%, Risk/Reward ratio: 1:2
   - Whichever triggers first executes; position fully managed

2. **Earnings Play**
   - Token has upcoming protocol upgrade announcement
   - Expect significant price movement either direction
   - OCO brackets current price with 15% stops each way
   - Captures breakout in either direction automatically

3. **Range Trading**
   - Asset trading in established range ($100-$120)
   - Buy at $100, OCO: stop $95, take-profit $120
   - If range breaks down, exit with minimal loss
   - If range continues, profit at top of range

4. **Volatility Event Protection**
   - Portfolio positioned before Fed meeting
   - OCO protects against surprise in either direction
   - Stop-loss limits damage from hawkish surprise
   - Take-profit captures gains from dovish surprise
   - No need to watch announcement live

## Real-World Products & User Experience

See dedicated product documentation: [Product Applications](../../../product/a-core-trading/a5-oco-products.md)

---

[Back to Index](../../README.md)
