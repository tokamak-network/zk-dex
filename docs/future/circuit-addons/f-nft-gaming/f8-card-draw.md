# F8. Card Draw Verify

Provably fair card drawing and deck shuffling for blockchain card games with hidden hands and verifiable randomness.

**Constraints**: ~200K | **Complexity**: High

---

## Background

Card games require cryptographic fairness guarantees:

- **Shuffle Integrity**: Deck ordering must be unpredictable and unmanipulable by any party
- **Hand Privacy**: Players' hands must remain hidden from opponents
- **Draw Verification**: Each draw must be provably from the committed deck order
- **Anti-Cheating**: Impossible to peek at upcoming cards or manipulate draws

Traditional online card games rely on trusted servers. Blockchain card games need trustless mechanisms where neither players nor the house can cheat. ZK proofs enable mental poker protocols with practical efficiency.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `deckCommitment` | field | Commitment to shuffled deck state |
| `drawCommitment` | field | Commitment to drawn card(s) |
| `drawIndex` | uint | Position in deck being drawn from |
| `gameId` | uint | Unique game session identifier |
| `playerCommitment` | field | Player's identity commitment |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `playerPkX, playerPkY` | field | Player's public key |
| `playerSk` | field | Player's secret key |
| `shuffleSeed` | field | Combined shuffle randomness |
| `deckCards` | uint[52] | Full deck order after shuffle |
| `drawnCard` | uint | Card being drawn |
| `handSalt` | field | Randomness for hand commitment |
| `deckSalt` | field | Randomness for deck commitment |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/shuffle/fisher_yates.circom";

template CardDrawVerify(DECK_SIZE) {
    // ===== Public Inputs =====
    signal input deckCommitment;
    signal input drawCommitment;
    signal input drawIndex;
    signal input gameId;
    signal input playerCommitment;

    // ===== Private Inputs =====
    signal input playerPkX, playerPkY, playerSk;
    signal input shuffleSeed;
    signal input deckCards[DECK_SIZE];
    signal input drawnCard;
    signal input handSalt;
    signal input deckSalt;

    // ===== 1. Verify Player Identity =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== playerSk;
    ownership.pkX <== playerPkX;
    ownership.pkY <== playerPkY;

    // ===== 2. Generate Player Commitment =====
    component playerCommit = Poseidon(3);
    playerCommit.inputs[0] <== playerPkX;
    playerCommit.inputs[1] <== playerPkY;
    playerCommit.inputs[2] <== gameId;
    playerCommit.out === playerCommitment;

    // ===== 3. Verify Deck Shuffled Correctly =====
    // Regenerate shuffled deck from seed
    component shuffle = FisherYatesShuffle(DECK_SIZE);
    shuffle.seed <== shuffleSeed;
    for (var i = 0; i < DECK_SIZE; i++) {
        shuffle.inputDeck[i] <== i;  // Standard deck 0-51
    }

    // Verify provided deck matches shuffle output
    for (var i = 0; i < DECK_SIZE; i++) {
        shuffle.outputDeck[i] === deckCards[i];
    }

    // ===== 4. Verify Deck Commitment =====
    // Deck commitment = Hash(cards..., salt)
    // Using recursive hashing for large deck
    component deckHash[DECK_SIZE];
    signal deckHashAccum[DECK_SIZE + 1];
    deckHashAccum[0] <== deckSalt;

    for (var i = 0; i < DECK_SIZE; i++) {
        deckHash[i] = Poseidon(2);
        deckHash[i].inputs[0] <== deckHashAccum[i];
        deckHash[i].inputs[1] <== deckCards[i];
        deckHashAccum[i + 1] <== deckHash[i].out;
    }
    deckHashAccum[DECK_SIZE] === deckCommitment;

    // ===== 5. Verify Draw Index Valid =====
    component indexCheck = LessThan(8);
    indexCheck.in[0] <== drawIndex;
    indexCheck.in[1] <== DECK_SIZE;
    indexCheck.out === 1;

    // ===== 6. Verify Drawn Card Matches Deck Position =====
    // Select card at drawIndex from deckCards
    component cardSelect[DECK_SIZE];
    signal isSelectedIndex[DECK_SIZE];
    signal selectedCard[DECK_SIZE + 1];
    selectedCard[0] <== 0;

    for (var i = 0; i < DECK_SIZE; i++) {
        cardSelect[i] = IsEqual();
        cardSelect[i].in[0] <== i;
        cardSelect[i].in[1] <== drawIndex;
        isSelectedIndex[i] <== cardSelect[i].out;
        selectedCard[i + 1] <== selectedCard[i] + isSelectedIndex[i] * deckCards[i];
    }

    // Verify drawn card matches
    drawnCard === selectedCard[DECK_SIZE];

    // ===== 7. Generate Draw Commitment =====
    // Hidden commitment to drawn card
    component drawCommit = Poseidon(4);
    drawCommit.inputs[0] <== drawnCard;
    drawCommit.inputs[1] <== drawIndex;
    drawCommit.inputs[2] <== gameId;
    drawCommit.inputs[3] <== handSalt;
    drawCommit.out === drawCommitment;

    // ===== 8. Verify Card Valid =====
    component cardValid = LessThan(8);
    cardValid.in[0] <== drawnCard;
    cardValid.in[1] <== DECK_SIZE;
    cardValid.out === 1;
}

component main {public [deckCommitment, drawCommitment, drawIndex, gameId, playerCommitment]} =
    CardDrawVerify(52);
```

### Key Constraints

1. **Shuffle Integrity**: Deck order deterministically derived from committed seed
2. **Draw Correctness**: Drawn card matches deck at specified index
3. **Card Validity**: Drawn card is valid (0-51 for standard deck)
4. **Index Validity**: Draw index within deck bounds
5. **Commitment Binding**: All commitments cryptographically bind to their contents

## Effects

| Aspect | Impact |
|--------|--------|
| **Fair Shuffling** | No party can predict or manipulate deck order |
| **Hand Privacy** | Opponents cannot see drawn cards |
| **Draw Verification** | Each draw provably from correct deck position |
| **Cheat Prevention** | Cannot look ahead or manipulate draws |
| **Trustless Gaming** | No trusted dealer or server required |
| **Dispute Resolution** | All actions cryptographically verifiable |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Seed Manipulation** | Multi-party seed generation with commit-reveal |
| **Deck Prediction** | Cryptographic shuffle from unpredictable seed |
| **Card Counting** | Deck state hidden; only draw commitments visible |
| **Collusion** | Each player contributes randomness to shuffle |
| **Replay Attacks** | gameId makes each game unique |
| **Hand Revelation** | handSalt prevents commitment brute-forcing |

## Implementation Challenges

1. **Multi-Party Shuffle**
   - All players contribute randomness
   - Combine seeds securely without revealing individual contributions
   - Handle player dropout during shuffle phase

2. **Efficient Deck Representation**
   - 52 cards requires efficient encoding
   - Recursive hashing for commitment
   - Consider batched operations for performance

3. **Game State Management**
   - Track which cards have been drawn
   - Verify draws in correct sequence
   - Handle multiple players' draws

4. **Reveal Mechanism**
   - When and how are cards revealed?
   - End-of-game reveal for verification
   - Partial reveals for game actions (showing cards)

## Derivatives

1. **Deck Building Verification** - Prove deck contains only legal cards without revealing composition. Circuit checks each card against allowed list. Supports constructed formats with deck restrictions.

2. **Hand Privacy** - Prove hand properties without revealing cards. Circuit verifies hand contains certain combinations (e.g., "has a pair"). Enables hidden information game actions.

3. **Draw Prediction Prevention** - Multi-party randomness ensures no single party can predict draws. Circuit verifies all parties contributed to shuffle seed. Eliminates advantage from seed knowledge.

4. **Mulligan Rules** - Prove mulligan was valid according to rules. Circuit verifies original hand met mulligan conditions. Prevents abuse of mulligan mechanics.

5. **Tournament-Legal Decks** - Prove deck follows tournament rules. Circuit checks card counts, banned cards, sideboard limits. Enables blind deck registration for tournaments.

## Use Cases

1. **Blockchain Poker**
   - Players commit to shuffle contributions
   - Combined seed shuffles deck
   - Each player draws cards with hidden commitments
   - Showdown reveals cards for pot determination
   - All hands verifiable post-game

2. **Trading Card Games**
   - Player builds deck privately
   - Proves deck legal without revealing cards
   - Draws hidden from opponent
   - Actions provable when revealed
   - Anti-cheat for competitive play

3. **Casino Card Games**
   - Blackjack with provably fair dealing
   - Player can verify each draw was legitimate
   - No house manipulation of card order
   - Regulatory compliance through verifiability

4. **Draft Formats**
   - Pack contents hidden but committed
   - Each pick provable from pack state
   - Prevents seeing future picks
   - Enables trustless drafting between strangers

## Real-World Products & User Experience

See detailed product descriptions and user experiences: [F8. Card Draw Verify - Products](../../product/f-nft-gaming/f8-card-draw-products.md)

---

[Back to Index](../../README.md)
