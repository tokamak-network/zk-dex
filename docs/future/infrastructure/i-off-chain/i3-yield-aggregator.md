# I3. Yield Aggregator

Privacy-preserving yield optimization infrastructure that moves funds to highest-yield opportunities without exposing positions or strategies.

**Requirements**: Private yield tracking | Strategy encryption | Automated rebalancing | Gas-optimized execution

---

## Background

DeFi yield optimization faces significant privacy challenges:

- **Strategy Exposure**: Visible yield farming reveals profitable strategies to copycats
- **Position Transparency**: Public positions invite front-running and copying
- **TVL Signaling**: Large deposits/withdrawals signal strategy changes
- **Competitive Erosion**: Visible alpha quickly gets arbitraged away

Private yield aggregation solves these by:
- Hiding position sizes across protocols
- Encrypting strategy decisions and rebalancing logic
- Executing moves through privacy-preserving infrastructure
- Maintaining competitive advantage through operational security

For ZK-DEX, this enables sophisticated yield strategies with protected alpha.

## Technical Specification

### Architecture Overview

```
Depositors                    Yield Aggregator                    DeFi Protocols
+--------+                    +------------------------+          +------------+
|        |  Private Deposit   |                        |          |            |
|User 1  |------------------>|  Strategy Engine       |--------->| Protocol A |
|        |                    |  (encrypted logic)     |          | (Aave)     |
+--------+                    |         |              |          +------------+
|        |  Private Deposit   |         v              |          |            |
|User 2  |------------------>|  +----------------+    |--------->| Protocol B |
|        |                    |  | Yield Monitor  |    |          | (Compound) |
+--------+                    |  | (private feeds)|    |          +------------+
                              |  +----------------+    |          |            |
                              |         |              |--------->| Protocol C |
                              |         v              |          | (Yearn)    |
                              |  Rebalancing Engine    |          +------------+
                              |  (hidden moves)        |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Deposit Vault** | Accepts deposits; issues private share tokens |
| **Yield Monitor** | Tracks yields across protocols privately |
| **Strategy Engine** | Encrypted logic for allocation decisions |
| **Rebalancer** | Executes position changes without exposure |
| **Performance Tracker** | Calculates returns without revealing positions |
| **Share Accounting** | Fair value calculation for deposits/withdrawals |

### Data Flows

1. **Deposit Flow**
   - User deposits assets to vault
   - Receives private share tokens (ZK commitment)
   - Vault allocates to yield opportunities

2. **Strategy Execution**
   - Yield monitor identifies opportunities
   - Strategy engine decides allocation
   - Rebalancer moves funds through private channels

3. **Withdrawal Flow**
   - User proves share ownership with ZK proof
   - Proportional assets redeemed
   - No exposure of vault strategy or other positions

### Yield Strategy Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/comparators.circom";

template YieldAllocation(numProtocols) {
    // Public inputs
    signal input totalValueCommitment;  // Commitment to total vault value
    signal input allocationCommitment;  // Commitment to allocation
    signal input timestamp;

    // Private inputs
    signal input allocations[numProtocols];  // Amount in each protocol
    signal input yields[numProtocols];       // Current APY per protocol
    signal input riskScores[numProtocols];   // Risk rating
    signal input salt;

    // Calculate total value
    signal totalValue;
    signal runningTotal[numProtocols + 1];
    runningTotal[0] <== 0;
    for (var i = 0; i < numProtocols; i++) {
        runningTotal[i + 1] <== runningTotal[i] + allocations[i];
    }
    totalValue <== runningTotal[numProtocols];

    // Verify total value commitment
    component tvHash = Poseidon(3);
    tvHash.inputs[0] <== totalValue;
    tvHash.inputs[1] <== timestamp;
    tvHash.inputs[2] <== salt;
    tvHash.out === totalValueCommitment;

    // Verify allocation commitment
    component allocHash = Poseidon(numProtocols + 1);
    for (var i = 0; i < numProtocols; i++) {
        allocHash.inputs[i] <== allocations[i];
    }
    allocHash.inputs[numProtocols] <== salt;
    allocHash.out === allocationCommitment;

    // Calculate weighted yield (for strategy optimization)
    signal weightedYield[numProtocols];
    signal totalYield;
    signal yieldSum[numProtocols + 1];
    yieldSum[0] <== 0;
    for (var i = 0; i < numProtocols; i++) {
        weightedYield[i] <== allocations[i] * yields[i];
        yieldSum[i + 1] <== yieldSum[i] + weightedYield[i];
    }
    totalYield <== yieldSum[numProtocols];
}

component main {public [totalValueCommitment, allocationCommitment, timestamp]} = YieldAllocation(10);
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Strategy Privacy** | Allocation logic hidden from competitors |
| **Position Privacy** | Individual protocol positions not visible |
| **Alpha Protection** | Profitable strategies not easily copied |
| **Gas Efficiency** | Batched rebalancing reduces per-user costs |
| **Yield Optimization** | Continuous movement to best opportunities |
| **Risk Management** | Private risk limits without exposure |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Strategy Leakage** | Encrypted execution; trusted infrastructure |
| **Protocol Risk** | Diversification limits; risk scoring |
| **Impermanent Loss** | Avoid or hedge LP positions; clear disclosure |
| **Smart Contract Risk** | Audited protocols only; insurance coverage |
| **Withdrawal Runs** | Liquidity reserves; staged withdrawal |
| **Manager Misconduct** | Time-locked strategy changes; governance oversight |

## Implementation Challenges

1. **Cross-Protocol Privacy**
   - Deposits to external protocols are visible
   - Need mixer or relay network for deposits
   - Consider protocol-native privacy features

2. **Yield Data Accuracy**
   - APY calculations vary by protocol
   - Need standardized measurement
   - Consider time-weighted returns

3. **Rebalancing Costs**
   - Gas costs can exceed yield differential
   - Need threshold-based rebalancing
   - Batch user operations for efficiency

4. **Strategy Complexity**
   - Simple strategies get copied faster
   - Complex strategies need sophisticated infrastructure
   - Balance complexity vs. transparency

5. **Liquidity Management**
   - Some yield positions are illiquid
   - Need liquidity buffers for withdrawals
   - Consider tiered withdrawal timing

## Derivatives

1. **Risk-Adjusted Yields** - Weight opportunities by risk-adjusted returns. Higher yields at higher risk discounted. Sharpe ratio optimization privately.

2. **Strategy Vaults** - Multiple vaults with different strategies. Conservative, balanced, aggressive options. Users choose risk profile; strategy hidden.

3. **Auto-Compounding** - Automatically reinvest yields. Compound interest without manual action. Gas-efficient batched harvesting.

4. **Cross-Protocol Migration** - Move positions across protocols as yields change. Seamless rebalancing without user action. Private migration paths.

5. **Yield Tokenization** - Tokenize future yield streams. Trade yield separately from principal. Enable yield speculation privately.

## Use Cases

1. **Passive Yield Optimization**
   - User deposits stablecoins seeking best yield
   - Aggregator moves across lending protocols
   - User earns optimal yield without active management
   - Strategy details hidden from copycats

2. **Institutional Yield Strategy**
   - Fund allocates to DeFi yield opportunities
   - Positions hidden from competitors
   - Performance reported without position disclosure
   - Competitive advantage maintained

3. **Treasury Management**
   - DAO treasury earning yield on reserves
   - Allocation strategy not public
   - Prevents front-running of large moves
   - Sustainable yield without gaming

4. **Risk-Managed Exposure**
   - User wants yield with risk limits
   - Aggregator enforces max per-protocol exposure
   - Automatic rebalancing on risk events
   - Risk management without revealing limits


## Real-World Products & User Experience

See: [../../product/i-off-chain/i3-yield-aggregator-products.md](../../product/i-off-chain/i3-yield-aggregator-products.md)

---

[Back to Index](../../README.md)
