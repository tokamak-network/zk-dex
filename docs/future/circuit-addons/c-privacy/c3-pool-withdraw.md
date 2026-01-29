# C3. Privacy Pool Withdraw

Withdraw funds from a mixing pool by proving commitment membership without revealing which deposit was yours.

**Constraints**: ~180K | **Complexity**: Medium

---

## Background

Pool withdrawals complete the privacy loop started by deposits:

- **Unlinkability**: Withdrawal proves membership in deposit set without revealing which deposit
- **Nullifier Mechanism**: Prevents double-withdrawal while hiding the specific commitment used
- **Fresh Address Output**: Funds can be withdrawn to any new address, breaking all prior linkage
- **Merkle Proof Efficiency**: Logarithmic proof size regardless of pool size
- **Relayer Support**: Can be submitted by third party without revealing recipient

The withdrawal circuit is the critical privacy component. It proves knowledge of a valid commitment in the pool tree and generates a nullifier that prevents reuse. The nullifier is deterministic from the commitment but reveals nothing about which commitment was used.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `poolRoot` | field | Merkle root of the commitment pool |
| `nullifierHash` | field | Hash preventing double-withdrawal |
| `outputHash` | field | Hash of the output note |
| `denomination` | uint | Pool denomination being withdrawn |
| `tokenType` | uint | Token type being withdrawn |
| `relayerFee` | uint | Fee for relayer (0 if self-relayed) |
| `relayerAddress` | field | Address to receive fee (0 if none) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Original note hash from deposit |
| `secret` | field | Random secret from deposit |
| `nullifierSeed` | field | Seed used to generate nullifier |
| `merklePath[TREE_DEPTH]` | field[] | Merkle proof path |
| `merkleIndex` | uint | Position in Merkle tree (as bits) |
| `outPkX, outPkY` | field | Output note owner public key |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template PoolWithdraw(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input poolRoot;
    signal input nullifierHash;
    signal input outputHash;
    signal input denomination;
    signal input tokenType;
    signal input relayerFee;
    signal input relayerAddress;

    // ===== Private Inputs =====
    signal input noteHash;
    signal input secret;
    signal input nullifierSeed;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;
    signal input outPkX, outPkY, outSalt;

    // ===== 1. Recompute Commitment =====
    component comm = Poseidon(3);
    comm.inputs[0] <== noteHash;
    comm.inputs[1] <== secret;
    comm.inputs[2] <== nullifierSeed;

    // ===== 2. Verify Merkle Inclusion =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== comm.out;
    merkle.root <== poolRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Compute and Verify Nullifier =====
    // nullifier = H(nullifierSeed, merkleIndex, poolRoot)
    // Including merkleIndex and poolRoot prevents cross-pool attacks
    component nullifier = Poseidon(3);
    nullifier.inputs[0] <== nullifierSeed;
    nullifier.inputs[1] <== merkleIndex;
    nullifier.inputs[2] <== poolRoot;
    nullifier.out === nullifierHash;

    // ===== 4. Compute Output Value (denomination - relayerFee) =====
    signal outputValue;
    outputValue <== denomination - relayerFee;

    // Verify relayer fee is reasonable (< denomination)
    component feeCheck = LessThan(64);
    feeCheck.in[0] <== relayerFee;
    feeCheck.in[1] <== denomination;
    feeCheck.out === 1;

    // ===== 5. Verify Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== outputValue;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;

    // ===== 6. Verify Relayer Address Constraint =====
    // If relayerFee > 0, relayerAddress must be non-zero
    component feeNonZero = IsZero();
    feeNonZero.in <== relayerFee;

    component addrNonZero = IsZero();
    addrNonZero.in <== relayerAddress;

    // Either fee is 0, or address is non-zero
    signal feeImpliesAddress;
    feeImpliesAddress <== (1 - feeNonZero.out) * addrNonZero.out;
    feeImpliesAddress === 0;
}

component main {public [poolRoot, nullifierHash, outputHash, denomination, tokenType, relayerFee, relayerAddress]} =
    PoolWithdraw(20);
```

### Key Constraints

1. **Commitment Recomputation**: Must match a commitment in the pool tree
2. **Merkle Membership**: Valid path from commitment to pool root
3. **Nullifier Derivation**: Deterministic from secret inputs, prevents double-spend
4. **Value Conservation**: Output value = denomination - relayer fee
5. **Relayer Validation**: Fee requires valid relayer address

## Effects

| Aspect | Impact |
|--------|--------|
| **Unlinkability** | Complete separation from deposit transaction |
| **Double-Spend Prevention** | On-chain nullifier set blocks reuse |
| **Recipient Flexibility** | Any address can receive withdrawn funds |
| **Relayer Support** | Third-party submission preserves privacy |
| **Gas Privacy** | Relayer pays gas, hiding recipient's wallet |
| **Anonymity Set** | Equals total deposits minus spent nullifiers |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Nullifier Reuse** | On-chain nullifier set with O(1) lookup |
| **Root Staleness** | Include recent roots only (e.g., last 100) |
| **Relayer Censorship** | Multiple independent relayers |
| **Timing Correlation** | Encourage delayed withdrawals |
| **Amount Correlation** | Fixed denominations prevent amount linking |
| **IP Address Leak** | Use Tor/VPN when interacting with relayers |
| **Merkle Proof Validity** | Circuit verifies complete path |

## Implementation Challenges

1. **Nullifier Storage**
   - Growing set of all spent nullifiers
   - Efficient lookup required (mapping in Solidity)
   - ~32 bytes per withdrawal, ~1M withdrawals = 32MB

2. **Root Management**
   - Pool root changes with each deposit
   - Must accept recent roots for UX (pending deposits)
   - Configurable root history depth (30-100 roots typical)

3. **Relayer Network**
   - Need decentralized relayer infrastructure
   - Fee market for competitive pricing
   - Reliability and uptime requirements

4. **Withdrawal Timing**
   - Users want immediate withdrawal
   - Privacy requires waiting for more deposits
   - UX balance: show anonymity set size

5. **Failed Withdrawal Recovery**
   - If proof fails, funds remain in pool
   - User must retry with correct inputs
   - Consider proof simulation before submission

## Derivatives

1. **Withdrawal to Stealth Address** - Combine pool withdrawal with stealth address generation. Recipient publishes meta-address; withdrawer computes one-time stealth address. Double privacy: pool anonymity plus address unlinkability.

2. **Partial Pool Withdrawal** - Withdraw portion of deposit, leaving remainder in pool. Requires homomorphic commitment updates or multiple sub-commitments. Increases flexibility but complicates anonymity sets.

3. **Delayed Withdrawal Rewards** - Incentivize longer lock periods with yield or fee discounts. Users who wait longer contribute to larger anonymity sets. Creates natural incentive alignment for privacy.

4. **Pool Exit with Proof of Source** - Optional compliance mode where withdrawer proves funds originated from specific allowlisted addresses. Enables regulated entity participation without revealing exact deposit.

5. **Withdrawal Relayer Network** - Decentralized relayer protocol with reputation, staking, and fee markets. Relayers compete on price and reliability. Prevents censorship and ensures withdrawal availability.

## Use Cases

1. **Anonymous Payment Receipt**
   - Freelancer receives payment to public address
   - Deposits to pool, waits, withdraws to fresh wallet
   - Client cannot track how funds are spent
   - Financial privacy maintained

2. **Exchange Withdrawal Privacy**
   - User withdraws from centralized exchange
   - Routes through privacy pool before personal wallet
   - Exchange cannot track user's DeFi activity
   - Reduces surveillance capitalism

3. **Investment Privacy**
   - Investor accumulates position privately
   - Multiple deposits over time to pool
   - Single withdrawal to investment wallet
   - Position size hidden from competitors

4. **Salary Privacy (Recipient Side)**
   - Employee receives salary to known address
   - Deposits salary to pool weekly
   - Withdraws monthly to spending wallet
   - Spending patterns hidden from employer

## Real-World Products & User Experience

See [Privacy Pool Withdraw - Products & UX](../../product/c-privacy/c3-pool-withdraw-products.md) for detailed real-world applications and user experience scenarios.

---

[Back to Index](../../README.md)
