# I6. Transaction Graph Obfuscation

Privacy infrastructure that breaks transaction linkability through routing, mixing, and timing obfuscation to prevent identity correlation.

**Requirements**: Mix network infrastructure | Timing randomization | Decoy generation | Graph analysis resistance

---

## Background

Even with private transactions, metadata can reveal identity:

- **Transaction Graph Analysis**: Flow patterns reveal sender-receiver relationships
- **Timing Correlation**: Transaction timing links deposits and withdrawals
- **Amount Matching**: Similar amounts across transactions enable linking
- **Behavioral Fingerprinting**: Usage patterns unique to individuals

Graph obfuscation addresses these by:
- Breaking direct transaction links through relays
- Adding random timing delays to prevent correlation
- Generating decoy transactions to confuse analysis
- Making all transactions indistinguishable

For ZK-DEX, this provides defense-in-depth privacy beyond transaction encryption.

## Technical Specification

### Architecture Overview

```
User                          Obfuscation Network                Final Destination
+--------+                    +------------------------+         +------------+
|        |  Transaction       |                        |         |            |
| Sender |------------------>| Relay Node 1           |         | Recipient  |
|        |                    |       |                |-------->|            |
+--------+                    |       v                |         +------------+
                              | +----------------+     |
                              | | Mix Pool       |     |
                              | | (batching)     |     |
                              | +----------------+     |
                              |       |                |
                              |       v                |
                              | Relay Node 2           |
                              |       |                |
                              |       v                |
                              | +----------------+     |
                              | | Timing Delay   |     |
                              | | (randomized)   |     |
                              | +----------------+     |
                              |       |                |
                              |       v                |
                              | Relay Node 3           |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Relay Nodes** | Forward transactions without linking input/output |
| **Mix Pool** | Batches transactions to break timing correlation |
| **Timing Randomizer** | Adds variable delays to obfuscate timing |
| **Decoy Generator** | Creates fake transactions to confuse analysis |
| **Path Selector** | Chooses relay routes to maximize privacy |
| **Graph Monitor** | Detects potential deanonymization attempts |

### Data Flows

1. **Transaction Submission**
   - User creates transaction with multiple potential paths
   - Onion-encrypted for each relay in path
   - First relay receives, unwraps one layer

2. **Mixing Phase**
   - Transactions collected in mix pool
   - Batched with others of similar characteristics
   - Random delay applied before forwarding

3. **Final Delivery**
   - Last relay delivers to destination
   - No single relay knows both source and destination
   - Timing uncorrelated with original submission

### Obfuscation Protocol

```
Protocol: Dandelion++ Style Propagation

Stem Phase (Privacy):
1. Transaction enters anonymity phase
2. Forwarded through random relay chain
3. Each relay knows only predecessor and successor
4. Chain length: random between 1-10 hops

Fluff Phase (Propagation):
1. After stem, enters normal broadcast
2. Propagates to all nodes
3. Origin indistinguishable from relay

Timing Obfuscation:
- Each hop adds random delay (0-30 seconds)
- Poisson distribution mimics natural traffic
- Batch release at regular intervals

Decoy Traffic:
- Network generates constant background transactions
- Real transactions indistinguishable from decoys
- Traffic analysis yields no information
```

### Graph Privacy Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template RelayHop() {
    // Public inputs
    signal input inputCommitment;    // Previous hop commitment
    signal input outputCommitment;   // This hop commitment
    signal input relayCommitment;    // Hidden relay identity

    // Private inputs
    signal input value;              // Transaction value
    signal input sender;             // Original sender (hidden)
    signal input receiver;           // Final receiver (hidden)
    signal input relayPk;            // This relay's key
    signal input hopNumber;          // Position in chain
    signal input inputSalt;
    signal input outputSalt;

    // Verify input commitment from previous hop
    component inHash = Poseidon(4);
    inHash.inputs[0] <== value;
    inHash.inputs[1] <== sender;
    inHash.inputs[2] <== hopNumber - 1;
    inHash.inputs[3] <== inputSalt;
    inHash.out === inputCommitment;

    // Create output commitment for next hop
    component outHash = Poseidon(4);
    outHash.inputs[0] <== value;
    outHash.inputs[1] <== sender;
    outHash.inputs[2] <== hopNumber;
    outHash.inputs[3] <== outputSalt;
    outHash.out === outputCommitment;

    // Verify relay commitment
    component relayHash = Poseidon(2);
    relayHash.inputs[0] <== relayPk;
    relayHash.inputs[1] <== hopNumber;
    relayHash.out === relayCommitment;
}

component main {public [inputCommitment, outputCommitment, relayCommitment]} = RelayHop();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Sender Privacy** | Cannot determine original sender from output |
| **Receiver Privacy** | Cannot determine final recipient from input |
| **Timing Privacy** | Random delays prevent timing correlation |
| **Amount Privacy** | Batching and decoys prevent amount matching |
| **Behavioral Privacy** | Usage patterns obscured by mixing |
| **Graph Resistance** | Transaction graph provides no information |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Relay Collusion** | Sufficient relay diversity; threshold paths |
| **Timing Analysis** | Random delays; constant traffic generation |
| **Volume Analysis** | Standard transaction sizes; amount splitting |
| **Long-Term Correlation** | Regular path rotation; decoy refresh |
| **Sybil Attacks** | Relay staking; reputation requirements |
| **Network-Level Attacks** | Tor/I2P integration; encrypted communication |

## Implementation Challenges

1. **Latency vs. Privacy**
   - More mixing = better privacy = more delay
   - Need configurable privacy levels
   - Fast track for time-sensitive transactions

2. **Relay Incentives**
   - Relays need compensation for service
   - Fees must not reveal transaction value
   - Consider fixed relay fees

3. **Anonymity Set Size**
   - Larger batches = better privacy
   - Low volume reduces anonymity
   - Need critical mass of users

4. **Decoy Sustainability**
   - Decoys cost gas/resources
   - Need economic model for decoy generation
   - Protocol-funded or user-funded

5. **Active Attacks**
   - Adversary may inject transactions
   - Flood attacks to reduce anonymity
   - Rate limiting and proof-of-work

## Derivatives

1. **Dandelion++ Protocol** - Two-phase propagation (stem/fluff). Stem phase provides sender anonymity. Fluff phase ensures delivery.

2. **Onion Routing** - Layered encryption through multiple relays. Each relay removes one encryption layer. End-to-end path privacy.

3. **Mix Networks** - Batch transactions and shuffle. Cryptographic mixing protocols. Verifiable shuffle proofs.

4. **Timing Obfuscation** - Random delay injection at each hop. Poisson-distributed timing. Constant-rate traffic patterns.

5. **Decoy Transactions** - Protocol-generated fake transactions. Indistinguishable from real traffic. Increases anonymity set.

## Use Cases

1. **Private Salary Payment**
   - Employer pays employee monthly
   - Direct payment reveals salary timing
   - Obfuscated transfer breaks correlation
   - Salary privacy maintained

2. **Anonymous Donation**
   - Donor wants privacy from recipient
   - Direct transfer reveals donor
   - Routed through mix network
   - Recipient receives anonymous donation

3. **Trading Privacy**
   - Trader executes multiple trades
   - Pattern reveals strategy
   - Transactions obfuscated through relays
   - Trading behavior hidden

4. **Whistleblower Protection**
   - Source sends sensitive information
   - Must not be traceable
   - Maximum obfuscation applied
   - Source identity protected


## Real-World Products & User Experience

See: [../../product/i-off-chain/i6-graph-obfuscation-products.md](../../product/i-off-chain/i6-graph-obfuscation-products.md)

---

[Back to Index](../../README.md)
