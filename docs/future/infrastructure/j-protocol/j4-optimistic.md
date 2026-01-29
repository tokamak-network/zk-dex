# J4. Optimistic Rollup Mode

Hybrid protocol mode using optimistic execution with ZK proof fallback, reducing costs during normal operation while maintaining security through fraud proofs.

**Requirements**: Optimistic executor | Fraud proof circuits | Challenge mechanism | Fallback to ZK mode

---

## Background

Pure ZK-rollups have high computational overhead:

- **Proving Costs**: ZK proof generation is computationally expensive
- **Hardware Requirements**: Specialized hardware needed for efficient proving
- **Latency**: Proof generation adds delay to finality
- **Complexity**: ZK circuits are difficult to develop and audit

Optimistic mode addresses these by:
- Assuming all transactions are valid by default
- Only generating ZK proofs when challenged
- Dramatically reducing normal-case costs
- Maintaining security through economic incentives

For ZK-DEX, this enables cost-effective operation while preserving the option for ZK-level security.

## Technical Specification

### Architecture Overview

```
Transactions                  Hybrid Rollup                      L1 Settlement
+-------------+               +------------------------+         +-------------+
|             |               |                        |         |             |
| Tx 1        |               |  Optimistic Path       |         |             |
| Tx 2        |-------------->|  (assume valid)        |-------->|  State Root |
| Tx 3        |               |                        |         |  Posted     |
| ...         |               +------------------------+         |             |
+-------------+                        |                         +-------------+
                                       |                              |
                                Challenge?                            v
                                       |                         +-------------+
                                       v                         |             |
                              +------------------------+         |  Challenge  |
                              |                        |         |  Period     |
                              |  ZK Fallback           |         |  (7 days)   |
                              |  (generate proof)      |-------->|             |
                              |                        |         +-------------+
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Sequencer** | Orders and executes transactions optimistically |
| **State Poster** | Posts state roots to L1 |
| **Challenge Contract** | Accepts and processes fraud claims |
| **Fraud Proof Generator** | Creates proofs of invalid execution |
| **ZK Fallback Prover** | Generates ZK proofs when needed |
| **Dispute Resolver** | Determines challenge outcomes |

### Data Flows

1. **Optimistic Execution**
   - Sequencer executes transactions
   - State root posted to L1
   - Assumed valid; no proof required

2. **Challenge Window**
   - Anyone can challenge posted state
   - Challenge requires bond
   - Triggers fraud proof game

3. **Dispute Resolution**
   - Interactive or non-interactive fraud proof
   - Invalid state: revert and slash sequencer
   - Valid state: slash challenger

### Fraud Proof Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/merkle/sparse_merkle_tree.circom";

template FraudProof() {
    // Public inputs
    signal input claimedStateRoot;    // State root posted by sequencer
    signal input correctStateRoot;    // Actual correct state root
    signal input transactionHash;     // Transaction being disputed
    signal input preStateRoot;        // State before transaction

    // Private inputs
    signal input transaction[10];     // Transaction data
    signal input preStateWitness[32]; // Merkle proof of pre-state
    signal input stateTransition[10]; // Correct state changes

    // Verify pre-state is in claimed history
    component preCheck = MerkleProof(32);
    // ... verify preStateRoot leads to valid chain

    // Execute transaction correctly
    component executor = TransactionExecutor();
    executor.preState <== preStateRoot;
    for (var i = 0; i < 10; i++) {
        executor.tx[i] <== transaction[i];
    }

    // Verify correct execution differs from claimed
    signal computedRoot;
    computedRoot <== executor.postState;
    computedRoot === correctStateRoot;

    // Prove claimed root is wrong
    component notEqual = IsZero();
    notEqual.in <== claimedStateRoot - correctStateRoot;
    notEqual.out === 0;  // Must be different (fraud occurred)
}

component main {public [claimedStateRoot, correctStateRoot, transactionHash, preStateRoot]} = FraudProof();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Cost (Normal)** | ~90% reduction vs. pure ZK |
| **Cost (Dispute)** | Higher due to fraud proof generation |
| **Latency (Normal)** | Instant soft confirmation |
| **Latency (Final)** | 7-day challenge period for finality |
| **Security** | Economic security; rational actors |
| **Complexity** | Simpler execution; complex dispute logic |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Sequencer Fraud** | Economic bonds; slashing |
| **Challenge Spam** | Challenger bonds; loser pays |
| **Data Withholding** | Data availability requirements |
| **Collusion** | Decentralized challengers; whistleblower rewards |
| **Liveness Failure** | Forced inclusion mechanisms |
| **Long Finality** | Fast withdrawal bridges; liquidity providers |

## Implementation Challenges

1. **Finality Delay**
   - 7-day challenge period standard
   - Poor UX for fast finality needs
   - Need liquidity bridges for faster withdrawals

2. **Data Availability**
   - Must publish all transaction data
   - Enables anyone to verify and challenge
   - Data costs can be significant

3. **Fraud Proof Complexity**
   - Interactive proofs require multiple rounds
   - Non-interactive proofs need complete proof
   - Both have implementation challenges

4. **Challenger Incentives**
   - Must incentivize honest monitoring
   - Balance between rewards and spam prevention
   - Consider insurance/staking models

5. **Hybrid Mode Transitions**
   - When to switch to ZK mode?
   - How to handle mode transitions?
   - Consistency across modes

## Derivatives

1. **Hybrid ZK/Optimistic** - Use optimistic for normal operation; ZK for high-value or disputed transactions. Dynamic mode selection based on transaction characteristics.

2. **Challenge Games** - Interactive dispute resolution protocol. Binary search to isolate fraud. Logarithmic number of on-chain steps.

3. **Fraud Proof Generation** - Automated proof generation on challenge. Pre-computed proofs for common disputes. Efficient proof circuits.

4. **Sequencer Selection** - Decentralized sequencer rotation. Economic security through stake. Prevents single point of failure.

5. **Data Availability** - Ensure transaction data is available. On-chain calldata or separate DA layer. Critical for fraud proof generation.

## Use Cases

1. **Cost-Sensitive Applications**
   - Gaming with many low-value transactions
   - ZK proofs too expensive per-transaction
   - Optimistic mode reduces costs 90%+
   - ZK fallback for security guarantees

2. **Fast-but-Safe Trading**
   - Instant trade execution optimistically
   - Full finality after challenge period
   - Fast withdrawal bridges for urgent needs
   - Best of both worlds

3. **Gradual ZK Migration**
   - Start with optimistic mode
   - Gradually add ZK proofs for components
   - Full ZK migration over time
   - Reduced development risk

4. **High-Frequency Market Making**
   - Thousands of quotes per second
   - ZK proof per quote impractical
   - Optimistic execution for speed
   - ZK settlement for net positions


## Real-World Products & User Experience

See: [../../../product/j-protocol/j4-optimistic-products.md](../../../product/j-protocol/j4-optimistic-products.md)

---

[Back to Index](../../README.md)
