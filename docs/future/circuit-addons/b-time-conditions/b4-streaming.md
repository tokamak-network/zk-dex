# B4. Streaming Payment

Continuous payment over time period, enabling real-time salary distribution and subscription payments with hidden stream parameters.

**Constraints**: ~200K | **Complexity**: Medium

---

## Background

Streaming payments transform how value flows between parties:

- **Cash Flow Mismatch**: Traditional payments are discrete (monthly, annual) while value accrues continuously
- **Capital Inefficiency**: Prepaid subscriptions lock funds; post-paid creates counterparty risk
- **Transparency Issues**: On-chain streams (Sablier, Superfluid) expose salary amounts and employer-employee relationships
- **Real-Time Finance**: Modern DeFi enables per-second value transfer, changing payment paradigms

In traditional finance, salaries are paid monthly despite work being performed daily. In DeFi, streaming enables continuous payments but current implementations expose all terms. ZK streaming payments hide the rate, total amount, and parties while allowing the recipient to claim earned funds at any time.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `streamHash` | field | Hash of the current stream state |
| `newStreamHash` | field | Hash of updated stream after claim (0 if complete) |
| `claimHash` | field | Hash of the claimed amount as a note |
| `currentTime` | uint | Current block.timestamp |
| `tokenType` | uint | Token type being streamed |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `senderPkX, senderPkY` | field | Sender's public key |
| `recipientPkX, recipientPkY` | field | Recipient's public key |
| `recipientSk` | field | Recipient's secret key for claim authorization |
| `totalAmount` | uint | Total stream value |
| `startTime` | uint | Stream start timestamp |
| `endTime` | uint | Stream end timestamp |
| `claimedAmount` | uint | Amount already claimed |
| `salt` | field | Stream note randomness |
| `claimAmount` | uint | Amount being claimed now |
| `newClaimedAmount` | uint | Updated claimed amount |
| `newSalt` | field | New stream note randomness |
| `claimSalt` | field | Claim output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/safe_math.circom";

template ClaimStream() {
    // ===== Public Inputs =====
    signal input streamHash;
    signal input newStreamHash;      // Updated stream (or 0 if complete)
    signal input claimHash;          // Claimed amount as note
    signal input currentTime;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input senderPkX, senderPkY;
    signal input recipientPkX, recipientPkY, recipientSk;
    signal input totalAmount, startTime, endTime;
    signal input claimedAmount, salt;
    signal input claimAmount, newClaimedAmount, newSalt, claimSalt;

    // ===== 1. Verify Stream Note =====
    component stream = Poseidon(10);
    stream.inputs[0] <== senderPkX;
    stream.inputs[1] <== senderPkY;
    stream.inputs[2] <== recipientPkX;
    stream.inputs[3] <== recipientPkY;
    stream.inputs[4] <== totalAmount;
    stream.inputs[5] <== tokenType;
    stream.inputs[6] <== startTime;
    stream.inputs[7] <== endTime;
    stream.inputs[8] <== claimedAmount;
    stream.inputs[9] <== salt;
    stream.out === streamHash;

    // ===== 2. Verify Recipient Authorization =====
    component own = ProofOfOwnershipStrict();
    own.sk <== recipientSk;
    own.pkX <== recipientPkX;
    own.pkY <== recipientPkY;

    // ===== 3. Calculate Vested Amount =====
    signal duration;
    duration <== endTime - startTime;

    // effectiveTime = min(currentTime, endTime)
    component timeCompare = LessThan(64);
    timeCompare.in[0] <== currentTime;
    timeCompare.in[1] <== endTime;
    signal effectiveTime;
    effectiveTime <== timeCompare.out * currentTime + (1 - timeCompare.out) * endTime;

    // Ensure stream has started
    component startedCheck = GreaterEqThan(64);
    startedCheck.in[0] <== currentTime;
    startedCheck.in[1] <== startTime;
    startedCheck.out === 1;

    signal elapsed;
    elapsed <== effectiveTime - startTime;

    // vestedAmount = totalAmount * elapsed / duration
    // Use integer division (truncates down, favoring sender)
    signal vestedNumerator;
    vestedNumerator <== totalAmount * elapsed;

    // Safe division with non-zero check
    component divCheck = IsZero();
    divCheck.in <== duration;
    divCheck.out === 0;  // duration must not be zero

    signal vestedAmount;
    vestedAmount <-- vestedNumerator \ duration;  // Integer division

    // Verify division: vestedAmount * duration <= vestedNumerator < (vestedAmount + 1) * duration
    component divLower = LessEqThan(128);
    divLower.in[0] <== vestedAmount * duration;
    divLower.in[1] <== vestedNumerator;
    divLower.out === 1;

    component divUpper = LessThan(128);
    divUpper.in[0] <== vestedNumerator;
    divUpper.in[1] <== (vestedAmount + 1) * duration;
    divUpper.out === 1;

    // ===== 4. Calculate Claimable Amount =====
    signal claimable;
    claimable <== vestedAmount - claimedAmount;

    // claimAmount <= claimable
    component claimCheck = LessEqThan(252);
    claimCheck.in[0] <== claimAmount;
    claimCheck.in[1] <== claimable;
    claimCheck.out === 1;

    // claimAmount > 0 (cannot claim zero)
    component nonZeroClaim = GreaterThan(252);
    nonZeroClaim.in[0] <== claimAmount;
    nonZeroClaim.in[1] <== 0;
    nonZeroClaim.out === 1;

    // ===== 5. Update Claimed Amount =====
    newClaimedAmount === claimedAmount + claimAmount;

    // ===== 6. Create New Stream Note (if not complete) =====
    component newStream = Poseidon(10);
    newStream.inputs[0] <== senderPkX;
    newStream.inputs[1] <== senderPkY;
    newStream.inputs[2] <== recipientPkX;
    newStream.inputs[3] <== recipientPkY;
    newStream.inputs[4] <== totalAmount;
    newStream.inputs[5] <== tokenType;
    newStream.inputs[6] <== startTime;
    newStream.inputs[7] <== endTime;
    newStream.inputs[8] <== newClaimedAmount;
    newStream.inputs[9] <== newSalt;

    // If fully claimed, newStreamHash should be 0
    // Otherwise, it should be the new stream hash
    component fullyClaimedCheck = IsEqual();
    fullyClaimedCheck.in[0] <== newClaimedAmount;
    fullyClaimedCheck.in[1] <== totalAmount;

    signal expectedNewStreamHash;
    expectedNewStreamHash <== (1 - fullyClaimedCheck.out) * newStream.out;
    newStreamHash === expectedNewStreamHash;

    // ===== 7. Output Claim Note =====
    component claimNote = PoseidonRegularNote();
    claimNote.pkX <== recipientPkX;
    claimNote.pkY <== recipientPkY;
    claimNote.value <== claimAmount;
    claimNote.tokenType <== tokenType;
    claimNote.salt <== claimSalt;
    claimNote.out === claimHash;
}

component main {public [streamHash, newStreamHash, claimHash, currentTime, tokenType]} =
    ClaimStream();
```

### Key Constraints

1. **Stream Note Verification**: Stream parameters committed in hash (parties, amount, duration, claimed)
2. **Recipient Authorization**: Only recipient can claim streamed funds
3. **Vesting Calculation**: Vested amount computed proportionally based on elapsed time
4. **Claim Bounds**: Claim amount must be positive and not exceed claimable amount
5. **State Update**: New stream note reflects updated claimed amount
6. **Completion Handling**: Stream hash becomes 0 when fully claimed

## Effects

| Aspect | Impact |
|--------|--------|
| **Cash Flow** | Continuous fund access as earned |
| **Capital Efficiency** | Unvested funds remain with sender until earned |
| **Privacy** | Rate, total, and parties hidden |
| **Flexibility** | Recipient claims at any frequency desired |
| **Accounting** | Clear vesting calculation for both parties |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Integer Division Rounding** | Truncate down to favor sender; recipient can claim remainder at end |
| **Timestamp Manipulation** | Use block.timestamp; manipulation limited to ~15 seconds |
| **Double Claim** | Stream state updated atomically; old state nullified |
| **Premature Cancellation** | Consider cancel circuit with unvested refund to sender |
| **Front-running Claims** | Claims are permissionless for recipient; no advantage to front-run |
| **Overflow** | Use 128-bit comparators for intermediate calculations |

## Implementation Challenges

1. **Division in Circuits**
   - Circom doesn't have native division; need witness with verification
   - Round down to prevent over-claiming
   - Consider fixed-point representation for precision

2. **Stream Cancellation**
   - Current design doesn't support early termination
   - Need separate circuit for sender-initiated cancel
   - Unvested funds should return to sender

3. **Partial Claims vs Full Claims**
   - Recipient can claim any amount up to claimable
   - Frequent small claims increase gas costs
   - Consider batching or minimum claim amounts

4. **UI/UX for Real-Time Display**
   - Wallet needs to show continuously increasing balance
   - Calculate earned amount client-side
   - Sync with chain state on actual claims

## Derivatives

1. **Milestone-Gated Streams** - Stream rate changes based on milestone achievement. Initial slow rate increases after each milestone verified. Combines streaming with conditional logic for performance-based compensation without revealing terms.

2. **Multi-Recipient Splits** - Single stream that automatically splits to multiple recipients (e.g., team salary from single funding source). Circuit manages proportional distribution with configurable split percentages hidden from observers.

3. **Inflation-Adjusted Streams** - Stream rate adjusts based on inflation oracle to maintain purchasing power. Annual salary in real terms rather than nominal. Requires oracle integration for inflation index with privacy-preserved calculation.

4. **Composable Stream NFTs** - Stream ownership represented as tradeable NFT. Recipient can sell future stream payments at discount. Enables salary factoring and liquidity for locked income streams while maintaining payment privacy.

5. **Conditional Stream Pause** - Sender can pause stream when conditions not met (e.g., contractor not working). Requires attestation or oracle for work verification. Paused time doesn't accrue; stream extends duration.

## Use Cases

1. **Private Salary Streaming**
   - Employer pays employee 120,000 USDC/year
   - Stream delivers ~$0.0038/second continuously
   - Employee claims weekly, getting instant access to earned wages
   - Privacy: Coworkers cannot see each other's salaries

2. **Subscription Services**
   - SaaS charges $100/month for premium access
   - User starts stream; service verifies active stream for access
   - Cancellation stops stream immediately; no overpayment
   - Privacy: Subscription costs hidden from competitors

3. **Investment Vesting**
   - VC invests $1M with 3-year vesting to founder
   - Stream releases proportionally over time
   - Founder claims as needed for expenses
   - Privacy: Investment terms confidential between parties

4. **Rental Payments**
   - Tenant streams rent to landlord continuously
   - Landlord receives real-time payment visibility
   - Tenant never "behind" on rent; partial month = partial payment
   - Privacy: Rental amounts hidden from neighbors

## Real-World Products & User Experience

See [Streaming Payment - Products & User Experience](../../../product/b-time-conditions/b4-streaming-products.md) for detailed product scenarios and user stories.

---

[Back to Index](../../README.md)
