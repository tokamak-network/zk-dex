# I10. Prover Marketplace

Decentralized marketplace for ZK proof generation services enabling competitive proving with quality guarantees and efficient resource allocation.

**Requirements**: Proof request protocol | Prover registration | Quality verification | Payment settlement

---

## Background

ZK proof generation is computationally intensive with significant challenges:

- **Hardware Requirements**: Proving requires expensive GPU/FPGA infrastructure
- **Centralization Risk**: Few entities can afford proving infrastructure
- **Latency Sensitivity**: Users want fast proofs; hardware is slow
- **Resource Inefficiency**: Proving capacity often underutilized or insufficient

A prover marketplace addresses these by:
- Creating competitive market for proving services
- Enabling hardware owners to monetize idle capacity
- Providing users with fast, reliable proof generation
- Decentralizing the proving layer of ZK systems

For ZK-DEX, this ensures reliable, fast proof generation without centralized infrastructure.

## Technical Specification

### Architecture Overview

```
Proof Requesters              Prover Marketplace                 Provers
+------------+                +------------------------+         +----------+
|            |  Request       |                        |         |          |
| User 1     |--------------->|  Job Dispatcher        |-------->| Prover 1 |
|            |                |                        |         | (GPU)    |
+------------+                |  +----------------+    |         +----------+
|            |  Request       |  | Reputation     |    |         |          |
| User 2     |--------------->|  | System         |    |-------->| Prover 2 |
|            |                |  +----------------+    |         | (FPGA)   |
+------------+                |         |              |         +----------+
                              |         v              |         |          |
                              |  +----------------+    |-------->| Prover 3 |
                              |  | Auction/Match  |    |         | (Cloud)  |
                              |  +----------------+    |         +----------+
                              |         |              |
                              |         v              |
                              |  Payment Settlement    |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Job Dispatcher** | Receives proof requests; routes to provers |
| **Prover Registry** | Tracks registered provers and capabilities |
| **Matching Engine** | Matches requests to optimal provers |
| **Reputation System** | Tracks prover reliability and performance |
| **Verification Layer** | Validates submitted proofs |
| **Payment Contract** | Handles escrow and settlement |

### Data Flows

1. **Request Submission**
   - User submits proof request with witness data
   - Specifies requirements (latency, circuit type, price)
   - Payment escrowed

2. **Prover Matching**
   - Dispatcher matches request to capable provers
   - Auction or first-come assignment
   - Prover accepts job

3. **Proof Generation & Settlement**
   - Prover generates proof
   - Verification layer validates proof
   - Payment released; reputation updated

### Prover Registration Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template ProverRegistration() {
    // Public inputs
    signal input proverCommitment;    // Commitment to prover identity
    signal input capabilityHash;      // Hash of supported circuits
    signal input stakeAmount;         // Slashable stake
    signal input registrationTime;

    // Private inputs
    signal input proverPk;            // Prover public key
    signal input capabilities[10];    // Supported circuit types
    signal input hardwareSpec;        // Hardware capabilities
    signal input salt;

    // Verify prover commitment
    component proverHash = Poseidon(3);
    proverHash.inputs[0] <== proverPk;
    proverHash.inputs[1] <== hardwareSpec;
    proverHash.inputs[2] <== salt;
    proverHash.out === proverCommitment;

    // Verify capability commitment
    component capHash = Poseidon(11);
    for (var i = 0; i < 10; i++) {
        capHash.inputs[i] <== capabilities[i];
    }
    capHash.inputs[10] <== salt;
    capHash.out === capabilityHash;
}

component main {public [proverCommitment, capabilityHash, stakeAmount, registrationTime]} = ProverRegistration();
```

### Proof Job Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template ProofJob() {
    // Public inputs
    signal input jobId;               // Unique job identifier
    signal input circuitHash;         // Which circuit to prove
    signal input inputCommitment;     // Commitment to witness
    signal input deadline;            // Required completion time
    signal input maxPrice;            // Maximum payment

    // Private inputs
    signal input witness[100];        // Actual witness data
    signal input requesterPk;         // Requester identity
    signal input salt;

    // Verify input commitment matches witness
    component inputHash = Poseidon(101);
    for (var i = 0; i < 100; i++) {
        inputHash.inputs[i] <== witness[i];
    }
    inputHash.inputs[100] <== salt;
    inputHash.out === inputCommitment;
}

component main {public [jobId, circuitHash, inputCommitment, deadline, maxPrice]} = ProofJob();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Decentralization** | No single proving entity; competitive market |
| **Cost Efficiency** | Competition drives down proving costs |
| **Latency Reduction** | Multiple provers reduce wait times |
| **Resource Utilization** | Idle capacity monetized |
| **Reliability** | Redundant provers; failover capability |
| **Scalability** | Market grows with demand |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Witness Privacy** | Encrypted witness transmission; TEE option |
| **Proof Forgery** | On-chain verification; slashing for invalid proofs |
| **Prover Collusion** | Diverse prover set; random assignment |
| **DoS Attacks** | Rate limiting; stake requirements |
| **Payment Disputes** | Escrow; arbitration mechanism |
| **Timing Attacks** | Batched job assignment; random delays |

## Implementation Challenges

1. **Witness Confidentiality**
   - Prover needs witness to generate proof
   - Witness may contain sensitive data
   - Consider trusted hardware (TEE) or MPC proving

2. **Proof Verification Cost**
   - Must verify proofs are correct
   - Verification also has cost
   - Optimistic verification with challenges

3. **Latency Guarantees**
   - Users need predictable timing
   - Hardware performance varies
   - SLA commitments with penalties

4. **Price Discovery**
   - Fair pricing without race to bottom
   - Variable demand/supply
   - Consider Dutch auctions or posted prices

5. **Circuit Specialization**
   - Different circuits have different requirements
   - Provers may specialize
   - Need rich capability matching

## Derivatives

1. **Proof Auctions** - Competitive bidding for proof jobs. Provers bid on price and time. Requester selects optimal offer.

2. **Proof Verification** - Separate service verifying submitted proofs. Catches invalid proofs before payment. Reduces on-chain verification load.

3. **Prover Reputation** - Long-term reputation scores. Based on reliability, speed, accuracy. Higher reputation = more jobs.

4. **Hardware Acceleration** - Specialized hardware (FPGA, ASIC) proving. Higher throughput; lower unit cost. Premium for fast provers.

5. **Proof Aggregation** - Combine multiple proof requests. Single aggregated proof for batch. Reduced per-proof cost.

## Use Cases

1. **User Transaction Proving**
   - User creates ZK-DEX transaction
   - Submits witness to marketplace
   - Prover generates proof; user pays fee
   - Transaction submitted to chain

2. **Batch Proof Generation**
   - ZK-DEX accumulates pending transactions
   - Batch submitted to marketplace
   - Prover generates aggregated proof
   - Efficient batch settlement

3. **Real-Time Proving**
   - Time-sensitive transaction needs fast proof
   - Premium pricing for expedited service
   - High-performance prover accepts
   - Proof delivered within seconds

4. **Proof Redundancy**
   - Critical transaction needs reliability
   - Multiple provers assigned
   - First valid proof used; others discarded
   - Guaranteed completion


## Real-World Products & User Experience

See: [../../../product/i-off-chain/i10-prover-market-products.md](../../../product/i-off-chain/i10-prover-market-products.md)

---

[Back to Index](../../README.md)
