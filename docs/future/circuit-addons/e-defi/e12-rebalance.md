# E12. Portfolio Rebalance

Automatically rebalance portfolio allocations with hidden target weights, thresholds, and trade amounts.

**Constraints**: ~400K | **Complexity**: High

---

## Background

Portfolio rebalancing reveals significant strategic information:

- **Target Allocation**: Visible weights expose investment thesis and strategy
- **Threshold Detection**: Known rebalance triggers enable front-running
- **Trade Size Prediction**: Drift magnitude reveals upcoming trade sizes
- **Strategy Copying**: Competitors can replicate allocation strategies

Current DeFi portfolio managers expose all rebalancing parameters. Private rebalancing hides target weights and trade amounts while proving rebalancing maintains portfolio constraints through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `portfolioNoteHash` | field | Hash of the portfolio state note |
| `newPortfolioNoteHash` | field | Hash of portfolio after rebalance |
| `rebalanceProofHash` | field | Commitment to rebalance parameters |
| `currentTime` | uint | Timestamp of rebalance |
| `nullifier` | field | Prevents double-rebalance |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `managerPkX, managerPkY` | field | Portfolio manager's public key |
| `managerSk` | field | Manager's secret key |
| `assetBalances[N]` | uint[] | Current asset balances (hidden) |
| `assetPrices[N]` | uint[] | Current asset prices |
| `targetWeights[N]` | uint[] | Target allocation weights (hidden) |
| `newBalances[N]` | uint[] | Balances after rebalance (hidden) |
| `rebalanceThreshold` | uint | Drift threshold triggering rebalance |
| `portfolioSalt` | field | Portfolio note randomness |
| `newPortfolioSalt` | field | New portfolio note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template PortfolioRebalance(NUM_ASSETS) {
    // ===== Public Inputs =====
    signal input portfolioNoteHash;
    signal input newPortfolioNoteHash;
    signal input rebalanceProofHash;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input managerPkX, managerPkY, managerSk;
    signal input assetBalances[NUM_ASSETS];
    signal input assetPrices[NUM_ASSETS];
    signal input targetWeights[NUM_ASSETS];  // Basis points, sum = 10000
    signal input newBalances[NUM_ASSETS];
    signal input rebalanceThreshold;  // Basis points
    signal input portfolioSalt, newPortfolioSalt;
    signal input lastRebalanceTime;
    signal input minRebalanceInterval;

    // ===== 1. Verify Manager Ownership =====
    component managerOwnership = ProofOfOwnershipStrict();
    managerOwnership.sk <== managerSk;
    managerOwnership.pkX <== managerPkX;
    managerOwnership.pkY <== managerPkY;

    // ===== 2. Calculate Current Portfolio Value =====
    signal assetValues[NUM_ASSETS];
    signal cumulativeValue[NUM_ASSETS + 1];
    cumulativeValue[0] <== 0;

    for (var i = 0; i < NUM_ASSETS; i++) {
        assetValues[i] <== assetBalances[i] * assetPrices[i];
        cumulativeValue[i + 1] <== cumulativeValue[i] + assetValues[i];
    }

    signal totalValue;
    totalValue <== cumulativeValue[NUM_ASSETS];

    // ===== 3. Calculate Current Weights =====
    signal currentWeights[NUM_ASSETS];
    for (var i = 0; i < NUM_ASSETS; i++) {
        currentWeights[i] <== assetValues[i] * 10000 / totalValue;
    }

    // ===== 4. Verify Rebalance Needed =====
    // At least one asset must have drifted beyond threshold
    signal drifts[NUM_ASSETS];
    signal absDrifts[NUM_ASSETS];
    signal driftExceeds[NUM_ASSETS];
    signal cumulativeDriftCheck[NUM_ASSETS + 1];
    cumulativeDriftCheck[0] <== 0;

    component driftGt[NUM_ASSETS];
    component thresholdCheck[NUM_ASSETS];

    for (var i = 0; i < NUM_ASSETS; i++) {
        driftGt[i] = GreaterThan(32);
        driftGt[i].in[0] <== currentWeights[i];
        driftGt[i].in[1] <== targetWeights[i];

        signal driftIfGt;
        signal driftIfLt;
        driftIfGt <== currentWeights[i] - targetWeights[i];
        driftIfLt <== targetWeights[i] - currentWeights[i];
        absDrifts[i] <== driftGt[i].out * driftIfGt + (1 - driftGt[i].out) * driftIfLt;

        thresholdCheck[i] = GreaterThan(32);
        thresholdCheck[i].in[0] <== absDrifts[i];
        thresholdCheck[i].in[1] <== rebalanceThreshold;
        driftExceeds[i] <== thresholdCheck[i].out;

        cumulativeDriftCheck[i + 1] <== cumulativeDriftCheck[i] + driftExceeds[i];
    }

    // At least one asset exceeded threshold
    component needsRebalance = GreaterThan(32);
    needsRebalance.in[0] <== cumulativeDriftCheck[NUM_ASSETS];
    needsRebalance.in[1] <== 0;
    needsRebalance.out === 1;

    // ===== 5. Verify Time Interval =====
    signal timeSinceLastRebalance;
    timeSinceLastRebalance <== currentTime - lastRebalanceTime;

    component intervalCheck = GreaterEqThan(64);
    intervalCheck.in[0] <== timeSinceLastRebalance;
    intervalCheck.in[1] <== minRebalanceInterval;
    intervalCheck.out === 1;

    // ===== 6. Verify Target Weights Sum to 100% =====
    signal cumulativeWeights[NUM_ASSETS + 1];
    cumulativeWeights[0] <== 0;
    for (var i = 0; i < NUM_ASSETS; i++) {
        cumulativeWeights[i + 1] <== cumulativeWeights[i] + targetWeights[i];
    }
    cumulativeWeights[NUM_ASSETS] === 10000;

    // ===== 7. Calculate New Portfolio Value =====
    signal newAssetValues[NUM_ASSETS];
    signal newCumulativeValue[NUM_ASSETS + 1];
    newCumulativeValue[0] <== 0;

    for (var i = 0; i < NUM_ASSETS; i++) {
        newAssetValues[i] <== newBalances[i] * assetPrices[i];
        newCumulativeValue[i + 1] <== newCumulativeValue[i] + newAssetValues[i];
    }

    signal newTotalValue;
    newTotalValue <== newCumulativeValue[NUM_ASSETS];

    // ===== 8. Verify Value Conservation =====
    // Total value should be preserved (minus small trading fees)
    signal maxSlippage;
    maxSlippage <== totalValue / 100;  // 1% max slippage

    signal valueDiff;
    component valueGt = GreaterThan(128);
    valueGt.in[0] <== totalValue;
    valueGt.in[1] <== newTotalValue;

    signal diffIfGt;
    signal diffIfLt;
    diffIfGt <== totalValue - newTotalValue;
    diffIfLt <== newTotalValue - totalValue;
    valueDiff <== valueGt.out * diffIfGt + (1 - valueGt.out) * diffIfLt;

    component slippageCheck = LessEqThan(128);
    slippageCheck.in[0] <== valueDiff;
    slippageCheck.in[1] <== maxSlippage;
    slippageCheck.out === 1;

    // ===== 9. Verify New Weights Match Targets =====
    signal newWeights[NUM_ASSETS];
    signal newWeightDiffs[NUM_ASSETS];

    for (var i = 0; i < NUM_ASSETS; i++) {
        newWeights[i] <== newAssetValues[i] * 10000 / newTotalValue;

        // Allow 1% tolerance from target
        component newWeightGt = GreaterThan(32);
        newWeightGt.in[0] <== newWeights[i];
        newWeightGt.in[1] <== targetWeights[i];

        signal newDiffIfGt;
        signal newDiffIfLt;
        newDiffIfGt <== newWeights[i] - targetWeights[i];
        newDiffIfLt <== targetWeights[i] - newWeights[i];
        newWeightDiffs[i] <== newWeightGt.out * newDiffIfGt + (1 - newWeightGt.out) * newDiffIfLt;

        component newWeightTolerance = LessEqThan(32);
        newWeightTolerance.in[0] <== newWeightDiffs[i];
        newWeightTolerance.in[1] <== 100;  // 1% tolerance
        newWeightTolerance.out === 1;
    }

    // ===== 10. Verify Portfolio Notes =====
    component portfolioNote = Poseidon(NUM_ASSETS + 4);
    portfolioNote.inputs[0] <== managerPkX;
    portfolioNote.inputs[1] <== managerPkY;
    for (var i = 0; i < NUM_ASSETS; i++) {
        portfolioNote.inputs[2 + i] <== assetBalances[i];
    }
    portfolioNote.inputs[NUM_ASSETS + 2] <== lastRebalanceTime;
    portfolioNote.inputs[NUM_ASSETS + 3] <== portfolioSalt;
    portfolioNote.out === portfolioNoteHash;

    component newPortfolioNote = Poseidon(NUM_ASSETS + 4);
    newPortfolioNote.inputs[0] <== managerPkX;
    newPortfolioNote.inputs[1] <== managerPkY;
    for (var i = 0; i < NUM_ASSETS; i++) {
        newPortfolioNote.inputs[2 + i] <== newBalances[i];
    }
    newPortfolioNote.inputs[NUM_ASSETS + 2] <== currentTime;
    newPortfolioNote.inputs[NUM_ASSETS + 3] <== newPortfolioSalt;
    newPortfolioNote.out === newPortfolioNoteHash;

    // ===== 11. Verify Rebalance Proof Hash =====
    component rebalanceHash = Poseidon(4);
    rebalanceHash.inputs[0] <== portfolioNoteHash;
    rebalanceHash.inputs[1] <== newPortfolioNoteHash;
    rebalanceHash.inputs[2] <== rebalanceThreshold;
    rebalanceHash.inputs[3] <== currentTime;
    rebalanceHash.out === rebalanceProofHash;

    // ===== 12. Verify Nullifier =====
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== portfolioNoteHash;
    nullifierHash.inputs[1] <== managerSk;
    nullifierHash.inputs[2] <== currentTime;
    nullifierHash.out === nullifier;
}

component main {public [portfolioNoteHash, newPortfolioNoteHash,
    rebalanceProofHash, currentTime, nullifier]} = PortfolioRebalance(5);
```

### Key Constraints

1. **Ownership Verification**: Manager proves control via secret key
2. **Drift Threshold**: At least one asset exceeds rebalance threshold
3. **Time Interval**: Minimum time between rebalances respected
4. **Weight Sum**: Target weights sum to 100%
5. **Value Conservation**: Portfolio value preserved minus slippage
6. **Target Achievement**: New weights match targets within tolerance

## Effects

| Aspect | Impact |
|--------|--------|
| **Allocation Privacy** | Target weights hidden from observers |
| **Threshold Secrecy** | Rebalance triggers not predictable |
| **Trade Size Privacy** | Rebalance trades not anticipatable |
| **Strategy Protection** | Investment thesis remains confidential |
| **Fair Execution** | Cryptographic proof of correct rebalancing |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Frontrunning Rebalance** | Trade sizes and timing hidden |
| **Weight Manipulation** | Sum constraint ensures valid allocation |
| **Value Extraction** | Slippage bounds prevent excessive loss |
| **Timing Attacks** | Minimum interval prevents rapid rebalancing |
| **Stale Prices** | Price freshness can be verified on-chain |
| **Double Rebalance** | Time-based nullifier prevents duplicate execution |

## Implementation Challenges

1. **Price Feed Integration**
   - Accurate prices for all assets
   - Handling illiquid assets
   - Cross-chain price aggregation

2. **Trade Execution**
   - Atomic multi-asset swaps
   - Slippage management
   - Gas optimization for multiple trades

3. **Portfolio Tracking**
   - Updating portfolio note after trades
   - Handling deposits/withdrawals
   - Fee accounting

4. **Drift Calculation**
   - Real-time weight monitoring
   - Efficient drift detection
   - Threshold parameter tuning

## Derivatives

1. **Threshold Rebalancing** - Rebalance only when drift exceeds customizable threshold. Proves threshold was crossed while hiding both threshold and exact drift amounts.

2. **Tax-Loss Harvesting** - Sell losing positions and repurchase similar assets. Proves tax loss while hiding specific holdings and amounts harvested.

3. **Risk Parity Rebalancing** - Maintain equal risk contribution from each asset. Proves risk calculations while hiding volatility estimates and position sizes.

4. **Momentum Rebalancing** - Adjust weights based on price momentum signals. Proves momentum factors while hiding signal thresholds and resulting allocations.

5. **Factor Rebalancing** - Maintain target factor exposures (value, growth, etc.). Proves factor calculations while hiding factor loadings and target exposures.

## Use Cases

1. **Index Fund Management**
   - Fund maintains target index weights
   - Rebalance thresholds hidden
   - Trade sizes not predictable by arbitrageurs

2. **Risk-Based Allocation**
   - Portfolio maintains risk targets
   - Volatility-based weights hidden
   - Risk model not exposed to competitors

3. **Strategic Asset Allocation**
   - Investor maintains long-term targets
   - Allocation thesis confidential
   - Rebalancing trades private

4. **Automated DCA**
   - Regular rebalancing maintains targets
   - Purchase amounts hidden
   - Accumulation strategy not visible

## Real-World Products & User Experience

See: [Portfolio Rebalance - Real-World Products](../../../product/e-defi/e12-rebalance-products.md)
---

[Back to Index](../../README.md)
