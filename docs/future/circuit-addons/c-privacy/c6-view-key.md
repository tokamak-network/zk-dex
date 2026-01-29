# C6. View Key Delegation

Grant read-only access to note information without spending authority, enabling auditing and monitoring.

**Constraints**: ~180K | **Complexity**: Medium

---

## Background

View key delegation separates visibility from control for practical privacy systems:

- **Separation of Concerns**: Accountants need visibility; only owners should spend
- **Audit Requirements**: Businesses must provide financial records to auditors
- **Tax Compliance**: Tax authorities may require transaction visibility
- **Wealth Management**: Advisors monitor portfolios without custody
- **Institutional Requirements**: Fund administrators need oversight capabilities

In traditional finance, read-only access is standard (bank statements, portfolio views). Privacy systems need equivalent functionality. View key delegation creates cryptographic delegation where delegates can prove they have viewing rights and access note details without gaining spending capability.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `delegationHash` | field | Hash of the delegation authorization |
| `noteHash` | field | Hash of the note being viewed |
| `merkleRoot` | field | Root of the note commitment tree |
| `currentTime` | uint | Current timestamp for expiry check |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | Note owner's public key |
| `delegatePkX, delegatePkY` | field | Delegate's public key |
| `delegateSk` | field | Delegate's secret key (proves delegate identity) |
| `scope` | field | Delegation scope (0 = all, or specific noteHash) |
| `expiry` | uint | Delegation expiration timestamp |
| `delegationSalt` | field | Randomness for delegation hash |
| `noteValue` | uint | Note value (revealed to delegate) |
| `noteTokenType` | uint | Note token type |
| `noteSalt` | field | Note randomness |
| `merklePath[TREE_DEPTH]` | field[] | Merkle proof path |
| `merkleIndex` | uint | Position in Merkle tree |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template VerifyViewAccess(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input delegationHash;
    signal input noteHash;
    signal input merkleRoot;
    signal input currentTime;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY;
    signal input delegatePkX, delegatePkY;
    signal input delegateSk;
    signal input scope;
    signal input expiry;
    signal input delegationSalt;
    signal input noteValue, noteTokenType, noteSalt;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Delegation Hash =====
    // delegation = H(ownerPk, delegatePk, scope, expiry, salt)
    component delegation = Poseidon(7);
    delegation.inputs[0] <== ownerPkX;
    delegation.inputs[1] <== ownerPkY;
    delegation.inputs[2] <== delegatePkX;
    delegation.inputs[3] <== delegatePkY;
    delegation.inputs[4] <== scope;
    delegation.inputs[5] <== expiry;
    delegation.inputs[6] <== delegationSalt;
    delegation.out === delegationHash;

    // ===== 2. Verify Delegate Identity =====
    component delegateOwn = ProofOfOwnershipStrict();
    delegateOwn.sk <== delegateSk;
    delegateOwn.pkX <== delegatePkX;
    delegateOwn.pkY <== delegatePkY;

    // ===== 3. Verify Note Belongs to Owner =====
    component note = PoseidonRegularNote();
    note.pkX <== ownerPkX;
    note.pkY <== ownerPkY;
    note.value <== noteValue;
    note.tokenType <== noteTokenType;
    note.salt <== noteSalt;
    note.out === noteHash;

    // ===== 4. Verify Merkle Inclusion =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 5. Verify Scope =====
    // scope = 0 means all notes; otherwise scope must equal noteHash
    component scopeCheck = IsZero();
    scopeCheck.in <== scope;

    signal scopeMatch;
    scopeMatch <== (scope - noteHash) * (1 - scopeCheck.out);
    scopeMatch === 0;

    // ===== 6. Verify Not Expired =====
    component expiryCheck = LessThan(64);
    expiryCheck.in[0] <== currentTime;
    expiryCheck.in[1] <== expiry;
    expiryCheck.out === 1;

    // ===== Output: Note details are now proven accessible =====
    // The delegate can include noteValue, noteTokenType in their report
    // These are private inputs but the proof attests to their correctness
}

component main {public [delegationHash, noteHash, merkleRoot, currentTime]} =
    VerifyViewAccess(20);
```

### Key Constraints

1. **Delegation Authenticity**: Delegation hash matches claimed parameters
2. **Delegate Identity**: Prover controls the delegate key
3. **Note Ownership**: Note belongs to the delegating owner
4. **Scope Compliance**: Note within delegation scope (all or specific)
5. **Time Validity**: Current time before expiration

## Effects

| Aspect | Impact |
|--------|--------|
| **Access Control** | Read-only access without spending |
| **Scope Flexibility** | All notes or specific subset |
| **Time Limitation** | Automatic expiration of access |
| **Revocability** | Owner can revoke by not renewing |
| **Auditability** | Delegations can be logged |
| **Privacy Preservation** | Only delegated info revealed |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Delegation Forgery** | Owner signature on delegation (off-chain) |
| **Scope Creep** | Explicit scope in delegation hash |
| **Expired Delegation Use** | On-chain time verification |
| **Delegate Key Compromise** | Short expiry periods; rotation |
| **Owner Impersonation** | Verify delegation source off-chain |
| **Unauthorized Note Access** | Scope limits which notes visible |
| **Delegation Revocation** | Maintain revocation registry |

## Implementation Challenges

1. **Delegation Creation**
   - Owner must sign delegation off-chain
   - Delegation hash published or shared privately
   - Consider delegation registry contract

2. **Revocation Mechanism**
   - Delegations valid until expiry by default
   - Early revocation requires on-chain registry
   - Gas cost for revocation checks

3. **Hierarchical Delegation**
   - Can delegate re-delegate?
   - Depth limits prevent abuse
   - Clear authorization chains

4. **Scope Specification**
   - Single note vs. all notes vs. time range
   - Token type filters
   - Value range filters

5. **Proof Generation for Delegates**
   - Delegate needs note data to generate proofs
   - Owner must share encrypted note data
   - Consider note registry with encrypted data

## Derivatives

1. **Hierarchical View Keys** - Multi-level delegation where delegates can sub-delegate with reduced scope. CEO delegates to CFO (all finance), CFO delegates to accountant (specific accounts). Organizational hierarchy mapping.

2. **Scoped View Access** - Fine-grained scope definitions beyond single note. Token type filters, time range filters, value range filters. Auditor sees only transactions above threshold.

3. **Auditor-Specific Keys** - Regulatory auditors receive special keys with compliance-specific access. Can verify AML compliance without full transaction details. Satisfies regulatory requirements minimally.

4. **Time-Expiring View Delegations** - Automatic expiration with optional renewal. Quarterly auditor access, annual tax preparer access. Reduces long-term exposure from delegation.

5. **Multi-Party View Sharing** - Threshold schemes requiring multiple delegates to collaborate for access. Board members jointly access treasury view. Prevents single-party surveillance.

## Use Cases

1. **Tax Preparation**
   - User delegates view access to tax preparer for calendar year
   - Tax preparer generates reports of holdings and transactions
   - Preparer cannot spend or transfer funds
   - Delegation expires after tax filing deadline

2. **Fund Administration**
   - Hedge fund delegates view to administrator
   - Administrator monitors positions and generates NAV reports
   - No custody or trading capability
   - Satisfies regulatory oversight requirements

3. **Estate Planning**
   - Individual delegates view to estate lawyer
   - Lawyer can verify assets for estate planning
   - Actual control remains with individual
   - Delegation transfers on death (separate mechanism)

4. **Wealth Management**
   - Client delegates view to financial advisor
   - Advisor monitors portfolio and recommends changes
   - Client executes all transactions
   - Maintains privacy from advisor's other clients

## Real-World Products & User Experience

See [View Key Delegation - Products & UX](../../product/c-privacy/c6-view-key-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
