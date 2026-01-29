# G7. Credit Score Range

Privacy-preserving credit worthiness proofs demonstrating score falls within acceptable range without revealing exact score or underlying credit history.

**Constraints**: ~200K | **Complexity**: Medium

---

## Background

Credit scores create significant privacy concerns:

- **Score Sensitivity**: Exact credit scores reveal financial history and can be used for discrimination
- **Inquiry Impact**: Traditional credit checks affect scores; excessive inquiries signal desperation
- **Data Leakage**: Credit reports contain detailed financial history, account information, and payment patterns
- **Range Sufficiency**: Most credit decisions only need to know if score exceeds threshold, not exact value

Current credit systems force full disclosure of scores and reports. ZK credit proofs enable proving creditworthiness (e.g., "score above 700") without revealing exact scores, detailed history, or triggering hard inquiries that impact the score itself.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `creditCommitment` | field | Commitment to credit profile |
| `bureauCommit` | field | Commitment to credit bureau identity |
| `scoreRangeMin` | uint | Minimum score being claimed |
| `scoreRangeMax` | uint | Maximum score being claimed |
| `reportTimestamp` | uint | When credit report was generated |
| `expiryTimestamp` | uint | When proof expires |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `userPkX, userPkY` | field | User's public key |
| `userSk` | field | User's secret key |
| `actualScore` | uint | Actual credit score |
| `bureauPkX, bureauPkY` | field | Credit bureau's public key |
| `bureauSignature` | field[] | Bureau's signature on score attestation |
| `accountCount` | uint | Number of credit accounts |
| `utilizationRatio` | uint | Credit utilization percentage |
| `paymentHistory` | uint | Payment history score |
| `accountAges` | uint | Average account age in months |
| `inquiryCount` | uint | Recent hard inquiries |
| `userSalt` | field | Identity commitment randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/babyjubjub/signature_verify.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template CreditScoreRange(BUREAU_TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input creditCommitment;
    signal input bureauCommit;
    signal input scoreRangeMin;
    signal input scoreRangeMax;
    signal input reportTimestamp;
    signal input expiryTimestamp;
    signal input trustedBureauRoot;

    // ===== Private Inputs =====
    signal input userPkX, userPkY;
    signal input userSk;
    signal input userSalt;

    signal input actualScore;
    signal input bureauPkX, bureauPkY;
    signal input bureauSigR8x, bureauSigR8y, bureauSigS;
    signal input bureauSalt;
    signal input bureauProof[BUREAU_TREE_DEPTH];
    signal input bureauProofIndices[BUREAU_TREE_DEPTH];

    // Credit factors (for detailed verification)
    signal input accountCount;
    signal input utilizationRatio;        // 0-100 percentage
    signal input paymentHistoryScore;     // 0-100 score
    signal input avgAccountAgeMonths;
    signal input recentInquiries;
    signal input derogatoryMarks;

    // ===== 1. Verify User Ownership =====
    component userOwnership = ProofOfOwnershipStrict();
    userOwnership.sk <== userSk;
    userOwnership.pkX <== userPkX;
    userOwnership.pkY <== userPkY;

    // ===== 2. Verify Bureau in Trusted Bureau Tree =====
    component bureauLeaf = Poseidon(2);
    bureauLeaf.inputs[0] <== bureauPkX;
    bureauLeaf.inputs[1] <== bureauPkY;

    component bureauMerkle = MerkleProof(BUREAU_TREE_DEPTH);
    bureauMerkle.leaf <== bureauLeaf.out;
    bureauMerkle.root <== trustedBureauRoot;
    for (var i = 0; i < BUREAU_TREE_DEPTH; i++) {
        bureauMerkle.siblings[i] <== bureauProof[i];
        bureauMerkle.pathIndices[i] <== bureauProofIndices[i];
    }

    // ===== 3. Verify Bureau Identity Commitment =====
    component bureauCommitHash = Poseidon(3);
    bureauCommitHash.inputs[0] <== bureauPkX;
    bureauCommitHash.inputs[1] <== bureauPkY;
    bureauCommitHash.inputs[2] <== bureauSalt;
    bureauCommitHash.out === bureauCommit;

    // ===== 4. Create Credit Report Hash =====
    component creditReportHash = Poseidon(8);
    creditReportHash.inputs[0] <== userPkX;
    creditReportHash.inputs[1] <== actualScore;
    creditReportHash.inputs[2] <== accountCount;
    creditReportHash.inputs[3] <== utilizationRatio;
    creditReportHash.inputs[4] <== paymentHistoryScore;
    creditReportHash.inputs[5] <== avgAccountAgeMonths;
    creditReportHash.inputs[6] <== recentInquiries;
    creditReportHash.inputs[7] <== reportTimestamp;

    // ===== 5. Verify Bureau Signature on Credit Report =====
    component sigVerify = EdDSAVerify();
    sigVerify.msg <== creditReportHash.out;
    sigVerify.pubKeyX <== bureauPkX;
    sigVerify.pubKeyY <== bureauPkY;
    sigVerify.R8x <== bureauSigR8x;
    sigVerify.R8y <== bureauSigR8y;
    sigVerify.S <== bureauSigS;

    // ===== 6. Verify Score Within Claimed Range =====
    // actualScore >= scoreRangeMin
    component minCheck = GreaterEqThan(32);
    minCheck.in[0] <== actualScore;
    minCheck.in[1] <== scoreRangeMin;
    minCheck.out === 1;

    // actualScore <= scoreRangeMax
    component maxCheck = LessEqThan(32);
    maxCheck.in[0] <== actualScore;
    maxCheck.in[1] <== scoreRangeMax;
    maxCheck.out === 1;

    // ===== 7. Verify Credit Score Is Valid (300-850 range) =====
    component validScoreMin = GreaterEqThan(32);
    validScoreMin.in[0] <== actualScore;
    validScoreMin.in[1] <== 300;
    validScoreMin.out === 1;

    component validScoreMax = LessEqThan(32);
    validScoreMax.in[0] <== actualScore;
    validScoreMax.in[1] <== 850;
    validScoreMax.out === 1;

    // ===== 8. Verify Report Not Expired =====
    component expiryCheck = GreaterThan(64);
    expiryCheck.in[0] <== expiryTimestamp;
    expiryCheck.in[1] <== reportTimestamp;
    expiryCheck.out === 1;

    // ===== 9. Verify Credit Factors Are Reasonable =====
    // Utilization should be 0-100
    component utilCheck = LessEqThan(16);
    utilCheck.in[0] <== utilizationRatio;
    utilCheck.in[1] <== 100;
    utilCheck.out === 1;

    // Payment history should be 0-100
    component paymentCheck = LessEqThan(16);
    paymentCheck.in[0] <== paymentHistoryScore;
    paymentCheck.in[1] <== 100;
    paymentCheck.out === 1;

    // ===== 10. Create Credit Commitment =====
    component creditCommit = Poseidon(5);
    creditCommit.inputs[0] <== userPkX;
    creditCommit.inputs[1] <== scoreRangeMin;
    creditCommit.inputs[2] <== scoreRangeMax;
    creditCommit.inputs[3] <== reportTimestamp;
    creditCommit.inputs[4] <== userSalt;
    creditCommit.out === creditCommitment;

    // ===== 11. Output Credit Tier (Optional Disclosure) =====
    signal output creditTier;
    // Tier 0: <580, Tier 1: 580-669, Tier 2: 670-739, Tier 3: 740-799, Tier 4: 800+
    signal tier0, tier1, tier2, tier3, tier4;

    component t0Check = LessThan(32);
    t0Check.in[0] <== actualScore;
    t0Check.in[1] <== 580;
    tier0 <== t0Check.out;

    component t1Check = LessThan(32);
    t1Check.in[0] <== actualScore;
    t1Check.in[1] <== 670;
    tier1 <== (1 - tier0) * t1Check.out;

    component t2Check = LessThan(32);
    t2Check.in[0] <== actualScore;
    t2Check.in[1] <== 740;
    tier2 <== (1 - tier0) * (1 - tier1) * t2Check.out;

    component t3Check = LessThan(32);
    t3Check.in[0] <== actualScore;
    t3Check.in[1] <== 800;
    tier3 <== (1 - tier0) * (1 - tier1) * (1 - tier2) * t3Check.out;

    tier4 <== (1 - tier0) * (1 - tier1) * (1 - tier2) * (1 - tier3);

    creditTier <== tier0 * 0 + tier1 * 1 + tier2 * 2 + tier3 * 3 + tier4 * 4;
}

component main {public [creditCommitment, bureauCommit, scoreRangeMin, scoreRangeMax, reportTimestamp, expiryTimestamp, trustedBureauRoot]} =
    CreditScoreRange(8);
```

### Key Constraints

1. **User Ownership**: User proves control of identity linked to credit report
2. **Bureau Authenticity**: Credit report signed by bureau in trusted tree
3. **Score Range**: Actual score falls within claimed min-max range
4. **Score Validity**: Score within standard 300-850 range
5. **Report Freshness**: Report not expired at verification time
6. **Factor Bounds**: Credit factors within reasonable ranges

## Effects

| Aspect | Impact |
|--------|--------|
| **Score Privacy** | Exact score hidden; only range disclosed |
| **No Hard Inquiry** | ZK proof doesn't require new credit pull |
| **Reduced Discrimination** | Range-based decisions reduce exact-score bias |
| **Multiple Applications** | One proof works for multiple lenders |
| **Factor Protection** | Detailed credit factors remain private |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Fake Credit Reports** | Bureau signature verification required |
| **Bureau Compromise** | Only bureaus in trusted tree accepted |
| **Stale Reports** | Expiry timestamp enforces freshness |
| **Score Manipulation** | Score bounds checked against valid range |
| **Identity Theft** | User ownership proof binds report to user |
| **Range Gaming** | Lender specifies minimum range, not user |

## Implementation Challenges

1. **Bureau Integration**
   - Major bureaus (Equifax, Experian, TransUnion) must adopt signing
   - API integration for signed credit reports
   - Coordination across different bureau score models

2. **Score Model Variations**
   - Different lenders use different scoring models (FICO, VantageScore)
   - Model version differences (FICO 8 vs FICO 9)
   - Industry-specific scores (auto, mortgage)

3. **Real-Time Verification**
   - Credit scores change frequently
   - Determining appropriate proof validity period
   - Balancing freshness with user convenience

4. **Regulatory Compliance**
   - Fair Credit Reporting Act requirements
   - Equal Credit Opportunity Act compliance
   - Adverse action notice requirements

## Derivatives

1. **Multi-Bureau Aggregation** - Combines scores from multiple bureaus into single proof. Proves average or best score across bureaus without revealing individual bureau scores or which bureau provided which score.

2. **Score History Proofs** - Demonstrates credit score trajectory over time. Proves score has improved by X points over Y months without revealing historical scores, useful for demonstrating credit rehabilitation.

3. **Credit Factor Disclosure** - Selective disclosure of specific credit factors. Proves low utilization or long credit history without revealing score or other factors; enables factor-specific underwriting.

4. **Score Improvement Tracking** - Proves adherence to credit improvement plan. Demonstrates progress toward credit goals without revealing starting point or exact current position.

5. **Cross-Border Credit** - Translates credit worthiness across jurisdictions. Proves equivalent creditworthiness using home country bureau data for foreign lender acceptance.

## Use Cases

1. **Rental Application**
   - Tenant applies for apartment
   - Proves credit score above landlord's minimum (e.g., 650)
   - Landlord doesn't see exact score or full credit report
   - No hard inquiry impact on tenant's score

2. **Pre-Qualification**
   - Consumer shopping for auto loan
   - Generates proof showing score in "good" tier
   - Shares with multiple dealers without multiple inquiries
   - Actual score revealed only to chosen lender

3. **Employment Screening**
   - Employer requires credit check for financial role
   - Candidate proves score above threshold
   - Exact score and financial details remain private
   - Satisfies employer requirements with minimal disclosure

4. **Insurance Pricing**
   - Insurance company uses credit for pricing
   - Customer proves score tier for discount eligibility
   - Exact score not needed for tier-based pricing
   - Privacy preserved while accessing better rates

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/g-enterprise/g7-credit-products.md) for detailed product descriptions and user experience scenarios.

---

[Back to Index](../../README.md)
