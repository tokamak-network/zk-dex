# H2. HTLC Atomic Swap

Hash Time-Locked Contracts enabling trustless cross-chain exchange with zero-knowledge proofs hiding swap amounts and participants.

**Requirements**: HTLC contract on each chain | Timelock coordination | ZK proof of preimage knowledge

---

## Background

Atomic swaps solve the fundamental problem of trustless exchange across separate blockchains:

- **Counterparty Risk**: Traditional cross-chain trades require trusting the counterparty or an escrow service
- **Intermediary Fees**: Centralized exchanges and bridges extract significant fees for cross-chain services
- **Privacy Exposure**: Standard HTLCs reveal swap amounts, participants, and timing on both chains
- **MEV Vulnerability**: Visible pending swaps can be front-run or sandwich attacked

Hash Time-Locked Contracts (HTLCs) use cryptographic hash locks and timelocks to ensure atomicity: either both legs of a swap complete, or neither does. By integrating zero-knowledge proofs, we can hide:
- The amounts being swapped
- The identities of swap participants
- The relationship between transactions on different chains

For ZK-DEX, this enables private cross-chain trading without trusted intermediaries.

## Technical Specification

### Architecture Overview

```
Chain A (e.g., Bitcoin)                    Chain B (ZK-DEX)
+------------------------+                 +------------------------+
|                        |                 |                        |
|  HTLC Contract         |                 |  ZK-HTLC Contract      |
|  +------------------+  |                 |  +------------------+  |
|  | hashLock: H(s)   |  |                 |  | commitment: C    |  |
|  | timelock: T1     |  |  Preimage 's'   |  | timelock: T2     |  |
|  | amount: visible  |  | <=============> |  | amount: hidden   |  |
|  | sender: Alice    |  |                 |  | sender: hidden   |  |
|  | receiver: Bob    |  |                 |  | receiver: hidden |  |
|  +------------------+  |                 |  +------------------+  |
|                        |                 |                        |
+------------------------+                 +------------------------+
        |                                           |
        | Reveal 's' to claim                       | ZK proof of
        | (links chains)                            | preimage knowledge
        v                                           v
   Bob claims on A                            Alice claims on B
```

### Component List

| Component | Description |
|-----------|-------------|
| **HTLC Contract (Chain A)** | Standard hash-locked contract holding assets |
| **ZK-HTLC Contract (Chain B)** | Privacy-preserving HTLC using commitments |
| **Preimage Generator** | Creates random secret for hash lock |
| **ZK Preimage Circuit** | Proves knowledge of preimage without revealing it |
| **Timelock Coordinator** | Ensures safe timelock differentials across chains |

### Data Flows

1. **Swap Initiation**
   - Alice (initiator) generates random secret `s`, computes `H(s)`
   - Alice locks funds in HTLC on Chain A with `hashLock = H(s)`, `timelock = T1`
   - Bob verifies HTLC on Chain A is correctly funded

2. **Counterparty Lock**
   - Bob creates ZK-HTLC on Chain B (ZK-DEX)
   - Commitment `C` hides amount and participants
   - Same `hashLock = H(s)`, shorter `timelock = T2 < T1`

3. **Claim Phase**
   - Alice generates ZK proof of knowing `s` such that `H(s) = hashLock`
   - Submits proof to ZK-HTLC on Chain B to claim (no `s` revealed on-chain)
   - Alice privately reveals `s` to Bob off-chain (or through ZK relay)

4. **Completion**
   - Bob uses `s` to claim from HTLC on Chain A
   - Swap complete; on-chain observers cannot link A and B transactions

### ZK Preimage Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template HTLCPreimageProof() {
    // Public inputs
    signal input hashLock;        // H(s) - the hash lock
    signal input nullifier;       // Prevents double-claim
    signal input recipientCommit; // Commitment to recipient

    // Private inputs
    signal input preimage;        // The secret 's'
    signal input recipientPk;     // Recipient public key
    signal input salt;            // Randomness for commitments

    // Verify preimage hashes to hashLock
    component hasher = Poseidon(1);
    hasher.inputs[0] <== preimage;
    hasher.out === hashLock;

    // Verify recipient commitment
    component recipCommit = Poseidon(2);
    recipCommit.inputs[0] <== recipientPk;
    recipCommit.inputs[1] <== salt;
    recipCommit.out === recipientCommit;

    // Compute nullifier (prevents double-spend)
    component nullHash = Poseidon(2);
    nullHash.inputs[0] <== preimage;
    nullHash.inputs[1] <== recipientPk;
    // Nullifier verified externally
}

component main {public [hashLock, nullifier, recipientCommit]} = HTLCPreimageProof();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Trustlessness** | No intermediary required; cryptographic guarantees ensure atomicity |
| **Privacy** | ZK proofs hide amounts, participants, and cross-chain linkage |
| **Censorship Resistance** | Peer-to-peer swaps; no centralized chokepoint |
| **Cost Efficiency** | Only gas costs; no exchange fees or bridge premiums |
| **Finality** | Deterministic completion; no probabilistic settlement |
| **Cross-Chain MEV** | Swap details hidden; front-running prevented |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Timelock Race** | Ensure T1 >> T2 with sufficient margin for blockchain delays |
| **Preimage Withholding** | Initiator incentivized to reveal; loses funds otherwise |
| **Chain Reorganization** | Wait for sufficient confirmations before revealing preimage |
| **Hash Function Weakness** | Use collision-resistant, preimage-resistant hash (Poseidon, SHA-256) |
| **Griefing Attack** | Initiator can lock counterparty funds temporarily; require reputation or bonds |
| **Network Delays** | Conservative timelock margins; monitoring infrastructure |

## Implementation Challenges

1. **Timelock Coordination**
   - Different chains have different block times and finality
   - Must account for worst-case network delays
   - Cross-chain time synchronization is imprecise
   - Recommendation: T1 should be at least 2x T2

2. **Preimage Relay Privacy**
   - Standard HTLCs reveal preimage on-chain, linking swaps
   - Need secure off-chain channel or ZK relay for preimage transfer
   - Consider using encrypted preimage with recipient's key

3. **Liquidity Discovery**
   - Finding swap counterparties without centralized orderbook
   - Need privacy-preserving peer discovery (onion routing, mixnets)
   - Decentralized swap coordination protocols needed

4. **Multi-Hop Routing**
   - Direct swaps require finding exact counterparty
   - Payment channel networks can route through intermediaries
   - Each hop adds latency and timelock requirements

5. **Failed Swap Recovery**
   - If swap fails mid-way, funds locked until timelock expiry
   - User experience degraded by long wait times
   - Consider faster cancellation with mutual consent

## Derivatives

1. **Multi-Hop Swaps** - Route swaps through intermediary nodes like Lightning Network. Enables swapping between any pair of assets through liquidity providers. Each hop uses chained HTLCs with decreasing timelocks.

2. **Time-Locked Swaps** - Swaps that only execute within specific time windows. Useful for scheduled trades or conditional execution. Combines HTLC with additional time constraints.

3. **Partial Swaps** - Allow partial fills of swap orders. If counterparty only has partial liquidity, swap completes for available amount. Requires divisible HTLC design with multiple preimages.

4. **Swap Aggregation** - Batch multiple small swaps into single atomic operation. Reduces per-swap overhead and enables better price discovery. Coordinator matches compatible swaps off-chain.

5. **Cross-Chain DEX** - Full decentralized exchange using HTLCs for settlement. Orderbook can be on any chain; settlement happens cross-chain. Privacy preserved through ZK-HTLCs on both sides.

## Use Cases

1. **Bitcoin to ZK-DEX Swap**
   - Alice wants to trade BTC for private tokens on ZK-DEX
   - Creates HTLC on Bitcoin with hashlock
   - Bob creates ZK-HTLC on ZK-DEX
   - Alice claims privately using ZK proof
   - Bob claims BTC; no on-chain link between transactions

2. **Private OTC Trading**
   - Two institutions want to execute large trade
   - Neither wants to reveal trading relationship
   - HTLC ensures atomicity; ZK proofs hide identities
   - Trade appears as unrelated transactions on each chain

3. **Decentralized Stablecoin Gateway**
   - User wants to on-ramp USDC to private ZK-DEX position
   - Market makers offer HTLC swaps from Ethereum USDC
   - User gets private stable notes without KYC'ed on-ramp
   - Market makers earn spread; no trusted bridge

4. **Cross-Chain Arbitrage**
   - Price differs between Ethereum DEX and ZK-DEX
   - Arbitrageur executes simultaneous swaps using HTLCs
   - Atomicity prevents execution risk
   - Privacy prevents copycat strategies

## Real-World Products & User Experience

### 1. "체인 연결 끊기" - 크로스체인 거래 링크 차단 서비스

**제품 설명**:
ZK-HTLC를 사용해 두 체인의 거래가 연결되지 않도록 하는 프라이버시 스왑. 일반 HTLC는 같은 해시로 두 체인 거래가 연결되어 추적됩니다.

**일반 사용자 경험**:
- 최민수씨(31세)는 비트코인을 ZK-DEX 토큰으로 교환하려 함
- 일반 HTLC: 같은 preimage가 양쪽 체인에 공개되어 거래 연결됨
- ZK-HTLC: preimage 지식을 ZK로 증명, 체인에 공개하지 않음
- 비트코인 거래와 ZK-DEX 거래가 별개 거래로 보임
- 블록체인 분석가도 민수씨의 크로스체인 활동을 추적 불가

**관찰 가능한 이점**:
- 두 체인 간 거래 연결고리 완전 차단
- 크로스체인 자산 흐름 추적 방지
- 거래 상대방에게도 다른 체인 활동 숨김

### 2. "비밀 크로스체인 OTC" - 대량 거래 완전 비공개

**제품 설명**:
대량의 크로스체인 스왑을 실행할 때 거래 금액, 참여자, 타이밍이 모두 숨겨지는 기관급 프라이버시 서비스.

**일반 사용자 경험**:
- 정예진씨(35세)는 $500,000 규모의 ETH를 BTC로 교환하려 함
- 일반 스왑: "이 지갑이 대량 스왑했다"가 양쪽 체인에 공개
- 비밀 OTC: 금액이 commitment로 숨겨지고, ZK로 정확한 교환 증명
- 양쪽 체인에서 거래 금액이 보이지 않음
- 예진씨가 대량 거래자라는 사실 자체가 비공개

**관찰 가능한 이점**:
- 거래 규모가 시장에 노출되지 않아 가격 영향 없음
- "고래" 라벨링 및 추적 방지
- 거래 상대방에게도 자산 규모 비공개

### 3. "프라이빗 온램프" - 투명 자산을 프라이빗하게 전환

**제품 설명**:
공개 체인의 스테이블코인을 ZK-DEX의 프라이빗 자산으로 전환할 때, 전환 과정 자체도 숨겨지는 서비스.

**일반 사용자 경험**:
- 박현우씨(27세)는 USDC 급여를 프라이빗하게 관리하고 싶음
- 일반 브릿지: "현우씨가 USDC를 프라이빗 체인으로 보냈다" 공개
- 프라이빗 온램프: HTLC로 교환하되, 연결고리 없이 전환
- 이더리움에서는 "누군가에게 USDC 전송", ZK-DEX에서는 "새로운 프라이빗 자산"
- 두 이벤트가 연결되지 않아 프라이버시 전환 자체가 숨겨짐

**관찰 가능한 이점**:
- 프라이버시 체인으로의 이동 자체가 비공개
- "이 사람이 프라이버시를 원한다"는 신호 숨김
- 프라이빗 자산과 공개 자산 간 연결 차단

---

[Back to Index](../../README.md)
