# Credit Score Range - Real-World Products

[Technical Specification](../../circuit-addons/g-enterprise/g7-credit.md)

---

## Real-World Products & User Experience

### 1. "Hidden Exact Score Loans" - Credit Score Unknown Even to Financial Institutions

**Product Description**:
When exact credit score is known, financial institutions offer interest rates precisely matched to that score (no negotiation room), or score leaks create fraud targets. ZK proves only "above 700 points" condition met while actual score (e.g., 823 points) absolutely unknown to financial institutions.

**User Experience**:
- Without Privacy: Exact credit score 823 points known to Bank A, bank calculates "5.2% interest rate for 823 points" and offers with no negotiation room
- With ZK Solution: Submit only "credit score above 750 points" proof, bank doesn't know whether 750 or 850
- Result: Precise pricing based on actual score impossible, consumer maintains negotiating power

**Observable Benefits**:
- Prevents price discrimination based on precise credit scores
- Mitigates financial institution's information advantage
- Prevents fraud targeting from credit score leaks

### 2. "Private Credit History Employment" - Hide Financial Status from Employer

**Product Description**:
Credit checks are mandatory for financial sector employment, but exact credit history (past delinquencies, loan balances, etc.) known to employer raises discrimination concerns. ZK proves only "credit grade good, no current delinquencies" conditions while keeping detailed history private.

**User Experience**:
- Without Privacy: Applicant with temporary delinquency history from 5 years ago, despite excellent abilities, rejected after seeing credit history
- With ZK Solution: Submit only "current credit grade 2, no delinquencies in recent 2 years" proof
- Result: Prevents employment discrimination from past temporary difficulties

**Observable Benefits**:
- Prevents employment discrimination from past financial difficulties
- Provides only necessary information to employer
- Balances personal financial privacy with employment opportunities

### 3. "No Score Reduction Loan Shopping Service" - Loan Shopping Without Credit Inquiry Impact

**Product Description**:
Inquiring about loans at multiple financial institutions means each credit check → many inquiries lower score. ZK submits proof generated once to multiple financial institutions, verifying conditions without actual credit checks.

**User Experience**:
- Without Privacy: Inquiring about loan terms at 5 banks → 5 credit checks → score drops 20 points
- With ZK Solution: Generate "credit grade 1" proof once and submit to 10 financial institutions, actual check only at final chosen 1
- Result: Compare loan conditions freely without credit score impact

**Observable Benefits**:
- Prevents score reduction from credit inquiries
- Guarantees consumer freedom to compare financial products
- Prevents "desperate for loan" stigma from inquiry record exposure

---

[Back to Enterprise Solutions](../../circuit-addons/g-enterprise/)
