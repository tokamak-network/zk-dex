# G3. Invoice Factoring

Private invoice factoring enabling businesses to prove receivables value and authenticity without exposing customer identities or exact amounts.

**Constraints**: ~200K | **Complexity**: Medium

---

## Background

Invoice factoring is essential for business cash flow but exposes sensitive information:

- **Customer Confidentiality**: Revealing customer names exposes business relationships and can lead to poaching
- **Amount Privacy**: Invoice values reveal pricing strategies and customer importance
- **Financial Position**: Factoring patterns indicate cash flow status to competitors
- **Fraud Prevention**: Factors need assurance invoices are genuine without accessing full records

Traditional factoring requires full disclosure of invoices. Blockchain-based factoring exposes everything publicly. ZK invoice factoring allows businesses to prove they have legitimate receivables meeting certain criteria without revealing customer details or exact amounts.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `invoiceCommitment` | field | Commitment to invoice details |
| `minValue` | uint | Minimum invoice value being claimed |
| `maxAge` | uint | Maximum days since invoice date |
| `sellerCommit` | field | Commitment to seller identity |
| `factorCommit` | field | Commitment to factor identity |
| `discountRate` | uint | Agreed discount rate (basis points) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX, sellerPkY` | field | Seller's public key |
| `sellerSk` | field | Seller's secret key |
| `customerPkX, customerPkY` | field | Customer's public key (invoice debtor) |
| `invoiceAmount` | uint | Actual invoice amount |
| `invoiceDate` | uint | Invoice issuance timestamp |
| `dueDate` | uint | Payment due date |
| `invoiceId` | field | Unique invoice identifier |
| `customerSignature` | field[] | Customer's signature on invoice |
| `sellerSalt, factorSalt` | field | Identity commitment randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/babyjubjub/signature_verify.circom";
include "../utils/comparators.circom";

template InvoiceFactoring() {
    // ===== Public Inputs =====
    signal input invoiceCommitment;
    signal input minValue;
    signal input maxAge;
    signal input sellerCommit;
    signal input factorCommit;
    signal input discountRate;
    signal input currentTimestamp;

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY;
    signal input sellerSk;
    signal input customerPkX, customerPkY;
    signal input invoiceAmount;
    signal input invoiceDate;
    signal input dueDate;
    signal input invoiceId;
    signal input customerSigR8x, customerSigR8y, customerSigS;
    signal input sellerSalt;
    signal input factorPkX, factorPkY;
    signal input factorSalt;

    // ===== 1. Verify Seller Identity =====
    component sellerCommitHash = Poseidon(3);
    sellerCommitHash.inputs[0] <== sellerPkX;
    sellerCommitHash.inputs[1] <== sellerPkY;
    sellerCommitHash.inputs[2] <== sellerSalt;
    sellerCommitHash.out === sellerCommit;

    // ===== 2. Verify Seller Ownership =====
    component sellerOwnership = ProofOfOwnershipStrict();
    sellerOwnership.sk <== sellerSk;
    sellerOwnership.pkX <== sellerPkX;
    sellerOwnership.pkY <== sellerPkY;

    // ===== 3. Verify Factor Identity =====
    component factorCommitHash = Poseidon(3);
    factorCommitHash.inputs[0] <== factorPkX;
    factorCommitHash.inputs[1] <== factorPkY;
    factorCommitHash.inputs[2] <== factorSalt;
    factorCommitHash.out === factorCommit;

    // ===== 4. Create Invoice Commitment =====
    component invoiceHash = Poseidon(6);
    invoiceHash.inputs[0] <== sellerPkX;
    invoiceHash.inputs[1] <== customerPkX;
    invoiceHash.inputs[2] <== invoiceAmount;
    invoiceHash.inputs[3] <== invoiceDate;
    invoiceHash.inputs[4] <== dueDate;
    invoiceHash.inputs[5] <== invoiceId;
    invoiceHash.out === invoiceCommitment;

    // ===== 5. Verify Invoice Amount >= minValue =====
    component valueCheck = GreaterEqThan(64);
    valueCheck.in[0] <== invoiceAmount;
    valueCheck.in[1] <== minValue;
    valueCheck.out === 1;

    // ===== 6. Verify Invoice Age =====
    signal invoiceAge;
    invoiceAge <== currentTimestamp - invoiceDate;

    // Convert maxAge from days to seconds (86400 seconds per day)
    signal maxAgeSeconds;
    maxAgeSeconds <== maxAge * 86400;

    component ageCheck = LessEqThan(64);
    ageCheck.in[0] <== invoiceAge;
    ageCheck.in[1] <== maxAgeSeconds;
    ageCheck.out === 1;

    // ===== 7. Verify Invoice Not Past Due =====
    component dueDateCheck = GreaterThan(64);
    dueDateCheck.in[0] <== dueDate;
    dueDateCheck.in[1] <== currentTimestamp;
    dueDateCheck.out === 1;

    // ===== 8. Verify Customer Signature on Invoice =====
    component invoiceDataHash = Poseidon(5);
    invoiceDataHash.inputs[0] <== sellerPkX;
    invoiceDataHash.inputs[1] <== invoiceAmount;
    invoiceDataHash.inputs[2] <== invoiceDate;
    invoiceDataHash.inputs[3] <== dueDate;
    invoiceDataHash.inputs[4] <== invoiceId;

    component sigVerify = EdDSAVerify();
    sigVerify.msg <== invoiceDataHash.out;
    sigVerify.pubKeyX <== customerPkX;
    sigVerify.pubKeyY <== customerPkY;
    sigVerify.R8x <== customerSigR8x;
    sigVerify.R8y <== customerSigR8y;
    sigVerify.S <== customerSigS;

    // ===== 9. Calculate Factoring Proceeds =====
    signal output factoringProceeds;
    // proceeds = invoiceAmount * (10000 - discountRate) / 10000
    signal discountedAmount;
    discountedAmount <== invoiceAmount * (10000 - discountRate);
    factoringProceeds <-- discountedAmount / 10000;

    // Verify division is correct
    signal verifyProceeds;
    verifyProceeds <== factoringProceeds * 10000;
    component proceedsCheck = LessEqThan(128);
    proceedsCheck.in[0] <== verifyProceeds;
    proceedsCheck.in[1] <== discountedAmount;
    proceedsCheck.out === 1;
}

component main {public [invoiceCommitment, minValue, maxAge, sellerCommit, factorCommit, discountRate, currentTimestamp]} =
    InvoiceFactoring();
```

### Key Constraints

1. **Seller Authorization**: Only invoice owner can initiate factoring
2. **Customer Signature**: Invoice must be signed by customer (debtor)
3. **Value Threshold**: Invoice amount meets minimum requirement
4. **Freshness**: Invoice is not too old and not past due
5. **Identity Binding**: All parties committed without revealing identities

## Effects

| Aspect | Impact |
|--------|--------|
| **Customer Privacy** | Debtor identity completely hidden from public |
| **Amount Confidentiality** | Only minimum value threshold disclosed |
| **Business Relationships** | Customer lists remain private |
| **Fraud Prevention** | Customer signature proves invoice authenticity |
| **Liquidity Access** | Smaller businesses can factor without reputation risk |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Fake Invoice** | Customer signature required; forging requires customer's secret key |
| **Double Factoring** | Invoice commitment used as nullifier; each invoice factored once |
| **Stale Invoice** | Age check ensures recent invoices only |
| **Past Due Invoice** | Due date validation prevents factoring defaulted invoices |
| **Customer Collusion** | Factors can require additional verification for large invoices |
| **Amount Inflation** | Signed invoice locks amount; cannot be modified |

## Implementation Challenges

1. **Customer Signature Collection**
   - Invoices must be digitally signed by customers
   - Requires customer onboarding to ZK system
   - Fallback for customers not using digital signatures

2. **Invoice Uniqueness**
   - Preventing same invoice from being factored multiple times
   - Global registry of factored invoice commitments
   - Cross-factor coordination to prevent fraud

3. **Dispute Handling**
   - What happens if customer disputes invoice validity?
   - Selective disclosure for arbitration
   - Escrow mechanisms for disputed invoices

4. **Integration with Accounting**
   - Synchronization with traditional accounting systems
   - Audit trail maintenance
   - Tax reporting requirements

## Derivatives

1. **Batch Factoring** - Multiple invoices factored in single transaction. Circuit aggregates proofs for N invoices, dramatically reducing gas costs for businesses with many small invoices while hiding the portfolio composition.

2. **Recourse Factoring** - Factor has recourse to seller if customer defaults. Additional circuit components handle credit event verification and seller repayment obligations with time-locked collateral.

3. **Reverse Factoring** - Large buyer initiates factoring for supplier invoices. Buyer's creditworthiness reduces discount rate; circuit proves buyer approval without revealing buyer identity or full supply chain.

4. **Dynamic Discounting** - Discount rate varies based on payment timing. Circuit enables early payment at higher discount, with rate schedule committed in advance and payment date verification.

5. **Cross-Border Factoring** - Handles multi-currency invoices with exchange rate verification. Includes proof of compliance with international factoring rules and currency conversion at oracle-verified rates.

## Use Cases

1. **SMB Cash Flow Management**
   - Small manufacturer has $500K in outstanding invoices
   - Factors invoices to meet payroll without revealing customer names
   - Competitor cannot see who manufacturer's customers are
   - Factor verifies invoice legitimacy via customer signatures

2. **Supply Chain Finance**
   - Large retailer approves supplier invoices for early payment
   - Suppliers get liquidity; retailer's approval reduces discount rate
   - Hidden: specific supplier identities, individual invoice amounts
   - Revealed: aggregate approved volume, retailer commitment

3. **Healthcare Receivables**
   - Medical practice factors insurance receivables
   - Patient privacy maintained even from factor
   - Proves insurance company acknowledgment without patient details
   - Enables healthcare providers to access working capital

4. **Construction Progress Billing**
   - Contractor factors progress billing from project owner
   - Owner's signature proves work acceptance
   - Project details and specific amounts remain confidential
   - Enables contractors to manage cash flow across projects

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../../product/g-enterprise/g3-invoice-products.md) for detailed product descriptions and user experience scenarios.

---

[Back to Index](../../README.md)
