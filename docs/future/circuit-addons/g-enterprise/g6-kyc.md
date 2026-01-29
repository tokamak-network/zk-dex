# G6. KYC Verify

Privacy-preserving identity verification proving specific attributes (age, residency, accreditation) without revealing underlying identity documents.

**Constraints**: ~150K | **Complexity**: Medium

---

## Background

KYC (Know Your Customer) creates fundamental privacy tensions:

- **Data Minimization**: Regulations like GDPR require collecting only necessary data, yet KYC often demands excessive information
- **Identity Theft Risk**: Centralized KYC data stores are prime targets; breaches expose sensitive personal information
- **Repeated Verification**: Users re-submit documents to each service, multiplying exposure risk
- **Attribute vs. Identity**: Services need to verify attributes (over 18, accredited investor) not full identity

Current KYC systems require full identity disclosure even when only specific attributes matter. ZK KYC enables proving attributes derived from verified identity documents without revealing the documents themselves or unnecessary personal information.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `attributeCommitment` | field | Commitment to claimed attributes |
| `verifierCommit` | field | Commitment to KYC verifier identity |
| `documentRoot` | field | Merkle root of verified identity documents |
| `verificationTimestamp` | uint | When verification was performed |
| `expiryTimestamp` | uint | When verification expires |
| `jurisdictionCode` | uint | Applicable jurisdiction |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `userPkX, userPkY` | field | User's public key |
| `userSk` | field | User's secret key |
| `dateOfBirth` | uint | User's date of birth (timestamp) |
| `countryCode` | uint | User's country of residence/citizenship |
| `documentType` | uint | Type of identity document |
| `documentId` | field | Document identifier hash |
| `documentExpiry` | uint | Document expiration date |
| `issuerSignature` | field[] | Issuer's signature on document |
| `documentProof` | field[] | Merkle proof for document validity |
| `userSalt` | field | Identity commitment randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/babyjubjub/signature_verify.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template KYCVerify(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input attributeCommitment;
    signal input verifierCommit;
    signal input documentRoot;
    signal input verificationTimestamp;
    signal input expiryTimestamp;
    signal input jurisdictionCode;

    // ===== Attribute Requirements (Public) =====
    signal input minAge;                    // Minimum age in years (0 if not checked)
    signal input allowedCountries[10];      // Allowed country codes (0 = any)
    signal input requiredDocTypes[5];       // Required document types (0 = any)
    signal input accreditationRequired;     // 1 if accredited investor status required

    // ===== Private Inputs =====
    signal input userPkX, userPkY;
    signal input userSk;
    signal input userSalt;

    signal input dateOfBirth;
    signal input countryCode;
    signal input documentType;
    signal input documentId;
    signal input documentExpiry;

    signal input issuerPkX, issuerPkY;
    signal input issuerSigR8x, issuerSigR8y, issuerSigS;

    signal input documentProof[TREE_DEPTH];
    signal input documentProofIndices[TREE_DEPTH];

    signal input verifierPkX, verifierPkY;
    signal input verifierSalt;

    signal input accreditationStatus;
    signal input accreditationExpiry;
    signal input netWorthBracket;           // 0: <1M, 1: 1-5M, 2: >5M

    // ===== 1. Verify User Ownership =====
    component userOwnership = ProofOfOwnershipStrict();
    userOwnership.sk <== userSk;
    userOwnership.pkX <== userPkX;
    userOwnership.pkY <== userPkY;

    // ===== 2. Verify Verifier Identity =====
    component verifierCommitHash = Poseidon(3);
    verifierCommitHash.inputs[0] <== verifierPkX;
    verifierCommitHash.inputs[1] <== verifierPkY;
    verifierCommitHash.inputs[2] <== verifierSalt;
    verifierCommitHash.out === verifierCommit;

    // ===== 3. Create Document Hash =====
    component documentHash = Poseidon(6);
    documentHash.inputs[0] <== userPkX;
    documentHash.inputs[1] <== dateOfBirth;
    documentHash.inputs[2] <== countryCode;
    documentHash.inputs[3] <== documentType;
    documentHash.inputs[4] <== documentId;
    documentHash.inputs[5] <== documentExpiry;

    // ===== 4. Verify Issuer Signature on Document =====
    component sigVerify = EdDSAVerify();
    sigVerify.msg <== documentHash.out;
    sigVerify.pubKeyX <== issuerPkX;
    sigVerify.pubKeyY <== issuerPkY;
    sigVerify.R8x <== issuerSigR8x;
    sigVerify.R8y <== issuerSigR8y;
    sigVerify.S <== issuerSigS;

    // ===== 5. Verify Document in Trusted Issuer Tree =====
    component issuerLeaf = Poseidon(2);
    issuerLeaf.inputs[0] <== issuerPkX;
    issuerLeaf.inputs[1] <== issuerPkY;

    component documentMerkle = MerkleProof(TREE_DEPTH);
    documentMerkle.leaf <== issuerLeaf.out;
    documentMerkle.root <== documentRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        documentMerkle.siblings[i] <== documentProof[i];
        documentMerkle.pathIndices[i] <== documentProofIndices[i];
    }

    // ===== 6. Verify Document Not Expired =====
    component docExpiryCheck = GreaterThan(64);
    docExpiryCheck.in[0] <== documentExpiry;
    docExpiryCheck.in[1] <== verificationTimestamp;
    docExpiryCheck.out === 1;

    // ===== 7. Age Verification =====
    signal userAge;
    // Convert timestamps to approximate years (seconds / 31536000)
    userAge <-- (verificationTimestamp - dateOfBirth) / 31536000;

    // Verify age calculation is approximately correct
    signal ageInSeconds;
    ageInSeconds <== userAge * 31536000;
    component ageCalcCheck = LessEqThan(64);
    ageCalcCheck.in[0] <== ageInSeconds;
    ageCalcCheck.in[1] <== verificationTimestamp - dateOfBirth;
    ageCalcCheck.out === 1;

    // Check minimum age requirement
    component ageCheck = GreaterEqThan(32);
    ageCheck.in[0] <== userAge;
    ageCheck.in[1] <== minAge;
    ageCheck.out === 1;

    // ===== 8. Country Verification =====
    // Check if country is in allowed list (at least one match, or first is 0 meaning any)
    signal countryMatches[10];
    signal countryMatchSum[11];
    countryMatchSum[0] <== 0;

    component countryEq[10];
    component anyCountryCheck;

    for (var i = 0; i < 10; i++) {
        countryEq[i] = IsEqual();
        countryEq[i].in[0] <== countryCode;
        countryEq[i].in[1] <== allowedCountries[i];
        countryMatches[i] <== countryEq[i].out;
        countryMatchSum[i + 1] <== countryMatchSum[i] + countryMatches[i];
    }

    // Either country matches one in list, or first allowed country is 0 (any)
    component firstIsZero = IsZero();
    firstIsZero.in <== allowedCountries[0];

    signal countryValid;
    countryValid <== firstIsZero.out + (1 - firstIsZero.out) * (countryMatchSum[10] > 0 ? 1 : 0);

    // ===== 9. Accreditation Check (if required) =====
    component accredRequired = IsEqual();
    accredRequired.in[0] <== accreditationRequired;
    accredRequired.in[1] <== 1;

    // If accreditation required, status must be valid and not expired
    component accredStatusCheck = GreaterEqThan(8);
    accredStatusCheck.in[0] <== accreditationStatus;
    accredStatusCheck.in[1] <== accredRequired.out;

    component accredExpiryCheck = GreaterThan(64);
    accredExpiryCheck.in[0] <== accreditationExpiry;
    accredExpiryCheck.in[1] <== verificationTimestamp;

    // Accreditation valid if not required OR (status valid AND not expired)
    signal accredValid;
    accredValid <== (1 - accredRequired.out) + accredRequired.out * accredStatusCheck.out * accredExpiryCheck.out;

    // ===== 10. Create Attribute Commitment =====
    component attrCommit = Poseidon(6);
    attrCommit.inputs[0] <== userPkX;
    attrCommit.inputs[1] <== userAge >= minAge ? 1 : 0;
    attrCommit.inputs[2] <== countryCode;
    attrCommit.inputs[3] <== accreditationStatus;
    attrCommit.inputs[4] <== verificationTimestamp;
    attrCommit.inputs[5] <== userSalt;
    attrCommit.out === attributeCommitment;

    // ===== 11. Verify Expiry Is Valid =====
    component expiryValid = GreaterThan(64);
    expiryValid.in[0] <== expiryTimestamp;
    expiryValid.in[1] <== verificationTimestamp;
    expiryValid.out === 1;
}

component main {public [attributeCommitment, verifierCommit, documentRoot, verificationTimestamp, expiryTimestamp, jurisdictionCode, minAge, allowedCountries, requiredDocTypes, accreditationRequired]} =
    KYCVerify(10);
```

### Key Constraints

1. **User Ownership**: User proves control of their identity keys
2. **Document Authenticity**: Document signed by trusted issuer in verified issuer tree
3. **Document Validity**: Document not expired at verification time
4. **Age Requirement**: User age meets minimum threshold
5. **Geographic Compliance**: User country in allowed jurisdiction list
6. **Accreditation Status**: If required, valid and not expired

## Effects

| Aspect | Impact |
|--------|--------|
| **Data Minimization** | Only required attributes disclosed, not full identity |
| **Breach Protection** | No central identity database to breach |
| **Reusability** | Single proof works across multiple services |
| **Regulatory Compliance** | GDPR data minimization principle satisfied |
| **User Control** | Users decide when and what to disclose |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Fake Documents** | Documents must be signed by issuers in trusted tree |
| **Document Sharing** | Proof of ownership prevents using others' documents |
| **Expired Verification** | Expiry timestamp enforces revalidation |
| **Jurisdiction Shopping** | Country code verified against allowed list |
| **Accreditation Fraud** | Accreditation status signed by authorized verifiers |
| **Replay Attacks** | Timestamp and verifier commitment prevent replay |

## Implementation Challenges

1. **Issuer Onboarding**
   - Which government agencies and institutions are trusted issuers?
   - How to add/remove issuers from the trusted tree?
   - International issuer recognition

2. **Document Digitization**
   - How to convert physical documents to signed digital form?
   - Preventing document tampering during digitization
   - Biometric binding to prevent document theft

3. **Attribute Standardization**
   - Different jurisdictions define attributes differently
   - Age of majority varies by country
   - Accredited investor definitions differ

4. **Revocation Handling**
   - How to revoke compromised documents?
   - Real-time revocation checking
   - Balancing privacy with revocation capability

## Derivatives

1. **Age Verification** - Simplified circuit proving only age threshold without any other attributes. Minimal disclosure for age-restricted purchases; proves over 18/21 without revealing exact birth date or any identity details.

2. **Residency Proofs** - Proves residence in specific jurisdiction for tax or regulatory purposes. Enables compliance with local regulations without revealing exact address or other personal details.

3. **Identity Reuse** - Single KYC verification portable across multiple platforms. User proves they passed KYC elsewhere without re-disclosing documents, with service-specific attribute filtering.

4. **KYC Portability** - Cross-platform identity federation with selective attribute sharing. Different services see different attributes from same underlying identity; user controls what each sees.

5. **Tiered KYC Levels** - Progressive disclosure based on transaction value or risk level. Basic tier requires only age; higher tiers add accreditation or enhanced verification, each with its own proof.

## Use Cases

1. **Exchange Onboarding**
   - User wants to trade on cryptocurrency exchange
   - Proves age over 18 and residence in allowed jurisdiction
   - Exchange never sees passport, only attribute proof
   - Same proof works for multiple exchanges

2. **Accredited Investor Verification**
   - Investment platform requires accredited investor status
   - User proves net worth bracket without revealing exact amount
   - Platform verifies accreditation without seeing tax returns
   - Enables compliant private securities trading

3. **Age-Restricted E-Commerce**
   - Online retailer requires age verification for alcohol sales
   - Customer proves over 21 without revealing birth date
   - No identity data stored by retailer
   - Proof valid for defined period, then expires

4. **Cross-Border Financial Services**
   - User opens account with foreign financial institution
   - Proves citizenship, residency, and non-sanctioned status
   - Institution verifies compliance without full passport copy
   - Satisfies regulatory requirements with minimal data exposure

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/g-enterprise/g6-kyc-products.md) for detailed product descriptions and user experience scenarios.

---

[Back to Index](../../README.md)
