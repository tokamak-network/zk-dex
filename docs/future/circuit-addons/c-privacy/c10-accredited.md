# C10. Accredited Investor Proof

Prove net worth exceeds regulatory threshold for accredited investor status without revealing exact holdings.

**Constraints**: ~350K (20 assets) | **Complexity**: Medium

---

## Background

Accredited investor verification is required for access to certain investment opportunities:

- **SEC Regulation D**: US securities law restricts some offerings to accredited investors
- **Net Worth Threshold**: $1 million net worth (excluding primary residence) or $200K income
- **Privacy Sensitivity**: Net worth is extremely sensitive personal financial information
- **Traditional Process**: Requires submitting tax returns, bank statements, brokerage statements
- **Recurring Verification**: Status must be re-verified for each investment opportunity

Traditional accreditation verification requires extensive document disclosure to each fund or offering. ZK proofs enable proving qualification without revealing the underlying financial details to multiple parties. Users prove once, verify many times.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `threshold` | uint | Accreditation threshold (e.g., $1,000,000) |
| `isAccredited` | uint | 1 if net worth exceeds threshold |
| `merkleRoot` | field | Root of the note commitment tree |
| `priceOracleRoot` | field | Root of verified price attestations |
| `verificationDate` | uint | Timestamp of verification |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key |
| `sk` | field | Secret key for ownership proof |
| `noteHashes[NUM_ASSETS]` | field[] | Hashes of asset notes |
| `values[NUM_ASSETS]` | uint[] | Asset values in native units |
| `tokenTypes[NUM_ASSETS]` | uint[] | Token type identifiers |
| `salts[NUM_ASSETS]` | field[] | Note randomness |
| `prices[NUM_ASSETS]` | uint[] | USD prices per token |
| `priceProofs[NUM_ASSETS]` | PriceAttestation[] | Oracle attestations for prices |
| `merklePaths[NUM_ASSETS][TREE_DEPTH]` | field[][] | Merkle proofs |
| `merkleIndexes[NUM_ASSETS]` | uint[] | Merkle tree positions |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template PriceAttestation(DEPTH) {
    signal input tokenType;
    signal input price;
    signal input timestamp;
    signal input oracleRoot;
    signal input path[DEPTH];
    signal input index;
    signal output valid;

    // Compute price attestation leaf
    component priceLeaf = Poseidon(3);
    priceLeaf.inputs[0] <== tokenType;
    priceLeaf.inputs[1] <== price;
    priceLeaf.inputs[2] <== timestamp;

    // Verify price is in oracle tree
    component priceProof = MerkleProof(DEPTH);
    priceProof.leaf <== priceLeaf.out;
    priceProof.root <== oracleRoot;
    for (var i = 0; i < DEPTH; i++) {
        priceProof.path[i] <== path[i];
    }
    priceProof.index <== index;

    valid <== 1; // MerkleProof will fail if invalid
}

template AccreditedInvestorProof(NUM_ASSETS, TREE_DEPTH, ORACLE_DEPTH) {
    // ===== Public Inputs =====
    signal input threshold;          // e.g., 1000000 * 10^6 (USDC units)
    signal input isAccredited;
    signal input merkleRoot;
    signal input priceOracleRoot;
    signal input verificationDate;

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input sk;
    signal input noteHashes[NUM_ASSETS];
    signal input values[NUM_ASSETS];
    signal input tokenTypes[NUM_ASSETS];
    signal input salts[NUM_ASSETS];
    signal input prices[NUM_ASSETS];
    signal input pricePaths[NUM_ASSETS][ORACLE_DEPTH];
    signal input priceIndexes[NUM_ASSETS];
    signal input priceTimestamps[NUM_ASSETS];
    signal input merklePaths[NUM_ASSETS][TREE_DEPTH];
    signal input merkleIndexes[NUM_ASSETS];

    // ===== 1. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 2. Process Each Asset =====
    component note[NUM_ASSETS];
    component merkle[NUM_ASSETS];
    component priceAttest[NUM_ASSETS];
    component timestampCheck[NUM_ASSETS];
    signal usdValues[NUM_ASSETS];

    for (var i = 0; i < NUM_ASSETS; i++) {
        // Verify note format and ownership
        note[i] = PoseidonRegularNote();
        note[i].pkX <== pkX;
        note[i].pkY <== pkY;
        note[i].value <== values[i];
        note[i].tokenType <== tokenTypes[i];
        note[i].salt <== salts[i];
        note[i].out === noteHashes[i];

        // Verify Merkle inclusion
        merkle[i] = MerkleProof(TREE_DEPTH);
        merkle[i].leaf <== noteHashes[i];
        merkle[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkle[i].path[j] <== merklePaths[i][j];
        }
        merkle[i].index <== merkleIndexes[i];

        // Verify price attestation
        priceAttest[i] = PriceAttestation(ORACLE_DEPTH);
        priceAttest[i].tokenType <== tokenTypes[i];
        priceAttest[i].price <== prices[i];
        priceAttest[i].timestamp <== priceTimestamps[i];
        priceAttest[i].oracleRoot <== priceOracleRoot;
        for (var j = 0; j < ORACLE_DEPTH; j++) {
            priceAttest[i].path[j] <== pricePaths[i][j];
        }
        priceAttest[i].index <== priceIndexes[i];

        // Verify price is recent (within 24 hours of verification)
        timestampCheck[i] = GreaterEqThan(64);
        timestampCheck[i].in[0] <== priceTimestamps[i];
        timestampCheck[i].in[1] <== verificationDate - 86400; // 24 hours
        timestampCheck[i].out === 1;

        // Calculate USD value
        usdValues[i] <== values[i] * prices[i];
    }

    // ===== 3. Sum Total Net Worth =====
    signal partialSums[NUM_ASSETS + 1];
    partialSums[0] <== 0;
    for (var i = 0; i < NUM_ASSETS; i++) {
        partialSums[i + 1] <== partialSums[i] + usdValues[i];
    }
    signal totalNetWorth <== partialSums[NUM_ASSETS];

    // ===== 4. Threshold Check =====
    component check = GreaterEqThan(128);
    check.in[0] <== totalNetWorth;
    check.in[1] <== threshold;

    // ===== 5. Verify Result =====
    isAccredited === check.out;
}

component main {public [threshold, isAccredited, merkleRoot, priceOracleRoot, verificationDate]} =
    AccreditedInvestorProof(20, 20, 10);
```

### Key Constraints

1. **Ownership Verification**: All assets must belong to the prover
2. **Asset Authenticity**: Each note exists in the commitment tree
3. **Price Verification**: Prices attested by trusted oracle
4. **Price Freshness**: Prices must be recent (within 24 hours)
5. **Threshold Comparison**: Total USD value exceeds accreditation threshold

## Effects

| Aspect | Impact |
|--------|--------|
| **Privacy** | Exact holdings never revealed |
| **Reusability** | Single proof for multiple verifications |
| **Trustless** | No third-party attestation of net worth needed |
| **Regulatory Compliance** | Satisfies SEC accreditation requirements |
| **Reduced Friction** | Faster investment onboarding |
| **Asset Flexibility** | Multiple token types counted |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Price Manipulation** | Use reputable oracle with attestations |
| **Stale Prices** | 24-hour freshness requirement |
| **Double Counting** | Unique note hashes prevent duplication |
| **Borrowed Assets** | Ownership proof prevents using others' assets |
| **Flash Loan Attacks** | Require minimum holding period or multi-day average |
| **Oracle Compromise** | Multiple oracle sources; threshold agreement |
| **Collusion** | Decentralized price feeds |

## Implementation Challenges

1. **Multi-Asset Price Feeds**
   - Need prices for all supported token types
   - Oracle integration for each asset class
   - Price precision and scaling standardization

2. **Off-Chain Assets**
   - Real estate, stocks, etc. not on-chain
   - May need oracle attestation bridges
   - Consider hybrid on-chain/off-chain proofs

3. **Liabilities Handling**
   - Net worth should subtract liabilities
   - Debt representation as negative notes
   - Privacy for liability disclosure

4. **Income-Based Accreditation**
   - Alternative: $200K income for 2 years
   - Requires income range proofs over time
   - May need separate circuit

5. **Verification Freshness**
   - How long is a proof valid?
   - Asset values change; re-verification needed
   - Consider proof expiration timestamps

## Derivatives

1. **Tiered Accreditation** - Different thresholds for different investment tiers. Qualified Purchaser ($5M), Qualified Institutional Buyer ($100M). Single proof can indicate multiple qualification levels.

2. **Multi-Jurisdiction Qualification** - Prove accreditation under multiple regulatory regimes simultaneously. US SEC, EU AIFMD, UK FCA requirements. Single proof for global investment access.

3. **Accreditation Expiry/Renewal** - Time-limited accreditation proofs with renewal mechanism. Annual re-verification as required by regulations. Automatic reminder system for expiring proofs.

4. **Institutional Accreditation** - Prove entity-level qualification (QIB status, institutional investor). Aggregate holdings across entity accounts. Corporate governance integration.

5. **Partial Accreditation (Specific Limits)** - Prove qualification for specific investment amounts. "Accredited for investments up to $500K". Tiered access based on net worth bands.

## Use Cases

1. **Private Equity Investment**
   - PE fund requires accredited investor verification
   - Investor proves net worth exceeds $1M
   - Fund accepts proof; investment proceeds
   - Exact portfolio never disclosed to fund

2. **Real Estate Syndication**
   - Real estate offering limited to accredited investors
   - Multiple investors prove accreditation
   - Syndicator verifies all participants qualify
   - Individual wealth details remain private

3. **Hedge Fund Onboarding**
   - Hedge fund has minimum investment + accreditation requirement
   - Investor proves both sufficient balance and accreditation
   - Streamlined onboarding without document review
   - Privacy preserved from fund administrators

4. **Security Token Offering**
   - STO requires accredited investor whitelist
   - Investors submit ZK accreditation proofs
   - Smart contract verifies proofs automatically
   - Compliant token distribution without centralized KYC

## Real-World Products & User Experience

See [Accredited Investor Proof - Products & UX](../../product/c-privacy/c10-accredited-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
