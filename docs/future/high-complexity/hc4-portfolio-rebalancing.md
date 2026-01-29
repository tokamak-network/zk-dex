# HC4. Private Portfolio Rebalancing

Rebalance a portfolio of N assets to target allocations in one proof.

**Constraints**: ~500K | **Complexity**: High

---

## Background

Portfolio management faces transparency vs. privacy trade-off:
- Public rebalancing signals enable front-running
- Large orders move markets against the trader
- Institutional investors need confidential strategies
- Proof of proper fund management required for compliance

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| On-chain portfolio managers | All holdings visible; enables copy-trading and front-running |
| Traditional fund custody | Trusted custodian; no real-time verification |
| Multi-sig treasury | Transaction visibility reveals strategy |
| Periodic audits | Point-in-time snapshots; manipulation between audits |

Private portfolio rebalancing enables verifiable fund management without exposing positions or strategy. Investors can verify compliance without seeing actual holdings.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `portfolioCommitment` | field | Hash of current portfolio state |
| `newPortfolioCommitment` | field | Hash of portfolio after rebalance |
| `oraclePrices` | uint[N_ASSETS] | Current prices from oracle |
| `targetAllocations` | uint[N_ASSETS] | Target weights (basis points, sum=10000) |
| `tolerance` | uint | Maximum deviation from target (basis points) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX/Y, ownerSk` | field | Portfolio owner credentials |
| `currentNoteHashes, currentValues, currentTokenTypes, currentSalts` | arrays | Current holdings |
| `newNoteHashes, newValues, newSalts` | arrays | Holdings after rebalance |
| `tradeAmounts` | int[N_ASSETS] | Trade deltas (positive=buy, negative=sell) |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Information Leakage** | Zero - holdings and trades remain private |
| **Slippage** | Reduced - no front-running of rebalance orders |
| **Compliance** | Provable adherence to investment mandate |
| **Audit** | Cryptographic proof of proper management |
| **Scalability** | Single proof regardless of trade complexity |
| **Trust** | Investors verify without seeing positions |

## Derivatives

1. **Tax-Loss Harvesting** - Prove tax-efficient rebalancing by including cost basis in note metadata. Circuit verifies losses are harvested optimally while maintaining allocation targets. Useful for jurisdictions with wash-sale rules.

2. **ESG Compliance** - Prove portfolio meets ESG criteria without revealing positions. Include ESG score per asset in oracle data. Circuit verifies weighted portfolio ESG score exceeds threshold.

3. **Risk Parity Rebalance** - Rebalance based on volatility targets rather than dollar weights. Include volatility estimates from oracle. Each asset contributes equal risk to portfolio.

4. **Momentum Rebalance** - Automated trend-following rebalance. Include price moving averages from oracle. Overweight assets above MA, underweight those below.

5. **Multi-Manager Rebalance** - Coordinate rebalancing across sub-managers with aggregate constraints. Each manager proves their sub-portfolio compliance; master proof aggregates.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template PrivatePortfolioRebalance(N_ASSETS) {
    // ===== Public Inputs =====
    signal input portfolioCommitment;
    signal input newPortfolioCommitment;
    signal input oraclePrices[N_ASSETS];
    signal input targetAllocations[N_ASSETS];  // Basis points (sum = 10000)
    signal input tolerance;                     // Max deviation in basis points

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, ownerSk;

    signal input currentNoteHashes[N_ASSETS];
    signal input currentValues[N_ASSETS];
    signal input currentTokenTypes[N_ASSETS];
    signal input currentSalts[N_ASSETS];

    signal input newNoteHashes[N_ASSETS];
    signal input newValues[N_ASSETS];
    signal input newSalts[N_ASSETS];

    signal input tradeAmounts[N_ASSETS];  // Can be negative (sells)

    // ===== Component Declarations =====
    component ownership;
    component currentNote[N_ASSETS];
    component newNote[N_ASSETS];
    component currentHash;
    component newHash;
    component valueCheck;
    component deviationCheck[N_ASSETS];

    // Intermediate signals
    signal actualAllocation[N_ASSETS];
    signal deviation[N_ASSETS];
    signal deviationSq[N_ASSETS];

    // ===== Verify Ownership =====
    ownership = ProofOfOwnershipStrict();
    ownership.sk <== ownerSk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== Verify Current Portfolio =====
    currentHash = Poseidon(N_ASSETS * 3 + 2);
    currentHash.inputs[0] <== ownerPkX;
    currentHash.inputs[1] <== ownerPkY;

    var totalCurrentValue = 0;

    for (var i = 0; i < N_ASSETS; i++) {
        currentNote[i] = PoseidonRegularNote();
        currentNote[i].pkX <== ownerPkX;
        currentNote[i].pkY <== ownerPkY;
        currentNote[i].value <== currentValues[i];
        currentNote[i].tokenType <== currentTokenTypes[i];
        currentNote[i].salt <== currentSalts[i];
        currentNote[i].out === currentNoteHashes[i];

        currentHash.inputs[2 + i * 3] <== currentNoteHashes[i];
        currentHash.inputs[2 + i * 3 + 1] <== currentValues[i];
        currentHash.inputs[2 + i * 3 + 2] <== currentTokenTypes[i];

        totalCurrentValue += currentValues[i] * oraclePrices[i];
    }
    currentHash.out === portfolioCommitment;

    // ===== Verify New Portfolio =====
    newHash = Poseidon(N_ASSETS * 3 + 2);
    newHash.inputs[0] <== ownerPkX;
    newHash.inputs[1] <== ownerPkY;

    var totalNewValue = 0;

    for (var i = 0; i < N_ASSETS; i++) {
        // Trade amount constraint (handled via signed arithmetic)
        newValues[i] === currentValues[i] + tradeAmounts[i];

        newNote[i] = PoseidonRegularNote();
        newNote[i].pkX <== ownerPkX;
        newNote[i].pkY <== ownerPkY;
        newNote[i].value <== newValues[i];
        newNote[i].tokenType <== currentTokenTypes[i];
        newNote[i].salt <== newSalts[i];
        newNote[i].out === newNoteHashes[i];

        newHash.inputs[2 + i * 3] <== newNoteHashes[i];
        newHash.inputs[2 + i * 3 + 1] <== newValues[i];
        newHash.inputs[2 + i * 3 + 2] <== currentTokenTypes[i];

        totalNewValue += newValues[i] * oraclePrices[i];
    }
    newHash.out === newPortfolioCommitment;

    // ===== Verify Value Conservation =====
    // Allow up to 1% slippage for trading costs
    valueCheck = LessThan(128);
    valueCheck.in[0] <== totalCurrentValue * 99 / 100;
    valueCheck.in[1] <== totalNewValue + 1;
    valueCheck.out === 1;

    // ===== Verify Target Allocations =====
    for (var i = 0; i < N_ASSETS; i++) {
        // Calculate actual allocation in basis points
        actualAllocation[i] <== newValues[i] * oraclePrices[i] * 10000 / totalNewValue;

        // Calculate deviation
        deviation[i] <== actualAllocation[i] - targetAllocations[i];

        // Square deviation for absolute comparison
        deviationSq[i] <== deviation[i] * deviation[i];

        // Verify |deviation| <= tolerance
        deviationCheck[i] = LessThan(64);
        deviationCheck[i].in[0] <== deviationSq[i];
        deviationCheck[i].in[1] <== tolerance * tolerance + 1;
        deviationCheck[i].out === 1;
    }
}

component main {public [portfolioCommitment, newPortfolioCommitment, oraclePrices,
    targetAllocations, tolerance]} = PrivatePortfolioRebalance(10);
```

### Key Constraints

1. **Ownership**: Only portfolio owner can initiate rebalance
2. **Portfolio Integrity**: Current and new states match commitments
3. **Value Conservation**: Total value preserved (within slippage tolerance)
4. **Allocation Compliance**: Each asset within tolerance of target weight

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Oracle Manipulation** | Use TWAP prices; multiple oracle sources; price bounds |
| **Manager Misconduct** | Circuit enforces allocation limits; cannot deviate beyond tolerance |
| **Front-Running Rebalance** | Trade amounts private; only commitment published |
| **Slippage Exploitation** | 1% slippage cap; tighter for stable assets |
| **NAV Manipulation** | Commitment includes all holdings; cannot hide assets |
| **Unauthorized Access** | Ownership proof required for any rebalance |
| **Stale Prices** | Include timestamp in oracle data; reject if too old |

## Implementation Challenges

1. **Signed Arithmetic for Trades**
   - `tradeAmounts` can be negative (sells)
   - Circom field arithmetic wraps; need careful handling
   - Use two's complement or separate buy/sell arrays

2. **Division in ZK**
   - `actualAllocation = value * price * 10000 / totalValue`
   - Division in circuits is expensive (~1000 constraints)
   - Pre-compute quotient off-chain; verify multiplication in circuit

3. **Oracle Integration**
   - Need reliable, manipulation-resistant price feeds
   - Consider Chainlink, TWAP, or multi-source aggregation
   - Price precision standardization across assets

4. **Trade Execution**
   - Circuit only verifies rebalance validity
   - Actual trades must be executed separately
   - Need atomic execution or escrow mechanism

5. **Gas Costs for Many Assets**
   - 10 assets requires ~500K constraints
   - Public inputs: 10 prices + 10 allocations = 20 field elements
   - Consider batching multiple rebalances or hierarchical proofs

## Use Cases

1. **Private Index Fund**
   - Rebalance 10-asset portfolio to track S&P 500 top holdings
   - Investors verify fund follows index without seeing positions
   - Automatic rebalancing on price drift

2. **Robo-Advisor**
   - Automated portfolio management for retail investors
   - Prove risk-appropriate allocation without revealing size
   - Tax-aware rebalancing with loss harvesting

3. **DAO Treasury Management**
   - DAO treasury rebalanced per governance vote
   - Holdings private to prevent manipulation
   - Compliance with investment policy provable

4. **Pension Fund Compliance**
   - Prove regulatory allocation requirements met
   - No equities >60%, bonds >40%, etc.
   - Auditors verify without seeing positions

5. **Family Office**
   - Multi-generational wealth management
   - Prove fiduciary duty fulfilled
   - Privacy from family members while ensuring fairness

## Real-World Products & User Experience

See [Real-World Products & User Experience](../product/high-complexity/hc4-portfolio-rebalancing-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
