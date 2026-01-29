# F7. Achievement Prove

Verify gaming accomplishments and unlock rewards without revealing complete player history or specific achievement details.

**Constraints**: ~130K | **Complexity**: Low-Medium

---

## Background

Gaming achievements have valuable applications beyond bragging rights:

- **Selective Disclosure**: Players want to prove accomplishments without revealing all stats or history
- **Cross-Platform Recognition**: Achievements should be portable across games and platforms
- **Reward Eligibility**: Prove qualification for rewards without exposing exact performance
- **Privacy in Competition**: Hide skill level while proving minimum competency

Traditional achievement systems expose full player profiles. ZK achievement proofs allow players to prove they earned something without revealing how, when, or what else they have accomplished.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `achievementClaim` | field | Commitment to the achievement being proved |
| `gameId` | uint | Game where achievement was earned |
| `rewardEligibility` | field | Hash proving eligibility for specific reward |
| `minimumThreshold` | uint | Public minimum requirement (if applicable) |
| `nullifier` | field | Prevents duplicate claims |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `playerPkX, playerPkY` | field | Player's public key |
| `playerSk` | field | Player's secret key |
| `achievementId` | uint | Specific achievement identifier |
| `achievementValue` | uint | Numeric value (score, level, etc.) |
| `achievementTimestamp` | uint | When achievement was earned |
| `achievementProof` | field | Merkle proof of achievement in player history |
| `historyRoot` | field | Root of player's achievement Merkle tree |
| `claimSalt` | field | Randomness for claim commitment |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template AchievementProve(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input achievementClaim;
    signal input gameId;
    signal input rewardEligibility;
    signal input minimumThreshold;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input playerPkX, playerPkY, playerSk;
    signal input achievementId, achievementValue, achievementTimestamp;
    signal input achievementPathElements[TREE_DEPTH];
    signal input achievementPathIndices[TREE_DEPTH];
    signal input historyRoot;
    signal input claimSalt;

    // ===== 1. Verify Player Identity =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== playerSk;
    ownership.pkX <== playerPkX;
    ownership.pkY <== playerPkY;

    // ===== 2. Compute Achievement Leaf =====
    // Achievement = Hash(achievementId, value, timestamp, gameId)
    component achievementLeaf = Poseidon(4);
    achievementLeaf.inputs[0] <== achievementId;
    achievementLeaf.inputs[1] <== achievementValue;
    achievementLeaf.inputs[2] <== achievementTimestamp;
    achievementLeaf.inputs[3] <== gameId;

    // ===== 3. Verify Achievement in Player History =====
    component merkleVerify = MerkleTreeChecker(TREE_DEPTH);
    merkleVerify.leaf <== achievementLeaf.out;
    merkleVerify.root <== historyRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkleVerify.pathElements[i] <== achievementPathElements[i];
        merkleVerify.pathIndices[i] <== achievementPathIndices[i];
    }

    // ===== 4. Verify History Belongs to Player =====
    // Player history root = Hash(playerPkX, playerPkY, historyRoot)
    component playerHistory = Poseidon(3);
    playerHistory.inputs[0] <== playerPkX;
    playerHistory.inputs[1] <== playerPkY;
    playerHistory.inputs[2] <== historyRoot;

    // ===== 5. Verify Threshold Met =====
    component thresholdCheck = GreaterEqThan(64);
    thresholdCheck.in[0] <== achievementValue;
    thresholdCheck.in[1] <== minimumThreshold;
    thresholdCheck.out === 1;

    // ===== 6. Generate Achievement Claim =====
    component claim = Poseidon(4);
    claim.inputs[0] <== playerPkX;
    claim.inputs[1] <== playerPkY;
    claim.inputs[2] <== achievementId;
    claim.inputs[3] <== claimSalt;
    claim.out === achievementClaim;

    // ===== 7. Compute Nullifier =====
    // Prevents claiming same achievement multiple times
    component nullifierCalc = Poseidon(4);
    nullifierCalc.inputs[0] <== achievementId;
    nullifierCalc.inputs[1] <== gameId;
    nullifierCalc.inputs[2] <== playerSk;
    nullifierCalc.inputs[3] <== claimSalt;
    nullifierCalc.out === nullifier;

    // ===== 8. Generate Reward Eligibility Proof =====
    component eligibility = Poseidon(3);
    eligibility.inputs[0] <== achievementClaim;
    eligibility.inputs[1] <== minimumThreshold;
    eligibility.inputs[2] <== playerSk;
    eligibility.out === rewardEligibility;
}

component main {public [achievementClaim, gameId, rewardEligibility, minimumThreshold, nullifier]} =
    AchievementProve(20);  // Support history trees up to 2^20 achievements
```

### Key Constraints

1. **Player Ownership**: Only the actual player can prove their achievements
2. **Achievement Authenticity**: Achievement exists in player's verified history tree
3. **Threshold Compliance**: Achievement value meets or exceeds required minimum
4. **Single Claim**: Nullifier prevents duplicate reward claims
5. **Privacy**: Exact achievement value and other history not revealed

## Effects

| Aspect | Impact |
|--------|--------|
| **Selective Disclosure** | Prove specific achievements without exposing profile |
| **Cross-Platform Portability** | Achievements usable across different systems |
| **Privacy Preservation** | Full history remains hidden |
| **Sybil Resistance** | Tied to verified player identity |
| **Flexible Requirements** | Support range proofs, not just exact values |
| **Reward Security** | Cannot claim without genuine achievement |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Fake Achievements** | Merkle tree root signed by game authority |
| **History Manipulation** | Immutable tree; only additions allowed |
| **Achievement Replay** | Nullifier prevents reusing same proof |
| **Root Spoofing** | Root must match on-chain commitment |
| **Timing Attacks** | Timestamp verified against blockchain time |
| **Cross-Game Fraud** | gameId included in achievement and nullifier |

## Implementation Challenges

1. **Achievement Recording**
   - How are achievements recorded in the tree?
   - Game server or oracle commits achievements
   - Need trusted initial recording mechanism

2. **History Tree Management**
   - Growing tree of achievements per player
   - Updates must be efficient and verifiable
   - Consider append-only Merkle tree structures

3. **Cross-Game Standards**
   - Achievement formats vary across games
   - Need standard achievement schema
   - Translation layer for game-specific achievements

4. **Oracle Integration**
   - Who attests to achievement validity?
   - Game developers sign achievement batches
   - Decentralized oracle networks for verification

## Derivatives

1. **Cumulative Achievement Proofs** - Prove total across multiple achievements (e.g., "killed 10,000 enemies across all games"). Circuit aggregates values from multiple Merkle proofs. Enables meta-achievements spanning games.

2. **Time-Based Achievements** - Prove achievement earned before or after specific time. Circuit compares timestamp against target. Useful for "early adopter" or "speedrun" rewards.

3. **Comparative Achievements** - Prove achievement better than threshold percentile. Circuit verifies against distribution commitment. Shows "top 10%" without revealing exact rank.

4. **Cross-Game Achievements** - Prove achievements across multiple games simultaneously. Single proof covers multiple game histories. Enables ecosystem-wide reputation.

5. **Achievement NFTs** - Mint NFT proving achievement without revealing player. NFT contains proof; can be displayed or traded. Non-transferable or soulbound options available.

## Use Cases

1. **Exclusive Game Access**
   - New game requires proof of skill from previous title
   - Player proves "Diamond rank" without revealing exact rank or playtime
   - Early access granted without exposing full gaming history
   - Multiple qualification paths supported anonymously

2. **Reward Airdrops**
   - Game studio airdrops tokens to players with specific achievements
   - Players claim by proving achievement without revealing identity
   - No public list of qualified wallets
   - Sybil-resistant through achievement-based nullifier

3. **Cross-Platform Reputation**
   - Job application for esports team
   - Prove competitive achievements across multiple games
   - Hide embarrassing losses or time spent
   - Verifiable skill floor without ceiling reveal

4. **Community Governance**
   - DAO voting weight based on game contributions
   - Prove veteran status without revealing join date
   - Weighted voting based on achievement tiers
   - Protects early adopter privacy while granting benefits

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F7. Achievement Prove - Products](../../product/f-nft-gaming/f7-achievement-products.md)

---

[Back to Index](../../README.md)
