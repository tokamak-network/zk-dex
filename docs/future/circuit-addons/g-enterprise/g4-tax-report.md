# G4. Tax Report Generate

Privacy-preserving tax compliance proofs that demonstrate tax obligations are met without revealing complete financial records.

**Constraints**: ~500K | **Complexity**: High

---

## Background

Tax reporting requires balancing privacy with compliance obligations:

- **Financial Privacy**: Full tax returns reveal income sources, investment strategies, and financial position
- **Compliance Verification**: Tax authorities need assurance taxes are correctly calculated
- **Audit Risk**: Over-disclosure invites unnecessary scrutiny; under-disclosure risks penalties
- **Cross-Border Complexity**: Multi-jurisdiction taxation requires selective disclosure to multiple authorities

Current systems force a binary choice: full disclosure or non-compliance. ZK tax reports enable proving that tax obligations are correctly calculated based on actual financial data without revealing the underlying transactions, amounts, or counterparties.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `taxpayerCommit` | field | Commitment to taxpayer identity |
| `taxYear` | uint | Tax reporting year |
| `jurisdictionId` | uint | Tax jurisdiction code |
| `taxOwed` | uint | Calculated tax liability |
| `taxPaid` | uint | Tax amount paid |
| `incomeRangeCommit` | field | Commitment to income bracket |
| `complianceHash` | field | Hash of compliance attestation |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `taxpayerPkX, taxpayerPkY` | field | Taxpayer's public key |
| `taxpayerSk` | field | Taxpayer's secret key |
| `totalIncome` | uint | Gross income amount |
| `deductions[N]` | uint[] | Itemized deduction amounts |
| `deductionTypes[N]` | uint[] | Deduction category codes |
| `taxableIncome` | uint | Income after deductions |
| `taxBrackets[M]` | uint[] | Applicable tax brackets |
| `taxRates[M]` | uint[] | Rates for each bracket |
| `incomeProofs` | field[][] | Merkle proofs for income sources |
| `taxpayerSalt` | field | Identity commitment randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template TaxReportGenerate(NUM_DEDUCTIONS, NUM_BRACKETS, NUM_INCOME_SOURCES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input taxpayerCommit;
    signal input taxYear;
    signal input jurisdictionId;
    signal input taxOwed;
    signal input taxPaid;
    signal input incomeRangeCommit;
    signal input complianceHash;
    signal input incomeSourcesRoot;

    // ===== Private Inputs =====
    signal input taxpayerPkX, taxpayerPkY;
    signal input taxpayerSk;
    signal input totalIncome;
    signal input deductions[NUM_DEDUCTIONS];
    signal input deductionTypes[NUM_DEDUCTIONS];
    signal input deductionLimits[NUM_DEDUCTIONS];
    signal input taxableIncome;
    signal input taxBrackets[NUM_BRACKETS];
    signal input taxRates[NUM_BRACKETS];
    signal input incomeSources[NUM_INCOME_SOURCES];
    signal input incomeProofs[NUM_INCOME_SOURCES][TREE_DEPTH];
    signal input incomeProofIndices[NUM_INCOME_SOURCES][TREE_DEPTH];
    signal input taxpayerSalt;
    signal input incomeLowerBound;
    signal input incomeUpperBound;

    // ===== 1. Verify Taxpayer Identity =====
    component taxpayerCommitHash = Poseidon(3);
    taxpayerCommitHash.inputs[0] <== taxpayerPkX;
    taxpayerCommitHash.inputs[1] <== taxpayerPkY;
    taxpayerCommitHash.inputs[2] <== taxpayerSalt;
    taxpayerCommitHash.out === taxpayerCommit;

    // ===== 2. Verify Taxpayer Ownership =====
    component taxpayerOwnership = ProofOfOwnershipStrict();
    taxpayerOwnership.sk <== taxpayerSk;
    taxpayerOwnership.pkX <== taxpayerPkX;
    taxpayerOwnership.pkY <== taxpayerPkY;

    // ===== 3. Verify Income Sources =====
    signal incomeSum[NUM_INCOME_SOURCES + 1];
    incomeSum[0] <== 0;

    component incomeMerkle[NUM_INCOME_SOURCES];
    component incomeLeaves[NUM_INCOME_SOURCES];

    for (var i = 0; i < NUM_INCOME_SOURCES; i++) {
        // Create leaf for income source
        incomeLeaves[i] = Poseidon(3);
        incomeLeaves[i].inputs[0] <== taxpayerPkX;
        incomeLeaves[i].inputs[1] <== incomeSources[i];
        incomeLeaves[i].inputs[2] <== taxYear;

        // Verify income source in Merkle tree
        incomeMerkle[i] = MerkleProof(TREE_DEPTH);
        incomeMerkle[i].leaf <== incomeLeaves[i].out;
        incomeMerkle[i].root <== incomeSourcesRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            incomeMerkle[i].siblings[j] <== incomeProofs[i][j];
            incomeMerkle[i].pathIndices[j] <== incomeProofIndices[i][j];
        }

        incomeSum[i + 1] <== incomeSum[i] + incomeSources[i];
    }

    // Total income must match sum of verified sources
    incomeSum[NUM_INCOME_SOURCES] === totalIncome;

    // ===== 4. Verify Deductions =====
    signal deductionSum[NUM_DEDUCTIONS + 1];
    deductionSum[0] <== 0;

    component deductionChecks[NUM_DEDUCTIONS];

    for (var i = 0; i < NUM_DEDUCTIONS; i++) {
        // Each deduction must be within allowed limit for its type
        deductionChecks[i] = LessEqThan(64);
        deductionChecks[i].in[0] <== deductions[i];
        deductionChecks[i].in[1] <== deductionLimits[i];
        deductionChecks[i].out === 1;

        deductionSum[i + 1] <== deductionSum[i] + deductions[i];
    }

    // ===== 5. Verify Taxable Income Calculation =====
    signal calculatedTaxableIncome;
    calculatedTaxableIncome <== totalIncome - deductionSum[NUM_DEDUCTIONS];

    // Handle case where deductions exceed income
    component taxableCheck = GreaterEqThan(64);
    taxableCheck.in[0] <== calculatedTaxableIncome;
    taxableCheck.in[1] <== 0;

    // Use actual taxable income (minimum 0)
    signal effectiveTaxableIncome;
    effectiveTaxableIncome <== taxableCheck.out * calculatedTaxableIncome;
    effectiveTaxableIncome === taxableIncome;

    // ===== 6. Calculate Tax Using Brackets =====
    signal bracketTax[NUM_BRACKETS];
    signal taxAccum[NUM_BRACKETS + 1];
    taxAccum[0] <== 0;

    component bracketComparators[NUM_BRACKETS];
    signal incomeInBracket[NUM_BRACKETS];

    for (var i = 0; i < NUM_BRACKETS; i++) {
        // Determine income in this bracket
        if (i == 0) {
            bracketComparators[i] = LessThan(64);
            bracketComparators[i].in[0] <== taxableIncome;
            bracketComparators[i].in[1] <== taxBrackets[i];

            // If income < bracket limit, tax all income; else tax up to limit
            incomeInBracket[i] <== bracketComparators[i].out * taxableIncome +
                                   (1 - bracketComparators[i].out) * taxBrackets[i];
        } else {
            bracketComparators[i] = LessThan(64);
            bracketComparators[i].in[0] <== taxableIncome;
            bracketComparators[i].in[1] <== taxBrackets[i];

            signal bracketWidth;
            bracketWidth <== taxBrackets[i] - taxBrackets[i-1];

            signal incomeAbovePrevBracket;
            incomeAbovePrevBracket <== taxableIncome - taxBrackets[i-1];

            // If income exceeds this bracket, use full bracket width
            incomeInBracket[i] <== bracketComparators[i].out * incomeAbovePrevBracket +
                                   (1 - bracketComparators[i].out) * bracketWidth;
        }

        // Calculate tax for this bracket
        bracketTax[i] <== incomeInBracket[i] * taxRates[i] / 10000;
        taxAccum[i + 1] <== taxAccum[i] + bracketTax[i];
    }

    // Verify calculated tax matches claimed tax
    taxAccum[NUM_BRACKETS] === taxOwed;

    // ===== 7. Verify Tax Payment Sufficiency =====
    component paymentCheck = GreaterEqThan(64);
    paymentCheck.in[0] <== taxPaid;
    paymentCheck.in[1] <== taxOwed;
    paymentCheck.out === 1;

    // ===== 8. Verify Income Range Commitment =====
    component incomeRangeHash = Poseidon(2);
    incomeRangeHash.inputs[0] <== incomeLowerBound;
    incomeRangeHash.inputs[1] <== incomeUpperBound;
    incomeRangeHash.out === incomeRangeCommit;

    // Verify income falls within committed range
    component lowerBoundCheck = GreaterEqThan(64);
    lowerBoundCheck.in[0] <== totalIncome;
    lowerBoundCheck.in[1] <== incomeLowerBound;
    lowerBoundCheck.out === 1;

    component upperBoundCheck = LessEqThan(64);
    upperBoundCheck.in[0] <== totalIncome;
    upperBoundCheck.in[1] <== incomeUpperBound;
    upperBoundCheck.out === 1;

    // ===== 9. Generate Compliance Attestation =====
    component complianceHasher = Poseidon(5);
    complianceHasher.inputs[0] <== taxpayerCommit;
    complianceHasher.inputs[1] <== taxYear;
    complianceHasher.inputs[2] <== jurisdictionId;
    complianceHasher.inputs[3] <== taxOwed;
    complianceHasher.inputs[4] <== taxPaid;
    complianceHasher.out === complianceHash;
}

component main {public [taxpayerCommit, taxYear, jurisdictionId, taxOwed, taxPaid, incomeRangeCommit, complianceHash, incomeSourcesRoot]} =
    TaxReportGenerate(10, 5, 20, 12);
```

### Key Constraints

1. **Identity Verification**: Taxpayer identity bound via commitment
2. **Income Verification**: All income sources proven via Merkle inclusion
3. **Deduction Limits**: Each deduction within allowed limits for type
4. **Tax Calculation**: Tax computed correctly using bracket structure
5. **Payment Sufficiency**: Tax paid meets or exceeds obligation
6. **Range Proof**: Income falls within disclosed range

## Effects

| Aspect | Impact |
|--------|--------|
| **Privacy Preservation** | Exact income and deductions hidden from public |
| **Compliance Proof** | Tax authorities can verify correct calculation |
| **Selective Disclosure** | Different information to different authorities |
| **Audit Efficiency** | Pre-verified returns reduce audit burden |
| **Fraud Prevention** | Income must be verifiably sourced |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Income Underreporting** | Income must be proven via Merkle inclusion from verified sources |
| **Deduction Inflation** | Deductions capped by jurisdiction-specific limits |
| **False Identity** | Taxpayer ownership proof required |
| **Bracket Manipulation** | Tax brackets and rates are public inputs verified by contract |
| **Double Reporting** | Year and jurisdiction included prevent cross-filing |
| **Proof Forgery** | Zero-knowledge proof cryptographically unforgeable |

## Implementation Challenges

1. **Income Source Oracle**
   - Who maintains the verified income sources Merkle tree?
   - Employer reporting integration
   - Investment income tracking
   - Self-employment income verification

2. **Jurisdiction-Specific Rules**
   - Different countries have vastly different tax codes
   - Deduction categories and limits vary
   - Need modular circuit design for jurisdiction plugins

3. **Multi-Year Carryforwards**
   - Loss carryforwards require linking across years
   - Capital gains calculations need cost basis tracking
   - Depreciation schedules span multiple years

4. **Audit Compatibility**
   - How to handle audit requests with selective disclosure
   - Evidence preservation for potential disputes
   - Integration with existing tax authority systems

## Derivatives

1. **Multi-Jurisdiction Tax** - Handles taxpayers with obligations in multiple countries. Circuit proves proper allocation of income, foreign tax credits, and treaty benefits without revealing full global income picture to any single authority.

2. **Capital Gains Calculation** - Specialized circuit for investment tax calculations. Proves cost basis, holding periods, and gain/loss amounts from trade history without revealing specific positions or trading strategy.

3. **Loss Harvesting Proofs** - Demonstrates tax loss harvesting was performed within rules. Proves losses are genuine, wash sale rules not violated, and loss amounts correct without revealing portfolio composition.

4. **Deduction Verification** - Detailed proof for specific deduction categories. Proves charitable donations, medical expenses, or business expenses meet requirements without revealing beneficiaries or vendors.

5. **Audit-Ready Reports** - Enhanced reports with selective disclosure capability. Pre-computes proofs for common audit queries, enabling rapid response while maintaining privacy for non-queried items.

## Use Cases

1. **High-Net-Worth Individual**
   - Complex income from multiple sources globally
   - Proves tax compliance without revealing wealth structure
   - Different disclosures to different jurisdictions
   - Privacy-preserving proof of tax residency

2. **Cryptocurrency Trader**
   - Thousands of transactions across multiple exchanges
   - Proves capital gains calculated correctly
   - Cost basis tracking without revealing trading strategy
   - Demonstrates no wash sales without showing all trades

3. **Business Owner**
   - Mixed personal and business income
   - Proves business expense deductions are legitimate
   - Salary vs. dividend split compliance
   - Privacy for customer-related business deductions

4. **International Employee**
   - Works in multiple countries during year
   - Proves proper tax allocation between jurisdictions
   - Foreign tax credit calculations
   - Treaty benefit eligibility without full income disclosure

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../../product/g-enterprise/g4-tax-report-products.md) for detailed product descriptions and user experience scenarios.

---

[Back to Index](../../README.md)
