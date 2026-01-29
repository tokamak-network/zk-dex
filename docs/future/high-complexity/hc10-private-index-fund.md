# HC10. Private Index Fund Rebalancing

Manage a private index fund tracking multiple assets with complex rebalancing logic.

**Constraints**: ~900K | **Complexity**: Very High

---

## Background

Index fund management involves sensitive operations:
- Rebalancing trades signal portfolio composition
- Large trades move markets (information leakage)
- Investor positions reveal wealth distribution
- Fee calculations must be verifiable
- Regulatory compliance requires audit trails

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| On-chain funds (e.g., TokenSets) | All holdings public; front-running endemic |
| Traditional fund custody | Opaque operations; trust in custodian |
| DAO treasuries | Transparent holdings; governance attacks |
| Hedge fund SPVs | Limited access; high minimums; slow settlement |

Private index fund circuits enable institutional-grade fund management with full privacy while maintaining cryptographic auditability.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `fundCommitment` | field | Current fund state commitment |
| `newFundCommitment` | field | Fund state after rebalance |
| `indexWeights` | uint[N_ASSETS] | Target index weights (basis points) |
| `oraclePrices` | uint[N_ASSETS] | Current asset prices |
| `managementFee` | uint | Annual fee in basis points |
| `performanceFee` | uint | Performance fee percentage |
| `benchmarkReturn` | uint | Benchmark return for performance fee |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `managerPkX/Y, managerSk` | field | Fund manager credentials |
| `currentHoldings, newHoldings` | uint[N_ASSETS] | Asset quantities |
| `holdingSalts` | field[N_ASSETS] | Holding note salts |
| `investorPkX/Y, investorShares, investorShareSalts` | arrays | Investor positions |
| `previousNAV, currentNAV` | uint | Net asset values |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Information Leakage** | Zero - all positions and trades private |
| **Market Impact** | Eliminated front-running of rebalance |
| **Investor Privacy** | Position sizes never revealed |
| **Fee Transparency** | Verifiable fee calculation |
| **Compliance** | Cryptographic audit trail |
| **Scalability** | Single proof for 20 assets, 100 investors |

## Derivatives

1. **Active Fund Management** - Discretionary trades within mandate constraints. Manager has flexibility but must stay within risk limits. Circuit enforces sector limits, concentration limits, etc.

2. **Multi-Manager Fund** - Multiple managers with allocation limits. Each manager controls a portion with sub-limits. Aggregated proof verifies all managers compliant.

3. **Smart Beta Fund** - Factor-based rebalancing (value, momentum, quality, volatility). Include factor scores from oracle. Rebalance to target factor exposures.

4. **Leveraged Fund** - Rebalancing with borrowed assets. Include leverage ratio constraints. Verify margin requirements maintained.

5. **Fund of Funds** - Manage allocation across multiple sub-funds. Recursive proofs for sub-fund compliance. Master proof aggregates all sub-fund states.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template PrivateIndexFund(N_ASSETS, N_INVESTORS) {
    // ===== Public Inputs =====
    signal input fundCommitment;
    signal input newFundCommitment;
    signal input indexWeights[N_ASSETS];
    signal input oraclePrices[N_ASSETS];
    signal input managementFee;       // Annual fee in basis points
    signal input performanceFee;      // % of gains above benchmark
    signal input highWaterMark;       // Previous peak NAV for performance fee
    signal input rebalanceTimestamp;  // For time-based fee accrual

    // ===== Private Inputs =====
    signal input managerPkX, managerPkY, managerSk;

    signal input currentHoldings[N_ASSETS];
    signal input currentHoldingSalts[N_ASSETS];

    signal input newHoldings[N_ASSETS];
    signal input newHoldingSalts[N_ASSETS];

    signal input investorPkX[N_INVESTORS], investorPkY[N_INVESTORS];
    signal input investorShares[N_INVESTORS];
    signal input investorShareSalts[N_INVESTORS];
    signal input investorIsActive[N_INVESTORS];

    signal input previousNAV;
    signal input currentNAV;
    signal input benchmarkReturn;
    signal input daysSinceLastRebalance;

    // ===== Component Declarations =====
    component managerOwnership;
    component fundHash;
    component newFundHash;
    component navCheck;
    component excessCheck;
    component weightCheck[N_ASSETS];
    component sharesSumCheck;

    // Intermediate signals
    signal actualWeight[N_ASSETS];
    signal weightDeviation[N_ASSETS];
    signal deviationSq[N_ASSETS];
    signal fundReturn;
    signal excessReturn;
    signal managementFeeAmount;
    signal performanceFeeAmount;
    signal totalFees;

    // ===== Verify Manager =====
    managerOwnership = ProofOfOwnershipStrict();
    managerOwnership.sk <== managerSk;
    managerOwnership.pkX <== managerPkX;
    managerOwnership.pkY <== managerPkY;

    // ===== Calculate Current NAV =====
    var calculatedNAV = 0;
    for (var i = 0; i < N_ASSETS; i++) {
        calculatedNAV += currentHoldings[i] * oraclePrices[i];
    }
    // Verify NAV matches claimed value
    calculatedNAV === currentNAV;

    // ===== Verify Investor Shares Sum to 100% =====
    var totalShares = 0;
    for (var i = 0; i < N_INVESTORS; i++) {
        totalShares += investorShares[i] * investorIsActive[i];
    }
    // Total shares should equal 10000 (100% in basis points)
    totalShares === 10000;

    // ===== Verify Fund Commitment =====
    fundHash = Poseidon(N_ASSETS * 2 + N_INVESTORS * 3 + 4);
    fundHash.inputs[0] <== managerPkX;
    fundHash.inputs[1] <== managerPkY;
    fundHash.inputs[2] <== previousNAV;
    fundHash.inputs[3] <== highWaterMark;

    var idx = 4;
    for (var i = 0; i < N_ASSETS; i++) {
        fundHash.inputs[idx] <== currentHoldings[i];
        fundHash.inputs[idx + 1] <== currentHoldingSalts[i];
        idx += 2;
    }
    for (var i = 0; i < N_INVESTORS; i++) {
        fundHash.inputs[idx] <== investorPkX[i];
        fundHash.inputs[idx + 1] <== investorPkY[i];
        fundHash.inputs[idx + 2] <== investorShares[i];
        idx += 3;
    }
    fundHash.out === fundCommitment;

    // ===== Calculate Fees =====
    // Fund return = (currentNAV - previousNAV) / previousNAV * 10000
    fundReturn <-- (currentNAV - previousNAV) * 10000 / previousNAV;

    // Management fee (pro-rata for days elapsed)
    managementFeeAmount <== currentNAV * managementFee * daysSinceLastRebalance / 10000 / 365;

    // Performance fee (only on gains above high water mark)
    excessCheck = LessThan(64);
    excessCheck.in[0] <== highWaterMark;
    excessCheck.in[1] <== currentNAV;

    // If currentNAV > highWaterMark, calculate performance fee
    signal navAboveHWM;
    navAboveHWM <== (currentNAV - highWaterMark) * excessCheck.out;
    performanceFeeAmount <== navAboveHWM * performanceFee / 100;

    totalFees <== managementFeeAmount + performanceFeeAmount;

    // ===== Verify Rebalancing Follows Index =====
    var newNAV = 0;
    for (var i = 0; i < N_ASSETS; i++) {
        newNAV += newHoldings[i] * oraclePrices[i];
    }

    // New NAV should equal current NAV minus fees (within tolerance)
    navCheck = LessThan(64);
    navCheck.in[0] <== (currentNAV - totalFees) * 99 / 100;  // 1% tolerance
    navCheck.in[1] <== newNAV + 1;
    navCheck.out === 1;

    // Each asset should be close to target weight
    for (var i = 0; i < N_ASSETS; i++) {
        actualWeight[i] <== newHoldings[i] * oraclePrices[i] * 10000 / newNAV;
        weightDeviation[i] <== actualWeight[i] - indexWeights[i];
        deviationSq[i] <== weightDeviation[i] * weightDeviation[i];

        weightCheck[i] = LessThan(32);
        weightCheck[i].in[0] <== deviationSq[i];
        weightCheck[i].in[1] <== 100 * 100 + 1;  // 1% tolerance squared
        weightCheck[i].out === 1;
    }

    // ===== Verify New Fund Commitment =====
    // Update high water mark if NAV increased
    signal newHighWaterMark;
    newHighWaterMark <== currentNAV * excessCheck.out + highWaterMark * (1 - excessCheck.out);

    newFundHash = Poseidon(N_ASSETS * 2 + N_INVESTORS * 3 + 4);
    newFundHash.inputs[0] <== managerPkX;
    newFundHash.inputs[1] <== managerPkY;
    newFundHash.inputs[2] <== newNAV;
    newFundHash.inputs[3] <== newHighWaterMark;

    idx = 4;
    for (var i = 0; i < N_ASSETS; i++) {
        newFundHash.inputs[idx] <== newHoldings[i];
        newFundHash.inputs[idx + 1] <== newHoldingSalts[i];
        idx += 2;
    }
    for (var i = 0; i < N_INVESTORS; i++) {
        newFundHash.inputs[idx] <== investorPkX[i];
        newFundHash.inputs[idx + 1] <== investorPkY[i];
        newFundHash.inputs[idx + 2] <== investorShares[i];
        idx += 3;
    }
    newFundHash.out === newFundCommitment;
}

component main {public [fundCommitment, newFundCommitment, indexWeights,
    oraclePrices, managementFee, performanceFee, highWaterMark, rebalanceTimestamp]} =
    PrivateIndexFund(20, 100);
```

### Key Constraints

1. **Manager Authorization**: Only fund manager can trigger rebalance
2. **NAV Calculation**: Holdings * prices must match claimed NAV
3. **Share Integrity**: Investor shares sum to 100%
4. **Fee Accuracy**: Management and performance fees correctly calculated
5. **Index Tracking**: Asset weights within tolerance of target
6. **High Water Mark**: Performance fee only on new gains

### Fee Structure Details

| Fee Type | Calculation | Typical Range |
|----------|-------------|---------------|
| Management Fee | NAV * rate * days / 365 | 0.5% - 2% annual |
| Performance Fee | (NAV - HWM) * rate | 10% - 20% of gains |
| Entry/Exit Fee | (not in this circuit) | 0% - 2% |

**High Water Mark (HWM)** ensures performance fees only charged on new gains:
- Tracks peak NAV achieved
- Performance fee only on amount exceeding HWM
- Prevents double-charging after drawdowns

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **NAV Manipulation** | Oracle prices from trusted sources; TWAP |
| **Fee Extraction** | Fee formulas public; verifiable in circuit |
| **Manager Misconduct** | Index tracking enforced; cannot deviate beyond tolerance |
| **Investor Dilution** | Share sum = 100% constraint prevents inflation |
| **Front-Running Rebalance** | Trades not revealed until after execution |
| **Unauthorized Rebalance** | Manager ownership proof required |
| **Oracle Staleness** | Timestamp check on price data |
| **Share Manipulation** | Investor share changes require separate proof |

## Implementation Challenges

1. **Large State Management**
   - 20 assets + 100 investors = complex state
   - Poseidon hash input limits (~16 fields typically)
   - Need hierarchical hashing or Merkle trees

2. **Division in Circuits**
   - NAV/share calculations need division
   - Use pre-computed quotients; verify via multiplication
   - Integer division introduces rounding errors

3. **Investor Additions/Removals**
   - New investors joining or redeeming shares
   - Need separate subscription/redemption proofs
   - Share dilution/consolidation logic

4. **Trade Execution**
   - Circuit verifies rebalance validity
   - Actual trades executed separately
   - Need atomic execution or escrow

5. **Multi-Period Accounting**
   - Track performance across rebalance periods
   - Cumulative fee accrual
   - Investor-specific performance (for late joiners)

## Use Cases

1. **Private Index Fund**
   - Track S&P 500 with top 20 holdings
   - 100 investors with private position sizes
   - Automatic rebalancing to target weights
   - Verifiable fee deduction

2. **Hedge Fund**
   - Active management within constraints
   - Performance fees on alpha generation
   - Investor privacy for competitive reasons
   - Regulatory compliance via audit trail

3. **DAO Treasury Management**
   - Diversified treasury across 20 assets
   - Token holders as "investors"
   - Governance-approved rebalancing
   - Transparent fee structure

4. **Family Office**
   - Multi-generational wealth management
   - Different family members as investors
   - Privacy between family members
   - Fiduciary duty provable

5. **Pension Fund**
   - Long-term investment mandate
   - Regulatory allocation requirements
   - Verifiable compliance
   - Beneficiary privacy

## Real-World Products & User Experience

See [Real-World Products & User Experience](../product/high-complexity/hc10-private-index-fund-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
