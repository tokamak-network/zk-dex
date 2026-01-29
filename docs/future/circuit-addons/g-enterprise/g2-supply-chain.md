# G2. Supply Chain Transfer

Private verification of goods transfer between supply chain participants while hiding volumes, prices, and business relationships.

**Constraints**: ~180K | **Complexity**: Medium

---

## Background

Supply chain data represents critical competitive intelligence:

- **Volume Confidentiality**: Production quantities reveal market demand and business scale
- **Pricing Secrecy**: Transfer prices expose margins and negotiating positions
- **Relationship Privacy**: Supplier-buyer links are strategic assets; exposure enables competitor poaching
- **Provenance Integrity**: Authentic goods must be verifiable without revealing full chain details

Traditional supply chain systems either lack verification (trust-based) or expose sensitive data (blockchain-based). ZK supply chain transfers enable cryptographic verification of transfers, quality certifications, and provenance without revealing commercially sensitive details.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `transferId` | field | Unique identifier for this transfer |
| `senderCommit` | field | Commitment to sender identity |
| `receiverCommit` | field | Commitment to receiver identity |
| `goodsHash` | field | Hash of goods description/SKU |
| `qualityCertRoot` | field | Merkle root of quality certifications |
| `timestamp` | uint | Transfer timestamp |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `senderPkX, senderPkY` | field | Sender's public key |
| `senderSk` | field | Sender's secret key |
| `receiverPkX, receiverPkY` | field | Receiver's public key |
| `quantity` | uint | Transfer quantity |
| `unitPrice` | uint | Price per unit |
| `goodsDescription` | field[] | Goods identifier/SKU data |
| `certifications` | field[] | Quality certification hashes |
| `certProofs` | field[][] | Merkle proofs for certifications |
| `senderSalt, receiverSalt` | field | Identity commitment randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template SupplyChainTransfer(NUM_CERTS, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input transferId;
    signal input senderCommit;
    signal input receiverCommit;
    signal input goodsHash;
    signal input qualityCertRoot;
    signal input timestamp;

    // ===== Private Inputs =====
    signal input senderPkX, senderPkY;
    signal input senderSk;
    signal input receiverPkX, receiverPkY;
    signal input quantity;
    signal input unitPrice;
    signal input goodsDescription[4];
    signal input certifications[NUM_CERTS];
    signal input certProofs[NUM_CERTS][TREE_DEPTH];
    signal input certProofIndices[NUM_CERTS][TREE_DEPTH];
    signal input senderSalt;
    signal input receiverSalt;

    // ===== 1. Verify Sender Identity Commitment =====
    component senderCommitHash = Poseidon(3);
    senderCommitHash.inputs[0] <== senderPkX;
    senderCommitHash.inputs[1] <== senderPkY;
    senderCommitHash.inputs[2] <== senderSalt;
    senderCommitHash.out === senderCommit;

    // ===== 2. Verify Sender Ownership =====
    component senderOwnership = ProofOfOwnershipStrict();
    senderOwnership.sk <== senderSk;
    senderOwnership.pkX <== senderPkX;
    senderOwnership.pkY <== senderPkY;

    // ===== 3. Verify Receiver Identity Commitment =====
    component receiverCommitHash = Poseidon(3);
    receiverCommitHash.inputs[0] <== receiverPkX;
    receiverCommitHash.inputs[1] <== receiverPkY;
    receiverCommitHash.inputs[2] <== receiverSalt;
    receiverCommitHash.out === receiverCommit;

    // ===== 4. Verify Goods Description Hash =====
    component goodsHasher = Poseidon(4);
    for (var i = 0; i < 4; i++) {
        goodsHasher.inputs[i] <== goodsDescription[i];
    }
    goodsHasher.out === goodsHash;

    // ===== 5. Verify Quantity and Price Are Valid =====
    component quantityCheck = GreaterThan(64);
    quantityCheck.in[0] <== quantity;
    quantityCheck.in[1] <== 0;
    quantityCheck.out === 1;

    component priceCheck = GreaterThan(64);
    priceCheck.in[0] <== unitPrice;
    priceCheck.in[1] <== 0;
    priceCheck.out === 1;

    // ===== 6. Verify Quality Certifications =====
    component certMerkle[NUM_CERTS];
    for (var i = 0; i < NUM_CERTS; i++) {
        certMerkle[i] = MerkleProof(TREE_DEPTH);
        certMerkle[i].leaf <== certifications[i];
        certMerkle[i].root <== qualityCertRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            certMerkle[i].siblings[j] <== certProofs[i][j];
            certMerkle[i].pathIndices[j] <== certProofIndices[i][j];
        }
    }

    // ===== 7. Create Transfer Record Commitment =====
    signal output transferRecord;
    component transferHash = Poseidon(6);
    transferHash.inputs[0] <== transferId;
    transferHash.inputs[1] <== senderCommit;
    transferHash.inputs[2] <== receiverCommit;
    transferHash.inputs[3] <== goodsHash;
    transferHash.inputs[4] <== quantity;
    transferHash.inputs[5] <== timestamp;
    transferRecord <== transferHash.out;
}

component main {public [transferId, senderCommit, receiverCommit, goodsHash, qualityCertRoot, timestamp]} =
    SupplyChainTransfer(5, 8);
```

### Key Constraints

1. **Sender Authorization**: Only sender with valid secret key can initiate transfer
2. **Identity Binding**: Public commitments bind to actual identities without revealing them
3. **Goods Integrity**: Goods hash matches private description data
4. **Certification Validity**: All referenced certifications exist in valid certification tree
5. **Positive Values**: Quantity and price must be greater than zero

## Effects

| Aspect | Impact |
|--------|--------|
| **Competitive Protection** | Volumes and prices hidden from competitors |
| **Relationship Privacy** | Supplier-buyer links concealed from market |
| **Provenance Verification** | Goods authenticity verifiable without full chain exposure |
| **Regulatory Compliance** | Selective disclosure possible for auditors |
| **Counterfeit Prevention** | Cryptographic proof of authorized transfers |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Fake Certification** | Certifications must exist in oracle-managed Merkle tree |
| **Transfer Replay** | Unique transferId prevents duplicate transfer claims |
| **Sender Impersonation** | Proof of ownership verifies sender authorization |
| **Collusion** | Multi-party verification for high-value transfers |
| **Data Correlation** | Different salts per transfer prevent linkability |
| **Timestamp Manipulation** | Use block timestamp or trusted timestamping service |

## Implementation Challenges

1. **Certification Oracle Management**
   - Who maintains the certification Merkle tree?
   - How are new certifications added and old ones revoked?
   - Cross-border certification recognition

2. **Identity System Integration**
   - Mapping real-world business identities to ZK commitments
   - Key recovery and rotation for long-lived business relationships
   - Onboarding process for new supply chain participants

3. **Goods Tracking Continuity**
   - Linking multiple transfers to track goods through chain
   - Handling goods transformation (raw materials to products)
   - Batch splitting and combining

4. **Dispute Resolution**
   - How to prove transfer occurred if receiver disputes
   - Selective disclosure for arbitration
   - Evidence preservation requirements

## Derivatives

1. **Multi-Party Supply Chain** - Extends to handle multi-hop transfers through intermediaries. Single proof verifies entire chain from origin to destination, proving each handoff was authorized without revealing intermediate parties.

2. **Quality Verification** - Integrates IoT sensor data for real-time quality attestation. Circuit verifies sensor readings fall within acceptable ranges and sensor identity is authorized, enabling automated quality gates.

3. **Origin Tracking** - Proves goods originate from certified sources (e.g., conflict-free minerals, sustainable farms). Recursive proofs compress full provenance history into single verification.

4. **Customs Integration** - Generates customs-compatible proofs showing goods classification and origin for duty calculation. Reveals only information required by customs authority while hiding commercial terms.

5. **IoT Attestation** - Links physical goods to digital records via IoT device signatures. Circuit verifies device attestation, tamper-evident seal status, and GPS coordinates match expected route.

## Use Cases

1. **Pharmaceutical Supply Chain**
   - Drug manufacturer ships to distributor
   - Proof verifies: authorized manufacturer, valid batch, temperature compliance
   - Hidden: exact quantity, pricing, specific facility identity
   - Enables recall capability without exposing normal operations

2. **Luxury Goods Authentication**
   - High-end brand transfers goods to authorized retailer
   - Proof verifies: genuine product, authorized channel, certification validity
   - Consumers can verify authenticity without seller revealing supplier
   - Prevents gray market diversion detection

3. **Agricultural Commodities**
   - Farm sells grain to processor
   - Proof verifies: organic certification, origin region, grade
   - Hidden: exact farm, volume, price per bushel
   - Enables premium verification without competitive intelligence leak

4. **Electronics Component Supply**
   - Semiconductor supplier ships chips to manufacturer
   - Proof verifies: authorized source, not counterfeit, meets specifications
   - Hidden: volume (reveals production plans), pricing (reveals margins)
   - Critical for defense and aerospace supply chains

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/g-enterprise/g2-supply-chain-products.md) for detailed product descriptions and user experience scenarios.

---

[Back to Index](../../README.md)
