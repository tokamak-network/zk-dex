# F6. Tournament Entry

Anonymous tournament registration with private stake amounts, hidden participant count, and verifiable qualification requirements.

**Constraints**: ~140K | **Complexity**: Medium

---

## Background

Tournament entry reveals competitive information:

- **Participant Privacy**: Public registration exposes who is competing, allowing targeted preparation
- **Stake Concealment**: Visible stake amounts reveal player confidence and financial capacity
- **Qualification Privacy**: Requirements verification without exposing player stats or history
- **Anti-Collusion**: Anonymous entry makes it harder for participants to coordinate

Esports and gaming tournaments are high-stakes competitions where information asymmetry matters. ZK tournament entry allows fair competition while protecting participant identities until matches begin.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `entryCommitment` | field | Hash commitment to entry details |
| `tournamentId` | uint | Unique identifier for the tournament |
| `stakeNoteHash` | field | Hash of stake/entry fee note |
| `qualificationProof` | field | Proof of meeting requirements |
| `nullifier` | field | Prevents double-entry |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `playerPkX, playerPkY` | field | Player's public key |
| `playerSk` | field | Player's secret key |
| `entrySalt` | field | Randomness for entry commitment |
| `stakeValue` | uint | Entry stake amount |
| `stakeSalt` | field | Stake note randomness |
| `playerRating` | uint | Player's skill rating |
| `playerHistory` | field | Hash of match history |
| `minRating` | uint | Minimum required rating |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template TournamentEntry() {
    // ===== Public Inputs =====
    signal input entryCommitment;
    signal input tournamentId;
    signal input stakeNoteHash;
    signal input qualificationProof;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input playerPkX, playerPkY, playerSk;
    signal input entrySalt;
    signal input stakeValue, stakeSalt, stakeToken;
    signal input playerRating, playerHistory;
    signal input minRating, minStake;

    // ===== 1. Verify Entry Commitment =====
    // Entry = Hash(playerPkX, playerPkY, tournamentId, entrySalt)
    component entryHash = Poseidon(4);
    entryHash.inputs[0] <== playerPkX;
    entryHash.inputs[1] <== playerPkY;
    entryHash.inputs[2] <== tournamentId;
    entryHash.inputs[3] <== entrySalt;
    entryHash.out === entryCommitment;

    // ===== 2. Verify Player Identity =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== playerSk;
    ownership.pkX <== playerPkX;
    ownership.pkY <== playerPkY;

    // ===== 3. Compute Nullifier =====
    // Prevents same player from entering twice
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== tournamentId;
    nullifierCalc.inputs[1] <== playerSk;
    nullifierCalc.inputs[2] <== entrySalt;
    nullifierCalc.out === nullifier;

    // ===== 4. Verify Stake Note =====
    component stakeNote = Poseidon(5);
    stakeNote.inputs[0] <== playerPkX;
    stakeNote.inputs[1] <== playerPkY;
    stakeNote.inputs[2] <== stakeValue;
    stakeNote.inputs[3] <== stakeToken;
    stakeNote.inputs[4] <== stakeSalt;
    stakeNote.out === stakeNoteHash;

    // ===== 5. Verify Minimum Stake =====
    component stakeCheck = GreaterEqThan(64);
    stakeCheck.in[0] <== stakeValue;
    stakeCheck.in[1] <== minStake;
    stakeCheck.out === 1;

    // ===== 6. Verify Rating Qualification =====
    component ratingCheck = GreaterEqThan(64);
    ratingCheck.in[0] <== playerRating;
    ratingCheck.in[1] <== minRating;
    ratingCheck.out === 1;

    // ===== 7. Generate Qualification Proof =====
    // Proof that player meets requirements without revealing exact stats
    component qualProof = Poseidon(4);
    qualProof.inputs[0] <== playerRating;
    qualProof.inputs[1] <== playerHistory;
    qualProof.inputs[2] <== minRating;
    qualProof.inputs[3] <== playerSk;
    qualProof.out === qualificationProof;
}

component main {public [entryCommitment, tournamentId, stakeNoteHash, qualificationProof, nullifier]} =
    TournamentEntry();
```

### Key Constraints

1. **Identity Verification**: Player proves ownership of their gaming identity
2. **Single Entry**: Nullifier prevents one player from entering multiple times
3. **Stake Requirement**: Entry stake meets tournament minimum
4. **Rating Qualification**: Player rating exceeds minimum threshold
5. **Commitment Binding**: Entry details cannot be changed after registration

## Effects

| Aspect | Impact |
|--------|--------|
| **Participant Privacy** | Competitors unknown until match time |
| **Stake Privacy** | Entry amounts hidden; no wealth signaling |
| **Fair Competition** | No targeted preparation against known opponents |
| **Anti-Collusion** | Anonymous entry reduces coordination ability |
| **Qualification Proof** | Requirements verified without exposing stats |
| **Sybil Prevention** | Nullifier prevents duplicate entries |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Multi-Accounting** | Link to verified identity or require stake |
| **Rating Manipulation** | Rating from trusted oracle or on-chain history |
| **Entry Grinding** | Salt provides entropy; nullifier prevents retries |
| **Stake Withdrawal** | Stake locked until tournament completes |
| **Bracket Manipulation** | VRF-based bracket generation after entry closes |
| **Collusion Detection** | Match monitoring and statistical analysis |

## Implementation Challenges

1. **Rating System Integration**
   - Where does player rating come from?
   - On-chain ELO system or trusted oracle
   - Rating updates must be verifiable

2. **Reveal Timing**
   - When are participants revealed?
   - Just before matches or after tournament?
   - Balance privacy with audience experience

3. **Bracket Generation**
   - How to create fair brackets anonymously?
   - VRF-based seeding after all entries
   - Prevent bracket manipulation

4. **Prize Distribution**
   - Winners need to claim without full identity reveal
   - Proof of match results
   - Private prize transfer to winner

## Derivatives

1. **Anonymous Brackets** - Generate tournament brackets without revealing participant identities. Bracket positions derived from VRF after entry deadline. Players only revealed to opponents just before match.

2. **Prize Pool Contribution** - Additional stake beyond minimum contributes to prize pool. Circuit verifies contribution without revealing amount. Creates variable prize pools with hidden contributions.

3. **Elimination Proofs** - Prove match results and eliminations without revealing player identities. Winner advances with new commitment; loser's entry nullified. Maintains bracket integrity anonymously.

4. **Skill-Based Matchmaking** - Match players of similar skill without revealing ratings. Circuit proves both players in same rating band. Ensures fair matches while hiding exact ratings.

5. **Anti-Sybil Entry** - Prove uniqueness across multiple identity frameworks. Circuit verifies player not registered under different identity. Combines with stake to prevent multi-accounting.

## Use Cases

1. **Professional Esports Tournament**
   - Major tournament with $1M prize pool
   - Top players enter anonymously to prevent targeted practice
   - Qualifications verified without revealing exact stats
   - Identities revealed only at live event

2. **Daily Gaming Competitions**
   - Daily tournaments with entry stakes
   - Players compete anonymously for prize pool
   - Prevents collusion between regular players
   - Fair competition across skill brackets

3. **Guild vs. Guild Wars**
   - Guild registers team without revealing roster
   - Opponents cannot prepare for specific players
   - Strategic advantage in hidden team composition
   - Members revealed only during live matches

4. **High-Stakes Poker Tournament**
   - Players enter with hidden bankroll information
   - No ability to target wealthy players
   - Anonymous until seated at table
   - Prize claims maintain winner privacy

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F6. Tournament Entry - Products](../../product/f-nft-gaming/f6-tournament-products.md)

---

[Back to Index](../../README.md)
