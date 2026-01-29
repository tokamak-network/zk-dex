# C4. Stealth Address Receive

Claim payments sent to one-time stealth addresses derived from your meta-address using ECDH key exchange.

**Constraints**: ~250K | **Complexity**: Medium

---

## Background

Stealth addresses solve the address reuse problem in privacy systems:

- **Address Reuse Danger**: Receiving multiple payments to same address enables transaction linking
- **Meta-Address System**: Single published address generates unlimited one-time receiving addresses
- **ECDH Foundation**: Elliptic Curve Diffie-Hellman enables shared secret without interaction
- **EIP-5564 Standard**: Ethereum stealth address proposal provides interoperability framework
- **No Coordination Required**: Sender generates stealth address without contacting recipient

In traditional systems, recipients must generate and share new addresses for each payment, creating friction. Stealth addresses allow senders to derive unique receiving addresses from a single meta-address. Only the recipient can detect and claim these payments by scanning with their view key.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the stealth note being claimed |
| `outputHash` | field | Hash of the output note |
| `ephemeralPkX, ephemeralPkY` | field | Sender's ephemeral public key |
| `tokenType` | uint | Token type being claimed |
| `stealthMetaAddressHash` | field | Hash of recipient's meta-address |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `stealthPkX, stealthPkY` | field | One-time stealth public key |
| `value` | uint | Note value |
| `salt` | field | Note randomness |
| `spendSk` | field | Recipient's spending secret key |
| `viewSk` | field | Recipient's viewing secret key |
| `spendPkX, spendPkY` | field | Recipient's spending public key |
| `viewPkX, viewPkY` | field | Recipient's viewing public key |
| `outPkX, outPkY` | field | Output note owner (can be main wallet) |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/baby_jub_jub.circom";
include "../utils/babyjubjub/scalar_mul.circom";
include "../utils/babyjubjub/point_add.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

template StealthReceive() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input ephemeralPkX, ephemeralPkY;
    signal input tokenType;
    signal input stealthMetaAddressHash;

    // ===== Private Inputs =====
    signal input stealthPkX, stealthPkY;
    signal input value, salt;
    signal input spendSk, viewSk;
    signal input spendPkX, spendPkY;
    signal input viewPkX, viewPkY;
    signal input outPkX, outPkY, outSalt;

    // ===== 1. Verify Stealth Note Format =====
    component note = PoseidonRegularNote();
    note.pkX <== stealthPkX;
    note.pkY <== stealthPkY;
    note.value <== value;
    note.tokenType <== tokenType;
    note.salt <== salt;
    note.out === noteHash;

    // ===== 2. Verify Meta-Address Ownership =====
    // Meta-address = (spendPk, viewPk)
    component metaAddr = Poseidon(4);
    metaAddr.inputs[0] <== spendPkX;
    metaAddr.inputs[1] <== spendPkY;
    metaAddr.inputs[2] <== viewPkX;
    metaAddr.inputs[3] <== viewPkY;
    metaAddr.out === stealthMetaAddressHash;

    // Verify spend key ownership
    component spendOwn = BabyJubJubScalarMulBase();
    spendOwn.scalar <== spendSk;
    spendOwn.outX === spendPkX;
    spendOwn.outY === spendPkY;

    // Verify view key ownership
    component viewOwn = BabyJubJubScalarMulBase();
    viewOwn.scalar <== viewSk;
    viewOwn.outX === viewPkX;
    viewOwn.outY === viewPkY;

    // ===== 3. Compute Shared Secret via ECDH =====
    // sharedSecret = viewSk * ephemeralPk
    component ecdh = BabyJubJubScalarMul();
    ecdh.scalar <== viewSk;
    ecdh.pointX <== ephemeralPkX;
    ecdh.pointY <== ephemeralPkY;

    // Hash shared secret to get scalar
    component sharedHash = Poseidon(2);
    sharedHash.inputs[0] <== ecdh.outX;
    sharedHash.inputs[1] <== ecdh.outY;

    // ===== 4. Derive Expected Stealth Public Key =====
    // stealthPk = spendPk + H(sharedSecret) * G
    component offset = BabyJubJubScalarMulBase();
    offset.scalar <== sharedHash.out;

    component expectedStealth = BabyJubJubPointAdd();
    expectedStealth.x1 <== spendPkX;
    expectedStealth.y1 <== spendPkY;
    expectedStealth.x2 <== offset.outX;
    expectedStealth.y2 <== offset.outY;

    // Verify derived stealth pk matches note's pk
    expectedStealth.outX === stealthPkX;
    expectedStealth.outY === stealthPkY;

    // ===== 5. Derive and Verify Stealth Secret Key =====
    // stealthSk = spendSk + H(sharedSecret)
    signal stealthSk;
    stealthSk <== spendSk + sharedHash.out;

    component stealthOwn = ProofOfOwnershipStrict();
    stealthOwn.sk <== stealthSk;
    stealthOwn.pkX <== stealthPkX;
    stealthOwn.pkY <== stealthPkY;

    // ===== 6. Create Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [noteHash, outputHash, ephemeralPkX, ephemeralPkY, tokenType, stealthMetaAddressHash]} =
    StealthReceive();
```

### Key Constraints

1. **Stealth Note Validity**: Input note correctly formatted with stealth public key
2. **Meta-Address Ownership**: Prover controls both spend and view keys
3. **ECDH Correctness**: Shared secret computed from view key and ephemeral key
4. **Stealth Key Derivation**: Stealth pk = spend pk + H(shared) * G
5. **Spending Authority**: Stealth sk correctly derived and matches stealth pk

## Effects

| Aspect | Impact |
|--------|--------|
| **Recipient Privacy** | Each payment to unique, unlinkable address |
| **Sender Experience** | Same as normal transfer (compute stealth address) |
| **Scanning Requirement** | Recipient must scan chain for payments |
| **Key Management** | Two keys: spend (cold) and view (hot) |
| **Delegation Possible** | View key can be shared for monitoring |
| **Address Reuse** | Eliminated - every payment unique |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **View Key Compromise** | Only reveals payments, not spending authority |
| **Spend Key Compromise** | Full control lost; use cold storage |
| **Ephemeral Key Reuse** | Sender must generate fresh key per payment |
| **Scanning Privacy** | Use local scanning or trusted third party |
| **Timing Attacks** | Randomize scanning intervals |
| **Meta-Address Linkage** | Different meta-addresses for different contexts |
| **Computation Cost** | ECDH is expensive; batch scanning helps |

## Implementation Challenges

1. **Payment Detection**
   - Recipients must scan all stealth payments
   - Compute: try_decrypt(view_key, ephemeral_pk) for each
   - Can be computationally expensive for active chains

2. **Scanning Infrastructure**
   - Need efficient indexing of stealth announcements
   - Consider: dedicated stealth announcement contract
   - View key delegation to scanning services

3. **Ephemeral Key Publishing**
   - Sender must publish ephemeral public key with payment
   - Event emission or dedicated announcement contract
   - Standard format for interoperability (EIP-5564)

4. **Gas for Claiming**
   - Claiming from stealth address requires gas
   - Cannot use stealth address directly (reveals ownership)
   - Solutions: relayers, pre-funded claim wallets

5. **Key Derivation Standards**
   - Must match sender's derivation exactly
   - Interoperability requires strict standards
   - Consider BIP-32 style hierarchical derivation

## Derivatives

1. **Stealth Address Registry** - On-chain registry mapping identities to meta-addresses. ENS integration allows sending to name.eth stealth address. Simplifies discovery while maintaining payment privacy.

2. **Delegated Scanning Service** - Third-party services that scan for stealth payments using delegated view keys. User receives notifications of incoming payments. Trades some privacy for convenience.

3. **View Key Compartmentalization** - Multiple view keys for different contexts (business, personal, investment). Each view key can only detect subset of payments. Enables selective disclosure to accountants or auditors.

4. **Stealth-to-Stealth Transfers** - Chain stealth payments without revealing ownership. Receive to stealth address, immediately send to another stealth address. Maximum unlinkability for sensitive transfers.

5. **Compliance-Compatible Stealth** - Stealth addresses with embedded compliance proofs. Recipient proves AML compliance without revealing identity. Enables institutional adoption of stealth addresses.

## Use Cases

1. **Donation Privacy**
   - Non-profit publishes stealth meta-address
   - Donors send without revealing their identities
   - Non-profit scans for incoming donations
   - Individual donation amounts remain private

2. **Payroll Privacy**
   - Employees register stealth meta-addresses
   - Employer pays to stealth addresses each period
   - Employees cannot see each other's salaries
   - Employer spending not traceable to individuals

3. **E-commerce Privacy**
   - Merchant displays stealth meta-address at checkout
   - Each customer payment goes to unique address
   - Customers cannot be linked across purchases
   - Merchant maintains complete transaction records

4. **Investment Fund Privacy**
   - Fund publishes meta-address for investments
   - LPs contribute to unique stealth addresses
   - Investment amounts not visible to other LPs
   - Fund can aggregate for compliance reporting

## Real-World Products & User Experience

See [Stealth Address Receive - Products & UX](../../../product/c-privacy/c4-stealth-address-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
