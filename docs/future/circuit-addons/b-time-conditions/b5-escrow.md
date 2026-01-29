# B5. Escrow with Timeout

Multi-party escrow with automatic timeout release, enabling trustless trade settlement with hidden deal terms and arbiter-mediated disputes.

**Constraints**: ~220K | **Complexity**: Medium

---

## Background

Escrow is fundamental to trustless commerce:

- **Counterparty Risk**: Online transactions require trust that goods/services will be delivered after payment
- **Dispute Resolution**: Traditional escrow relies on centralized arbiters with full visibility into transactions
- **Timeout Problem**: Funds can be locked indefinitely if parties don't cooperate
- **Privacy Exposure**: Current on-chain escrow reveals deal amounts, parties, and arbiter identities

Traditional escrow services are centralized and require full transaction transparency. On-chain escrow contracts (like OpenZeppelin's Escrow) expose all details. ZK escrow hides the deal terms, parties, and arbiter while enabling trustless release based on authorization or timeout.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `escrowHash` | field | Hash of the escrow note |
| `outputHash` | field | Hash of the released funds |
| `currentTime` | uint | Current block.timestamp |
| `releaseType` | uint | 0=buyer, 1=seller, 2=arbiter, 3=timeout |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `buyerPkX, buyerPkY` | field | Buyer's public key |
| `sellerPkX, sellerPkY` | field | Seller's public key |
| `arbiterPkX, arbiterPkY` | field | Arbiter's public key |
| `value` | uint | Escrowed amount |
| `tokenType` | uint | Token type identifier |
| `timeoutTime` | uint | Timeout timestamp for automatic release |
| `salt` | field | Escrow note randomness |
| `releaserSk` | field | Secret key of the authorizing party |
| `recipientPkX, recipientPkY` | field | Recipient's public key |
| `outSalt` | field | Output note randomness |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/scalar_mul_base.circom";
include "../utils/comparators.circom";

template EscrowRelease() {
    // ===== Public Inputs =====
    signal input escrowHash;
    signal input outputHash;
    signal input currentTime;
    signal input releaseType;        // 0=buyer, 1=seller, 2=arbiter, 3=timeout

    // ===== Private Inputs =====
    signal input buyerPkX, buyerPkY;
    signal input sellerPkX, sellerPkY;
    signal input arbiterPkX, arbiterPkY;
    signal input value, tokenType, timeoutTime, salt;
    signal input releaserSk;
    signal input recipientPkX, recipientPkY, outSalt;

    // ===== 1. Verify Escrow Note =====
    component escrow = Poseidon(11);
    escrow.inputs[0] <== buyerPkX;
    escrow.inputs[1] <== buyerPkY;
    escrow.inputs[2] <== sellerPkX;
    escrow.inputs[3] <== sellerPkY;
    escrow.inputs[4] <== arbiterPkX;
    escrow.inputs[5] <== arbiterPkY;
    escrow.inputs[6] <== value;
    escrow.inputs[7] <== tokenType;
    escrow.inputs[8] <== timeoutTime;
    escrow.inputs[9] <== salt;
    escrow.inputs[10] <== 0;  // escrowType: 0 = standard escrow
    escrow.out === escrowHash;

    // ===== 2. Validate releaseType =====
    // releaseType must be 0, 1, 2, or 3
    component isType0 = IsEqual();
    isType0.in[0] <== releaseType;
    isType0.in[1] <== 0;

    component isType1 = IsEqual();
    isType1.in[0] <== releaseType;
    isType1.in[1] <== 1;

    component isType2 = IsEqual();
    isType2.in[0] <== releaseType;
    isType2.in[1] <== 2;

    component isType3 = IsEqual();
    isType3.in[0] <== releaseType;
    isType3.in[1] <== 3;

    signal validType;
    validType <== isType0.out + isType1.out + isType2.out + isType3.out;
    validType === 1;

    // ===== 3. Derive Releaser Public Key from Secret Key =====
    component releaserPk = BabyJubJubScalarMulBase();
    releaserPk.scalar <== releaserSk;

    // ===== 4. Verify Authorization Based on Release Type =====

    // Type 0 (Buyer Release): Buyer authorizes release to seller
    // Buyer signs, recipient must be seller
    signal buyerAuth;
    buyerAuth <== isType0.out * (
        (1 - (releaserPk.outX - buyerPkX)) * (1 - (releaserPk.outY - buyerPkY)) *
        (1 - (recipientPkX - sellerPkX)) * (1 - (recipientPkY - sellerPkY))
    );

    // Simplified authorization checks
    // For buyer release: verify releaser is buyer, recipient is seller
    component buyerMatch = IsEqual();
    buyerMatch.in[0] <== releaserPk.outX;
    buyerMatch.in[1] <== buyerPkX;

    component buyerMatchY = IsEqual();
    buyerMatchY.in[0] <== releaserPk.outY;
    buyerMatchY.in[1] <== buyerPkY;

    component sellerRecipientX = IsEqual();
    sellerRecipientX.in[0] <== recipientPkX;
    sellerRecipientX.in[1] <== sellerPkX;

    component sellerRecipientY = IsEqual();
    sellerRecipientY.in[0] <== recipientPkY;
    sellerRecipientY.in[1] <== sellerPkY;

    // For seller release: verify releaser is seller, recipient is buyer
    component sellerMatch = IsEqual();
    sellerMatch.in[0] <== releaserPk.outX;
    sellerMatch.in[1] <== sellerPkX;

    component sellerMatchY = IsEqual();
    sellerMatchY.in[0] <== releaserPk.outY;
    sellerMatchY.in[1] <== sellerPkY;

    component buyerRecipientX = IsEqual();
    buyerRecipientX.in[0] <== recipientPkX;
    buyerRecipientX.in[1] <== buyerPkX;

    component buyerRecipientY = IsEqual();
    buyerRecipientY.in[0] <== recipientPkY;
    buyerRecipientY.in[1] <== buyerPkY;

    // For arbiter release: verify releaser is arbiter (recipient can be anyone)
    component arbiterMatch = IsEqual();
    arbiterMatch.in[0] <== releaserPk.outX;
    arbiterMatch.in[1] <== arbiterPkX;

    component arbiterMatchY = IsEqual();
    arbiterMatchY.in[0] <== releaserPk.outY;
    arbiterMatchY.in[1] <== arbiterPkY;

    // Timeout check: currentTime >= timeoutTime
    component timeoutCheck = GreaterEqThan(64);
    timeoutCheck.in[0] <== currentTime;
    timeoutCheck.in[1] <== timeoutTime;

    // ===== 5. Combine Authorization Logic =====
    signal type0Valid;
    type0Valid <== isType0.out * buyerMatch.out * buyerMatchY.out *
                   sellerRecipientX.out * sellerRecipientY.out;

    signal type1Valid;
    type1Valid <== isType1.out * sellerMatch.out * sellerMatchY.out *
                   buyerRecipientX.out * buyerRecipientY.out;

    signal type2Valid;
    type2Valid <== isType2.out * arbiterMatch.out * arbiterMatchY.out;

    signal type3Valid;
    type3Valid <== isType3.out * timeoutCheck.out;  // Timeout: no signature needed

    signal authValid;
    authValid <== type0Valid + type1Valid + type2Valid + type3Valid;
    authValid === 1;

    // ===== 6. Create Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== recipientPkX;
    outNote.pkY <== recipientPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [escrowHash, outputHash, currentTime, releaseType]} =
    EscrowRelease();
```

### Key Constraints

1. **Escrow Note Verification**: All parties (buyer, seller, arbiter) committed in hash
2. **Release Type Validation**: Type must be exactly 0, 1, 2, or 3
3. **Buyer Release (Type 0)**: Buyer signs, funds go to seller (goods received)
4. **Seller Release (Type 1)**: Seller signs, funds return to buyer (refund/cancellation)
5. **Arbiter Release (Type 2)**: Arbiter signs, can send to either party (dispute resolution)
6. **Timeout Release (Type 3)**: No signature needed if timeout passed

## Effects

| Aspect | Impact |
|--------|--------|
| **Trust** | Trustless three-party settlement without revealing deal terms |
| **Dispute Resolution** | Arbiter can resolve disputes while only knowing necessary details |
| **Safety** | Automatic timeout prevents permanent fund lockup |
| **Privacy** | Deal amount, parties, and arbiter all hidden |
| **Flexibility** | Multiple release paths for different scenarios |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Arbiter Collusion** | Use reputable arbiters; consider decentralized arbiter networks |
| **Timeout Gaming** | Buyer shouldn't have timeout recipient advantage; use fair defaults |
| **Key Loss** | Timeout provides eventual release even if keys lost |
| **Replay Attacks** | Escrow hash nullified on release; cannot be re-spent |
| **Malicious Arbiter** | Arbiter stake or reputation system; limited to escrowed amount |
| **Timing Attacks** | Buffer time before timeout; parties have time to act |

## Implementation Challenges

1. **Timeout Recipient Selection**
   - Who receives funds on timeout? Buyer? Seller? Split?
   - Consider escrow type parameter for different defaults
   - May need additional circuits for different timeout behaviors

2. **Arbiter Selection**
   - How are arbiters discovered and chosen?
   - Consider arbiter marketplace or decentralized selection
   - Arbiter fees and payment mechanism

3. **Partial Releases**
   - Current design is all-or-nothing
   - Consider extension for partial refunds (e.g., 70% to seller, 30% refund)
   - Requires additional output notes and split logic

4. **Evidence Submission**
   - Arbiters need evidence to make decisions
   - Off-chain communication channel needed
   - Consider encrypted evidence with arbiter's public key

## Derivatives

1. **Multi-Stage Escrow** - Escrow with multiple release stages (e.g., 30% on contract start, 40% on delivery, 30% on acceptance). Each stage has its own timeout and release conditions. Enables milestone-based payments for complex projects.

2. **Milestone-Based Release** - Escrow where funds release incrementally as milestones are verified. Oracle or arbiter confirms milestone completion. Combines escrow security with streaming-like progressive payments.

3. **Escrow with Partial Refund** - Allows arbiter to split funds between parties (e.g., 60% to seller, 40% to buyer). Useful when both parties have valid claims. Creates two output notes with configurable split ratio.

4. **Cross-Chain Escrow** - Escrow for cross-chain atomic swaps. Uses hash time-locked contracts (HTLC) pattern with ZK proofs. Enables trustless exchange across different blockchains with hidden amounts.

5. **Escrow with Insurance** - Escrow combined with insurance pool. If deal fails, insurance covers buyer's loss. Insurance premium deducted from escrow amount. Creates additional safety net for high-value transactions.

## Use Cases

1. **Private P2P Trading**
   - Alice sells NFT to Bob for 10 ETH
   - Both agree on arbiter (Kleros juror)
   - Bob deposits 10 ETH into escrow
   - Alice transfers NFT off-chain, Bob releases escrow
   - Privacy: Trade amount and parties hidden from observers

2. **Freelance Contracts**
   - Client hires developer for $5,000 project
   - Payment escrowed at project start
   - On delivery, client releases to developer
   - Dispute: Arbiter reviews work, decides release
   - Privacy: Contract value confidential between parties

3. **Real Estate Deposits**
   - Buyer deposits $50,000 earnest money
   - Seller commits to closing within 30 days
   - On closing, escrow releases to seller
   - Deal falls through: Seller refunds buyer
   - Timeout: Automatic refund if closing doesn't happen

4. **International Trade**
   - Importer pays for goods via escrow
   - Exporter ships goods, provides tracking
   - On receipt confirmation, funds release to exporter
   - Dispute: Trade arbiter examines shipping documents
   - Privacy: Trade values hidden from competitors

## Real-World Products & User Experience

See [Escrow with Timeout - Products & User Experience](../../product/b-time-conditions/b5-escrow-products.md) for detailed product scenarios and user stories.

---

[Back to Index](../../README.md)
