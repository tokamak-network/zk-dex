# C2. Privacy Pool Deposit

Deposit funds into a mixing pool with fixed denominations, creating unlinkable commitments for later withdrawal.

**Constraints**: ~120K | **Complexity**: Low

---

## Background

Mixing pools provide fundamental transaction graph privacy through fund pooling:

- **Transaction Graph Breaking**: Deposits become indistinguishable from other same-denomination deposits
- **Tornado Cash Precedent**: Proved mixing pools effective for privacy at scale (before sanctions)
- **Fixed Denominations**: Standard amounts (0.1, 1, 10, 100 ETH) maximize anonymity set size
- **Commitment Scheme**: Hash-based commitments enable withdrawal without revealing deposit
- **Time Delay Benefits**: Longer wait times between deposit and withdrawal increase privacy

In standard blockchain transactions, sender and receiver are directly linked. Privacy pools break this linkage by pooling identical deposits, making it impossible to determine which depositor corresponds to which withdrawal. The commitment scheme ensures only the original depositor can withdraw.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the note being deposited |
| `commitment` | field | Pool commitment for withdrawal |
| `denomination` | uint | Fixed pool size (e.g., 1 ETH) |
| `tokenType` | uint | Token type being deposited |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key |
| `salt` | field | Note randomness |
| `sk` | field | Secret key for ownership proof |
| `secret` | field | Random secret for withdrawal proof |
| `nullifierSeed` | field | Seed for deriving nullifier on withdrawal |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

template PoolDeposit() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input commitment;
    signal input denomination;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input salt;
    signal input sk;
    signal input secret;
    signal input nullifierSeed;

    // ===== 1. Verify Note Format and Value =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== denomination;
    note.tokenType <== tokenType;
    note.salt <== salt;
    note.out === noteHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 3. Create Pool Commitment =====
    // commitment = H(noteHash, secret, nullifierSeed)
    component comm = Poseidon(3);
    comm.inputs[0] <== noteHash;
    comm.inputs[1] <== secret;
    comm.inputs[2] <== nullifierSeed;
    comm.out === commitment;

    // ===== 4. Verify Denomination is Valid =====
    // Note: In practice, contract enforces valid denominations
    // Circuit ensures note value matches declared denomination
    signal denominationCheck;
    denominationCheck <== denomination * denomination;
    // Dummy constraint to ensure denomination is used
}

component main {public [noteHash, commitment, denomination, tokenType]} =
    PoolDeposit();
```

### Key Constraints

1. **Note Validity**: Input note must be properly formatted with correct value
2. **Ownership Proof**: Only note owner can deposit to pool
3. **Commitment Binding**: Commitment cryptographically binds note, secret, and nullifier seed
4. **Denomination Match**: Note value must exactly match pool denomination
5. **Unique Commitment**: Random secret ensures commitment uniqueness

## Effects

| Aspect | Impact |
|--------|--------|
| **Anonymity Set** | All deposits of same denomination are indistinguishable |
| **Transaction Graph** | Complete break between deposit and withdrawal |
| **Liquidity** | Fixed denominations may require multiple deposits |
| **Time Privacy** | Longer delays increase anonymity |
| **Pool Size** | Larger pools provide stronger privacy guarantees |
| **Regulatory Risk** | Mixing pools face legal scrutiny in some jurisdictions |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Commitment Replay** | Include noteHash in commitment to bind to specific deposit |
| **Secret Entropy** | Use cryptographically secure random number generator |
| **Timing Analysis** | Encourage minimum wait time before withdrawal |
| **Deposit Pattern Analysis** | Use consistent deposit amounts and timing |
| **Front-Running** | Commitment revealed only after note nullified |
| **Pool Poisoning** | Verify deposits come from legitimate notes |
| **Correlation Attack** | Avoid depositing and withdrawing same amounts simultaneously |

## Implementation Challenges

1. **Denomination Selection**
   - Too few: insufficient liquidity per pool
   - Too many: fragmented anonymity sets
   - Standard set: 0.1, 1, 10, 100 ETH equivalent

2. **Pool Management**
   - On-chain Merkle tree of commitments
   - Efficient insertion (~50K gas per deposit)
   - Tree depth limits total capacity

3. **Multi-Token Support**
   - Separate pools per token type
   - Stablecoin pools may have different denominations
   - Cross-token deposits require swap integration

4. **Compliance Hooks**
   - Optional proof-of-innocence for regulatory compliance
   - Association sets to prove funds not from illicit sources
   - Balance between privacy and legal requirements

5. **User Experience**
   - Must save secret and nullifier seed securely
   - Loss of secrets means permanent fund loss
   - Consider recovery mechanisms (social recovery, hardware backup)

## Derivatives

1. **Association Sets (Proof of Innocence)** - Allow depositors to prove their funds did not originate from known illicit addresses. Creates allowlist of "clean" deposit sources that can be verified without revealing which specific deposit belongs to the user. Enables compliance while preserving privacy.

2. **Arbitrary Amount Pools** - Remove fixed denomination requirement using homomorphic commitments. Depositors can deposit any amount and later withdraw different amounts (with change). More flexible but smaller anonymity sets per amount range.

3. **Cross-Pool Swaps** - Atomic deposits across multiple pools or token types. Deposit ETH to ETH pool while simultaneously depositing USDC to USDC pool. Enables portfolio rebalancing without revealing the connection.

4. **Time-Locked Deposits** - Require minimum lock period before withdrawal is possible. Longer locks provide larger anonymity sets (more deposits accumulate). May offer incentives for longer lock periods.

5. **Relayer-Compatible Deposits** - Include relayer fee commitment in deposit to enable gasless withdrawals. Depositor commits to fee amount; relayer submits withdrawal and claims fee. Preserves privacy by avoiding gas payment from personal wallet.

## Use Cases

1. **Salary Privacy**
   - Employee deposits paycheck into privacy pool
   - Withdraws to personal wallet after delay
   - Employer cannot track spending habits
   - Tax compliance maintained through separate records

2. **Business Transaction Privacy**
   - Company deposits revenue into pool
   - Withdraws to pay suppliers privately
   - Competitors cannot analyze business relationships
   - Prevents supply chain intelligence gathering

3. **Donation Anonymity**
   - Donor deposits funds to pool
   - Withdraws to charity wallet
   - Donation amount and timing obscured
   - Protects donor privacy for sensitive causes

4. **DeFi Entry Privacy**
   - User deposits funds before DeFi activity
   - Withdraws to fresh wallet for yield farming
   - Previous holdings not linked to DeFi positions
   - Prevents targeted liquidation attacks

## Real-World Products & User Experience

See [Privacy Pool Deposit - Products & UX](../../product/c-privacy/c2-pool-deposit-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
