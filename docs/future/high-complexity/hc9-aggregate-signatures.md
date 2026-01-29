# HC9. Aggregate Signature Verification

Verify many EdDSA/Schnorr signatures in a single proof.

**Constraints**: ~800K | **Complexity**: Very High

---

## Background

Multi-signature verification is expensive on-chain:
- Each ECDSA verification costs ~3,000 gas
- 100 signatures = 300,000 gas just for verification
- DAO governance requires many signatures
- Cross-chain validation needs efficient verification

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| Individual ECDSA | O(n) gas cost; 3K gas per signature |
| Gnosis Safe multi-sig | Limited signers; sequential verification |
| Native BLS precompile | Not available on most chains |
| Threshold ECDSA | Complex DKG; requires online coordination |

Aggregate signature circuits amortize verification cost to O(1), enabling verification of 100+ signatures for the cost of one ZK proof.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `messageHash` | field | Hash of message being signed |
| `aggregatePubKeyX/Y` | field | Combined public key |
| `aggregateR_X/Y` | field | Combined R point |
| `aggregateS` | field | Combined S scalar |
| `signerBitmap` | uint256 | Bitmap of which signers participated |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pubKeyX/Y` | field[N_SIGS] | Individual public keys |
| `R_X/Y, S` | field[N_SIGS] | Individual signature components |
| `isActive` | bool[N_SIGS] | Which signatures are included |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Gas Cost** | O(1) instead of O(n) for n signatures (~300K for any n) |
| **Scalability** | Support 100s of signers economically |
| **Threshold** | Easily implement m-of-n schemes |
| **Privacy** | Can hide which keys signed (optional) |
| **Cross-Chain** | Efficient multi-chain validation |
| **Composability** | Standard interface for multi-sig operations |

## Derivatives

1. **Threshold Signatures (k-of-n)** - Only k signatures required from n possible signers. Circuit verifies at least k active signatures. Useful for governance quorum requirements.

2. **Ring Signatures** - Anonymous signing from a group. Verifier knows one of group signed but not which. Requires ring membership proof. Privacy-preserving voting.

3. **Blind Signatures** - Signer doesn't see message content. Useful for anonymous credentials. Requires commitment scheme integration.

4. **Time-Delayed Signatures** - Signature valid only after timestamp. Include timestamp check in circuit. Useful for timelock governance.

5. **Revocable Signatures** - Can revoke before deadline using revocation list. Merkle tree of revoked signatures. Useful for changeable votes.

```circom
pragma circom 2.1.0;

include "../utils/babyjubjub/babyjubjub.circom";
include "../utils/babyjubjub/eddsa_verify.circom";
include "../utils/comparators.circom";

template AggregateSignatureVerify(N_SIGS) {
    // ===== Public Inputs =====
    signal input messageHash;
    signal input aggregatePubKeyX;
    signal input aggregatePubKeyY;
    signal input aggregateR_X;
    signal input aggregateR_Y;
    signal input aggregateS;
    signal input minSigners;  // Threshold requirement

    // ===== Private Inputs =====
    signal input pubKeyX[N_SIGS], pubKeyY[N_SIGS];
    signal input R_X[N_SIGS], R_Y[N_SIGS];
    signal input S[N_SIGS];
    signal input isActive[N_SIGS];

    // ===== Component Declarations =====
    component verify[N_SIGS];
    component addPubKey[N_SIGS];
    component addR[N_SIGS];
    component thresholdCheck;

    // Intermediate signals for accumulation
    signal accPubKeyX[N_SIGS + 1];
    signal accPubKeyY[N_SIGS + 1];
    signal accR_X[N_SIGS + 1];
    signal accR_Y[N_SIGS + 1];
    signal activeCount[N_SIGS + 1];

    // Initialize accumulators with identity point (0, 1) for BabyJubJub
    accPubKeyX[0] <== 0;
    accPubKeyY[0] <== 1;
    accR_X[0] <== 0;
    accR_Y[0] <== 1;
    activeCount[0] <== 0;

    // ===== Verify Each Signature and Aggregate =====
    for (var i = 0; i < N_SIGS; i++) {
        // Boolean check for isActive
        isActive[i] * (1 - isActive[i]) === 0;

        // Verify individual EdDSA signature (if active)
        verify[i] = EdDSAVerify();
        verify[i].enabled <== isActive[i];
        verify[i].Ax <== pubKeyX[i];
        verify[i].Ay <== pubKeyY[i];
        verify[i].R8x <== R_X[i];
        verify[i].R8y <== R_Y[i];
        verify[i].S <== S[i];
        verify[i].M <== messageHash;

        // Aggregate public key (conditional point addition)
        addPubKey[i] = BabyJubJubPointAddConditional();
        addPubKey[i].x1 <== accPubKeyX[i];
        addPubKey[i].y1 <== accPubKeyY[i];
        addPubKey[i].x2 <== pubKeyX[i];
        addPubKey[i].y2 <== pubKeyY[i];
        addPubKey[i].condition <== isActive[i];
        accPubKeyX[i + 1] <== addPubKey[i].outX;
        accPubKeyY[i + 1] <== addPubKey[i].outY;

        // Aggregate R point
        addR[i] = BabyJubJubPointAddConditional();
        addR[i].x1 <== accR_X[i];
        addR[i].y1 <== accR_Y[i];
        addR[i].x2 <== R_X[i];
        addR[i].y2 <== R_Y[i];
        addR[i].condition <== isActive[i];
        accR_X[i + 1] <== addR[i].outX;
        accR_Y[i + 1] <== addR[i].outY;

        // Count active signers
        activeCount[i + 1] <== activeCount[i] + isActive[i];
    }

    // ===== Verify Aggregates Match Public Inputs =====
    accPubKeyX[N_SIGS] === aggregatePubKeyX;
    accPubKeyY[N_SIGS] === aggregatePubKeyY;
    accR_X[N_SIGS] === aggregateR_X;
    accR_Y[N_SIGS] === aggregateR_Y;

    // ===== Verify Aggregate S =====
    var sumS = 0;
    for (var i = 0; i < N_SIGS; i++) {
        sumS += S[i] * isActive[i];
    }
    sumS === aggregateS;

    // ===== Verify Threshold Met =====
    thresholdCheck = LessThan(16);
    thresholdCheck.in[0] <== minSigners;
    thresholdCheck.in[1] <== activeCount[N_SIGS] + 1;
    thresholdCheck.out === 1;
}

component main {public [messageHash, aggregatePubKeyX, aggregatePubKeyY,
    aggregateR_X, aggregateR_Y, aggregateS, minSigners]} = AggregateSignatureVerify(100);
```

### Key Constraints

1. **Individual Verification**: Each active signature verified against message
2. **Aggregate Public Key**: Sum of active public keys matches commitment
3. **Aggregate R Point**: Sum of active R points matches commitment
4. **Aggregate S Scalar**: Sum of active S values matches commitment
5. **Threshold**: At least minSigners active signatures

## BLS vs EdDSA Aggregation: Technical Comparison

| Aspect | BLS Aggregation | EdDSA in ZK (Current) |
|--------|-----------------|----------------------|
| **Native Aggregation** | Yes - mathematical property | No - requires ZK proof |
| **On-chain Verification** | ~50K gas with precompile | ~300K gas (ZK proof) |
| **Circuit Complexity** | N/A (no circuit needed) | ~800K constraints for 100 sigs |
| **Curve** | BLS12-381 | BabyJubJub (SNARK-friendly) |
| **EVM Support** | Precompile on some chains | Works everywhere |
| **Rogue Key Attack** | Requires PoP or key aggregation | Not applicable |
| **Signature Size** | 48 bytes (aggregated) | Varies with proof system |

### When to Use Each

**Use BLS Aggregation when:**
- Target chain has BLS precompile (ETH 2.0 beacon chain)
- Pure signature aggregation is the goal
- No additional ZK privacy requirements
- Standardized key management acceptable

**Use EdDSA in ZK when:**
- Need SNARK-friendly curve for other computations
- Want to hide which signers participated
- Need conditional/threshold logic in same proof
- Cross-chain compatibility required
- Combining signature verification with other ZK logic

### Hybrid Approach

For maximum efficiency, consider a hybrid:
1. Use BLS for raw signature aggregation
2. Use ZK proof to verify BLS aggregate + add privacy/logic

```
BLS Aggregate (off-chain) -> ZK Proof (verify aggregate + extra logic)
```

This reduces ZK circuit complexity while gaining BLS efficiency.

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Rogue Key Attack** | Use proof of possession (PoP) for key registration |
| **Message Malleability** | Hash message with domain separator |
| **Replay Attacks** | Include nonce or chain ID in message |
| **Signer Set Manipulation** | Aggregate pubkey committed before signatures |
| **Threshold Circumvention** | Circuit enforces minimum signer count |
| **Key Reuse** | Recommend unique keys per application |
| **Timing Attacks** | Constant-time ZK proving |

## Implementation Challenges

1. **Conditional Point Addition**
   - Standard point addition fails for identity
   - Need conditional logic for inactive signers
   - Use specialized BabyJubJubPointAddConditional template

2. **Signer Ordering**
   - Must have deterministic signer ordering
   - Public key list must be committed beforehand
   - Consider sorted by pubkey hash for consistency

3. **Key Registration**
   - How do signers register their keys?
   - Need proof of possession to prevent rogue keys
   - Consider on-chain key registry

4. **Large Signer Sets**
   - 100 signers = ~800K constraints
   - 1000 signers may require recursive proofs
   - Consider batching or hierarchical aggregation

5. **Dynamic Signer Sets**
   - What if signers change over time?
   - Need versioned signer sets with epoch management
   - Or Merkle tree of authorized signers

## Use Cases

1. **DAO Governance**
   - 100 token holders vote on proposal
   - Single ZK proof verifies all signatures
   - Cost: ~300K gas regardless of voter count

2. **Multi-Party Wallet**
   - 5-of-10 corporate treasury
   - Any 5 signers can authorize transaction
   - Privacy: can hide which 5 signed

3. **Cross-Chain Bridge**
   - Validator set signs cross-chain message
   - Efficient verification on destination chain
   - Threshold ensures Byzantine fault tolerance

4. **Attestation Services**
   - Multiple oracles attest to data
   - Aggregate attestations into single proof
   - Reduces on-chain verification cost

5. **Voting Systems**
   - Anonymous voting with signature aggregation
   - Prove vote count without revealing individual votes
   - Verifiable election results

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/high-complexity/hc9-aggregate-signatures-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
