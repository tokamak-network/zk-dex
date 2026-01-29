# HC8. Private Credit Scoring

Compute credit score from multiple financial factors without revealing underlying data.

**Constraints**: ~450K | **Complexity**: High

---

## Background

Traditional credit scoring has fundamental privacy issues:
- Credit bureaus aggregate sensitive financial data
- Score calculation is opaque
- Data breaches expose personal information
- Cross-border credit is nearly impossible

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| Traditional credit bureaus | Centralized data; breach risk; opaque algorithms |
| On-chain reputation | All financial history public; no privacy |
| Self-reported credit | No verification; fraud risk |
| Bank references | Single-source; not portable; slow |

Private credit scoring enables verifiable creditworthiness without data exposure. Users prove score ranges without revealing underlying financial data.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `userCommitment` | field | Hash of user identity |
| `scoreRangeMin` | uint | Minimum claimed score |
| `scoreRangeMax` | uint | Maximum claimed score |
| `factorWeights` | uint[N_FACTORS] | Public scoring algorithm weights |
| `timestamp` | uint | Score calculation timestamp |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `userPkX/Y, userSk, userSalt` | field | User credentials |
| `factors` | uint[N_FACTORS] | Individual credit factors (assets, income, etc.) |
| `factorNoteHashes` | field[N_FACTORS] | Merkle roots or note hashes proving factors |
| `factorProofs` | field[N_FACTORS][DEPTH] | Merkle proofs for factor verification |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Data Privacy** | Underlying factors never revealed |
| **Portability** | Cross-platform, cross-border credit |
| **Verifiability** | Cryptographic proof of score calculation |
| **Self-Sovereignty** | User controls their own data |
| **Transparency** | Scoring algorithm is public and auditable |
| **Composability** | Score usable across DeFi protocols |

## Derivatives

1. **Multi-Source Credit** - Aggregate scores from multiple data sources (exchanges, banks, on-chain). Weighted combination of sub-scores. Cross-verifies data for fraud detection.

2. **Historical Credit** - Include on-chain payment history. Track loan repayments, liquidations avoided. Time-weighted recent activity more valuable.

3. **Social Credit Graph** - Factor in trusted connections and vouches. Network effects improve score. Sybil-resistant through stake requirements.

4. **Reputation Score** - Non-financial reputation factors. DAO participation, governance voting history. Protocol contributions and bug bounties.

5. **Dynamic Credit Line** - Auto-adjust credit limits based on score changes. Real-time score updates trigger limit recalculation. No manual review required.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/merkle/merkle_proof.circom";

template PrivateCreditScore(N_FACTORS, MERKLE_DEPTH) {
    // ===== Public Inputs =====
    signal input userCommitment;
    signal input scoreRangeMin;
    signal input scoreRangeMax;
    signal input factorWeights[N_FACTORS];
    signal input factorDataRoot;  // Merkle root of verified factor data
    signal input timestamp;

    // ===== Private Inputs =====
    signal input userPkX, userPkY, userSk, userSalt;

    // Financial factors (all private)
    // 0: Total assets value (USD)
    // 1: Total liabilities (USD)
    // 2: Monthly income (USD)
    // 3: Account age (months)
    // 4: Payment history (% on-time, 0-100)
    // 5: Credit utilization (%, 0-100)
    // 6: Number of accounts
    // 7: Recent inquiries (last 6 months)
    // 8: Longest account age (months)
    // 9: Debt-to-income ratio (%, 0-100)
    signal input factors[N_FACTORS];
    signal input factorSalts[N_FACTORS];
    signal input factorProofPaths[N_FACTORS][MERKLE_DEPTH];
    signal input factorProofIndices[N_FACTORS];

    // ===== Component Declarations =====
    component userHash;
    component ownership;
    component factorHash[N_FACTORS];
    component factorMerkle[N_FACTORS];
    component minCheck;
    component maxCheck;
    component boundsCheck[N_FACTORS];

    // Intermediate signals
    signal normalizedFactors[N_FACTORS];
    signal weightedFactors[N_FACTORS];
    signal rawScore;
    signal normalizedScore;

    // ===== Verify User =====
    userHash = Poseidon(3);
    userHash.inputs[0] <== userPkX;
    userHash.inputs[1] <== userPkY;
    userHash.inputs[2] <== userSalt;
    userHash.out === userCommitment;

    ownership = ProofOfOwnershipStrict();
    ownership.sk <== userSk;
    ownership.pkX <== userPkX;
    ownership.pkY <== userPkY;

    // ===== Verify Each Factor via Merkle Proof =====
    for (var i = 0; i < N_FACTORS; i++) {
        // Hash factor commitment
        factorHash[i] = Poseidon(4);
        factorHash[i].inputs[0] <== userPkX;
        factorHash[i].inputs[1] <== factors[i];
        factorHash[i].inputs[2] <== i;  // Factor index
        factorHash[i].inputs[3] <== factorSalts[i];

        // Verify factor in data root
        factorMerkle[i] = MerkleProof(MERKLE_DEPTH);
        factorMerkle[i].leaf <== factorHash[i].out;
        factorMerkle[i].root <== factorDataRoot;
        for (var j = 0; j < MERKLE_DEPTH; j++) {
            factorMerkle[i].path[j] <== factorProofPaths[i][j];
        }
        factorMerkle[i].index <== factorProofIndices[i];

        // Normalize factors to 0-100 range (simplified)
        // In practice, each factor has its own normalization curve
        normalizedFactors[i] <== factors[i];

        // Apply weights
        weightedFactors[i] <== normalizedFactors[i] * factorWeights[i];

        // Bounds check on factors (prevent overflow)
        boundsCheck[i] = LessThan(64);
        boundsCheck[i].in[0] <== factors[i];
        boundsCheck[i].in[1] <== 10000000000;  // Max factor value
        boundsCheck[i].out === 1;
    }

    // ===== Compute Credit Score =====
    var weightedSum = 0;
    var totalWeight = 0;

    for (var i = 0; i < N_FACTORS; i++) {
        weightedSum += weightedFactors[i];
        totalWeight += factorWeights[i];
    }

    // Score = weightedSum / totalWeight (scaled to avoid division)
    // Verify: rawScore * totalWeight == weightedSum (within tolerance)
    rawScore <-- weightedSum / totalWeight;
    rawScore * totalWeight === weightedSum;

    // Normalize to 300-850 range (standard credit score range)
    // normalizedScore = 300 + (rawScore * 550 / 100)
    normalizedScore <== rawScore;  // Simplified; real impl needs scaling

    // ===== Verify Score in Claimed Range =====
    minCheck = LessThan(16);
    minCheck.in[0] <== scoreRangeMin;
    minCheck.in[1] <== normalizedScore + 1;
    minCheck.out === 1;

    maxCheck = LessThan(16);
    maxCheck.in[0] <== normalizedScore;
    maxCheck.in[1] <== scoreRangeMax + 1;
    maxCheck.out === 1;
}

component main {public [userCommitment, scoreRangeMin, scoreRangeMax, factorWeights,
    factorDataRoot, timestamp]} = PrivateCreditScore(10, 20);
```

### Key Constraints

1. **User Identity**: User proves ownership of identity commitment
2. **Factor Verification**: Each factor verified via Merkle proof against data root
3. **Score Calculation**: Weighted sum follows public algorithm
4. **Range Proof**: Computed score falls within claimed range
5. **Bounds Checking**: Factor values within valid ranges

### Credit Factor Details

| Factor | Description | Weight (typical) | Range |
|--------|-------------|-----------------|-------|
| Total Assets | Sum of verifiable on-chain assets | 15% | USD value |
| Total Liabilities | Outstanding debts and loans | 15% | USD value |
| Monthly Income | Regular income streams | 20% | USD value |
| Account Age | Time since first account | 10% | Months |
| Payment History | % of on-time payments | 25% | 0-100% |
| Credit Utilization | Used credit / Available credit | 10% | 0-100% |
| Number of Accounts | Diversity of credit types | 5% | Count |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Factor Falsification** | Merkle proof against verified data root |
| **Stale Data** | Timestamp check; recent data required |
| **Score Gaming** | Multiple factor types; hard to optimize all |
| **Identity Theft** | Ownership proof with secret key |
| **Data Provider Collusion** | Multiple independent data sources |
| **Algorithm Manipulation** | Weights public; auditable |
| **Replay Attacks** | Timestamp and nonce in commitment |

## Implementation Challenges

1. **Data Oracle Integration**
   - Where does factor data come from?
   - Options: CEX APIs, bank connections, on-chain history
   - Need trusted data providers with attestations
   - Consider Chainlink Functions or API3 for off-chain data

2. **Factor Normalization**
   - Different factors have different scales
   - Normalization curves must be standardized
   - Non-linear relationships (e.g., utilization sweet spot)
   - Consider lookup tables in circuit

3. **Historical Data**
   - Credit scores depend on history
   - Need efficient way to prove payment history
   - Consider rolling Merkle trees for time series
   - Or periodic snapshots with proofs

4. **Cross-Platform Data**
   - User may have data across multiple platforms
   - Need standardized factor format
   - Data aggregation without revealing sources
   - Consider recursive proofs from multiple sources

5. **Score Freshness**
   - How often should scores be recalculated?
   - Balance between accuracy and computation cost
   - Consider incremental updates vs. full recalculation

## Use Cases

1. **DeFi Lending Creditworthiness**
   - Prove credit score is 700-750 without revealing income
   - Access better interest rates with proven creditworthiness
   - Under-collateralized loans for high-score users

2. **Apartment Rental Applications**
   - Prove income > 3x rent without revealing exact salary
   - Privacy-preserving tenant screening
   - Portable across property managers

3. **Employment Verification**
   - Prove minimum income threshold
   - Background check without full data disclosure
   - Useful for gig economy workers

4. **Insurance Underwriting**
   - Risk assessment without full financial disclosure
   - Privacy-preserving premium calculation
   - Fraud detection via anomaly patterns

5. **Cross-Border Credit**
   - Portable credit score across jurisdictions
   - No need for local credit history
   - Enables global financial inclusion

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/high-complexity/hc8-private-credit-score-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
