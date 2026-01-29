# H1. ZK Light Client Bridge

Trustless cross-chain bridges using zero-knowledge proofs to verify source chain consensus without running full nodes.

**Requirements**: ZK-SNARK verifier contract | Consensus proof circuits | Header relay infrastructure

---

## Background

Cross-chain interoperability is essential for DeFi composability, but current bridge designs face significant challenges:

- **Trust Assumptions**: Most bridges rely on multisig committees or trusted validators, creating centralization risks and single points of failure
- **Full Node Requirements**: Trustless verification traditionally requires running full nodes for each connected chain, which is expensive and impractical
- **Finality Delays**: Waiting for deep confirmations to ensure security creates poor user experience
- **Bridge Exploits**: Over $2 billion lost to bridge hacks in 2022-2023, primarily due to trusted intermediary failures

ZK light clients solve these problems by using zero-knowledge proofs to verify blockchain consensus. A light client can verify that a block header is valid by checking a proof that the consensus rules were followed, without processing all transactions or storing the full state.

For ZK-DEX, this enables:
- Trustless deposits from other chains
- Private cross-chain transfers without exposing amounts
- Atomic cross-chain swaps with privacy preservation

## Technical Specification

### Architecture Overview

```
Source Chain                    Bridge Infrastructure                 ZK-DEX Chain
+------------+                  +------------------+                  +------------+
|            |   Headers        |                  |    ZK Proof      |            |
| Blockchain | --------------> | Header Relayer   | --------------> | Light      |
|   Node     |                  |                  |                  | Client     |
+------------+                  +------------------+                  | Contract   |
      |                                |                              +------------+
      |                         +------------------+                        |
      |  Consensus Data         |                  |                        |
      +----------------------> | Proof Generator  |                        |
                               | (Off-chain)      |                        |
                               +------------------+                        |
                                                                           v
                                                               +------------------+
                                                               | Deposit/Bridge   |
                                                               | Contract         |
                                                               +------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Header Relayer** | Monitors source chain, submits headers and consensus data to proof generator |
| **Proof Generator** | Off-chain service generating ZK proofs of consensus validity |
| **Light Client Contract** | On-chain verifier maintaining verified header chain |
| **Bridge Contract** | Handles deposits/withdrawals based on verified headers |
| **Consensus Circuit** | ZK circuit proving source chain consensus rules |

### Data Flows

1. **Header Submission Flow**
   - Relayer fetches latest finalized block headers from source chain
   - Consensus data (validator signatures, attestations) collected
   - Proof generator creates ZK proof of header validity
   - Proof submitted to light client contract for verification

2. **Deposit Verification Flow**
   - User deposits assets on source chain
   - Merkle proof of deposit transaction generated
   - ZK proof created combining header validity + transaction inclusion
   - ZK-DEX mints private notes upon proof verification

### Consensus Proof Types

| Source Chain Type | Proof Strategy |
|-------------------|----------------|
| **PoW (Ethereum pre-merge)** | Prove accumulated difficulty, header chain linking |
| **PoS (Ethereum)** | Prove sync committee signatures, BLS aggregation |
| **Tendermint (Cosmos)** | Prove 2/3+ validator signatures on commit |
| **Nakamoto (Bitcoin)** | Prove header chain with sufficient work |

## Effects

| Aspect | Impact |
|--------|--------|
| **Trust Model** | Eliminates reliance on trusted intermediaries; security equals source chain |
| **Capital Efficiency** | No over-collateralization needed; direct 1:1 asset bridging |
| **Privacy** | Bridge amounts can be hidden using commitment schemes |
| **Latency** | Verification possible after single finalized block (vs. waiting for deep confirmations) |
| **Gas Costs** | ~300K-500K gas per proof verification; amortized via batching |
| **Decentralization** | Anyone can run relayers; no permissioned validator set |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Circuit Bugs** | Formal verification of consensus circuits; multiple audit rounds |
| **Reorganization Attacks** | Wait for sufficient finality; economic finality thresholds |
| **Header Withholding** | Multiple independent relayers; incentivized submission |
| **Proof Malleability** | Use binding commitment schemes; verify proof uniqueness |
| **Long-Range Attacks (PoS)** | Social consensus checkpoints; weak subjectivity bounds |
| **Griefing Attacks** | Require relayer bonds; slash for invalid submissions |

## Implementation Challenges

1. **Consensus Circuit Complexity**
   - Ethereum PoS sync committee verification requires BLS signature aggregation
   - BLS12-381 pairing operations are expensive in circuits (~millions of constraints)
   - Consider using specialized proof systems (e.g., Halo2 with custom gates)

2. **Cross-Chain Finality Semantics**
   - Different chains have different finality guarantees
   - Need clear mapping of "final" on source to "verified" on destination
   - Consider probabilistic vs. deterministic finality models

3. **Proof Generation Latency**
   - Consensus proofs may take minutes to generate
   - Real-time bridging requires optimistic modes with dispute windows
   - Prover network needed for redundancy and speed

4. **Header Synchronization**
   - Light client must track header chain without gaps
   - Catching up after downtime requires proving historical headers
   - Consider checkpoint systems for faster sync

5. **Multi-Chain Scaling**
   - Each source chain needs specialized consensus circuits
   - Verification costs multiply with number of connected chains
   - Aggregated multi-chain proofs could amortize costs

## Derivatives

1. **Multi-Chain Light Clients** - Single contract verifying headers from multiple source chains using unified proof format. Reduces deployment overhead and enables atomic multi-chain operations. Requires abstracting consensus differences into common interface.

2. **Fraud-Proof Fallback** - Hybrid mode where headers are optimistically accepted with challenge window. Reduces latency for common case while maintaining security through fraud proofs. ZK proofs generated on-demand during disputes.

3. **Fast Finality Bridges** - Pre-confirmation network providing instant bridging backed by staked validators. ZK light client settles final state; pre-confirmations provide UX. Slashing ensures economic security of fast path.

4. **Bidirectional Bridges** - Full two-way bridging where both chains run light clients of each other. Enables symmetric operations without asymmetric trust. Requires light client deployment on source chain.

5. **Light Client Aggregation** - Multiple independent light client implementations verify same headers. Consensus among implementations provides defense-in-depth. Different proof systems reduce common-mode failures.

## Use Cases

1. **Trustless ETH Bridging**
   - User wants to trade ETH on ZK-DEX without trusting bridge operators
   - Deposits ETH to bridge contract on Ethereum mainnet
   - ZK light client verifies Ethereum header containing deposit
   - Private zkETH note minted on ZK-DEX
   - User trades with full Ethereum security guarantees

2. **Cross-Chain Arbitrage**
   - Price discrepancy between Ethereum DEX and ZK-DEX
   - Arbitrageur bridges assets trustlessly using light client
   - Executes trades on both sides privately
   - Bridges profits back; all movements verified by ZK proofs
   - No trusted party can front-run or censor

3. **Multi-Chain Portfolio**
   - Institutional user holds assets across Ethereum, Polygon, and ZK-DEX
   - Light clients enable verified view of all positions
   - Cross-chain rebalancing executed atomically
   - Single interface with trustless verification of all chains

4. **DeFi Composability**
   - Protocol on ZK-DEX needs Ethereum price feeds
   - Light client verifies Ethereum state including Chainlink prices
   - Oracle data provably fresh and authentic
   - Enables private DeFi with transparent chain data

## Real-World Products & User Experience

See: [H1. ZK Light Client Bridge - Real-World Products](../../../product/h-cross-chain/h1-light-client-products.md)

---

[Back to Index](../../README.md)
