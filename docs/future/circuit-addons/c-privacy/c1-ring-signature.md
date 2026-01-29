# C1. Ring Signature Spend

Hide real spender among decoy notes, providing transaction-graph unlinkability with key image double-spend prevention.

**Constraints**: ~600K (8 ring size) | **Complexity**: High

---

## Background

Ring signatures address fundamental privacy limitations in blockchain transactions:

- **Transaction Graph Analysis**: Even with ZK proofs, consistent sender patterns reveal identity over time
- **Address Clustering**: On-chain analysts can link transactions through common inputs/outputs
- **Monero Precedent**: Ring signatures proven effective in production privacy systems since 2014
- **Key Image Innovation**: Prevents double-spending without revealing which note was actually spent
- **Anonymity Set Scaling**: Larger rings provide exponentially better privacy guarantees

In traditional ZK systems, the spender is deterministic from the proof. Ring signatures introduce plausible deniability by proving ownership of one-of-many notes without revealing which one. The key image mechanism ensures each note can only be spent once across all possible ring configurations.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `merkleRoot` | field | Root of the note commitment tree |
| `decoyHashes[RING_SIZE]` | field[] | Ring of candidate note hashes |
| `outputHash` | field | Hash of the output note |
| `tokenType` | uint | Token type being spent |
| `keyImage` | field | Unique image preventing double-spend |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `realIndex` | uint | Index of the real note in the ring (hidden) |
| `pkX[RING_SIZE], pkY[RING_SIZE]` | field[] | Public keys for all ring members |
| `value[RING_SIZE]` | uint[] | Values for all ring members |
| `salt[RING_SIZE]` | field[] | Salts for all ring members |
| `sk` | field | Secret key for the real note only |
| `merklePath[RING_SIZE][TREE_DEPTH]` | field[][] | Merkle proofs for each ring member |
| `merkleIndex[RING_SIZE]` | uint[] | Merkle tree positions |
| `outPkX, outPkY` | field | Output note owner public key |
| `outValue` | uint | Output note value |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/baby_jub_jub.circom";
include "../utils/babyjubjub/scalar_mul.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";
include "../utils/mux1.circom";

template ComputeKeyImage() {
    signal input sk;
    signal input pkX, pkY;
    signal output outX, outY;

    // Hash public key to curve point
    component hashToCurve = HashToCurve();
    hashToCurve.inX <== pkX;
    hashToCurve.inY <== pkY;

    // Key image = sk * H(pk)
    component scalarMul = BabyJubJubScalarMul();
    scalarMul.scalar <== sk;
    scalarMul.pointX <== hashToCurve.outX;
    scalarMul.pointY <== hashToCurve.outY;

    outX <== scalarMul.outX;
    outY <== scalarMul.outY;
}

template RingSpend(RING_SIZE, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input merkleRoot;
    signal input decoyHashes[RING_SIZE];
    signal input outputHash;
    signal input tokenType;
    signal input keyImageX, keyImageY;

    // ===== Private Inputs =====
    signal input realIndex;
    signal input pkX[RING_SIZE], pkY[RING_SIZE];
    signal input value[RING_SIZE], salt[RING_SIZE];
    signal input sk;
    signal input merklePath[RING_SIZE][TREE_DEPTH];
    signal input merkleIndex[RING_SIZE];
    signal input outPkX, outPkY, outValue, outSalt;

    // ===== 1. Verify All Notes Exist in Tree =====
    component note[RING_SIZE];
    component merkle[RING_SIZE];

    for (var i = 0; i < RING_SIZE; i++) {
        note[i] = PoseidonRegularNote();
        note[i].pkX <== pkX[i];
        note[i].pkY <== pkY[i];
        note[i].value <== value[i];
        note[i].tokenType <== tokenType;
        note[i].salt <== salt[i];
        note[i].out === decoyHashes[i];

        merkle[i] = MerkleProof(TREE_DEPTH);
        merkle[i].leaf <== decoyHashes[i];
        merkle[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkle[i].path[j] <== merklePath[i][j];
        }
        merkle[i].index <== merkleIndex[i];
    }

    // ===== 2. Verify realIndex is Valid =====
    component indexCheck = LessThan(8);
    indexCheck.in[0] <== realIndex;
    indexCheck.in[1] <== RING_SIZE;
    indexCheck.out === 1;

    // ===== 3. Compute Real Public Key from Secret Key =====
    component realPk = BabyJubJubScalarMulBase();
    realPk.scalar <== sk;

    // ===== 4. Verify sk Matches pk at realIndex =====
    component isReal[RING_SIZE];
    component eqCheck[RING_SIZE];
    signal matchX[RING_SIZE], matchY[RING_SIZE];

    for (var i = 0; i < RING_SIZE; i++) {
        isReal[i] = IsEqual();
        isReal[i].in[0] <== i;
        isReal[i].in[1] <== realIndex;

        matchX[i] <== (realPk.outX - pkX[i]) * isReal[i].out;
        matchY[i] <== (realPk.outY - pkY[i]) * isReal[i].out;
        matchX[i] === 0;
        matchY[i] === 0;
    }

    // ===== 5. Select Real Note Value Using Multiplexer =====
    component valueMux = MultiMux1(RING_SIZE);
    for (var i = 0; i < RING_SIZE; i++) {
        valueMux.c[i] <== value[i];
    }
    valueMux.s <== realIndex;
    signal realValue <== valueMux.out;

    // ===== 6. Compute and Verify Key Image =====
    component pkMuxX = MultiMux1(RING_SIZE);
    component pkMuxY = MultiMux1(RING_SIZE);
    for (var i = 0; i < RING_SIZE; i++) {
        pkMuxX.c[i] <== pkX[i];
        pkMuxY.c[i] <== pkY[i];
    }
    pkMuxX.s <== realIndex;
    pkMuxY.s <== realIndex;

    component keyImg = ComputeKeyImage();
    keyImg.sk <== sk;
    keyImg.pkX <== pkMuxX.out;
    keyImg.pkY <== pkMuxY.out;
    keyImg.outX === keyImageX;
    keyImg.outY === keyImageY;

    // ===== 7. Create Output Note with Real Value =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== realValue;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;

    // ===== 8. Verify Value Conservation =====
    outValue === realValue;
}

component main {public [merkleRoot, decoyHashes, outputHash, tokenType, keyImageX, keyImageY]} =
    RingSpend(8, 20);
```

### Key Constraints

1. **Ring Membership**: All decoy notes must exist in the Merkle tree
2. **Ownership Proof**: Secret key must derive to one public key in the ring
3. **Key Image Uniqueness**: Key image deterministically derived from sk and pk
4. **Value Conservation**: Output value equals the real input value
5. **Index Hiding**: realIndex never revealed; only used in conditional logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Anonymity Set** | Spender hidden among RING_SIZE candidates |
| **Double-Spend Prevention** | Key image tracking on-chain prevents reuse |
| **Transaction Graph** | Complete unlinkability of sender |
| **Proof Size** | Larger proof (~2KB vs 1KB for standard) |
| **Verification Cost** | ~400K gas (scales with ring size) |
| **Decoy Selection** | Critical for effective anonymity |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Decoy Selection Attack** | Use deterministic, uniform decoy selection algorithm |
| **Key Image Collision** | Hash function collision resistance (Poseidon) |
| **Timing Analysis** | Randomize proof generation time |
| **Ring Reuse Patterns** | Avoid using same decoys repeatedly |
| **Small Anonymity Set** | Enforce minimum ring size (e.g., 8) |
| **Sybil Decoys** | Ensure decoys are from diverse time periods |
| **Statistical Analysis** | Decoys should match real note characteristics |

## Implementation Challenges

1. **Decoy Selection Algorithm**
   - Must be deterministic for verification but appear random
   - Should select from recent, active notes to avoid obvious decoys
   - Consider age-weighted selection to prevent timing attacks

2. **Key Image Storage**
   - Requires on-chain mapping of all spent key images
   - Storage grows linearly with transactions
   - Consider Merkle tree for efficient membership checks

3. **Ring Size Trade-offs**
   - Larger rings: better privacy, higher costs
   - Smaller rings: cheaper, reduced anonymity
   - Dynamic sizing based on pool activity

4. **Decoy Note Data Availability**
   - Prover needs full note data for all ring members
   - Consider encrypted note registry or view key system
   - May require additional infrastructure

5. **Cross-Token Rings**
   - Current design requires same token type
   - Multi-token rings would increase complexity
   - Token type matching reduces available decoys

## Derivatives

1. **Linkable Ring Signatures** - Allow same user to prove multiple ring spends are from same identity without revealing identity. Useful for reputation systems where consistency matters but anonymity is preserved. Adds linkability tag derivable only by the real signer.

2. **Multi-Layered Rings** - Nested ring signatures where each ring member is itself a ring, providing exponential anonymity growth. A 4x4 multi-layer ring provides 16 possible spenders while only requiring 8 note verifications.

3. **Dynamic Ring Selection** - Automatic decoy selection based on on-chain analysis of note characteristics (value, age, activity patterns). Ensures statistical indistinguishability and prevents obvious decoy detection.

4. **Threshold Ring Signatures** - Require k-of-n ring members to collaborate for spending, enabling multi-sig functionality while preserving ring anonymity. Useful for shared custody with hidden participant identities.

5. **Cross-Pool Ring Signatures** - Combine notes from different privacy pools or even different chains into a single ring. Dramatically increases anonymity set by drawing from larger candidate pool.

## Use Cases

1. **Whale Transaction Privacy**
   - Large holder wants to transfer without market impact
   - Ring signature hides which large balance is moving
   - Prevents front-running and market manipulation

2. **Salary Payment Privacy**
   - Employer pays multiple employees from same wallet
   - Ring signatures hide which payment belongs to which employee
   - Prevents salary disclosure through chain analysis

3. **DAO Treasury Operations**
   - DAO moves funds without revealing voting patterns
   - Contributors maintain privacy about their holdings
   - Prevents targeted attacks on large stakeholders

4. **Whistleblower Protection**
   - Journalist receives payment for sensitive information
   - Ring signature hides the actual payment among decoys
   - Source protection through cryptographic anonymity

## Real-World Products & User Experience

See [Ring Signature Spend - Products & UX](../../../product/c-privacy/c1-ring-signature-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
