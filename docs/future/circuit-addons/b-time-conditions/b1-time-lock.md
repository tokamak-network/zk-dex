# B1. Time-Locked Notes

Notes spendable only after unlock time, enabling vesting schedules and scheduled payments with hidden lock parameters.

**Constraints**: ~150K | **Complexity**: Low

---

## Background

Time-locked notes are fundamental primitives for programmable money:

- **Vesting Requirements**: Employee token grants, founder allocations, and investor lockups require time-based restrictions
- **Scheduled Payments**: Future-dated transactions like rent, subscriptions, or installment payments need trustless enforcement
- **Privacy Gap**: On-chain time locks expose vesting schedules, revealing employee compensation and investment terms
- **Trustless Enforcement**: Traditional escrows require trusted third parties; ZK time locks are self-enforcing

In traditional finance, time-locked funds require custodians or legal agreements. In DeFi, time locks are typically transparent (TokenVesting contracts expose all terms). ZK time-locked notes hide the unlock time, amount, and recipient until funds are claimed.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `noteHash` | field | Hash of the time-locked note |
| `outputHash` | field | Hash of the unlocked output note |
| `currentTime` | uint | Current block.timestamp from contract |
| `tokenType` | uint | Token type identifier |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Owner's public key coordinates |
| `value` | uint | Note value (hidden) |
| `salt` | field | Note randomness |
| `sk` | field | Secret key for ownership proof |
| `unlockTime` | uint | Timestamp when note becomes spendable |
| `outPkX, outPkY` | field | Output note owner public key |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template SpendTimeLocked() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input currentTime;        // block.timestamp from contract
    signal input tokenType;

    // ===== Private Inputs =====
    signal input pkX, pkY, value, salt, sk;
    signal input unlockTime;
    signal input outPkX, outPkY, outSalt;

    // ===== 1. Verify Time-Locked Note =====
    // Note format: hash(pkX, pkY, value, tokenType, salt, unlockTime, lockType)
    // lockType = 0 indicates time-lock
    component note = Poseidon(7);
    note.inputs[0] <== pkX;
    note.inputs[1] <== pkY;
    note.inputs[2] <== value;
    note.inputs[3] <== tokenType;
    note.inputs[4] <== salt;
    note.inputs[5] <== unlockTime;
    note.inputs[6] <== 0;  // lockType: 0 = time-lock
    note.out === noteHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 3. Time Check: currentTime >= unlockTime =====
    // Using LessThan to check unlockTime < currentTime + 1
    // This is equivalent to unlockTime <= currentTime
    component timeCheck = LessThan(64);
    timeCheck.in[0] <== unlockTime;
    timeCheck.in[1] <== currentTime + 1;
    timeCheck.out === 1;

    // ===== 4. Create Output Note (Regular, No Time Lock) =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [noteHash, outputHash, currentTime, tokenType]} =
    SpendTimeLocked();
```

### Key Constraints

1. **Note Format Verification**: Time-locked notes include unlockTime in hash, differentiating from regular notes
2. **Ownership Verification**: Only the note owner can spend the time-locked funds
3. **Time Condition**: `currentTime >= unlockTime` must hold for spending to succeed
4. **Value Preservation**: Output note value equals input note value (no funds created or destroyed)

## Effects

| Aspect | Impact |
|--------|--------|
| **Programmability** | Time-based fund control without smart contract complexity |
| **Trust Minimization** | Self-enforcing locks without third-party custodians |
| **Privacy** | Unlock time, amount, and parties all hidden until claim |
| **Composability** | Time-locked notes can be nested with other circuit types |
| **Gas Efficiency** | Single proof verification vs. complex contract state |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Timestamp Manipulation** | Use block.timestamp with reasonable tolerance; miners can manipulate by ~15 seconds |
| **Clock Drift** | Include buffer time in unlock conditions; don't rely on exact timing |
| **Front-running Claims** | First valid claim wins; funds cannot be double-spent due to nullifier |
| **Lost Keys** | Consider adding emergency recovery mechanism or backup signers |
| **Contract Pause** | Time continues passing during pause; consider pause-aware unlock logic |

## Implementation Challenges

1. **Timestamp Source**
   - `block.timestamp` is miner-controlled within bounds
   - Consider using block numbers for more predictable timing
   - Cross-chain time locks need synchronized time sources

2. **Unlock Granularity**
   - Seconds-level precision may be unnecessary and adds complexity
   - Consider day or hour-level granularity for most use cases
   - Balance between precision and practical needs

3. **Note Format Compatibility**
   - Time-locked notes use different hash structure than regular notes
   - Need clear type indicators (lockType field) for wallet compatibility
   - Migration path for upgrading note formats

4. **UI/UX Considerations**
   - Users need to understand when funds become available
   - Wallets must track and display time-locked balances separately
   - Consider countdown notifications approaching unlock

## Derivatives

1. **Cliff Vesting Notes** - Time-locked notes with a cliff period where no tokens vest, then full unlock. Useful for employee grants where tokens vest after a 1-year cliff. Circuit adds cliff time check before linear vesting calculation.

2. **Auto-Refund Escrow** - Time-locked note that returns to sender if not claimed by recipient before timeout. Combines time lock with conditional recipient, enabling trustless deposits with automatic refund on expiry.

3. **Deadman's Switch** - Note that becomes spendable by backup key if primary owner doesn't "check in" periodically. Each check-in extends the unlock time. Useful for inheritance and emergency recovery scenarios.

4. **Rate-Limited Spending** - Time-locked notes that enforce maximum spending velocity. Each spend resets a timer, limiting how quickly funds can be drained. Protects against key compromise with time-based rate limits.

5. **Future-Dated Checks** - Notes payable to a recipient only after a specific date, like traditional post-dated checks. Sender creates note with recipient's key and future unlock time; recipient can only claim after that date.

## Use Cases

1. **Employee Token Vesting**
   - Company grants employee 10,000 tokens vesting over 4 years
   - Creates time-locked notes unlocking quarterly (1/16 each)
   - Employee claims each tranche as it vests
   - Privacy: Other employees cannot see each other's grants

2. **Subscription Prepayment**
   - User prepays 12 months of service subscription
   - Creates 12 time-locked notes, one unlocking each month
   - Service provider claims monthly payment as it vests
   - Protection: Service must be provided to claim next payment

3. **Investment Lockup**
   - VC receives tokens with 2-year lockup requirement
   - Tokens placed in time-locked notes with future unlock dates
   - Cannot be transferred or sold until lockup expires
   - Compliance: Proves lockup to auditors without revealing holdings

4. **Scheduled Inheritance**
   - Parent sets up inheritance that unlocks when child turns 25
   - Time-locked notes with unlock time = child's 25th birthday
   - Funds cannot be accessed prematurely by anyone
   - Privacy: Estate details remain confidential

## Real-World Products & User Experience

See [Time-Locked Notes - Products & User Experience](../../product/b-time-conditions/b1-time-lock-products.md) for detailed product scenarios and user stories.

---

[Back to Index](../../README.md)
