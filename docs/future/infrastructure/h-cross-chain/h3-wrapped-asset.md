# H3. Wrapped Asset Bridge

Privacy-preserving wrapped token infrastructure enabling cross-chain asset representation with hidden bridged amounts and ownership.

**Requirements**: Lock-and-mint contracts | Burn-and-release mechanism | ZK commitment scheme for wrapped tokens

---

## Background

Wrapped assets are fundamental to cross-chain DeFi, but current implementations have critical limitations:

- **Transparency Exposure**: Standard wrapped tokens (WBTC, WETH) reveal exact holdings and all transfers
- **Centralized Custodians**: Most wrapped assets rely on trusted custodians holding the underlying
- **Audit Complexity**: Proving reserves requires trust in custodian attestations
- **Privacy Leakage**: Wrapping/unwrapping transactions reveal user intentions and portfolio composition

Privacy-preserving wrapped assets solve these problems by:
- Using ZK proofs to verify proper collateralization without revealing amounts
- Enabling private transfers of wrapped assets
- Allowing proof of reserves without exposing individual holdings

For ZK-DEX, this enables users to bring assets from any chain while maintaining full privacy.

## Technical Specification

### Architecture Overview

```
Source Chain                              ZK-DEX Chain
+------------------------+                +---------------------------+
|                        |                |                           |
|  User Wallet           |                |  Private Wrapped Asset    |
|       |                |                |                           |
|       v                |                |  +---------------------+  |
|  +------------+        |   ZK Proof     |  |  Note Commitment    |  |
|  | Lock       | -------|--------------> |  |  (amount hidden)    |  |
|  | Contract   |        |                |  +---------------------+  |
|  +------------+        |                |           |               |
|       |                |                |           v               |
|       v                |                |  +---------------------+  |
|  Collateral Pool       |                |  |  Private Transfers  |  |
|  (transparent)         |                |  |  (ZK-DEX trading)   |  |
|                        |                |  +---------------------+  |
+------------------------+                |           |               |
        ^                                 |           v               |
        |                                 |  +---------------------+  |
        |           Burn Proof            |  |  Burn & Withdraw    |  |
        +<--------------------------------|  |  Request            |  |
                                          |  +---------------------+  |
                                          +---------------------------+
```

### Component List

| Component | Description |
|-----------|-------------|
| **Lock Contract** | Holds collateral on source chain; emits lock events |
| **Mint Circuit** | ZK proof that lock occurred; creates private wrapped note |
| **Wrapped Note** | Privacy-preserving representation of underlying asset |
| **Burn Circuit** | ZK proof of note ownership; authorizes withdrawal |
| **Release Contract** | Processes verified burn proofs; releases collateral |
| **Reserve Prover** | Generates aggregate reserve proofs without exposing individual positions |

### Data Flows

1. **Wrapping (Deposit) Flow**
   - User sends assets to Lock Contract on source chain
   - Lock event emitted with commitment (hides amount)
   - ZK proof generated linking lock to note creation
   - Private wrapped note minted on ZK-DEX
   - User can trade privately with wrapped assets

2. **Unwrapping (Withdrawal) Flow**
   - User creates burn request with ZK proof of note ownership
   - Note nullified on ZK-DEX
   - Burn proof verified by Release Contract
   - Underlying assets sent to user's address

3. **Reserve Verification Flow**
   - Prover aggregates all active wrapped notes
   - Generates ZK proof: sum(notes) <= locked_collateral
   - Anyone can verify reserves without seeing individual holdings

### Wrapped Note Circuit

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/merkle/merkle_proof.circom";

template WrapAsset() {
    // Public inputs
    signal input lockCommitment;     // Commitment from lock event
    signal input wrappedNoteHash;    // Output wrapped note
    signal input nullifier;          // Prevents double-minting

    // Private inputs
    signal input amount;             // Locked amount (hidden)
    signal input lockSalt;           // Randomness in lock commitment
    signal input recipientPk;        // Recipient public key
    signal input noteSalt;           // Note randomness
    signal input chainId;            // Source chain identifier
    signal input lockTxData;         // Lock transaction reference

    // Verify lock commitment matches
    component lockHash = Poseidon(4);
    lockHash.inputs[0] <== amount;
    lockHash.inputs[1] <== lockSalt;
    lockHash.inputs[2] <== chainId;
    lockHash.inputs[3] <== lockTxData;
    lockHash.out === lockCommitment;

    // Create wrapped note with same amount
    component noteHash = Poseidon(4);
    noteHash.inputs[0] <== recipientPk;
    noteHash.inputs[1] <== amount;      // Same amount preserved
    noteHash.inputs[2] <== chainId;     // Track origin chain
    noteHash.inputs[3] <== noteSalt;
    noteHash.out === wrappedNoteHash;

    // Nullifier prevents replay
    component nullGen = Poseidon(2);
    nullGen.inputs[0] <== lockCommitment;
    nullGen.inputs[1] <== noteSalt;
    // Verified externally against nullifier set
}

component main {public [lockCommitment, wrappedNoteHash, nullifier]} = WrapAsset();
```

## Effects

| Aspect | Impact |
|--------|--------|
| **Privacy** | Wrapped amounts and ownership completely hidden |
| **Fungibility** | All wrapped notes indistinguishable; no tainted assets |
| **Composability** | Private wrapped assets usable in all ZK-DEX features |
| **Reserve Transparency** | Aggregate reserves verifiable; individual positions hidden |
| **Cross-Chain Liquidity** | Any chain's assets can be privately traded on ZK-DEX |
| **Custodian Trust** | Reduced through cryptographic verification; no blind trust |

## Security Considerations

| Risk | Mitigation |
|------|------------|
| **Lock Contract Exploit** | Formal verification; time-locked upgrades; bug bounties |
| **Double-Mint Attack** | Strict nullifier tracking; lock event uniqueness |
| **Collateral Insufficiency** | Real-time reserve proofs; automated monitoring |
| **Bridge Griefing** | Rate limiting; minimum lock amounts; fee structure |
| **Chain Reorganization** | Wait for deep finality before minting wrapped notes |
| **Withdrawal Censorship** | Decentralized relayer network; forced inclusion mechanisms |

## Implementation Challenges

1. **Cross-Chain Event Verification**
   - Need trustless proof that lock event occurred on source chain
   - Options: ZK light client (H1), oracle network, optimistic with fraud proofs
   - Latency vs. trust tradeoff in event verification

2. **Canonical Wrapped Asset**
   - Multiple bridges could create incompatible wrapped versions
   - Need standardization or liquidity fragmentation occurs
   - Consider unified canonical bridge or interoperability layer

3. **Withdrawal Liquidity**
   - Release contract needs sufficient liquidity for withdrawals
   - Large withdrawals may require batching or delays
   - Liquidity provider incentives needed

4. **Fee Economics**
   - Bridge operation has real costs (gas, relayers, provers)
   - Fee structure must be sustainable but competitive
   - Consider fee sharing with liquidity providers

5. **Multi-Asset Scaling**
   - Each asset type needs bridge deployment
   - Circuit parameters may vary by asset (decimals, value ranges)
   - Standardized wrapper interface reduces integration burden

## Derivatives

1. **Multi-Asset Wrapping** - Single bridge contract supporting multiple asset types. Unified interface for wrapping any ERC-20. Reduces deployment costs and simplifies integration.

2. **Canonical Bridges** - Governance-approved primary bridge per asset. Ensures single wrapped representation; prevents fragmentation. Community-controlled through DAO voting.

3. **Liquidity Mining** - Incentives for providing withdrawal liquidity. LPs earn fees from unwrapping transactions. Bootstraps liquidity during early adoption phase.

4. **Bridge Insurance** - Protection against bridge exploits or insolvency. Users pay premium for coverage. Claims paid from insurance fund on verified exploit.

5. **Wrapped Token Privacy** - Enhanced privacy for wrapped assets including origin chain obfuscation. Even chain of origin hidden after multiple hops. Maximum fungibility across all wrapped assets.

## Use Cases

1. **Private Ethereum Exposure**
   - User holds ETH but wants private trading
   - Wraps ETH through private bridge to zkETH
   - Trades on ZK-DEX without revealing positions
   - Unwraps back to ETH when desired; no trace of trading activity

2. **Multi-Chain Portfolio Privacy**
   - Investor holds assets across Bitcoin, Ethereum, Solana
   - Wraps portions of each to ZK-DEX
   - Single private portfolio view; rebalances privately
   - External observers see only bridge deposits, not strategy

3. **Institutional Custody**
   - Fund needs cross-chain exposure with regulatory compliance
   - Wraps assets from regulated custody to ZK-DEX
   - Trades privately but maintains proof of reserves
   - Auditors can verify holdings without seeing strategy

4. **Stablecoin Privacy**
   - User receives USDC payment (transparent)
   - Wraps to private zkUSDC on ZK-DEX
   - Subsequent spending is private
   - Financial privacy restored after initial transparent receipt

## Real-World Products & User Experience

### 1. "숨겨진 브릿지 금액" - 래핑 금액 비공개 서비스

**제품 설명**:
자산을 래핑할 때 얼마나 래핑했는지가 외부에 공개되지 않는 프라이버시 래핑 서비스. 일반 WBTC, WETH는 래핑 금액이 모두 공개됩니다.

**일반 사용자 경험**:
- 김태영씨(40세, 사업가)는 10 BTC를 ZK-DEX에서 사용하려 함
- 일반 래핑: "태영씨 주소가 10 BTC를 WBTC로 래핑" 공개
- 프라이빗 래핑: 금액이 commitment로 숨겨진 채 래핑
- 외부에서는 래핑 이벤트만 보이고 금액은 알 수 없음
- 태영씨의 자산 규모가 래핑 과정에서 노출되지 않음

**관찰 가능한 이점**:
- 래핑 금액으로 자산 규모 추정 방지
- 대량 래핑 시 "고래" 추적 회피
- 브릿지 사용 패턴으로 재정 상황 추론 차단

### 2. "출처 숨김 래핑" - 원본 체인 익명화

**제품 설명**:
래핑된 자산이 어느 체인에서 왔는지, 언제 래핑되었는지 추적이 불가능한 프라이버시 래핑 서비스.

**일반 사용자 경험**:
- 이수진씨(33세)는 이더리움 ETH, 폴리곤 ETH, 아비트럼 ETH 보유
- 각각을 ZK-DEX로 래핑하면 일반적으로 출처가 구분됨
- 출처 숨김 래핑: 모든 래핑된 자산이 동일하게 보임
- 수진씨의 zkETH가 어느 체인에서 왔는지 구분 불가
- 체인별 보유 현황을 역추적으로 파악할 수 없음

**관찰 가능한 이점**:
- 멀티체인 포트폴리오 구성 비공개
- 래핑된 자산 간 완전한 대체가능성
- 특정 체인 자산의 "오염" 딱지 제거

### 3. "선택적 공개 래핑" - 규제 준수 프라이빗 브릿지

**제품 설명**:
래핑 금액을 기본적으로 숨기되, 필요시 특정 감사자에게만 선택적으로 공개할 수 있는 기관용 프라이버시 래핑.

**일반 사용자 경험 (기관 관점)**:
- ABC 펀드는 $50M을 ZK-DEX로 래핑하여 운용
- 경쟁사: 래핑 금액을 볼 수 없어 AUM 파악 불가
- 감사자: 펀드가 제공한 뷰잉 키로 래핑 금액 확인 가능
- 규제 당국: 필요시 별도 키로 전체 이력 감사 가능
- 프라이버시와 규제 준수를 동시에 달성

**관찰 가능한 이점**:
- 경쟁사로부터 AUM 비공개
- 규제 요구 시 즉시 증명 가능
- "얼마나 운용하는지"가 영업비밀로 보호

---

[Back to Index](../../README.md)
