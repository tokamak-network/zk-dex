# B2. Multi-Signature Notes

M-of-N threshold spending requiring multiple signers to authorize transactions, enabling shared custody without revealing signer identities.

**Constraints**: ~300K (5 signers) | **Complexity**: Medium

---

## Background

Multi-signature schemes are critical for secure fund management:

- **Single Point of Failure**: Single-key control means one compromised key loses all funds
- **Organizational Requirements**: Corporate treasuries, DAOs, and partnerships need multiple approvers
- **Privacy Leak in Current Solutions**: Gnosis Safe and similar multisigs expose all signer addresses publicly
- **Flexible Thresholds**: Different scenarios require different M-of-N configurations (2-of-3, 3-of-5, etc.)

Traditional multisig solutions like Gnosis Safe are powerful but fully transparent. Every signer address is public, enabling social engineering attacks and revealing organizational structure. ZK multisig notes hide both the number of signers and their identities while still requiring threshold approval.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the multisig note |
| `outputHash` | field | Hash of the output note after spending |
| `threshold` | uint | Minimum number of signatures required |
| `tokenType` | uint | Token type identifier |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX[N]`, `pkY[N]` | field[] | Array of signer public keys |
| `value` | uint | Note value (hidden) |
| `salt` | field | Note randomness |
| `sk[N]` | field[] | Secret keys (only signing parties provide valid keys) |
| `isSigning[N]` | binary[] | Bitmap indicating which parties are signing |
| `outPkX, outPkY` | field | Output note owner public key |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/scalar_mul_base.circom";
include "../utils/comparators.circom";

template MultiSigSpend(N_SIGNERS) {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input threshold;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input pkX[N_SIGNERS], pkY[N_SIGNERS];
    signal input value, salt;
    signal input sk[N_SIGNERS];
    signal input isSigning[N_SIGNERS];  // 0 or 1 for each signer
    signal input outPkX, outPkY, outSalt;

    // ===== 1. Verify Multisig Note Hash =====
    // Note format includes all signer public keys plus metadata
    component note = Poseidon(N_SIGNERS * 2 + 4);
    for (var i = 0; i < N_SIGNERS; i++) {
        note.inputs[i * 2] <== pkX[i];
        note.inputs[i * 2 + 1] <== pkY[i];
    }
    note.inputs[N_SIGNERS * 2] <== value;
    note.inputs[N_SIGNERS * 2 + 1] <== tokenType;
    note.inputs[N_SIGNERS * 2 + 2] <== salt;
    note.inputs[N_SIGNERS * 2 + 3] <== threshold;
    note.out === noteHash;

    // ===== 2. Count Valid Signatures =====
    signal sigCount[N_SIGNERS + 1];
    sigCount[0] <== 0;

    component own[N_SIGNERS];
    for (var i = 0; i < N_SIGNERS; i++) {
        // Ensure isSigning is binary (0 or 1)
        isSigning[i] * (1 - isSigning[i]) === 0;

        // Derive public key from secret key
        own[i] = BabyJubJubScalarMulBase();
        own[i].scalar <== sk[i];

        // If signing, verify sk derives to pk
        // Conditional check: (derived - expected) * isSigning == 0
        (own[i].outX - pkX[i]) * isSigning[i] === 0;
        (own[i].outY - pkY[i]) * isSigning[i] === 0;

        // Accumulate signature count
        sigCount[i + 1] <== sigCount[i] + isSigning[i];
    }

    // ===== 3. Threshold Check =====
    component thresholdCheck = GreaterEqThan(8);
    thresholdCheck.in[0] <== sigCount[N_SIGNERS];
    thresholdCheck.in[1] <== threshold;
    thresholdCheck.out === 1;

    // ===== 4. Verify Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [noteHash, outputHash, threshold, tokenType]} =
    MultiSigSpend(5);
```

### Key Constraints

1. **Note Format Verification**: All signer public keys committed in note hash
2. **Binary Signing Flags**: Each `isSigning[i]` must be exactly 0 or 1
3. **Signature Verification**: If `isSigning[i] == 1`, the provided `sk[i]` must derive to `pk[i]`
4. **Threshold Satisfaction**: Total valid signatures must meet or exceed threshold
5. **Value Preservation**: Output note contains same value as input note

## Effects

| Aspect | Impact |
|--------|--------|
| **Security** | No single key compromise can drain funds |
| **Privacy** | Signer identities and number of signers remain hidden |
| **Flexibility** | Configurable M-of-N thresholds for different security needs |
| **Trust Distribution** | Control distributed across multiple parties |
| **Organizational Privacy** | Corporate structure not revealed on-chain |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Key Collusion** | Set appropriate threshold based on trust assumptions |
| **Social Engineering** | Hidden signer identities prevent targeted attacks |
| **Lost Keys** | Ensure threshold < total signers for redundancy |
| **Malicious Signers** | Cannot spend alone if threshold > 1 |
| **Replay Attacks** | Nullifier from note hash prevents double-spending |
| **Dummy Key Attack** | All keys must be valid BabyJubjub points on note creation |

## Implementation Challenges

1. **Coordination Protocol**
   - Signers need secure channel to share partial signatures
   - Consider threshold signature schemes (TSS) for non-interactive signing
   - Off-chain coordination required before on-chain submission

2. **Circuit Size Scaling**
   - Constraints grow linearly with N_SIGNERS
   - ~50K constraints per additional signer
   - Consider hierarchical multisig for large groups

3. **Key Management**
   - Each signer must securely store their key
   - Key rotation requires creating new multisig note
   - No on-chain recovery mechanism

4. **Proof Generation Distribution**
   - Who generates the final proof?
   - Need to share witness data securely
   - Consider MPC-based proof generation

## Derivatives

1. **Hierarchical Multi-Sig** - Two-tier signing structure where department heads approve, then executives provide final approval. Enables enterprise governance with organizational hierarchy reflected in signing requirements without revealing structure.

2. **Weighted Voting Notes** - Each signer has different voting power (e.g., CEO has 3 votes, managers have 1 vote each). Threshold is weighted sum rather than simple count. Circuit includes weight array in note hash and accumulates weighted votes.

3. **Time-Delayed Multi-Sig** - After threshold signatures collected, transaction enters time delay before execution. Remaining signers can cancel during delay. Provides security buffer for high-value transactions with time to detect compromise.

4. **Role-Based Access Notes** - Different roles can perform different actions on the same note. Spending requires admin keys; viewing balance only requires auditor key. Single note with multiple access tiers defined by different key sets.

5. **Social Recovery Notes** - Designate trusted guardians who can collectively recover funds if primary keys are lost. Guardians cannot spend normally but can transfer to recovery address. 3-of-5 guardian threshold for recovery only.

## Use Cases

1. **Corporate Treasury**
   - Company holds $10M in tokens
   - 3-of-5 multisig with CFO, CEO, and 3 board members
   - Any transaction requires 3 approvals
   - Privacy: Competitors cannot identify treasury holdings or signers

2. **DAO Governance**
   - DAO funds controlled by elected council
   - 4-of-7 threshold ensures majority consensus
   - Council member changes require migration to new multisig
   - Privacy: Council member identities protected from external pressure

3. **Family Trust**
   - Parents set up trust for children
   - 2-of-3 with both parents and attorney as signers
   - Major distributions require parental approval
   - Privacy: Family financial arrangements remain confidential

4. **Business Partnership**
   - Two partners share control of business funds
   - 2-of-2 for major expenses, 1-of-2 for daily operations
   - Either partner can handle routine costs
   - Privacy: Business financials not exposed to competitors

## Real-World Products & User Experience

See [Multi-Signature Notes - Products & User Experience](../../product/b-time-conditions/b2-multisig-products.md) for detailed product scenarios and user stories.

---

[Back to Index](../../README.md)
