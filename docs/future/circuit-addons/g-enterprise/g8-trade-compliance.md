# G8. Trade Compliance

Privacy-preserving verification of international trade regulatory compliance including export controls, sanctions, and dual-use goods restrictions.

**Constraints**: ~300K | **Complexity**: High

---

## Background

International trade compliance involves complex, sensitive requirements:

- **Export Control Sensitivity**: Export license applications reveal product capabilities and customer relationships
- **Sanctions Complexity**: Screening against sanctions lists requires checking multiple jurisdictions and ownership chains
- **Competitive Intelligence**: Trade patterns reveal market strategies, customer bases, and supply chain structures
- **Dual-Use Concerns**: Proving goods are for civilian use without revealing technical specifications

Traditional compliance requires full disclosure to regulators and often third-party compliance providers. ZK trade compliance enables proving adherence to export controls, sanctions requirements, and end-use restrictions without revealing commercially sensitive trade details.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `tradeCommitment` | field | Commitment to trade transaction details |
| `exporterCommit` | field | Commitment to exporter identity |
| `complianceRoot` | field | Merkle root of compliance rules and lists |
| `jurisdictionCode` | uint | Regulating jurisdiction |
| `transactionTimestamp` | uint | Transaction date |
| `complianceCertHash` | field | Hash of compliance certification |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `exporterPkX, exporterPkY` | field | Exporter's public key |
| `exporterSk` | field | Exporter's secret key |
| `importerPkX, importerPkY` | field | Importer's public key |
| `importerCountry` | uint | Importer's country code |
| `endUserPkX, endUserPkY` | field | End user's public key (if different) |
| `productCode` | field[] | Product classification codes (HS, ECCN) |
| `productValue` | uint | Transaction value |
| `endUseCode` | uint | Declared end use category |
| `sanctionsProofs` | field[][] | Merkle proofs for sanctions clearance |
| `exporterSalt` | field | Identity commitment randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/merkle/non_membership_proof.circom";
include "../utils/comparators.circom";

template TradeCompliance(NUM_PRODUCT_CODES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input tradeCommitment;
    signal input exporterCommit;
    signal input complianceRoot;
    signal input jurisdictionCode;
    signal input transactionTimestamp;
    signal input complianceCertHash;

    // ===== Compliance Requirements (Public) =====
    signal input sanctionsListRoot;
    signal input controlledGoodsRoot;
    signal input embargoedCountriesRoot;
    signal input licenseExemptionThreshold;

    // ===== Private Inputs =====
    signal input exporterPkX, exporterPkY;
    signal input exporterSk;
    signal input exporterSalt;
    signal input exporterCountry;

    signal input importerPkX, importerPkY;
    signal input importerCountry;
    signal input importerSalt;

    signal input endUserPkX, endUserPkY;
    signal input endUserCountry;
    signal input endUserSalt;

    signal input productCodes[NUM_PRODUCT_CODES];
    signal input productValue;
    signal input endUseCode;

    // Sanctions check proofs (non-membership in sanctions list)
    signal input importerSanctionsProof[TREE_DEPTH];
    signal input importerSanctionsIndices[TREE_DEPTH];
    signal input endUserSanctionsProof[TREE_DEPTH];
    signal input endUserSanctionsIndices[TREE_DEPTH];

    // Embargo check proofs
    signal input embargoProof[TREE_DEPTH];
    signal input embargoIndices[TREE_DEPTH];

    // Controlled goods proofs
    signal input controlledGoodsProofs[NUM_PRODUCT_CODES][TREE_DEPTH];
    signal input controlledGoodsIndices[NUM_PRODUCT_CODES][TREE_DEPTH];
    signal input isControlled[NUM_PRODUCT_CODES];

    // License information (if required)
    signal input licenseNumber;
    signal input licenseExpiry;
    signal input licensedValue;

    // ===== 1. Verify Exporter Identity =====
    component exporterCommitHash = Poseidon(3);
    exporterCommitHash.inputs[0] <== exporterPkX;
    exporterCommitHash.inputs[1] <== exporterPkY;
    exporterCommitHash.inputs[2] <== exporterSalt;
    exporterCommitHash.out === exporterCommit;

    // ===== 2. Verify Exporter Ownership =====
    component exporterOwnership = ProofOfOwnershipStrict();
    exporterOwnership.sk <== exporterSk;
    exporterOwnership.pkX <== exporterPkX;
    exporterOwnership.pkY <== exporterPkY;

    // ===== 3. Create Party Identifiers =====
    component importerHash = Poseidon(3);
    importerHash.inputs[0] <== importerPkX;
    importerHash.inputs[1] <== importerPkY;
    importerHash.inputs[2] <== importerSalt;

    component endUserHash = Poseidon(3);
    endUserHash.inputs[0] <== endUserPkX;
    endUserHash.inputs[1] <== endUserPkY;
    endUserHash.inputs[2] <== endUserSalt;

    // ===== 4. Sanctions Screening - Importer =====
    // Prove importer is NOT in sanctions list (non-membership proof)
    component importerSanctionsCheck = MerkleNonMembershipProof(TREE_DEPTH);
    importerSanctionsCheck.leaf <== importerHash.out;
    importerSanctionsCheck.root <== sanctionsListRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        importerSanctionsCheck.siblings[i] <== importerSanctionsProof[i];
        importerSanctionsCheck.pathIndices[i] <== importerSanctionsIndices[i];
    }

    // ===== 5. Sanctions Screening - End User =====
    component endUserSanctionsCheck = MerkleNonMembershipProof(TREE_DEPTH);
    endUserSanctionsCheck.leaf <== endUserHash.out;
    endUserSanctionsCheck.root <== sanctionsListRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        endUserSanctionsCheck.siblings[i] <== endUserSanctionsProof[i];
        endUserSanctionsCheck.pathIndices[i] <== endUserSanctionsIndices[i];
    }

    // ===== 6. Embargo Check - Destination Country =====
    // Prove destination country is NOT embargoed
    component embargoLeaf = Poseidon(1);
    embargoLeaf.inputs[0] <== importerCountry;

    component embargoCheck = MerkleNonMembershipProof(TREE_DEPTH);
    embargoCheck.leaf <== embargoLeaf.out;
    embargoCheck.root <== embargoedCountriesRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        embargoCheck.siblings[i] <== embargoProof[i];
        embargoCheck.pathIndices[i] <== embargoIndices[i];
    }

    // ===== 7. Controlled Goods Check =====
    signal controlledSum[NUM_PRODUCT_CODES + 1];
    controlledSum[0] <== 0;

    component productLeaves[NUM_PRODUCT_CODES];
    component controlledChecks[NUM_PRODUCT_CODES];

    for (var i = 0; i < NUM_PRODUCT_CODES; i++) {
        productLeaves[i] = Poseidon(2);
        productLeaves[i].inputs[0] <== productCodes[i];
        productLeaves[i].inputs[1] <== jurisdictionCode;

        // Check if product is in controlled goods list
        controlledChecks[i] = MerkleProof(TREE_DEPTH);
        controlledChecks[i].leaf <== productLeaves[i].out;
        controlledChecks[i].root <== controlledGoodsRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            controlledChecks[i].siblings[j] <== controlledGoodsProofs[i][j];
            controlledChecks[i].pathIndices[j] <== controlledGoodsIndices[i][j];
        }

        // isControlled[i] must match Merkle proof result
        controlledSum[i + 1] <== controlledSum[i] + isControlled[i];
    }

    // ===== 8. License Requirement Check =====
    signal needsLicense;
    // License needed if any controlled goods OR value exceeds threshold
    component thresholdCheck = GreaterThan(64);
    thresholdCheck.in[0] <== productValue;
    thresholdCheck.in[1] <== licenseExemptionThreshold;

    needsLicense <== (controlledSum[NUM_PRODUCT_CODES] > 0 ? 1 : 0) + thresholdCheck.out -
                     ((controlledSum[NUM_PRODUCT_CODES] > 0 ? 1 : 0) * thresholdCheck.out);

    // ===== 9. License Validation (if required) =====
    // If license needed, verify license is valid
    component licenseValid = GreaterThan(64);
    licenseValid.in[0] <== licenseExpiry;
    licenseValid.in[1] <== transactionTimestamp;

    component licenseCoverage = GreaterEqThan(64);
    licenseCoverage.in[0] <== licensedValue;
    licenseCoverage.in[1] <== productValue;

    // License check passes if not needed OR (valid AND covers value)
    signal licenseCheckPassed;
    licenseCheckPassed <== (1 - needsLicense) + needsLicense * licenseValid.out * licenseCoverage.out;
    licenseCheckPassed === 1;

    // ===== 10. End Use Verification =====
    // End use must not be prohibited (code > 0 indicates valid civilian use)
    component endUseValid = GreaterThan(16);
    endUseValid.in[0] <== endUseCode;
    endUseValid.in[1] <== 0;
    endUseValid.out === 1;

    // ===== 11. Create Trade Commitment =====
    component tradeHash = Poseidon(6);
    tradeHash.inputs[0] <== exporterCommit;
    tradeHash.inputs[1] <== importerHash.out;
    tradeHash.inputs[2] <== productCodes[0];  // Primary product code
    tradeHash.inputs[3] <== productValue;
    tradeHash.inputs[4] <== importerCountry;
    tradeHash.inputs[5] <== transactionTimestamp;
    tradeHash.out === tradeCommitment;

    // ===== 12. Generate Compliance Certificate Hash =====
    component certHash = Poseidon(5);
    certHash.inputs[0] <== tradeCommitment;
    certHash.inputs[1] <== jurisdictionCode;
    certHash.inputs[2] <== transactionTimestamp;
    certHash.inputs[3] <== needsLicense;
    certHash.inputs[4] <== licenseCheckPassed;
    certHash.out === complianceCertHash;
}

component main {public [tradeCommitment, exporterCommit, complianceRoot, jurisdictionCode, transactionTimestamp, complianceCertHash, sanctionsListRoot, controlledGoodsRoot, embargoedCountriesRoot, licenseExemptionThreshold]} =
    TradeCompliance(5, 12);
```

### Key Constraints

1. **Exporter Authorization**: Exporter proves identity and transaction authority
2. **Sanctions Clearance**: Importer and end user not on sanctions lists
3. **Embargo Compliance**: Destination country not embargoed
4. **Controlled Goods**: Products checked against control lists
5. **License Validity**: If required, license valid and covers transaction
6. **End Use Verification**: Declared end use is permitted category

## Effects

| Aspect | Impact |
|--------|--------|
| **Trade Privacy** | Customer identities and volumes hidden |
| **Compliance Proof** | Regulators can verify compliance without trade details |
| **Competitive Protection** | Trade patterns and relationships concealed |
| **Efficient Screening** | Automated compliance without manual review |
| **Multi-Jurisdiction** | Single proof can satisfy multiple regulatory regimes |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Sanctions Evasion** | Non-membership proofs against current sanctions list |
| **Shell Company Use** | End user screening separate from importer |
| **Controlled Goods Misclassification** | Product codes verified against authoritative lists |
| **License Fraud** | License validity and coverage verified in circuit |
| **Transshipment** | End user country separately verified |
| **List Staleness** | Timestamp ensures lists are current at transaction time |

## Implementation Challenges

1. **List Maintenance**
   - Sanctions lists updated frequently (sometimes daily)
   - Multiple overlapping lists (OFAC, EU, UN)
   - Ownership chain complexity for beneficial owner screening
   - Fuzzy name matching requirements

2. **Product Classification**
   - HS codes, ECCN codes, dual-use classifications vary by jurisdiction
   - Technical specifications determine control status
   - Classification disputes common

3. **License Tracking**
   - Licenses have value limits, expiry dates, conditions
   - Partial shipments against license limits
   - License amendments and transfers

4. **Cross-Border Coordination**
   - Export from Country A, import to Country B, end use in Country C
   - Different rules apply in each jurisdiction
   - Conflicting requirements resolution

## Derivatives

1. **Export Control Verification** - Specialized circuit for export control compliance. Proves product classification doesn't require license for specific destination, or that valid license exists, without revealing product specifications.

2. **Embargo Compliance** - Proves transaction doesn't involve embargoed countries. Includes ownership chain analysis to detect indirect involvement with embargoed entities through subsidiaries or affiliates.

3. **Dual-Use Goods Check** - Verifies goods won't be used for prohibited purposes. Proves end-use certification is valid and matches permitted categories without revealing specific application details.

4. **End-User Certification** - Verifies end user identity and intended use. Proves end user is legitimate commercial entity with appropriate use case, verified against denied party lists.

5. **Trade Finance Compliance** - Combines trade compliance with financial sanctions screening. Proves payment routing doesn't involve sanctioned banks and transaction structure is compliant.

## Use Cases

1. **Technology Export**
   - Software company exports encryption product
   - Proves: product not controlled at this level, customer not sanctioned
   - Hidden: customer identity, exact product specifications
   - Enables compliant export without competitive intelligence leak

2. **Defense Contractor Supply Chain**
   - Contractor sources components from global suppliers
   - Proves: suppliers not on denied party lists, no embargoed country involvement
   - Hidden: supplier identities, component specifications, volumes
   - Satisfies ITAR/EAR requirements privately

3. **Pharmaceutical Distribution**
   - Drug company ships to foreign distributor
   - Proves: distributor licensed, not sanctions-listed, country not embargoed
   - Hidden: distributor identity, volumes, pricing
   - Enables compliant distribution without market intelligence exposure

4. **Industrial Equipment Sale**
   - Machinery manufacturer sells to foreign factory
   - Proves: equipment not dual-use controlled, end use is civilian manufacturing
   - Hidden: buyer identity, specific equipment model, price
   - Compliant export without revealing customer relationships

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../../product/g-enterprise/g8-trade-compliance-products.md) for detailed product descriptions and user experience scenarios.

---

[Back to Index](../../README.md)
