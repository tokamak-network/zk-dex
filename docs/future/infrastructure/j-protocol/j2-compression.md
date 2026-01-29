# J2. Proof Compression

Techniques for reducing proof size and on-chain footprint while maintaining security guarantees and verification efficiency.

**Requirements**: Compression algorithms | Succinct proof systems | On-chain decompression | Calldata optimization

---

## Background

Proof size directly impacts on-chain costs and scalability:

- **Calldata Costs**: ~16 gas per byte; large proofs expensive
- **Storage Requirements**: Proofs may need on-chain storage
- **Bandwidth Limitations**: Large proofs slow to transmit and verify
- **Block Space Competition**: Limited space for proof data

Proof compression addresses these by:
- Minimizing proof representation without losing information
- Using succinct proof systems with smaller native proofs
- Aggregating multiple proofs to amortize size
- Exploiting on-chain computation vs. data trade-offs

For ZK-DEX, compression enables cost-effective high-volume proof verification.

## Technical Specification

### Architecture Overview

```
Prover                        Compression Layer                  On-Chain
+-------------+               +------------------------+         +-------------+
|             |               |                        |         |             |
| Generate    |  Full Proof   |  Compression           |  Small  |  Decompress |
| Proof       |-------------->|  Algorithm             |  Proof  |  & Verify   |
| (~1MB)      |               |                        |-------->|             |
|             |               |  +----------------+    |  (~256B)|             |
+-------------+               |  | SNARK Wrapper  |    |         +-------------+
                              |  +----------------+    |
                              |         |              |
                              |         v              |
                              |  +----------------+    |
                              |  | Calldata       |    |
                              |  | Optimization   |    |
                              |  +----------------+    |
                              +------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **SNARK Wrapper** | Wraps proofs in more succinct proof system |
| **Proof Serializer** | Optimizes proof encoding for calldata |
| **Compression Engine** | Applies algorithmic compression |
| **Decompression Contract** | On-chain proof reconstruction |
| **Batching Layer** | Aggregates proofs before compression |
| **Verification Adapter** | Interfaces compressed proofs with verifier |

### Data Flows

1. **Proof Generation**
   - Original proof generated (may be large STARK)
   - Proof passes to compression layer

2. **Compression Pipeline**
   - SNARK wrapper creates succinct proof-of-proof
   - Calldata optimization applied
   - Final compressed proof produced

3. **On-Chain Verification**
   - Compressed proof submitted in transaction
   - Decompression if needed
   - Verification of decompressed/wrapped proof

### Compression Strategies

| Strategy | Compression Ratio | Verification Cost | Trade-off |
|----------|-------------------|-------------------|-----------|
| **STARK-to-SNARK** | 100-1000x | Low | Proving time increase |
| **Proof Aggregation** | Nx | Constant | Batching latency |
| **Encoding Optimization** | 1.5-2x | None | Limited compression |
| **Deferred Verification** | N/A | Amortized | Challenge period |

### SNARK Wrapper Circuit

```circom
pragma circom 2.1.0;

// Conceptual: SNARK that verifies a STARK proof
// Real implementations use specialized libraries

include "../utils/poseidon/poseidon.circom";

template STARKVerifierSNARK() {
    // Public inputs
    signal input starkPublicInputs[10];  // Original STARK public inputs
    signal input proofCommitment;         // Commitment to STARK proof

    // Private inputs (the STARK proof data)
    signal input starkProof[1000];        // STARK proof elements
    signal input auxiliaryData[100];      // Verification hints

    // Verify STARK proof within SNARK circuit
    // This is computationally intensive but produces small proof

    // 1. Verify Merkle roots of STARK trace
    component traceVerifier = STARKTraceVerifier();
    // ... verification logic

    // 2. Verify FRI layer consistency
    component friVerifier = FRIVerifier();
    // ... verification logic

    // 3. Verify constraint satisfaction
    component constraintChecker = ConstraintChecker();
    // ... verification logic

    // 4. Commit to proof for reference
    component proofHash = Poseidon(1000);
    for (var i = 0; i < 1000; i++) {
        proofHash.inputs[i] <== starkProof[i];
    }
    proofHash.out === proofCommitment;
}

component main {public [starkPublicInputs, proofCommitment]} = STARKVerifierSNARK();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Gas Costs** | 10-100x reduction in calldata costs |
| **Throughput** | More proofs per block |
| **Latency** | Trade-off: compression adds proving time |
| **Flexibility** | Can use any proof system, wrap for efficiency |
| **Composability** | Uniform proof format regardless of source |
| **Storage** | Smaller proofs for archival and indexing |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Compression Soundness** | Wrapper proof system well-analyzed |
| **Decompression Bugs** | Formal verification of decompressor |
| **Side Channel Attacks** | Constant-time compression algorithms |
| **Proof Malleability** | Canonical compression format |
| **Wrapper Overhead** | Efficient wrapper circuit design |
| **Trusted Setup (SNARK wrapper)** | Reuse existing ceremonies; transparent alternatives |

## Implementation Challenges

1. **STARK-to-SNARK Complexity**
   - Verifying STARK in SNARK circuit is expensive
   - Millions of constraints for full verification
   - Need optimized STARK verifier circuits

2. **Proving Time Trade-off**
   - Compression increases total proving time
   - May need parallel proving infrastructure
   - Balance compression vs. latency

3. **Proof System Compatibility**
   - Different proof systems have different structures
   - Need generic wrapper or system-specific optimizations
   - Consider proof aggregation compatibility

4. **On-Chain Gas Optimization**
   - Even small proofs have gas overhead
   - Optimize calldata encoding
   - Consider blob transactions (EIP-4844)

5. **Verification Contract Complexity**
   - Complex verifiers have more attack surface
   - Balance between gas and security
   - Consider precompiles for common operations

## Derivatives

1. **Succinct Proofs** - Use inherently succinct proof systems (Groth16, PLONK). ~256 byte proofs natively. Trade-off: require trusted setup.

2. **Aggregated Verification** - Batch multiple proofs; single aggregated verification. Amortizes per-proof overhead. Logarithmic or constant verification cost.

3. **Proof Streaming** - Send proofs incrementally as generated. Early verification of partial proofs. Reduces perceived latency.

4. **Deferred Verification** - Post commitment, verify lazily on-demand. Optimistic model with challenge period. Extreme cost reduction for honest case.

5. **Proof Caching** - Cache verified proofs for reuse. Skip re-verification of known proofs. Useful for repeated operations.

## Use Cases

1. **STARK to Ethereum**
   - Application uses STARKs (no trusted setup)
   - STARK proofs are ~100KB+
   - Wrap in SNARK for ~256B on-chain
   - Best of both worlds

2. **High-Volume DEX**
   - Thousands of trades generate proofs
   - Aggregate and compress daily batch
   - Single small proof settles everything
   - Dramatic cost reduction

3. **Cross-Rollup Proofs**
   - Multiple rollups generate proofs
   - Compress each for efficient bridging
   - Aggregate compressed proofs
   - Efficient multi-rollup settlement

4. **Mobile Verification**
   - Mobile devices verify proofs
   - Bandwidth and compute limited
   - Compressed proofs essential
   - Enable mobile-first applications


## Real-World Products & User Experience

See: [../../product/j-protocol/j2-compression-products.md](../../product/j-protocol/j2-compression-products.md)

---

[Back to Index](../../README.md)
