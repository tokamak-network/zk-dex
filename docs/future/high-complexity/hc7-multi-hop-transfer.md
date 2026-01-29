# HC7. Multi-Hop Private Transfer

Route payment through multiple intermediaries without any seeing the full path.

**Constraints**: ~400K | **Complexity**: High

---

## Background

Private payment networks face trade-offs:
- Lightning Network reveals full path to sender
- Onion routing still requires online intermediaries
- Privacy often requires trusted relayers
- Path fees are unpredictable

**Why current approaches are insufficient:**

| Approach | Limitation |
|----------|------------|
| Lightning Network | Sender knows full path; intermediaries see amounts |
| Tornado Cash | Only single-hop; no routing capability |
| zkSync transfers | Direct only; no multi-hop privacy |
| Traditional onion routing | Requires online nodes; timing attacks possible |

Multi-hop private transfer enables trustless payment routing with cryptographic path privacy. The ZK proof ensures correct routing without revealing path details.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sourceNoteHash` | field | Commitment to source payment note |
| `destNoteHash` | field | Commitment to destination receipt note |
| `routeCommitment` | field | Hash of full route (for auditing) |
| `totalFees` | uint | Total fees paid to intermediaries |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sourcePkX/Y, sourceSk` | field | Sender credentials |
| `sourceValue, sourceToken, sourceSalt` | field | Source note details |
| `hopPkX/Y, hopValue, hopSalt, hopFee` | arrays | Intermediate hop details |
| `destPkX/Y, destValue, destSalt` | field | Recipient details |

### Circuit Logic

## Effects

| Aspect | Impact |
|--------|--------|
| **Path Privacy** | No single entity knows full route |
| **Trustless** | No trusted relayers required |
| **Atomicity** | All hops succeed or all fail |
| **Fee Transparency** | Fees locked at route creation |
| **Offline Support** | Intermediaries can be offline during proof |
| **MEV Resistance** | Route hidden from observers |

## Derivatives

1. **Multi-Path Routing** - Split payment across multiple routes for better privacy and liquidity. Each path carries fraction of total. Receiver aggregates. Adds redundancy if one path fails.

2. **Probabilistic Routing** - Random path selection for maximum privacy. Multiple valid paths; prover chooses randomly. Prevents pattern analysis across payments.

3. **Onion-Routed Hops** - Each hop only knows prev/next using layered encryption. Requires nested encryption scheme. True source and destination hidden from intermediaries.

4. **Rebalancing Hops** - Payment route doubles as channel rebalancing. Intermediaries gain/lose balance strategically. Incentivizes optimal route selection.

5. **Conditional Hops** - Hops only execute if condition met (e.g., price oracle). Enables complex payment conditions. Cross-chain atomic swaps possible.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template MultiHopTransfer(N_HOPS) {
    // ===== Public Inputs =====
    signal input sourceNoteHash;
    signal input destNoteHash;
    signal input routeCommitment;
    signal input totalFees;

    // ===== Private Inputs =====
    signal input sourcePkX, sourcePkY, sourceSk;
    signal input sourceValue, sourceToken, sourceSalt;

    signal input hopPkX[N_HOPS], hopPkY[N_HOPS];
    signal input hopInValue[N_HOPS];   // Value received at each hop
    signal input hopOutValue[N_HOPS];  // Value forwarded (after fee)
    signal input hopSalt[N_HOPS];
    signal input hopFee[N_HOPS];
    signal input hopIsActive[N_HOPS];  // Support variable hop count

    signal input destPkX, destPkY;
    signal input destValue, destSalt;

    // ===== Component Declarations =====
    component sourceNote;
    component sourceOwnership;
    component hopInNote[N_HOPS];
    component hopOutNote[N_HOPS];
    component feeCheck[N_HOPS];
    component destNote;
    component routeHash;

    // ===== Verify Source Note =====
    sourceNote = PoseidonRegularNote();
    sourceNote.pkX <== sourcePkX;
    sourceNote.pkY <== sourcePkY;
    sourceNote.value <== sourceValue;
    sourceNote.tokenType <== sourceToken;
    sourceNote.salt <== sourceSalt;
    sourceNote.out === sourceNoteHash;

    // Source ownership proof
    sourceOwnership = ProofOfOwnershipStrict();
    sourceOwnership.sk <== sourceSk;
    sourceOwnership.pkX <== sourcePkX;
    sourceOwnership.pkY <== sourcePkY;

    // ===== Verify Hop Chain =====
    // First hop receives from source
    signal prevOutValue[N_HOPS + 1];
    prevOutValue[0] <== sourceValue;

    for (var i = 0; i < N_HOPS; i++) {
        // Hop receives value from previous
        hopInValue[i] * hopIsActive[i] === prevOutValue[i] * hopIsActive[i];

        // Fee deduction: outValue = inValue - fee
        feeCheck[i] = LessThan(64);
        feeCheck[i].in[0] <== hopFee[i];
        feeCheck[i].in[1] <== hopInValue[i] + 1;  // Fee cannot exceed input
        feeCheck[i].out * hopIsActive[i] === hopIsActive[i];

        hopOutValue[i] === hopInValue[i] - hopFee[i];

        // Create intermediate notes (for each hop's ownership)
        hopInNote[i] = PoseidonRegularNote();
        hopInNote[i].pkX <== hopPkX[i];
        hopInNote[i].pkY <== hopPkY[i];
        hopInNote[i].value <== hopInValue[i];
        hopInNote[i].tokenType <== sourceToken;
        hopInNote[i].salt <== hopSalt[i];

        // Pass value to next hop
        prevOutValue[i + 1] <== hopOutValue[i];
    }

    // ===== Verify Value Conservation =====
    var computedTotalFees = 0;
    for (var i = 0; i < N_HOPS; i++) {
        computedTotalFees += hopFee[i] * hopIsActive[i];
    }
    computedTotalFees === totalFees;
    destValue === sourceValue - totalFees;

    // ===== Verify Destination Note =====
    destNote = PoseidonRegularNote();
    destNote.pkX <== destPkX;
    destNote.pkY <== destPkY;
    destNote.value <== destValue;
    destNote.tokenType <== sourceToken;
    destNote.salt <== destSalt;
    destNote.out === destNoteHash;

    // ===== Route Commitment =====
    routeHash = Poseidon(N_HOPS * 2 + 4);
    routeHash.inputs[0] <== sourcePkX;
    routeHash.inputs[1] <== sourcePkY;
    for (var i = 0; i < N_HOPS; i++) {
        routeHash.inputs[2 + i * 2] <== hopPkX[i];
        routeHash.inputs[2 + i * 2 + 1] <== hopPkY[i];
    }
    routeHash.inputs[N_HOPS * 2 + 2] <== destPkX;
    routeHash.inputs[N_HOPS * 2 + 3] <== destPkY;
    routeHash.out === routeCommitment;
}

component main {public [sourceNoteHash, destNoteHash, routeCommitment, totalFees]} =
    MultiHopTransfer(5);
```

### Key Constraints

1. **Source Ownership**: Sender proves they own the source note
2. **Hop Chain Validity**: Each hop receives exactly what the previous sent
3. **Fee Deduction**: Each hop deducts fee from forwarded amount
4. **Value Conservation**: Source value = dest value + total fees
5. **Route Integrity**: Route commitment binds the exact path

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Path Discovery** | Route commitment hashed; individual hops not revealed |
| **Intermediary Collusion** | Each hop only knows neighbors; full path requires all hops |
| **Fee Extraction** | Fees committed at route creation; cannot increase mid-route |
| **Replay Attacks** | Source note nullified; cannot reuse same route |
| **Timing Analysis** | All hops settled atomically; no timing correlation |
| **Value Correlation** | Consider padding to standard amounts |
| **Hop Withholding** | Atomic settlement; all succeed or all fail |

## Implementation Challenges

1. **Route Discovery**
   - How does sender find path to recipient?
   - Need routing table or pathfinding service
   - Consider gossip protocol for route discovery
   - Balance between privacy and efficiency

2. **Intermediary Incentives**
   - Why would intermediaries participate?
   - Fee compensation must exceed opportunity cost
   - Consider liquidity provider rewards
   - Market-based fee discovery

3. **Offline Intermediaries**
   - Traditional routing requires online nodes
   - ZK approach: pre-committed routes
   - Fallback routes if primary fails
   - Expiration for stale routes

4. **Liquidity Requirements**
   - Each hop needs sufficient balance
   - Liquidity fragmentation across routes
   - Rebalancing circuits can help
   - Consider liquidity pools

5. **Variable Hop Count**
   - Circuit compiled for fixed N_HOPS
   - Shorter routes use inactive hop padding
   - Longer routes need larger circuit
   - Consider recursive proofs for dynamic length

## Use Cases

1. **Privacy-Preserving Payments**
   - Send payment through 5 intermediaries
   - Like Lightning Network but with full path privacy
   - No intermediary knows source or destination

2. **Anonymous Donations**
   - Donate to cause without revealing identity
   - Multiple hops obscure origin
   - Recipient cannot trace back

3. **Corporate Treasury Transfers**
   - Move funds between subsidiaries
   - Path privacy prevents competitive intelligence
   - Audit trail via route commitment

4. **Cross-Border Remittances**
   - Route through multiple jurisdictions
   - Comply with local regulations via route selection
   - Lower fees than traditional corridors

5. **DEX Arbitrage Obscuring**
   - Hide arbitrage routes from competitors
   - Prevent copy-trading of strategies
   - Maintain trading edge

## Real-World Products & User Experience

See [Real-World Products & User Experience](../../product/high-complexity/hc7-multi-hop-transfer-products.md) for detailed product scenarios and use cases.

---

[Back to Index](../README.md)
