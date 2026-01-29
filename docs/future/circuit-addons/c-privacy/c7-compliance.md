# C7. Compliance Proof (AML)

Prove transaction compliance with AML thresholds without revealing exact amounts or identities.

**Constraints**: ~120K | **Complexity**: Low

---

## Background

AML compliance is a critical requirement for financial systems globally:

- **Regulatory Requirements**: AML laws require monitoring transactions above certain thresholds (e.g., $10,000 USD)
- **Privacy Conflict**: Traditional AML requires full transaction visibility, conflicting with user privacy
- **ZK Solution**: Prove compliance without revealing exact amounts or participant identities
- **Travel Rule Compatibility**: Can satisfy FATF Travel Rule requirements with minimal disclosure
- **Institutional Adoption**: Enables regulated entities to use privacy-preserving systems

Financial regulations require transaction monitoring, but privacy systems hide transaction details. ZK compliance proofs bridge this gap by proving adherence to rules without revealing the underlying data. Users can demonstrate their transactions are below reporting thresholds or meet other compliance criteria.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the note being verified |
| `merkleRoot` | field | Root of the note commitment tree |
| `threshold` | uint | Compliance threshold (e.g., $10,000) |
| `complianceResult` | uint | 1 if compliant, 0 if not |
| `complianceType` | uint | Type of check (0=under threshold, 1=over with reporting) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key |
| `value` | uint | Note value |
| `tokenType` | uint | Token type |
| `salt` | field | Note randomness |
| `sk` | field | Secret key for ownership proof |
| `merklePath[TREE_DEPTH]` | field[] | Merkle proof path |
| `merkleIndex` | uint | Position in Merkle tree |
| `pricePerToken` | uint | USD price per token unit |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template AMLCompliance(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input merkleRoot;
    signal input threshold;          // e.g., 10000 * 10^6 (for $10,000 in USDC units)
    signal input complianceResult;   // Expected: 1 = compliant
    signal input complianceType;     // 0 = under threshold, 1 = reported

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input value;
    signal input tokenType;
    signal input salt;
    signal input sk;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;
    signal input pricePerToken;      // Price oracle value (scaled)

    // ===== 1. Verify Note Format =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== value;
    note.tokenType <== tokenType;
    note.salt <== salt;
    note.out === noteHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 3. Verify Merkle Inclusion =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 4. Calculate USD Value =====
    signal usdValue;
    usdValue <== value * pricePerToken;

    // ===== 5. Threshold Comparison =====
    component thresholdCheck = LessThan(128);
    thresholdCheck.in[0] <== usdValue;
    thresholdCheck.in[1] <== threshold;

    // underThreshold = 1 if value < threshold
    signal underThreshold;
    underThreshold <== thresholdCheck.out;

    // ===== 6. Compliance Logic =====
    // complianceType = 0: Must be under threshold
    // complianceType = 1: Can be any value (reported externally)

    component typeIsZero = IsZero();
    typeIsZero.in <== complianceType;

    // If type = 0, compliance requires underThreshold = 1
    // If type = 1, compliance always true (external reporting assumed)
    signal typeZeroCompliance;
    typeZeroCompliance <== underThreshold * typeIsZero.out;

    signal typeOneCompliance;
    typeOneCompliance <== 1 - typeIsZero.out;

    signal computedCompliance;
    computedCompliance <== typeZeroCompliance + typeOneCompliance;

    // Verify claimed result matches computed
    complianceResult === computedCompliance;
}

component main {public [noteHash, merkleRoot, threshold, complianceResult, complianceType]} =
    AMLCompliance(20);
```

### Key Constraints

1. **Note Authenticity**: Note exists in commitment tree
2. **Ownership Verification**: Only owner can prove compliance for their notes
3. **Value Calculation**: USD value computed from token value and price
4. **Threshold Check**: Value compared against compliance threshold
5. **Result Verification**: Claimed compliance matches computed result

## Effects

| Aspect | Impact |
|--------|--------|
| **Regulatory Compliance** | Prove adherence to AML thresholds |
| **Privacy Preservation** | Exact amounts remain hidden |
| **Automated Checking** | Programmable compliance verification |
| **Audit Trail** | Proofs can be stored for regulatory audits |
| **Institutional Access** | Enables regulated entity participation |
| **User Sovereignty** | User controls when/how to prove compliance |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Price Oracle Manipulation** | Use TWAP, multiple oracles, or trusted feeds |
| **Threshold Gaming** | Structuring detection through pattern analysis |
| **False Compliance Claims** | Verifier checks proof; cannot fake ZK proof |
| **Compliance Type Abuse** | Type 1 requires external verification |
| **Stale Proofs** | Include timestamp; require recent merkleRoot |
| **Identity Inference** | Proof reveals nothing about prover identity |
| **Batch Compliance Evasion** | Aggregate compliance checks across time periods |

## Implementation Challenges

1. **Price Feed Integration**
   - Need reliable USD price for each token type
   - Oracle selection: Chainlink, Uniswap TWAP, Band Protocol
   - Price staleness checks required

2. **Multi-Transaction Aggregation**
   - Single transactions may be compliant; patterns may not be
   - Consider 24-hour rolling aggregation
   - Structuring detection requires historical analysis

3. **Cross-Jurisdiction Thresholds**
   - Different countries have different thresholds
   - US: $10,000, EU: EUR 10,000, varies globally
   - Parameterized thresholds in circuit

4. **Reporting Integration**
   - When complianceType = 1, external reporting needed
   - Integration with Suspicious Activity Report (SAR) systems
   - Privacy-preserving reporting mechanisms

5. **Continuous Monitoring**
   - Compliance isn't one-time; ongoing monitoring required
   - Batch compliance proofs for efficiency
   - Real-time vs. periodic verification trade-offs

## Derivatives

1. **Continuous Compliance Monitoring** - Generate periodic compliance proofs covering all transactions in time window. Automated proof generation for ongoing regulatory requirements. Reduces manual compliance overhead.

2. **Multi-Jurisdiction Compliance** - Single proof demonstrating compliance with multiple regulatory regimes. Prove under US $10K AND EU EUR 10K thresholds simultaneously. Enables global operation.

3. **Compliance Score Generation** - Risk scoring based on transaction patterns without revealing transactions. Aggregate score indicates overall compliance posture. Useful for institutional risk management.

4. **Audit Trail Proofs** - Chain of proofs demonstrating historical compliance. Auditors verify proof chain rather than examining transactions. Preserves privacy during audits.

5. **Retroactive Compliance Verification** - Prove past transactions were compliant when regulations were different. Historical compliance proofs for regulatory reviews. Addresses changing threshold requirements.

## Use Cases

1. **Cross-Border Remittance**
   - User sends funds internationally
   - Proves transaction under $10,000 threshold
   - No SAR filing required
   - Maintains sender/receiver privacy

2. **Exchange Integration**
   - Centralized exchange needs compliance verification
   - Users prove deposits/withdrawals comply with limits
   - Exchange satisfies regulatory requirements
   - User privacy preserved from exchange

3. **Institutional DeFi**
   - Bank wants to participate in DeFi
   - All transactions must be AML compliant
   - ZK proofs satisfy compliance requirements
   - Transaction details remain private

4. **Payment Processor Compliance**
   - Merchant processor handles multiple payments
   - Batch compliance proofs for daily transactions
   - Regulatory reporting without exposing customer data
   - Scalable compliance solution

## Real-World Products & User Experience

See [Compliance Proof (AML) - Products & UX](../../product/c-privacy/c7-compliance-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
