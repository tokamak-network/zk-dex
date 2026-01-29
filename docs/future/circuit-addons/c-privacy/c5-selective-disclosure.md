# C5. Selective Disclosure

Reveal specific note attributes (token type, ownership status) while keeping others private (value, identity).

**Constraints**: ~150K | **Complexity**: Low

---

## Background

Selective disclosure enables granular privacy control for compliance and verification:

- **Minimal Disclosure Principle**: Reveal only information necessary for the specific context
- **Attribute Independence**: Different attributes can be disclosed to different parties
- **Verifiable Claims**: Disclosed attributes are cryptographically proven, not just claimed
- **Privacy Preservation**: Non-disclosed attributes remain computationally hidden
- **Regulatory Compatibility**: Enables compliance without full transparency

In many scenarios, full transparency is unnecessary and harmful. A landlord needs to verify income range, not exact amount. A compliance officer needs to verify token type, not owner identity. Selective disclosure provides cryptographic proofs of specific attributes while hiding everything else.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the note being disclosed about |
| `merkleRoot` | field | Root of the note commitment tree |
| `disclosureFlags` | uint | Bitmap of which attributes to reveal |
| `disclosedTokenType` | uint | Token type (if flag set, else 0) |
| `disclosedValueMin` | uint | Minimum value (if range flag set) |
| `disclosedValueMax` | uint | Maximum value (if range flag set) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key |
| `value` | uint | Note value |
| `tokenType` | uint | Actual token type |
| `salt` | field | Note randomness |
| `sk` | field | Secret key for ownership proof |
| `merklePath[TREE_DEPTH]` | field[] | Merkle proof path |
| `merkleIndex` | uint | Position in Merkle tree |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";
include "../utils/bitify.circom";

template SelectiveDisclosure(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input merkleRoot;
    signal input disclosureFlags;    // Bit 0: tokenType, Bit 1: valueRange, Bit 2: ownership
    signal input disclosedTokenType;
    signal input disclosedValueMin;
    signal input disclosedValueMax;

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input value;
    signal input tokenType;
    signal input salt;
    signal input sk;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Parse Disclosure Flags =====
    component flagBits = Num2Bits(8);
    flagBits.in <== disclosureFlags;
    signal discloseTokType <== flagBits.out[0];
    signal discloseRange <== flagBits.out[1];
    signal discloseOwnership <== flagBits.out[2];

    // ===== 2. Verify Note Format =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== value;
    note.tokenType <== tokenType;
    note.salt <== salt;
    note.out === noteHash;

    // ===== 3. Verify Ownership (always required) =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 4. Verify Merkle Inclusion =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 5. Conditional Token Type Disclosure =====
    // If discloseTokType = 1, tokenType must equal disclosedTokenType
    // If discloseTokType = 0, no constraint (disclosedTokenType should be 0)
    signal tokenTypeMatch;
    tokenTypeMatch <== (tokenType - disclosedTokenType) * discloseTokType;
    tokenTypeMatch === 0;

    // ===== 6. Conditional Value Range Disclosure =====
    // If discloseRange = 1, value must be in [disclosedValueMin, disclosedValueMax]
    component minCheck = LessEqThan(64);
    minCheck.in[0] <== disclosedValueMin;
    minCheck.in[1] <== value;

    component maxCheck = LessEqThan(64);
    maxCheck.in[0] <== value;
    maxCheck.in[1] <== disclosedValueMax;

    // Only enforce if discloseRange = 1
    signal rangeValid;
    rangeValid <== minCheck.out * maxCheck.out;

    signal rangeConstraint;
    rangeConstraint <== (1 - rangeValid) * discloseRange;
    rangeConstraint === 0;

    // ===== 7. Ownership Disclosure (optional public key reveal) =====
    // If discloseOwnership = 1, public key could be made public
    // This is handled by including pkX, pkY in public inputs conditionally
    // For circuit simplicity, we just verify ownership was proven
}

component main {public [noteHash, merkleRoot, disclosureFlags, disclosedTokenType, disclosedValueMin, disclosedValueMax]} =
    SelectiveDisclosure(20);
```

### Key Constraints

1. **Note Authenticity**: Note must exist in the commitment tree
2. **Ownership Required**: Prover must own the note to disclose its attributes
3. **Conditional Constraints**: Disclosure flags enable/disable specific proofs
4. **Token Type Match**: If disclosed, actual type must match claimed type
5. **Value Range**: If disclosed, value must fall within specified range

## Effects

| Aspect | Impact |
|--------|--------|
| **Privacy Granularity** | Attribute-level disclosure control |
| **Compliance Enabling** | Prove requirements without over-disclosure |
| **Verifiability** | Disclosed attributes cryptographically verified |
| **Composability** | Multiple disclosures can be combined |
| **Auditability** | Proofs can be saved for audit trails |
| **User Control** | Owner decides what to reveal |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Over-Disclosure** | Careful flag selection; educate users |
| **Replay Attacks** | Include timestamp or nonce in proof request |
| **Correlation Attacks** | Avoid repeated disclosures of same note |
| **Verifier Collusion** | Different disclosures to different verifiers |
| **Range Inference** | Use wide ranges; avoid tight bounds |
| **Note Identification** | noteHash reveals existence; consider hiding |
| **Proof Freshness** | Verifiers should check merkleRoot recency |

## Implementation Challenges

1. **Disclosure Request Protocol**
   - Standard format for requesting specific disclosures
   - Prevent verifiers from requesting unnecessary data
   - Consider privacy-preserving request mechanism

2. **Proof Aggregation**
   - Multiple disclosures about same note
   - Batch proofs for efficiency
   - Avoid linking through repeated proofs

3. **Revocation and Updates**
   - Note state may change after disclosure
   - Consider time-bounded disclosures
   - Merkle root freshness requirements

4. **User Interface**
   - Clear display of what will be revealed
   - Confirmation before disclosure
   - Log of past disclosures for user

5. **Verifier Integration**
   - Standard verification API
   - Disclosure credential formats
   - Integration with existing identity systems

## Derivatives

1. **Threshold Disclosure** - Prove value exceeds or falls below threshold without revealing exact amount. Useful for access control (minimum balance gates) or compliance (under reporting threshold). More private than range disclosure.

2. **Attribute Certification** - Third-party attestations that can be selectively disclosed. KYC provider certifies identity attributes; user discloses specific attributes to different verifiers. Decentralized identity integration.

3. **Range Proofs with Partial Disclosure** - Prove value in range while revealing approximate magnitude (e.g., "between $10K-$100K"). Useful for creditworthiness without exact income. Bucketed range proofs.

4. **Multi-Attribute Selective Reveal** - Disclose combinations of attributes with logical constraints. "Token is ETH AND value > 1000" in single proof. Reduces number of proofs needed for complex verification.

5. **Time-Bounded Disclosures** - Proofs that expire after specified time. Prevents indefinite reuse of old proofs. Requires timestamp in circuit and on-chain time verification.

## Use Cases

1. **Rental Application**
   - Landlord requires income verification
   - Tenant proves income in range $5K-$10K/month
   - Exact income, employer, other holdings hidden
   - Landlord gets assurance without privacy invasion

2. **Token-Gated Access**
   - NFT community requires ownership proof
   - User proves they own token of correct type
   - Token ID, other holdings remain private
   - Enables sybil-resistant access control

3. **Tax Compliance**
   - Tax authority requires holdings report
   - User proves total value in tax bracket
   - Individual positions remain private
   - Reduces audit surface while meeting requirements

4. **Credit Assessment**
   - Lender needs creditworthiness verification
   - Borrower proves sufficient collateral value
   - Exact portfolio composition hidden
   - Enables undercollateralized lending with privacy

## Real-World Products & User Experience

See [Selective Disclosure - Products & UX](../../product/c-privacy/c5-selective-disclosure-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
