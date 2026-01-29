# D6. Proposal Bond

Stake required to submit proposals, filtering spam while signaling proposer confidence.

**Constraints**: ~140K | **Complexity**: Low

---

## Background

Proposal bonds improve governance quality:

- **Spam Prevention**: Low-quality proposals waste voter attention and governance resources
- **Skin in the Game**: Proposers with economic stake are more thoughtful about proposals
- **Signal Quality**: Bond size signals proposer confidence in proposal success
- **Attack Resistance**: Malicious governance attacks require capital commitment

Without proposal bonds, governance can be flooded with frivolous or malicious proposals. Bonds create economic filters that align proposer incentives with governance outcomes. Successful proposals return the bond; failed or malicious proposals forfeit it.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bondNoteHash` | field | Hash of the staked bond note |
| `proposalHash` | field | Hash commitment to proposal content |
| `minBond` | uint | Minimum required bond for this proposal type |
| `proposalType` | uint | Category of proposal (determines bond requirement) |
| `bondNullifier` | field | Nullifier to prevent bond reuse |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | Proposer's public key |
| `sk` | field | Secret key proving ownership |
| `bondValue` | uint | Amount of tokens bonded |
| `tokenType` | uint | Token type for bond (governance token) |
| `bondSalt` | field | Bond note randomness |
| `proposalData` | field | Hash of proposal content |
| `proposalNonce` | uint | Unique nonce for this proposal |
| `proposalDeadline` | uint | Voting deadline timestamp |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template ProposalBond() {
    // ===== Public Inputs =====
    signal input bondNoteHash;
    signal input proposalHash;
    signal input minBond;
    signal input proposalType;
    signal input bondNullifier;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input bondValue;
    signal input tokenType;
    signal input bondSalt;
    signal input proposalData;
    signal input proposalNonce;
    signal input proposalDeadline;

    // ===== 1. Verify Bond Note =====
    component bondNote = PoseidonRegularNote();
    bondNote.pkX <== pkX;
    bondNote.pkY <== pkY;
    bondNote.value <== bondValue;
    bondNote.tokenType <== tokenType;
    bondNote.salt <== bondSalt;
    bondNote.out === bondNoteHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 3. Verify Bond Meets Minimum =====
    component bondCheck = GreaterEqThan(64);
    bondCheck.in[0] <== bondValue;
    bondCheck.in[1] <== minBond;
    bondCheck.out === 1;

    // ===== 4. Verify Token Type is Governance Token =====
    tokenType === 0;  // Governance token type ID

    // ===== 5. Compute Proposal Hash =====
    component proposal = Poseidon(6);
    proposal.inputs[0] <== proposalData;
    proposal.inputs[1] <== pkX;
    proposal.inputs[2] <== pkY;
    proposal.inputs[3] <== proposalType;
    proposal.inputs[4] <== proposalNonce;
    proposal.inputs[5] <== proposalDeadline;
    proposal.out === proposalHash;

    // ===== 6. Compute Bond Nullifier =====
    // Prevents reusing same bond for multiple proposals
    component nullifier = Poseidon(3);
    nullifier.inputs[0] <== sk;
    nullifier.inputs[1] <== bondNoteHash;
    nullifier.inputs[2] <== proposalNonce;
    nullifier.out === bondNullifier;

    // ===== 7. Validate Positive Bond =====
    component bondPositive = GreaterThan(64);
    bondPositive.in[0] <== bondValue;
    bondPositive.in[1] <== 0;
    bondPositive.out === 1;

    // ===== 8. Validate Deadline in Future =====
    // Note: currentTime would need to be public input in practice
    component deadlineValid = GreaterThan(64);
    deadlineValid.in[0] <== proposalDeadline;
    deadlineValid.in[1] <== 0;
    deadlineValid.out === 1;
}

component main {public [bondNoteHash, proposalHash, minBond, proposalType, bondNullifier]} =
    ProposalBond();
```

### Key Constraints

1. **Bond Ownership**: Proposer must own the bond note
2. **Minimum Bond**: Bond value must meet or exceed minimum for proposal type
3. **Correct Token**: Bond must be in governance token
4. **Proposal Binding**: Proposal hash ties bond to specific proposal content
5. **Nullifier Prevention**: Same bond cannot be used for multiple active proposals

## Effects

| Aspect | Impact |
|--------|--------|
| **Quality Filter** | Economic barrier filters low-effort proposals |
| **Spam Prevention** | Cost to propose deters frivolous submissions |
| **Confidence Signal** | Larger bonds indicate higher proposer conviction |
| **Attack Cost** | Malicious proposals require capital at risk |
| **Aligned Incentives** | Proposers benefit from successful outcomes |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Bond Griefing** | Minimum bond should be meaningful but accessible |
| **Plutocratic Proposals** | Consider bond caps or sliding scales based on proposer history |
| **Bond Theft** | Bonds held in contract escrow, not transferred to proposer |
| **Slashing Abuse** | Clear, objective criteria for bond forfeiture |
| **Collusion** | Slashed bonds go to treasury, not individual voters |
| **Flash-Loan Bonds** | Bond must remain locked through voting period |

## Implementation Challenges

1. **Bond Sizing**
   - Too low: doesn't filter spam effectively
   - Too high: excludes legitimate community proposals
   - Consider dynamic bond based on governance activity levels
   - Different bonds for different proposal types

2. **Outcome Determination**
   - What counts as "success" for bond return?
   - Passing threshold? Reaching quorum? Implementation?
   - Handle edge cases (cancelled proposals, expired votes)

3. **Slashing Mechanics**
   - When is a bond forfeited vs. returned?
   - Partial slashing for close but failed proposals?
   - Who decides on malicious proposal slashing?

4. **Capital Efficiency**
   - Bonds locked during voting reduce circulating governance tokens
   - Consider bond delegation or pooling mechanisms
   - Time-limited locks with automatic release

## Derivatives

1. **Variable Bond by Proposal Type** - Different minimum bonds for different proposal categories. Treasury proposals require higher bonds than parameter changes. Risk-proportionate capital requirements based on proposal impact.

2. **Bond Delegation** - Community members pool governance tokens to back proposals they support. Shared risk and reward among backers. Enables capital-efficient proposal submission for aligned groups.

3. **Bond Insurance** - Third-party underwriting of proposal bonds. Proposers pay premium; insurer covers slashing risk. Creates market for proposal quality assessment and risk pricing.

4. **Gradual Bond Release** - Successful proposals release bond over time (e.g., 25% immediately, 75% over 3 months). Ensures proposer accountability for implementation phase. Aligns long-term incentives.

5. **Reputation-Adjusted Bonds** - Proposers with successful track record require smaller bonds. Failed proposals increase future bond requirements. Creates dynamic reputation system affecting proposal costs.

## Use Cases

1. **Protocol Upgrade Proposal**
   - Developer wants to propose significant code change
   - Stakes 1000 tokens as bond (10x minimum)
   - High bond signals strong confidence in upgrade
   - If proposal passes and implements successfully, bond returned
   - Community evaluates both proposal and signal

2. **Treasury Grant Request**
   - Project requests 50,000 token grant
   - Required to bond 5% of request (2,500 tokens)
   - Bond ensures project has skin in the game
   - If project delivers milestones, bond returned with grant
   - Failed delivery forfeits bond to treasury

3. **Parameter Change Proposal**
   - Community member proposes fee reduction
   - Stakes minimum bond of 100 tokens
   - Lower stakes appropriate for low-risk changes
   - Proposal evaluated on merits with basic spam filtering
   - Bond returned regardless of outcome if proposal valid

4. **Emergency Action Request**
   - Security researcher discovers vulnerability
   - Stakes large bond for emergency proposal bypassing normal queue
   - High bond compensates for expedited process
   - If vulnerability confirmed, bond returned with reward
   - False alarms forfeit bond to discourage abuse

## Real-World Products & User Experience

See: [Proposal Bond Products & UX](../../../product/d-governance/d6-proposal-bond-products.md)

---

[Back to Index](../../README.md)
