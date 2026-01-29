# C8. Income Range Proof

Prove total income falls within a specified range without revealing exact amount or individual sources.

**Constraints**: ~400K (12 notes) | **Complexity**: Medium

---

## Background

Income verification is required for many real-world applications:

- **Loan Applications**: Lenders need income verification for creditworthiness assessment
- **Rental Applications**: Landlords require proof of sufficient income to cover rent
- **Government Benefits**: Means-tested programs require income within specific ranges
- **Insurance Underwriting**: Life and disability insurance need income verification
- **Privacy Preservation**: Exact income is highly sensitive personal information

Traditional income verification requires tax returns, pay stubs, and bank statements revealing exact amounts and sources. ZK range proofs allow proving income falls within acceptable bounds without exposing the precise figure or underlying transactions.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHashes[NUM_NOTES]` | field[] | Hashes of income notes being aggregated |
| `minIncome` | uint | Lower bound of income range |
| `maxIncome` | uint | Upper bound of income range |
| `merkleRoot` | field | Root of the note commitment tree |
| `timePeriodStart` | uint | Start of income period (e.g., tax year) |
| `timePeriodEnd` | uint | End of income period |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key |
| `sk` | field | Secret key for ownership proof |
| `values[NUM_NOTES]` | uint[] | Individual note values |
| `tokenTypes[NUM_NOTES]` | uint[] | Token types for each note |
| `salts[NUM_NOTES]` | field[] | Randomness for each note |
| `timestamps[NUM_NOTES]` | uint[] | Timestamps for each note |
| `merklePaths[NUM_NOTES][TREE_DEPTH]` | field[][] | Merkle proofs |
| `merkleIndexes[NUM_NOTES]` | uint[] | Merkle tree positions |
| `prices[NUM_NOTES]` | uint[] | USD price per token at time of receipt |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template IncomeRangeProof(NUM_NOTES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input noteHashes[NUM_NOTES];
    signal input minIncome;
    signal input maxIncome;
    signal input merkleRoot;
    signal input timePeriodStart;
    signal input timePeriodEnd;

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input sk;
    signal input values[NUM_NOTES];
    signal input tokenTypes[NUM_NOTES];
    signal input salts[NUM_NOTES];
    signal input timestamps[NUM_NOTES];
    signal input merklePaths[NUM_NOTES][TREE_DEPTH];
    signal input merkleIndexes[NUM_NOTES];
    signal input prices[NUM_NOTES];

    // ===== 1. Verify Ownership Once =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 2. Process Each Note =====
    component note[NUM_NOTES];
    component merkle[NUM_NOTES];
    component timeStartCheck[NUM_NOTES];
    component timeEndCheck[NUM_NOTES];
    signal usdValues[NUM_NOTES];
    signal validNote[NUM_NOTES];

    for (var i = 0; i < NUM_NOTES; i++) {
        // Verify note format
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

        // Verify timestamp within period
        timeStartCheck[i] = GreaterEqThan(64);
        timeStartCheck[i].in[0] <== timestamps[i];
        timeStartCheck[i].in[1] <== timePeriodStart;

        timeEndCheck[i] = LessEqThan(64);
        timeEndCheck[i].in[0] <== timestamps[i];
        timeEndCheck[i].in[1] <== timePeriodEnd;

        validNote[i] <== timeStartCheck[i].out * timeEndCheck[i].out;

        // Calculate USD value (only count if in time period)
        usdValues[i] <== values[i] * prices[i] * validNote[i];
    }

    // ===== 3. Sum Total Income =====
    signal partialSums[NUM_NOTES + 1];
    partialSums[0] <== 0;
    for (var i = 0; i < NUM_NOTES; i++) {
        partialSums[i + 1] <== partialSums[i] + usdValues[i];
    }
    signal totalIncome <== partialSums[NUM_NOTES];

    // ===== 4. Range Check =====
    // Verify: minIncome <= totalIncome <= maxIncome
    component minCheck = GreaterEqThan(128);
    minCheck.in[0] <== totalIncome;
    minCheck.in[1] <== minIncome;
    minCheck.out === 1;

    component maxCheck = LessEqThan(128);
    maxCheck.in[0] <== totalIncome;
    maxCheck.in[1] <== maxIncome;
    maxCheck.out === 1;
}

component main {public [noteHashes, minIncome, maxIncome, merkleRoot, timePeriodStart, timePeriodEnd]} =
    IncomeRangeProof(12, 20);
```

### Key Constraints

1. **Single Ownership**: All notes must belong to the same owner
2. **Note Authenticity**: Each note exists in the commitment tree
3. **Time Period Filter**: Only notes within specified period counted
4. **USD Conversion**: Token values converted to USD using provided prices
5. **Range Verification**: Total income falls within [minIncome, maxIncome]

## Effects

| Aspect | Impact |
|--------|--------|
| **Privacy** | Exact income amount never revealed |
| **Flexibility** | Verifier specifies acceptable range |
| **Aggregation** | Multiple income sources combined |
| **Time Scoping** | Income limited to relevant period |
| **Trustless** | Cryptographic proof, no third-party attestation |
| **Reusability** | Same notes can prove different ranges |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Double Counting** | Note uniqueness via hash; verifier tracks used notes |
| **Price Manipulation** | Use historical TWAP prices; verifier-provided prices |
| **Future Income** | Timestamps must be in the past |
| **Note Borrowing** | Ownership proof prevents using others' notes |
| **Range Tightening** | Verifiers should use reasonable ranges |
| **Stale Data** | merkleRoot freshness requirement |
| **Currency Conversion** | Standardize on single currency (USD) |

## Implementation Challenges

1. **Note Aggregation Limit**
   - Circuit size grows with NUM_NOTES
   - 12 notes reasonable; 100+ becomes expensive
   - Consider recursive proofs for larger sets

2. **Historical Price Data**
   - Need price at time of each note creation
   - Price oracle historical lookup
   - Consider price commitment at note creation time

3. **Time Period Handling**
   - Different jurisdictions have different tax years
   - Calendar year vs. fiscal year
   - Overlapping periods for different purposes

4. **Multi-Token Income**
   - Income in multiple currencies/tokens
   - Each needs price conversion
   - Stablecoin income simplifies calculation

5. **Income Source Categorization**
   - Some verifiers want income by source type
   - Salary vs. investment vs. gifts
   - May require additional note metadata

## Derivatives

1. **Multi-Period Income Averaging** - Prove average income over multiple years falls within range. Smooths out variable income (freelancers, seasonal workers). More representative of long-term earning capacity.

2. **Income Source Verification** - Prove income comes from specific source types (employment, investments, business). Tag notes with source type; filter by category. Enables nuanced income verification.

3. **Projected Income Proofs** - Based on historical pattern, prove projected future income meets criteria. Uses recurring income pattern analysis. Useful for long-term loan applications.

4. **Comparative Income Proofs** - Prove income is greater than or less than another party (without revealing either). Useful for income-based benefits or tiered pricing. Privacy-preserving comparison.

5. **Income Stability Proofs** - Prove income variance is below threshold (stable income). Calculate standard deviation across periods. Lenders prefer stable over high-variance income.

## Use Cases

1. **Mortgage Application**
   - Bank requires income verification for loan approval
   - Borrower proves annual income between $80,000-$150,000
   - Bank sees income is sufficient for loan amount
   - Exact salary, employer, and other details remain private

2. **Rental Application**
   - Landlord requires 3x rent income verification
   - For $2,000/month rent, need to prove >$72,000/year
   - Tenant proves income in range $72,000-$200,000
   - Doesn't reveal exact income or employment details

3. **Government Benefits**
   - Means-tested benefit requires income below threshold
   - Applicant proves income between $0-$50,000
   - Qualifies for benefit without revealing exact income
   - Preserves dignity while meeting requirements

4. **Insurance Underwriting**
   - Life insurance needs income for coverage calculation
   - Applicant proves income in bracket for coverage tier
   - Insurer calculates appropriate coverage
   - Exact income not exposed to insurance company

## Real-World Products & User Experience

See [Income Range Proof - Products & UX](../../product/c-privacy/c8-income-range-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
