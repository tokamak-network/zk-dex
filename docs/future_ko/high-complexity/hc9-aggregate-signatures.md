# HC9. 집계 서명 검증

단일 증명으로 많은 EdDSA/Schnorr 서명을 검증합니다.

**제약조건**: ~800K | **복잡도**: 매우 높음

---

## 배경

다중 서명 검증은 온체인에서 비용이 많이 듭니다:
- 각 ECDSA 검증은 ~3,000 gas 소요
- 100개 서명 = 검증만 300,000 gas
- DAO 거버넌스는 많은 서명이 필요
- 크로스체인 검증은 효율적인 검증이 필요

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 개별 ECDSA | O(n) gas 비용; 서명당 3K gas |
| Gnosis Safe 다중 서명 | 제한된 서명자; 순차적 검증 |
| 네이티브 BLS 프리컴파일 | 대부분의 체인에서 사용 불가 |
| 임계값 ECDSA | 복잡한 DKG; 온라인 조정 필요 |

집계 서명 회로는 검증 비용을 O(1)로 분산시켜 하나의 ZK 증명 비용으로 100개 이상의 서명을 검증할 수 있습니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `messageHash` | field | 서명되는 메시지의 해시 |
| `aggregatePubKeyX/Y` | field | 결합된 공개 키 |
| `aggregateR_X/Y` | field | 결합된 R 포인트 |
| `aggregateS` | field | 결합된 S 스칼라 |
| `signerBitmap` | uint256 | 어느 서명자가 참여했는지의 비트맵 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pubKeyX/Y` | field[N_SIGS] | 개별 공개 키 |
| `R_X/Y, S` | field[N_SIGS] | 개별 서명 구성 요소 |
| `isActive` | bool[N_SIGS] | 어느 서명이 포함되는지 |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **Gas 비용** | n개 서명에 대해 O(n) 대신 O(1) (~300K for any n) |
| **확장성** | 경제적으로 수백 명의 서명자 지원 |
| **임계값** | m-of-n 방식을 쉽게 구현 |
| **프라이버시** | 어느 키가 서명했는지 숨길 수 있음 (선택 사항) |
| **크로스체인** | 효율적인 다중 체인 검증 |
| **조합 가능성** | 다중 서명 작업을 위한 표준 인터페이스 |

## 파생물

1. **임계값 서명 (k-of-n)** - n명의 가능한 서명자 중 k개의 서명만 필요합니다. 회로가 최소 k개의 활성 서명을 검증합니다. 거버넌스 정족수 요구사항에 유용합니다.

2. **링 서명** - 그룹에서 익명 서명입니다. 검증자는 그룹 중 한 명이 서명했음을 알지만 누구인지는 모릅니다. 링 멤버십 증명이 필요합니다. 프라이버시 보존 투표.

3. **블라인드 서명** - 서명자가 메시지 내용을 보지 못합니다. 익명 자격 증명에 유용합니다. Commitment 스킴 통합이 필요합니다.

4. **시간 지연 서명** - 타임스탬프 이후에만 유효한 서명입니다. 회로에 타임스탬프 확인을 포함합니다. 타임락 거버넌스에 유용합니다.

5. **취소 가능한 서명** - 마감일 전에 취소 목록을 사용하여 취소할 수 있습니다. 취소된 서명의 Merkle 트리. 변경 가능한 투표에 유용합니다.

```circom
pragma circom 2.1.0;

include "../utils/babyjubjub/babyjubjub.circom";
include "../utils/babyjubjub/eddsa_verify.circom";
include "../utils/comparators.circom";

template AggregateSignatureVerify(N_SIGS) {
    // ===== Public Inputs =====
    signal input messageHash;
    signal input aggregatePubKeyX;
    signal input aggregatePubKeyY;
    signal input aggregateR_X;
    signal input aggregateR_Y;
    signal input aggregateS;
    signal input minSigners;  // Threshold requirement

    // ===== Private Inputs =====
    signal input pubKeyX[N_SIGS], pubKeyY[N_SIGS];
    signal input R_X[N_SIGS], R_Y[N_SIGS];
    signal input S[N_SIGS];
    signal input isActive[N_SIGS];

    // ===== Component Declarations =====
    component verify[N_SIGS];
    component addPubKey[N_SIGS];
    component addR[N_SIGS];
    component thresholdCheck;

    // Intermediate signals for accumulation
    signal accPubKeyX[N_SIGS + 1];
    signal accPubKeyY[N_SIGS + 1];
    signal accR_X[N_SIGS + 1];
    signal accR_Y[N_SIGS + 1];
    signal activeCount[N_SIGS + 1];

    // Initialize accumulators with identity point (0, 1) for BabyJubJub
    accPubKeyX[0] <== 0;
    accPubKeyY[0] <== 1;
    accR_X[0] <== 0;
    accR_Y[0] <== 1;
    activeCount[0] <== 0;

    // ===== Verify Each Signature and Aggregate =====
    for (var i = 0; i < N_SIGS; i++) {
        // Boolean check for isActive
        isActive[i] * (1 - isActive[i]) === 0;

        // Verify individual EdDSA signature (if active)
        verify[i] = EdDSAVerify();
        verify[i].enabled <== isActive[i];
        verify[i].Ax <== pubKeyX[i];
        verify[i].Ay <== pubKeyY[i];
        verify[i].R8x <== R_X[i];
        verify[i].R8y <== R_Y[i];
        verify[i].S <== S[i];
        verify[i].M <== messageHash;

        // Aggregate public key (conditional point addition)
        addPubKey[i] = BabyJubJubPointAddConditional();
        addPubKey[i].x1 <== accPubKeyX[i];
        addPubKey[i].y1 <== accPubKeyY[i];
        addPubKey[i].x2 <== pubKeyX[i];
        addPubKey[i].y2 <== pubKeyY[i];
        addPubKey[i].condition <== isActive[i];
        accPubKeyX[i + 1] <== addPubKey[i].outX;
        accPubKeyY[i + 1] <== addPubKey[i].outY;

        // Aggregate R point
        addR[i] = BabyJubJubPointAddConditional();
        addR[i].x1 <== accR_X[i];
        addR[i].y1 <== accR_Y[i];
        addR[i].x2 <== R_X[i];
        addR[i].y2 <== R_Y[i];
        addR[i].condition <== isActive[i];
        accR_X[i + 1] <== addR[i].outX;
        accR_Y[i + 1] <== addR[i].outY;

        // Count active signers
        activeCount[i + 1] <== activeCount[i] + isActive[i];
    }

    // ===== Verify Aggregates Match Public Inputs =====
    accPubKeyX[N_SIGS] === aggregatePubKeyX;
    accPubKeyY[N_SIGS] === aggregatePubKeyY;
    accR_X[N_SIGS] === aggregateR_X;
    accR_Y[N_SIGS] === aggregateR_Y;

    // ===== Verify Aggregate S =====
    var sumS = 0;
    for (var i = 0; i < N_SIGS; i++) {
        sumS += S[i] * isActive[i];
    }
    sumS === aggregateS;

    // ===== Verify Threshold Met =====
    thresholdCheck = LessThan(16);
    thresholdCheck.in[0] <== minSigners;
    thresholdCheck.in[1] <== activeCount[N_SIGS] + 1;
    thresholdCheck.out === 1;
}

component main {public [messageHash, aggregatePubKeyX, aggregatePubKeyY,
    aggregateR_X, aggregateR_Y, aggregateS, minSigners]} = AggregateSignatureVerify(100);
```

### 주요 제약조건

1. **개별 검증**: 각 활성 서명이 메시지에 대해 검증됨
2. **집계 공개 키**: 활성 공개 키의 합이 commitment와 일치
3. **집계 R 포인트**: 활성 R 포인트의 합이 commitment와 일치
4. **집계 S 스칼라**: 활성 S 값의 합이 commitment와 일치
5. **임계값**: 최소 minSigners개의 활성 서명

## BLS vs EdDSA 집계: 기술 비교

| 측면 | BLS 집계 | ZK의 EdDSA (현재) |
|--------|-----------------|----------------------|
| **네이티브 집계** | 예 - 수학적 특성 | 아니오 - ZK 증명 필요 |
| **온체인 검증** | 프리컴파일로 ~50K gas | ~300K gas (ZK 증명) |
| **회로 복잡성** | N/A (회로 필요 없음) | 100개 서명에 ~800K 제약조건 |
| **커브** | BLS12-381 | BabyJubJub (SNARK 친화적) |
| **EVM 지원** | 일부 체인에 프리컴파일 | 어디서나 작동 |
| **악의적 키 공격** | PoP 또는 키 집계 필요 | 해당 없음 |
| **서명 크기** | 48바이트 (집계됨) | 증명 시스템에 따라 다름 |

### 각각 언제 사용할 것인가

**BLS 집계를 사용할 때:**
- 대상 체인에 BLS 프리컴파일이 있음 (ETH 2.0 비콘 체인)
- 순수 서명 집계가 목표
- 추가 ZK 프라이버시 요구사항 없음
- 표준화된 키 관리가 허용됨

**ZK의 EdDSA를 사용할 때:**
- 다른 계산을 위한 SNARK 친화적 커브가 필요
- 어느 서명자가 참여했는지 숨기고 싶음
- 동일한 증명에서 조건부/임계값 로직이 필요
- 크로스체인 호환성이 필요
- 서명 검증을 다른 ZK 로직과 결합

### 하이브리드 접근 방식

최대 효율성을 위해 하이브리드를 고려하세요:
1. 원시 서명 집계에 BLS 사용
2. BLS 집계를 검증하고 프라이버시/로직을 추가하기 위해 ZK 증명 사용

```
BLS 집계 (오프체인) -> ZK 증명 (집계 검증 + 추가 로직)
```

이것은 BLS 효율성을 얻으면서 ZK 회로 복잡성을 줄입니다.

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **악의적 키 공격** | 키 등록에 소유 증명 (PoP) 사용 |
| **메시지 가변성** | 도메인 구분자로 메시지 해시 |
| **재생 공격** | 메시지에 nonce 또는 체인 ID 포함 |
| **서명자 세트 조작** | 서명 전에 집계 공개 키가 커밋됨 |
| **임계값 우회** | 회로가 최소 서명자 수를 강제 |
| **키 재사용** | 애플리케이션별 고유 키 권장 |
| **타이밍 공격** | 일정 시간 ZK 증명 |

## 구현 과제

1. **조건부 포인트 추가**
   - 표준 포인트 추가가 identity에 대해 실패
   - 비활성 서명자를 위한 조건부 로직 필요
   - 특수화된 BabyJubJubPointAddConditional 템플릿 사용

2. **서명자 순서**
   - 결정론적 서명자 순서가 있어야 함
   - 공개 키 목록이 미리 커밋되어야 함
   - 일관성을 위해 공개 키 해시로 정렬 고려

3. **키 등록**
   - 서명자가 어떻게 키를 등록하는가?
   - 악의적 키를 방지하기 위한 소유 증명 필요
   - 온체인 키 레지스트리 고려

4. **대규모 서명자 세트**
   - 100명의 서명자 = ~800K 제약조건
   - 1000명의 서명자는 재귀 증명이 필요할 수 있음
   - 배치 또는 계층적 집계 고려

5. **동적 서명자 세트**
   - 서명자가 시간이 지남에 따라 변경되면?
   - 에포크 관리가 있는 버전 관리된 서명자 세트 필요
   - 또는 승인된 서명자의 Merkle 트리

## 사용 사례

1. **DAO 거버넌스**
   - 100명의 토큰 보유자가 제안에 투표
   - 단일 ZK 증명이 모든 서명을 검증
   - 비용: 투표자 수에 관계없이 ~300K gas

2. **다자 지갑**
   - 5-of-10 기업 재무부
   - 5명의 서명자가 트랜잭션을 승인할 수 있음
   - 프라이버시: 5명이 서명한 것을 숨길 수 있음

3. **크로스체인 브리지**
   - 검증자 세트가 크로스체인 메시지에 서명
   - 목적지 체인에서 효율적인 검증
   - 임계값이 비잔틴 장애 허용을 보장

4. **증명 서비스**
   - 여러 오라클이 데이터를 증명
   - 증명을 단일 증명으로 집계
   - 온체인 검증 비용 감소

5. **투표 시스템**
   - 서명 집계가 있는 익명 투표
   - 개별 투표를 공개하지 않고 투표 수를 증명
   - 검증 가능한 선거 결과

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../../future/product/high-complexity/hc9-aggregate-signatures-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
