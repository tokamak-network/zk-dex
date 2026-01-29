# B6. DCA (Dollar-Cost Averaging)

Periodic automatic purchases at regular intervals, enabling set-and-forget investing with hidden investment schedule and amounts.

**Constraints**: ~200K | **Complexity**: Medium

---

## Background

Dollar-cost averaging is a proven investment strategy:

- **Timing Risk Reduction**: Spreading purchases over time reduces impact of buying at market peaks
- **Emotional Discipline**: Automated execution removes psychological barriers to investing during volatility
- **Privacy Problem**: On-chain DCA orders reveal investment schedule, budget, and target asset
- **Execution Challenges**: Manual DCA requires constant attention; automated versions expose strategy

In traditional finance, DCA is offered by brokerages as an automated service but requires trusting the custodian. In DeFi, DCA services like DCA.xyz exist but expose all parameters publicly. ZK DCA hides the investment schedule, amounts, and total budget while enabling trustless execution.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `dcaHash` | field | Hash of the current DCA order state |
| `newDcaHash` | field | Hash of updated DCA order (or 0 if complete) |
| `outputHash` | field | Hash of purchased asset note |
| `currentTime` | uint | Current block.timestamp |
| `currentPrice` | uint | Oracle-provided current price |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | Owner's public key |
| `sk` | field | Owner's secret key for authorization |
| `totalBudget` | uint | Total amount to invest |
| `spentAmount` | uint | Amount already spent |
| `sourceTokenType` | uint | Token being spent (e.g., USDC) |
| `targetTokenType` | uint | Token being purchased (e.g., ETH) |
| `interval` | uint | Time between purchases (seconds) |
| `amountPerInterval` | uint | Amount to spend per interval |
| `lastExecutionTime` | uint | Timestamp of last execution |
| `salt` | field | DCA note randomness |
| `purchaseAmount` | uint | Amount of target token received |
| `newSpentAmount` | uint | Updated spent amount |
| `newSalt` | field | New DCA note randomness |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template DCAExecution() {
    // ===== Public Inputs =====
    signal input dcaHash;
    signal input newDcaHash;         // Updated DCA order (or 0 if complete)
    signal input outputHash;          // Purchased asset note
    signal input currentTime;
    signal input currentPrice;        // From price oracle

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, sk;
    signal input totalBudget, spentAmount;
    signal input sourceTokenType, targetTokenType;
    signal input interval, amountPerInterval;
    signal input lastExecutionTime, salt;
    signal input purchaseAmount, newSpentAmount, newSalt, outSalt;

    // ===== 1. Verify DCA Note =====
    component dca = Poseidon(11);
    dca.inputs[0] <== ownerPkX;
    dca.inputs[1] <== ownerPkY;
    dca.inputs[2] <== totalBudget;
    dca.inputs[3] <== spentAmount;
    dca.inputs[4] <== sourceTokenType;
    dca.inputs[5] <== targetTokenType;
    dca.inputs[6] <== interval;
    dca.inputs[7] <== amountPerInterval;
    dca.inputs[8] <== lastExecutionTime;
    dca.inputs[9] <== salt;
    dca.inputs[10] <== 0;  // dcaType: 0 = standard DCA
    dca.out === dcaHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== ownerPkX;
    own.pkY <== ownerPkY;

    // ===== 3. Check Interval Has Passed =====
    signal nextExecutionTime;
    nextExecutionTime <== lastExecutionTime + interval;

    component intervalCheck = GreaterEqThan(64);
    intervalCheck.in[0] <== currentTime;
    intervalCheck.in[1] <== nextExecutionTime;
    intervalCheck.out === 1;

    // ===== 4. Check Budget Remaining =====
    signal remainingBudget;
    remainingBudget <== totalBudget - spentAmount;

    component budgetCheck = GreaterEqThan(252);
    budgetCheck.in[0] <== remainingBudget;
    budgetCheck.in[1] <== amountPerInterval;
    budgetCheck.out === 1;

    // ===== 5. Calculate Purchase Amount =====
    // purchaseAmount = amountPerInterval / currentPrice (with precision)
    // Price is in format: 1 target token = currentPrice source tokens
    // purchaseAmount * currentPrice should approximate amountPerInterval

    signal expectedPurchase;
    expectedPurchase <-- amountPerInterval * 1000000 \ currentPrice;  // With 6 decimal precision

    // Verify purchase amount is within acceptable slippage (5%)
    signal minPurchase;
    minPurchase <== expectedPurchase * 95 / 100;

    signal maxPurchase;
    maxPurchase <== expectedPurchase * 105 / 100;

    component purchaseLower = GreaterEqThan(252);
    purchaseLower.in[0] <== purchaseAmount;
    purchaseLower.in[1] <== minPurchase;
    purchaseLower.out === 1;

    component purchaseUpper = LessEqThan(252);
    purchaseUpper.in[0] <== purchaseAmount;
    purchaseUpper.in[1] <== maxPurchase;
    purchaseUpper.out === 1;

    // ===== 6. Update Spent Amount =====
    newSpentAmount === spentAmount + amountPerInterval;

    // ===== 7. Create New DCA Note (if not complete) =====
    component newDca = Poseidon(11);
    newDca.inputs[0] <== ownerPkX;
    newDca.inputs[1] <== ownerPkY;
    newDca.inputs[2] <== totalBudget;
    newDca.inputs[3] <== newSpentAmount;
    newDca.inputs[4] <== sourceTokenType;
    newDca.inputs[5] <== targetTokenType;
    newDca.inputs[6] <== interval;
    newDca.inputs[7] <== amountPerInterval;
    newDca.inputs[8] <== currentTime;  // Update last execution time
    newDca.inputs[9] <== newSalt;
    newDca.inputs[10] <== 0;

    // If fully spent, newDcaHash should be 0
    component fullySpentCheck = IsEqual();
    fullySpentCheck.in[0] <== newSpentAmount;
    fullySpentCheck.in[1] <== totalBudget;

    signal expectedNewDcaHash;
    expectedNewDcaHash <== (1 - fullySpentCheck.out) * newDca.out;
    newDcaHash === expectedNewDcaHash;

    // ===== 8. Create Output Note (Purchased Asset) =====
    component outputNote = PoseidonRegularNote();
    outputNote.pkX <== ownerPkX;
    outputNote.pkY <== ownerPkY;
    outputNote.value <== purchaseAmount;
    outputNote.tokenType <== targetTokenType;
    outputNote.salt <== outSalt;
    outputNote.out === outputHash;
}

component main {public [dcaHash, newDcaHash, outputHash, currentTime, currentPrice]} =
    DCAExecution();
```

### Key Constraints

1. **DCA Note Verification**: All parameters (budget, interval, tokens) committed in hash
2. **Ownership Authorization**: Only owner can execute DCA order
3. **Interval Enforcement**: Must wait for full interval between executions
4. **Budget Check**: Remaining budget must cover current interval amount
5. **Purchase Calculation**: Output amount must match expected purchase within slippage
6. **State Update**: New DCA note reflects updated spent amount and execution time

## Effects

| Aspect | Impact |
|--------|--------|
| **Risk Reduction** | Systematic investment smooths out volatility |
| **Automation** | Set-and-forget execution without monitoring |
| **Privacy** | Investment schedule and amounts hidden |
| **Discipline** | Removes emotional decision-making |
| **Gas Efficiency** | Batch-able executions for multiple DCA orders |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP prices; require multiple oracle sources |
| **Front-running Execution** | Execution timing predictable but amounts hidden |
| **Slippage Attacks** | 5% slippage tolerance; consider tighter bounds |
| **Interval Gaming** | Interval is hidden; cannot predict exact execution times |
| **Budget Exhaustion** | Final execution handles partial budget automatically |
| **Price Feed Staleness** | Include timestamp check on oracle data |

## Implementation Challenges

1. **Execution Incentives**
   - Who triggers DCA executions?
   - Need keeper network or executor rewards
   - Consider small fee from purchased amount

2. **Price Precision**
   - Different tokens have different decimals
   - Need standardized price representation
   - Consider fixed-point arithmetic

3. **Partial Final Execution**
   - Final interval may have less than amountPerInterval remaining
   - Circuit needs to handle partial purchases
   - Consider separate circuit for final execution

4. **Liquidity Availability**
   - DCA assumes liquidity exists at execution time
   - May need fallback mechanism for illiquid markets
   - Consider execution at DEX with slippage protection

## Derivatives

1. **Variable Amount DCA** - Investment amount varies based on market conditions. Buy more when price drops (value averaging), less when price rises. Circuit includes price-responsive amount calculation based on target value growth rate.

2. **Price-Responsive DCA** - DCA that adjusts schedule based on price movements. Execute earlier if price drops significantly (opportunity), skip if price spikes (avoid buying tops). Combines interval-based with price triggers.

3. **Multi-Asset DCA Basket** - Single DCA order that purchases multiple assets with configurable allocations (e.g., 60% ETH, 30% BTC, 10% LINK). Creates multiple output notes per execution with hidden allocation percentages.

4. **DCA with Take-Profit Exit** - Automatically sells accumulated assets when target price reached. Combines accumulation with exit strategy. Circuit tracks both DCA state and take-profit trigger in single note.

5. **Inverse DCA (Systematic Selling)** - DCA in reverse: automatically sells fixed amounts at regular intervals. Useful for projects vesting tokens or investors taking profits. Same structure as DCA but source/target reversed.

## Use Cases

1. **Retirement Accumulation**
   - Investor commits $500/week to ETH for 5 years
   - DCA order: $500 weekly, 260 executions
   - Automatic purchase every week regardless of price
   - Privacy: Retirement savings strategy hidden from observers

2. **Token Treasury Diversification**
   - DAO wants to diversify treasury from native token to stables
   - Sets up inverse DCA selling 10,000 tokens monthly
   - Gradual sales reduce market impact
   - Privacy: Selling schedule hidden from market front-runners

3. **Salary Investment**
   - Employee allocates $1,000/month from salary to crypto
   - DCA synchronized with paycheck schedule
   - Consistent investment without manual execution
   - Privacy: Investment amounts hidden from coworkers

4. **Market Recovery Strategy**
   - Investor sets aggressive DCA during bear market
   - $200 daily into bluechips until $50,000 deployed
   - Takes advantage of lower prices systematically
   - Privacy: Accumulation strategy hidden from market

## Real-World Products & User Experience

See [DCA (Dollar-Cost Averaging) - Products & User Experience](../../../product/b-time-conditions/b6-dca-products.md) for detailed product scenarios and user stories.

---

[Back to Index](../../README.md)
