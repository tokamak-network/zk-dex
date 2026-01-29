# G1. Private Payroll Batch

Batch salary distribution with privacy-preserving verification of total amounts and individual entitlements.

**Constraints**: ~400K | **Complexity**: High

---

## Background

Private payroll systems are critical for organizational privacy and employee confidentiality:

- **Compensation Confidentiality**: Salary information is highly sensitive; exposure causes workplace conflicts and competitive disadvantages
- **Regulatory Compliance**: Many jurisdictions require payroll privacy while mandating tax withholding verification
- **Batch Efficiency**: Processing multiple payments in a single proof dramatically reduces gas costs
- **Audit Compatibility**: Organizations need to prove correct payroll execution without revealing individual amounts

Traditional blockchain payroll exposes all salary information publicly. Even "privacy" solutions often leak aggregate data or payment patterns. ZK payroll enables full confidentiality while maintaining verifiability for auditors and tax authorities.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `companyNoteHash` | field | Hash of company's funding note |
| `totalPayout` | uint | Sum of all salary payments (can be hidden via commitment) |
| `payrollRoot` | field | Merkle root of payroll commitments |
| `outputNotesRoot` | field | Merkle root of all employee output notes |
| `periodId` | uint | Payroll period identifier (month/week) |
| `employeeCount` | uint | Number of employees in batch |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `companyPkX, companyPkY` | field | Company's public key |
| `companySk` | field | Company's secret key |
| `companyValue` | uint | Company note value |
| `companySalt` | field | Company note randomness |
| `salaries[N]` | uint[] | Individual salary amounts |
| `employeePkX[N], employeePkY[N]` | field[] | Employee public keys |
| `employeeSalts[N]` | field[] | Output note randomness |
| `payrollProofs[N]` | field[][] | Merkle proofs for each employee |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template PrivatePayrollBatch(N, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input companyNoteHash;
    signal input totalPayout;
    signal input payrollRoot;
    signal input outputNotesRoot;
    signal input periodId;
    signal input employeeCount;

    // ===== Private Inputs =====
    signal input companyPkX, companyPkY;
    signal input companySk;
    signal input companyValue;
    signal input companySalt;
    signal input tokenType;

    signal input salaries[N];
    signal input employeePkX[N];
    signal input employeePkY[N];
    signal input employeeSalts[N];
    signal input payrollProofs[N][TREE_DEPTH];
    signal input payrollProofIndices[N][TREE_DEPTH];

    // ===== 1. Verify Company Ownership =====
    component companyNote = PoseidonRegularNote();
    companyNote.pkX <== companyPkX;
    companyNote.pkY <== companyPkY;
    companyNote.value <== companyValue;
    companyNote.tokenType <== tokenType;
    companyNote.salt <== companySalt;
    companyNote.out === companyNoteHash;

    component companyOwnership = ProofOfOwnershipStrict();
    companyOwnership.sk <== companySk;
    companyOwnership.pkX <== companyPkX;
    companyOwnership.pkY <== companyPkY;

    // ===== 2. Sum All Salaries =====
    signal salarySum[N + 1];
    salarySum[0] <== 0;
    for (var i = 0; i < N; i++) {
        salarySum[i + 1] <== salarySum[i] + salaries[i];
    }
    salarySum[N] === totalPayout;

    // ===== 3. Verify Sufficient Funds =====
    component fundCheck = GreaterEqThan(128);
    fundCheck.in[0] <== companyValue;
    fundCheck.in[1] <== totalPayout;
    fundCheck.out === 1;

    // ===== 4. Verify Each Employee in Payroll =====
    component payrollLeaves[N];
    component payrollMerkle[N];
    component outputNotes[N];
    signal outputHashes[N];

    for (var i = 0; i < N; i++) {
        // Create payroll commitment: hash(employeePk, expectedSalary, periodId)
        payrollLeaves[i] = Poseidon(4);
        payrollLeaves[i].inputs[0] <== employeePkX[i];
        payrollLeaves[i].inputs[1] <== employeePkY[i];
        payrollLeaves[i].inputs[2] <== salaries[i];
        payrollLeaves[i].inputs[3] <== periodId;

        // Verify employee is in payroll Merkle tree
        payrollMerkle[i] = MerkleProof(TREE_DEPTH);
        payrollMerkle[i].leaf <== payrollLeaves[i].out;
        payrollMerkle[i].root <== payrollRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            payrollMerkle[i].siblings[j] <== payrollProofs[i][j];
            payrollMerkle[i].pathIndices[j] <== payrollProofIndices[i][j];
        }

        // Create output note for employee
        outputNotes[i] = PoseidonRegularNote();
        outputNotes[i].pkX <== employeePkX[i];
        outputNotes[i].pkY <== employeePkY[i];
        outputNotes[i].value <== salaries[i];
        outputNotes[i].tokenType <== tokenType;
        outputNotes[i].salt <== employeeSalts[i];
        outputHashes[i] <== outputNotes[i].out;
    }

    // ===== 5. Verify Output Notes Root =====
    component outputTree = MerkleRoot(N);
    for (var i = 0; i < N; i++) {
        outputTree.leaves[i] <== outputHashes[i];
    }
    outputTree.root === outputNotesRoot;
}

component main {public [companyNoteHash, totalPayout, payrollRoot, outputNotesRoot, periodId, employeeCount]} =
    PrivatePayrollBatch(64, 10);
```

### Key Constraints

1. **Company Authorization**: Only the company with valid secret key can initiate payroll
2. **Payroll Integrity**: Each employee-salary pair must exist in pre-committed payroll tree
3. **Balance Conservation**: Total payout must equal sum of individual salaries
4. **Sufficient Funds**: Company note must have enough value for total payout
5. **Period Binding**: Payroll is locked to specific period preventing replay

## Effects

| Aspect | Impact |
|--------|--------|
| **Privacy** | Individual salaries completely hidden from public |
| **Efficiency** | Single proof for entire batch vs. N individual transactions |
| **Compliance** | Auditors can verify totals without seeing individual amounts |
| **Employee Protection** | Workers' compensation data remains confidential |
| **Cost Reduction** | ~90% gas savings compared to individual payments |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Payroll Tampering** | Merkle commitment to payroll data before execution |
| **Double Payment** | Period ID and nullifiers prevent duplicate payroll runs |
| **Unauthorized Access** | Company secret key required for proof generation |
| **Employee Impersonation** | Employee public keys verified in payroll tree |
| **Selective Non-payment** | Output notes root commits to all payments atomically |
| **Front-running** | Payroll commitments are hidden until execution |

## Implementation Challenges

1. **Scalability Limits**
   - Circuit size grows linearly with employee count
   - May need batching for organizations with >100 employees
   - Consider recursive proof composition for large payrolls

2. **Payroll Data Management**
   - Secure off-chain storage for salary data
   - Key management for HR personnel
   - Synchronization between HR systems and ZK infrastructure

3. **Tax Integration**
   - Different jurisdictions have varying withholding requirements
   - Need sub-circuits for tax calculation verification
   - Cross-border payroll adds complexity

4. **Dispute Resolution**
   - How to prove non-payment if employee claims missing salary
   - Selective disclosure mechanisms for dispute cases
   - Audit trail maintenance

## Derivatives

1. **Multi-Currency Payroll** - Employees receive salaries in different tokens based on preference. Circuit verifies exchange rates and handles token-specific output notes, enabling global teams to be paid in local stablecoins.

2. **Bonus Distribution** - Variable compensation tied to performance metrics. Extends base payroll with additional range proofs showing bonus amounts fall within approved brackets without revealing exact performance scores.

3. **Tax Withholding Proofs** - Automatic calculation and proof of tax withholding compliance. Sub-circuit computes withholding based on salary brackets and generates proofs for tax authorities without revealing gross salary.

4. **Benefits Deduction** - Healthcare, retirement, and other benefit deductions verified privately. Proves deductions match enrolled benefit levels without exposing which specific benefits each employee selected.

5. **Contractor Payments** - Extends payroll to include contract workers with different payment terms. Supports milestone-based payments, hourly billing verification, and variable payment schedules.

## Use Cases

1. **Corporate Payroll Processing**
   - Company with 50 employees processes monthly payroll
   - HR commits to payroll data; finance approves total amount
   - Single proof distributes all salaries privately
   - Auditors can verify total matches approved budget

2. **DAO Contributor Compensation**
   - Decentralized organization pays anonymous contributors
   - Pseudonymous members receive compensation without identity exposure
   - Governance can verify total spending without individual amounts
   - Enables privacy-preserving contributor rewards

3. **Multi-National Organization**
   - Global company pays employees across jurisdictions
   - Different currencies, tax rates, and benefit structures
   - Single batch proof handles all variations
   - Local compliance verified without central salary database

4. **Sensitive Industry Payroll**
   - Defense contractors or research organizations with classified projects
   - Compensation levels could reveal project importance or role seniority
   - ZK payroll prevents competitive intelligence gathering
   - Maintains compliance while protecting organizational structure

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/g-enterprise/g1-payroll-products.md) for detailed product descriptions and user experience scenarios.

---

[Back to Index](../../README.md)
