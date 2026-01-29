# G5. Audit Disclosure

Selective disclosure proofs for auditors that verify specific financial facts without revealing complete books and records.

**Constraints**: ~250K | **Complexity**: Medium

---

## Background

Audits require transparency but full disclosure is often excessive:

- **Competitive Sensitivity**: Full financial records reveal pricing, margins, and strategic plans
- **Client Confidentiality**: Audited data may contain third-party information protected by agreements
- **Scope Limitation**: Auditors typically need specific facts, not comprehensive data dumps
- **Continuous Monitoring**: Modern audit approaches require ongoing verification without constant full access

Traditional audits require either full trust (self-attestation) or full disclosure (complete records access). ZK audit disclosures enable proving specific financial assertions (e.g., "revenue exceeds $1M", "expenses in category X are below threshold") without revealing exact figures or underlying transactions.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `entityCommit` | field | Commitment to audited entity identity |
| `auditorCommit` | field | Commitment to auditor identity |
| `periodStart` | uint | Audit period start timestamp |
| `periodEnd` | uint | Audit period end timestamp |
| `assertionHash` | field | Hash of assertions being verified |
| `financialRoot` | field | Merkle root of financial records |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `entityPkX, entityPkY` | field | Entity's public key |
| `entitySk` | field | Entity's secret key |
| `auditorPkX, auditorPkY` | field | Auditor's public key |
| `revenueAmount` | uint | Total revenue for period |
| `expenseAmounts[N]` | uint[] | Expense amounts by category |
| `assetValues[M]` | uint[] | Asset valuations |
| `liabilityValues[L]` | uint[] | Liability amounts |
| `financialProofs` | field[][] | Merkle proofs for financial entries |
| `entitySalt, auditorSalt` | field | Identity commitment randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template AuditDisclosure(NUM_EXPENSE_CATS, NUM_ASSETS, NUM_LIABILITIES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input entityCommit;
    signal input auditorCommit;
    signal input periodStart;
    signal input periodEnd;
    signal input assertionHash;
    signal input financialRoot;

    // ===== Assertion Thresholds (Public) =====
    signal input minRevenue;
    signal input maxTotalExpenses;
    signal input minNetAssets;
    signal input expenseCategoryLimits[NUM_EXPENSE_CATS];

    // ===== Private Inputs =====
    signal input entityPkX, entityPkY;
    signal input entitySk;
    signal input auditorPkX, auditorPkY;
    signal input entitySalt;
    signal input auditorSalt;

    signal input revenueAmount;
    signal input revenueProof[TREE_DEPTH];
    signal input revenueProofIndices[TREE_DEPTH];

    signal input expenseAmounts[NUM_EXPENSE_CATS];
    signal input expenseProofs[NUM_EXPENSE_CATS][TREE_DEPTH];
    signal input expenseProofIndices[NUM_EXPENSE_CATS][TREE_DEPTH];

    signal input assetValues[NUM_ASSETS];
    signal input assetProofs[NUM_ASSETS][TREE_DEPTH];
    signal input assetProofIndices[NUM_ASSETS][TREE_DEPTH];

    signal input liabilityValues[NUM_LIABILITIES];
    signal input liabilityProofs[NUM_LIABILITIES][TREE_DEPTH];
    signal input liabilityProofIndices[NUM_LIABILITIES][TREE_DEPTH];

    // ===== 1. Verify Entity Identity =====
    component entityCommitHash = Poseidon(3);
    entityCommitHash.inputs[0] <== entityPkX;
    entityCommitHash.inputs[1] <== entityPkY;
    entityCommitHash.inputs[2] <== entitySalt;
    entityCommitHash.out === entityCommit;

    // ===== 2. Verify Entity Ownership =====
    component entityOwnership = ProofOfOwnershipStrict();
    entityOwnership.sk <== entitySk;
    entityOwnership.pkX <== entityPkX;
    entityOwnership.pkY <== entityPkY;

    // ===== 3. Verify Auditor Identity =====
    component auditorCommitHash = Poseidon(3);
    auditorCommitHash.inputs[0] <== auditorPkX;
    auditorCommitHash.inputs[1] <== auditorPkY;
    auditorCommitHash.inputs[2] <== auditorSalt;
    auditorCommitHash.out === auditorCommit;

    // ===== 4. Verify Revenue in Financial Records =====
    component revenueLeaf = Poseidon(4);
    revenueLeaf.inputs[0] <== entityPkX;
    revenueLeaf.inputs[1] <== revenueAmount;
    revenueLeaf.inputs[2] <== periodStart;
    revenueLeaf.inputs[3] <== periodEnd;

    component revenueMerkle = MerkleProof(TREE_DEPTH);
    revenueMerkle.leaf <== revenueLeaf.out;
    revenueMerkle.root <== financialRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        revenueMerkle.siblings[i] <== revenueProof[i];
        revenueMerkle.pathIndices[i] <== revenueProofIndices[i];
    }

    // ===== 5. Verify Revenue >= Minimum =====
    component revenueCheck = GreaterEqThan(64);
    revenueCheck.in[0] <== revenueAmount;
    revenueCheck.in[1] <== minRevenue;
    revenueCheck.out === 1;

    // ===== 6. Verify Expenses =====
    signal totalExpenses[NUM_EXPENSE_CATS + 1];
    totalExpenses[0] <== 0;

    component expenseLeaves[NUM_EXPENSE_CATS];
    component expenseMerkle[NUM_EXPENSE_CATS];
    component expenseLimitChecks[NUM_EXPENSE_CATS];

    for (var i = 0; i < NUM_EXPENSE_CATS; i++) {
        // Create expense leaf
        expenseLeaves[i] = Poseidon(4);
        expenseLeaves[i].inputs[0] <== entityPkX;
        expenseLeaves[i].inputs[1] <== expenseAmounts[i];
        expenseLeaves[i].inputs[2] <== i; // category index
        expenseLeaves[i].inputs[3] <== periodEnd;

        // Verify in Merkle tree
        expenseMerkle[i] = MerkleProof(TREE_DEPTH);
        expenseMerkle[i].leaf <== expenseLeaves[i].out;
        expenseMerkle[i].root <== financialRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            expenseMerkle[i].siblings[j] <== expenseProofs[i][j];
            expenseMerkle[i].pathIndices[j] <== expenseProofIndices[i][j];
        }

        // Verify category within limit
        expenseLimitChecks[i] = LessEqThan(64);
        expenseLimitChecks[i].in[0] <== expenseAmounts[i];
        expenseLimitChecks[i].in[1] <== expenseCategoryLimits[i];
        expenseLimitChecks[i].out === 1;

        totalExpenses[i + 1] <== totalExpenses[i] + expenseAmounts[i];
    }

    // Verify total expenses within limit
    component totalExpenseCheck = LessEqThan(64);
    totalExpenseCheck.in[0] <== totalExpenses[NUM_EXPENSE_CATS];
    totalExpenseCheck.in[1] <== maxTotalExpenses;
    totalExpenseCheck.out === 1;

    // ===== 7. Verify Assets =====
    signal totalAssets[NUM_ASSETS + 1];
    totalAssets[0] <== 0;

    component assetLeaves[NUM_ASSETS];
    component assetMerkle[NUM_ASSETS];

    for (var i = 0; i < NUM_ASSETS; i++) {
        assetLeaves[i] = Poseidon(3);
        assetLeaves[i].inputs[0] <== entityPkX;
        assetLeaves[i].inputs[1] <== assetValues[i];
        assetLeaves[i].inputs[2] <== periodEnd;

        assetMerkle[i] = MerkleProof(TREE_DEPTH);
        assetMerkle[i].leaf <== assetLeaves[i].out;
        assetMerkle[i].root <== financialRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            assetMerkle[i].siblings[j] <== assetProofs[i][j];
            assetMerkle[i].pathIndices[j] <== assetProofIndices[i][j];
        }

        totalAssets[i + 1] <== totalAssets[i] + assetValues[i];
    }

    // ===== 8. Verify Liabilities =====
    signal totalLiabilities[NUM_LIABILITIES + 1];
    totalLiabilities[0] <== 0;

    component liabilityLeaves[NUM_LIABILITIES];
    component liabilityMerkle[NUM_LIABILITIES];

    for (var i = 0; i < NUM_LIABILITIES; i++) {
        liabilityLeaves[i] = Poseidon(3);
        liabilityLeaves[i].inputs[0] <== entityPkX;
        liabilityLeaves[i].inputs[1] <== liabilityValues[i];
        liabilityLeaves[i].inputs[2] <== periodEnd;

        liabilityMerkle[i] = MerkleProof(TREE_DEPTH);
        liabilityMerkle[i].leaf <== liabilityLeaves[i].out;
        liabilityMerkle[i].root <== financialRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            liabilityMerkle[i].siblings[j] <== liabilityProofs[i][j];
            liabilityMerkle[i].pathIndices[j] <== liabilityProofIndices[i][j];
        }

        totalLiabilities[i + 1] <== totalLiabilities[i] + liabilityValues[i];
    }

    // ===== 9. Verify Net Assets =====
    signal netAssets;
    netAssets <== totalAssets[NUM_ASSETS] - totalLiabilities[NUM_LIABILITIES];

    component netAssetCheck = GreaterEqThan(64);
    netAssetCheck.in[0] <== netAssets;
    netAssetCheck.in[1] <== minNetAssets;
    netAssetCheck.out === 1;

    // ===== 10. Generate Assertion Hash =====
    component assertionHasher = Poseidon(6);
    assertionHasher.inputs[0] <== entityCommit;
    assertionHasher.inputs[1] <== minRevenue;
    assertionHasher.inputs[2] <== maxTotalExpenses;
    assertionHasher.inputs[3] <== minNetAssets;
    assertionHasher.inputs[4] <== periodStart;
    assertionHasher.inputs[5] <== periodEnd;
    assertionHasher.out === assertionHash;
}

component main {public [entityCommit, auditorCommit, periodStart, periodEnd, assertionHash, financialRoot, minRevenue, maxTotalExpenses, minNetAssets, expenseCategoryLimits]} =
    AuditDisclosure(8, 10, 5, 12);
```

### Key Constraints

1. **Entity Authorization**: Only the entity can disclose their own financial data
2. **Data Integrity**: All financial figures proven against committed financial records
3. **Threshold Verification**: Each assertion (revenue, expenses, net assets) meets requirements
4. **Category Compliance**: Expense categories individually within limits
5. **Period Binding**: Assertions bound to specific audit period

## Effects

| Aspect | Impact |
|--------|--------|
| **Privacy Preservation** | Exact figures hidden; only threshold compliance disclosed |
| **Audit Efficiency** | Instant verification of assertions without document review |
| **Scope Control** | Entity controls exactly which facts are disclosed |
| **Continuous Monitoring** | Enables real-time compliance checks |
| **Cost Reduction** | Reduced auditor time for routine verifications |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Data Manipulation** | Financial records committed in Merkle tree before audit |
| **Selective Disclosure Abuse** | Auditor specifies required assertions, not entity |
| **Stale Data** | Period timestamps ensure data freshness |
| **Collusion** | Auditor identity committed; independence verifiable |
| **Incomplete Disclosure** | Assertions must cover all required audit areas |
| **Record Tampering** | Financial root updated only through verified processes |

## Implementation Challenges

1. **Financial Record Commitment**
   - How are financial records committed to the Merkle tree?
   - Integration with accounting systems (QuickBooks, SAP, etc.)
   - Handling amendments and corrections
   - Real-time vs. batch commitment

2. **Assertion Standardization**
   - Different audits require different assertions
   - Industry-specific audit requirements
   - Regulatory framework alignment (SOC2, GAAP, IFRS)

3. **Auditor Verification**
   - How to verify auditor is properly licensed?
   - Independence requirements
   - Auditor rotation compliance

4. **Evidence Retention**
   - Proofs must be stored for potential future disputes
   - Long-term proof validity
   - Working paper equivalents in ZK context

## Derivatives

1. **Continuous Auditing** - Real-time compliance monitoring with periodic proof generation. Enables auditors to verify ongoing compliance without constant access, with automatic alerts when assertions fail.

2. **Internal Audit Proofs** - Departmental or divisional audits within organization. Business units prove compliance to corporate without revealing competitive internal data to other units.

3. **Regulatory Audits** - Specialized circuits for specific regulatory frameworks. Proves SOX compliance, banking capital adequacy, or insurance reserve requirements without full disclosure.

4. **Third-Party Verification** - Enables customers, partners, or investors to verify specific facts. Company proves minimum net assets or revenue threshold without revealing exact figures.

5. **Historical Audit Trails** - Proves consistency of financial records over time. Demonstrates records weren't retroactively modified, with timestamp verification and sequential proof linking.

## Use Cases

1. **Annual Financial Audit**
   - Public company undergoes annual audit
   - Proves revenue, expenses, and net assets within expected ranges
   - Auditor verifies assertions without accessing detailed general ledger
   - Board receives audit opinion with reduced disclosure risk

2. **Loan Covenant Compliance**
   - Borrower must prove debt-to-equity ratio below threshold
   - Bank verifies compliance quarterly
   - Exact financial position remains confidential
   - Automatic notification if covenant breached

3. **Due Diligence Support**
   - Acquisition target proves financial assertions
   - Revenue minimums, expense controls, asset valuations
   - Acquirer verifies without full data room access initially
   - Detailed disclosure only after preliminary agreement

4. **Regulatory Examination**
   - Bank proves capital adequacy requirements met
   - Specific ratios and thresholds verified
   - Detailed loan portfolio data remains private
   - Regulator confirms compliance without full access

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/g-enterprise/g5-audit-products.md) for detailed product descriptions and user experience scenarios.

---

[Back to Index](../../README.md)
