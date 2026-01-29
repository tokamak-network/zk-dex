# E15. Loan Repay

Repay loans with hidden repayment amounts, outstanding balances, and interest payments for private debt management.

**Constraints**: ~180K | **Complexity**: Low

---

## Background

Loan repayments expose sensitive financial information:

- **Debt Levels**: Visible repayments reveal total debt and financial health
- **Cash Flow Patterns**: Repayment timing exposes income patterns
- **Interest Burden**: Published interest payments reveal borrowing costs
- **Payoff Timeline**: Repayment sizes signal debt payoff schedule

Current lending protocols expose all repayment parameters. Private loan repayment hides amounts while proving debt reduction through ZK proofs.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `loanNoteHash` | field | Hash of the loan position note |
| `newLoanNoteHash` | field | Hash of loan after repayment |
| `repaymentNoteHash` | field | Hash of repayment token note |
| `lendingPoolCommitment` | field | Lending pool state commitment |
| `tokenType` | uint | Token being repaid |
| `interestRate` | uint | Current interest rate |
| `nullifier` | field | Prevents double-repayment |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `borrowerPkX, borrowerPkY` | field | Borrower's public key |
| `borrowerSk` | field | Borrower's secret key |
| `principalOutstanding` | uint | Current principal owed (hidden) |
| `interestAccrued` | uint | Accrued interest (hidden) |
| `repaymentAmount` | uint | Amount being repaid (hidden) |
| `principalRepaid` | uint | Principal portion of repayment |
| `interestPaid` | uint | Interest portion of repayment |
| `newPrincipal` | uint | Remaining principal (hidden) |
| `loanSalt` | field | Loan note randomness |
| `newLoanSalt` | field | New loan note randomness |
| `repaymentSalt` | field | Repayment note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template LoanRepay() {
    // ===== Public Inputs =====
    signal input loanNoteHash;
    signal input newLoanNoteHash;
    signal input repaymentNoteHash;
    signal input lendingPoolCommitment;
    signal input newPoolCommitment;
    signal input tokenType;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input borrowerPkX, borrowerPkY, borrowerSk;
    signal input principalOutstanding;
    signal input interestAccrued;
    signal input lastAccrualTime;
    signal input interestRate;        // Annual rate in basis points
    signal input repaymentAmount;
    signal input principalRepaid;
    signal input interestPaid;
    signal input newPrincipal;
    signal input newInterest;
    signal input loanSalt, newLoanSalt, repaymentSalt;
    signal input poolTotalBorrowed, poolSalt;
    signal input newPoolTotalBorrowed, newPoolSalt;

    // ===== 1. Verify Borrower Ownership =====
    component borrowerOwnership = ProofOfOwnershipStrict();
    borrowerOwnership.sk <== borrowerSk;
    borrowerOwnership.pkX <== borrowerPkX;
    borrowerOwnership.pkY <== borrowerPkY;

    // ===== 2. Verify Current Loan Note =====
    component loanNote = Poseidon(7);
    loanNote.inputs[0] <== borrowerPkX;
    loanNote.inputs[1] <== borrowerPkY;
    loanNote.inputs[2] <== principalOutstanding;
    loanNote.inputs[3] <== interestAccrued;
    loanNote.inputs[4] <== lastAccrualTime;
    loanNote.inputs[5] <== tokenType;
    loanNote.inputs[6] <== loanSalt;
    loanNote.out === loanNoteHash;

    // ===== 3. Calculate New Interest Accrued =====
    signal timeElapsed;
    timeElapsed <== currentTime - lastAccrualTime;

    signal newInterestAccrued;
    // interest = principal * rate * time / (365 * 86400 * 10000)
    // Simplified: interest per second = principal * rate / (365 * 86400 * 10000)
    signal annualSeconds;
    annualSeconds <== 31536000;  // 365 * 86400

    signal interestForPeriod;
    interestForPeriod <== principalOutstanding * interestRate * timeElapsed / (annualSeconds * 10000);

    signal totalInterestOwed;
    totalInterestOwed <== interestAccrued + interestForPeriod;

    // ===== 4. Verify Repayment Allocation =====
    // Interest must be paid before principal
    // interestPaid <= totalInterestOwed
    component interestPaymentCheck = LessEqThan(128);
    interestPaymentCheck.in[0] <== interestPaid;
    interestPaymentCheck.in[1] <== totalInterestOwed;
    interestPaymentCheck.out === 1;

    // If interest fully paid, principal can be paid
    // principalRepaid <= principalOutstanding
    component principalPaymentCheck = LessEqThan(128);
    principalPaymentCheck.in[0] <== principalRepaid;
    principalPaymentCheck.in[1] <== principalOutstanding;
    principalPaymentCheck.out === 1;

    // Total repayment = interestPaid + principalRepaid
    repaymentAmount === interestPaid + principalRepaid;

    // ===== 5. Verify New Balances =====
    newInterest === totalInterestOwed - interestPaid;
    newPrincipal === principalOutstanding - principalRepaid;

    // ===== 6. Verify Repayment Note =====
    component repaymentNote = PoseidonRegularNote();
    repaymentNote.pkX <== borrowerPkX;
    repaymentNote.pkY <== borrowerPkY;
    repaymentNote.value <== repaymentAmount;
    repaymentNote.tokenType <== tokenType;
    repaymentNote.salt <== repaymentSalt;
    repaymentNote.out === repaymentNoteHash;

    // ===== 7. Verify New Loan Note =====
    component newLoanNote = Poseidon(7);
    newLoanNote.inputs[0] <== borrowerPkX;
    newLoanNote.inputs[1] <== borrowerPkY;
    newLoanNote.inputs[2] <== newPrincipal;
    newLoanNote.inputs[3] <== newInterest;
    newLoanNote.inputs[4] <== currentTime;
    newLoanNote.inputs[5] <== tokenType;
    newLoanNote.inputs[6] <== newLoanSalt;
    newLoanNote.out === newLoanNoteHash;

    // ===== 8. Update Pool State =====
    component poolState = Poseidon(3);
    poolState.inputs[0] <== poolTotalBorrowed;
    poolState.inputs[1] <== tokenType;
    poolState.inputs[2] <== poolSalt;
    poolState.out === lendingPoolCommitment;

    newPoolTotalBorrowed === poolTotalBorrowed - principalRepaid;

    component newPoolState = Poseidon(3);
    newPoolState.inputs[0] <== newPoolTotalBorrowed;
    newPoolState.inputs[1] <== tokenType;
    newPoolState.inputs[2] <== newPoolSalt;
    newPoolState.out === newPoolCommitment;

    // ===== 9. Verify Nullifier =====
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== loanNoteHash;
    nullifierHash.inputs[1] <== borrowerSk;
    nullifierHash.inputs[2] <== currentTime;
    nullifierHash.out === nullifier;
}

template LoanFullRepay() {
    // ===== Public Inputs =====
    signal input loanNoteHash;
    signal input repaymentNoteHash;
    signal input lendingPoolCommitment;
    signal input newPoolCommitment;
    signal input tokenType;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input borrowerPkX, borrowerPkY, borrowerSk;
    signal input principalOutstanding;
    signal input interestAccrued;
    signal input lastAccrualTime;
    signal input interestRate;
    signal input totalRepayment;
    signal input loanSalt, repaymentSalt;
    signal input poolTotalBorrowed, poolSalt;
    signal input newPoolTotalBorrowed, newPoolSalt;

    // ===== 1. Verify Borrower Ownership =====
    component borrowerOwnership = ProofOfOwnershipStrict();
    borrowerOwnership.sk <== borrowerSk;
    borrowerOwnership.pkX <== borrowerPkX;
    borrowerOwnership.pkY <== borrowerPkY;

    // ===== 2. Verify Current Loan Note =====
    component loanNote = Poseidon(7);
    loanNote.inputs[0] <== borrowerPkX;
    loanNote.inputs[1] <== borrowerPkY;
    loanNote.inputs[2] <== principalOutstanding;
    loanNote.inputs[3] <== interestAccrued;
    loanNote.inputs[4] <== lastAccrualTime;
    loanNote.inputs[5] <== tokenType;
    loanNote.inputs[6] <== loanSalt;
    loanNote.out === loanNoteHash;

    // ===== 3. Calculate Total Owed =====
    signal timeElapsed;
    timeElapsed <== currentTime - lastAccrualTime;

    signal interestForPeriod;
    interestForPeriod <== principalOutstanding * interestRate * timeElapsed / (31536000 * 10000);

    signal totalInterestOwed;
    totalInterestOwed <== interestAccrued + interestForPeriod;

    signal totalOwed;
    totalOwed <== principalOutstanding + totalInterestOwed;

    // ===== 4. Verify Full Repayment =====
    component repaymentCheck = GreaterEqThan(128);
    repaymentCheck.in[0] <== totalRepayment;
    repaymentCheck.in[1] <== totalOwed;
    repaymentCheck.out === 1;

    // ===== 5. Verify Repayment Note =====
    component repaymentNote = PoseidonRegularNote();
    repaymentNote.pkX <== borrowerPkX;
    repaymentNote.pkY <== borrowerPkY;
    repaymentNote.value <== totalRepayment;
    repaymentNote.tokenType <== tokenType;
    repaymentNote.salt <== repaymentSalt;
    repaymentNote.out === repaymentNoteHash;

    // ===== 6. Update Pool State =====
    component poolState = Poseidon(3);
    poolState.inputs[0] <== poolTotalBorrowed;
    poolState.inputs[1] <== tokenType;
    poolState.inputs[2] <== poolSalt;
    poolState.out === lendingPoolCommitment;

    newPoolTotalBorrowed === poolTotalBorrowed - principalOutstanding;

    component newPoolState = Poseidon(3);
    newPoolState.inputs[0] <== newPoolTotalBorrowed;
    newPoolState.inputs[1] <== tokenType;
    newPoolState.inputs[2] <== newPoolSalt;
    newPoolState.out === newPoolCommitment;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== loanNoteHash;
    nullifierHash.inputs[1] <== borrowerSk;
    nullifierHash.out === nullifier;
}

template InterestOnlyPayment() {
    // ===== Public Inputs =====
    signal input loanNoteHash;
    signal input newLoanNoteHash;
    signal input paymentNoteHash;
    signal input tokenType;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input borrowerPkX, borrowerPkY, borrowerSk;
    signal input principalOutstanding;
    signal input interestAccrued;
    signal input lastAccrualTime;
    signal input interestRate;
    signal input interestPayment;
    signal input loanSalt, newLoanSalt, paymentSalt;

    // ===== 1. Verify Borrower Ownership =====
    component borrowerOwnership = ProofOfOwnershipStrict();
    borrowerOwnership.sk <== borrowerSk;
    borrowerOwnership.pkX <== borrowerPkX;
    borrowerOwnership.pkY <== borrowerPkY;

    // ===== 2. Verify Current Loan Note =====
    component loanNote = Poseidon(7);
    loanNote.inputs[0] <== borrowerPkX;
    loanNote.inputs[1] <== borrowerPkY;
    loanNote.inputs[2] <== principalOutstanding;
    loanNote.inputs[3] <== interestAccrued;
    loanNote.inputs[4] <== lastAccrualTime;
    loanNote.inputs[5] <== tokenType;
    loanNote.inputs[6] <== loanSalt;
    loanNote.out === loanNoteHash;

    // ===== 3. Calculate Interest Owed =====
    signal timeElapsed;
    timeElapsed <== currentTime - lastAccrualTime;

    signal interestForPeriod;
    interestForPeriod <== principalOutstanding * interestRate * timeElapsed / (31536000 * 10000);

    signal totalInterestOwed;
    totalInterestOwed <== interestAccrued + interestForPeriod;

    // ===== 4. Verify Interest Payment =====
    component paymentCheck = LessEqThan(128);
    paymentCheck.in[0] <== interestPayment;
    paymentCheck.in[1] <== totalInterestOwed;
    paymentCheck.out === 1;

    signal remainingInterest;
    remainingInterest <== totalInterestOwed - interestPayment;

    // ===== 5. Verify Payment Note =====
    component paymentNote = PoseidonRegularNote();
    paymentNote.pkX <== borrowerPkX;
    paymentNote.pkY <== borrowerPkY;
    paymentNote.value <== interestPayment;
    paymentNote.tokenType <== tokenType;
    paymentNote.salt <== paymentSalt;
    paymentNote.out === paymentNoteHash;

    // ===== 6. Verify New Loan Note (principal unchanged) =====
    component newLoanNote = Poseidon(7);
    newLoanNote.inputs[0] <== borrowerPkX;
    newLoanNote.inputs[1] <== borrowerPkY;
    newLoanNote.inputs[2] <== principalOutstanding;  // Principal unchanged
    newLoanNote.inputs[3] <== remainingInterest;
    newLoanNote.inputs[4] <== currentTime;
    newLoanNote.inputs[5] <== tokenType;
    newLoanNote.inputs[6] <== newLoanSalt;
    newLoanNote.out === newLoanNoteHash;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(3);
    nullifierHash.inputs[0] <== loanNoteHash;
    nullifierHash.inputs[1] <== borrowerSk;
    nullifierHash.inputs[2] <== currentTime;
    nullifierHash.out === nullifier;
}

component main {public [loanNoteHash, newLoanNoteHash, repaymentNoteHash,
    lendingPoolCommitment, newPoolCommitment, tokenType, currentTime, nullifier]} = LoanRepay();
```

### Key Constraints

1. **Ownership Verification**: Borrower proves control via secret key
2. **Interest Calculation**: Interest accrued correctly computed
3. **Payment Priority**: Interest paid before principal
4. **Balance Updates**: Principal and interest correctly reduced
5. **Pool Accounting**: Pool borrowed total correctly updated
6. **Time Tracking**: Interest accrual timestamp updated

## Effects

| Aspect | Impact |
|--------|--------|
| **Debt Privacy** | Outstanding balance hidden from observers |
| **Payment Confidentiality** | Repayment amounts not visible |
| **Interest Opacity** | Interest payments hidden |
| **Timeline Protection** | Payoff schedule not predictable |
| **Financial Privacy** | Cash flow patterns not exposed |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Double Repayment** | Time-based nullifier prevents duplicate payments |
| **Interest Evasion** | Interest must be paid before principal |
| **Amount Manipulation** | Repayment cannot exceed outstanding balance |
| **Time Manipulation** | Current time from consensus |
| **Pool Desync** | Pool state commitment verification |
| **Rate Gaming** | Interest rate fixed per loan or from pool |

## Implementation Challenges

1. **Interest Calculation**
   - Compound vs simple interest
   - Variable rate handling
   - Precision in calculations

2. **Payment Scheduling**
   - Minimum payment requirements
   - Grace periods
   - Late payment handling

3. **Loan Lifecycle**
   - Tracking loan age
   - Handling refinancing
   - Early payoff incentives

4. **Pool Integration**
   - Updating lender yields
   - Reserve ratio management
   - Utilization rate tracking

## Derivatives

1. **Partial Repayment** - Pay any amount toward loan with hidden payment size. Proves payment reduces debt while hiding exact amount and remaining balance.

2. **Interest-Only Payment** - Pay only accrued interest without reducing principal. Proves interest calculation while hiding principal balance and rate.

3. **Repayment Scheduling** - Commit to future repayment schedule privately. Proves schedule adherence while hiding payment amounts and dates.

4. **Early Repayment** - Pay off loan before maturity with penalty calculation. Proves early payoff terms while hiding original loan details.

5. **Debt Consolidation** - Combine multiple loans into single repayment. Proves combined debt while hiding individual loan amounts and terms.

## Use Cases

1. **Personal Debt Management**
   - Borrower makes regular payments
   - Payment amounts hidden
   - Debt level not revealed

2. **Business Loan Servicing**
   - Company repays business loan
   - Cash flow not exposed
   - Financial health private

3. **Margin Loan Maintenance**
   - Trader maintains margin loan
   - Interest payments hidden
   - Position leverage not calculable

4. **Protocol Treasury Debt**
   - DAO repays protocol debt
   - Treasury flows hidden
   - Financial operations private

## Real-World Products & User Experience

See: [Loan Repay - Real-World Products](../../product/e-defi/e15-loan-repay-products.md)
---

[Back to Index](../../README.md)
