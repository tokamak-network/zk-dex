# HC2. Multi-Asset Atomic Swap

Atomically exchange multiple different assets between multiple parties.

**Constraints**: ~600K | **Complexity**: High

---

## Background

Current DEX systems face limitations in complex trade scenarios:
- Two-party swaps can't handle multi-way trades efficiently
- Sequential swaps create MEV extraction opportunities
- Cross-asset arbitrage requires multiple transactions
- Settlement risk exists between sequential operations

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| Sequential swaps | MEV sandwich attacks between transactions; counterparty risk |
| AMM routing | Slippage compounds across hops; impermanent loss exposure |
| Order book matching | Requires liquidity in each pair; sparse order books |
| OTC desks | Trusted intermediary; high minimum sizes; slow settlement |

Multi-asset atomic swaps solve the "coincidence of wants" problem where Alice wants B, Bob wants C, and Charlie wants A - all can trade atomically without intermediaries.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inputHashes` | field[N_PARTIES][N_ASSETS] | Notes each party provides |
| `outputHashes` | field[N_PARTIES][N_ASSETS] | Notes each party receives |
| `swapConfigHash` | field | Commitment to swap configuration matrix |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inPkX/Y, inValue, inToken, inSalt` | field arrays | Input note details per party per asset |
| `inSk` | field[N_PARTIES] | Secret keys for ownership proof |
| `inIsActive` | bool[N_PARTIES][N_ASSETS] | Which input slots are active |
| `outPkX/Y, outValue, outToken, outSalt` | field arrays | Output note details |
| `outIsActive` | bool[N_PARTIES][N_ASSETS] | Which output slots are active |
| `swapMatrix` | uint[N_PARTIES][N_PARTIES][N_ASSETS] | Who gives what to whom |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Capital Efficiency** | No locked funds between sequential swaps |
| **MEV Protection** | Entire multi-party swap is atomic, no sandwich attacks |
| **Settlement Risk** | Zero counterparty risk - all or nothing execution |
| **Liquidity** | Enables complex trades that were previously impractical |
| **Privacy** | Only swap configuration hash is public |
| **Gas Cost** | Single proof (~300K gas) vs N*M individual swaps |

## Derivatives

1. **Ring Swap** - N parties in a circular swap (A->B->C->...->A). Each party gives one asset type and receives another. Simplifies swap matrix to a single cycle. Common in forex and commodity markets.

2. **Conditional Multi-Swap** - Swap only executes if oracle condition met (e.g., ETH price > $2000). Integrates price oracle verification into circuit. Enables complex trading strategies.

3. **Partial Fill Multi-Swap** - Allow partial execution with priority ordering. If full swap impossible, execute maximum possible subset. Requires fill priority rules and pro-rata distribution logic.

4. **Expiring Multi-Swap** - Time-bounded swap with automatic refund. Includes timestamp check; after expiry, anyone can trigger refund proof. Essential for time-sensitive trades.

5. **Cross-Chain Multi-Swap** - Extend to multiple chains using HTLCs (Hash Time-Locked Contracts). Requires hash preimage revelation across chains. Bridge integration for cross-chain note verification.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

template MultiAssetAtomicSwap(N_PARTIES, N_ASSETS) {
    // ===== Public Inputs =====
    signal input inputHashes[N_PARTIES][N_ASSETS];
    signal input outputHashes[N_PARTIES][N_ASSETS];
    signal input swapConfigHash;

    // ===== Private Inputs =====
    signal input inPkX[N_PARTIES][N_ASSETS];
    signal input inPkY[N_PARTIES][N_ASSETS];
    signal input inValue[N_PARTIES][N_ASSETS];
    signal input inToken[N_PARTIES][N_ASSETS];
    signal input inSalt[N_PARTIES][N_ASSETS];
    signal input inSk[N_PARTIES];
    signal input inIsActive[N_PARTIES][N_ASSETS];

    signal input outPkX[N_PARTIES][N_ASSETS];
    signal input outPkY[N_PARTIES][N_ASSETS];
    signal input outValue[N_PARTIES][N_ASSETS];
    signal input outToken[N_PARTIES][N_ASSETS];
    signal input outSalt[N_PARTIES][N_ASSETS];
    signal input outIsActive[N_PARTIES][N_ASSETS];

    signal input swapMatrix[N_PARTIES][N_PARTIES][N_ASSETS];

    // ===== Component Declarations =====
    component partyOwnership[N_PARTIES];
    component inNote[N_PARTIES][N_ASSETS];
    component outNote[N_PARTIES][N_ASSETS];
    component configHash;

    // ===== Verify Input Notes =====
    for (var p = 0; p < N_PARTIES; p++) {
        // Verify party's ownership once (using first active note's pk)
        partyOwnership[p] = ProofOfOwnershipStrict();
        partyOwnership[p].sk <== inSk[p];
        partyOwnership[p].pkX <== inPkX[p][0];
        partyOwnership[p].pkY <== inPkY[p][0];

        for (var a = 0; a < N_ASSETS; a++) {
            // Verify input note hash
            inNote[p][a] = PoseidonRegularNote();
            inNote[p][a].pkX <== inPkX[p][a];
            inNote[p][a].pkY <== inPkY[p][a];
            inNote[p][a].value <== inValue[p][a];
            inNote[p][a].tokenType <== inToken[p][a];
            inNote[p][a].salt <== inSalt[p][a];

            // Hash must match if active
            (inNote[p][a].out - inputHashes[p][a]) * inIsActive[p][a] === 0;

            // All active inputs must belong to same party
            (inPkX[p][a] - inPkX[p][0]) * inIsActive[p][a] === 0;
            (inPkY[p][a] - inPkY[p][0]) * inIsActive[p][a] === 0;
        }
    }

    // ===== Verify Output Notes =====
    for (var p = 0; p < N_PARTIES; p++) {
        for (var a = 0; a < N_ASSETS; a++) {
            outNote[p][a] = PoseidonRegularNote();
            outNote[p][a].pkX <== outPkX[p][a];
            outNote[p][a].pkY <== outPkY[p][a];
            outNote[p][a].value <== outValue[p][a];
            outNote[p][a].tokenType <== outToken[p][a];
            outNote[p][a].salt <== outSalt[p][a];

            (outNote[p][a].out - outputHashes[p][a]) * outIsActive[p][a] === 0;
        }
    }

    // ===== Verify Value Conservation per Asset =====
    for (var a = 0; a < N_ASSETS; a++) {
        var totalIn = 0;
        var totalOut = 0;
        for (var p = 0; p < N_PARTIES; p++) {
            totalIn += inValue[p][a] * inIsActive[p][a];
            totalOut += outValue[p][a] * outIsActive[p][a];
        }
        totalIn === totalOut;
    }

    // ===== Verify Swap Configuration =====
    for (var receiver = 0; receiver < N_PARTIES; receiver++) {
        for (var a = 0; a < N_ASSETS; a++) {
            var expectedValue = 0;
            for (var sender = 0; sender < N_PARTIES; sender++) {
                expectedValue += swapMatrix[sender][receiver][a];
            }
            outValue[receiver][a] * outIsActive[receiver][a] === expectedValue;
        }
    }

    // ===== Verify Swap Config Commitment =====
    configHash = Poseidon(N_PARTIES * N_PARTIES * N_ASSETS);
    var idx = 0;
    for (var i = 0; i < N_PARTIES; i++) {
        for (var j = 0; j < N_PARTIES; j++) {
            for (var a = 0; a < N_ASSETS; a++) {
                configHash.inputs[idx] <== swapMatrix[i][j][a];
                idx++;
            }
        }
    }
    configHash.out === swapConfigHash;
}

component main {public [inputHashes, outputHashes, swapConfigHash]} =
    MultiAssetAtomicSwap(4, 5);  // 4 parties, 5 asset types
```

### Key Constraints

1. **Ownership Verification**: Each party proves ownership of all their input notes
2. **Per-Asset Conservation**: Total input equals total output for each asset type
3. **Swap Matrix Compliance**: Output values match expected receives from swap matrix
4. **Configuration Binding**: Swap matrix hash prevents post-commitment changes

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Party Impersonation** | Each party must prove ownership with their secret key |
| **Swap Matrix Tampering** | Configuration hash committed on-chain before execution |
| **Partial Execution** | All-or-nothing atomic execution; no partial states |
| **Front-Running** | Swap config hash hides amounts until execution |
| **Replay Attack** | Input notes are spent (nullified); cannot reuse |
| **Collusion Among Parties** | Circuit only enforces agreed terms; off-chain coordination required |
| **Dust Attacks** | Minimum value thresholds per asset type |

## Implementation Challenges

1. **Multi-Party Coordination**
   - All parties must agree on swap terms off-chain
   - Each party must provide their secret key material to prover
   - Consider MPC (Multi-Party Computation) for distributed proving without key sharing

2. **Swap Discovery**
   - How do N parties find each other with compatible wants?
   - Intent-based matching engine needed
   - Graph-based "want" matching algorithm (find cycles in desire graph)

3. **Timeout and Cancellation**
   - What if one party goes offline before proof generation?
   - Need timeout mechanism to release locked intents
   - Partial refund logic if swap cannot complete

4. **Constraint Explosion**
   - N_PARTIES * N_ASSETS^2 scales poorly
   - For 4 parties, 5 assets: 4*5*5 = 100 swap matrix entries
   - Consider sparse matrix representation for efficiency

5. **Gas Cost for Large Swaps**
   - Public inputs grow with parties and assets
   - calldata: 32 * (N_PARTIES * N_ASSETS * 2 + 1) bytes
   - May need input aggregation for very large swaps

## Use Cases

1. **DEX Multi-Leg Trades**
   - Alice gives ETH to Bob, Bob gives DAI to Charlie, Charlie gives USDC to Alice
   - All settle atomically with no intermediate exposure
   - Eliminates sequential swap MEV extraction

2. **OTC Desk Replacement**
   - Institutional parties trade large blocks without trusted intermediary
   - Settlement in seconds vs. T+2 traditional
   - No counterparty credit risk

3. **Portfolio Swap**
   - Rebalancing between fund managers
   - Manager A trades tech stocks for commodities with Manager B
   - Multiple asset types in single atomic operation

4. **Cross-Margining Settlement**
   - Close positions across multiple perpetual contracts
   - Net settlement reduces capital requirements
   - Atomic to prevent partial liquidations

5. **Triangular Arbitrage**
   - Exploit price discrepancies across three pairs
   - Execute all three legs atomically
   - Profit only realized if all legs succeed

## Real-World Products & User Experience

See [Real-World Products & User Experience](../product/high-complexity/hc2-multi-asset-atomic-swap-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
