# J1. 재귀적 증명 집계 (Recursive Proof Aggregation)

여러 ZK 증명을 하나의 간결한 증명으로 집계하여 검증 비용을 극적으로 줄이고 확장성을 가능하게 하는 증명 시스템.

**요구사항**: 재귀 친화적 증명 시스템 | 집계 회로 | 검증자 컨트랙트 | 증명 배치 인프라

---

## 배경

개별 ZK 증명 검증은 확장성 문제에 직면합니다:

- **검증 비용**: 각 증명을 온체인에서 검증하는 데 약 200K-500K 가스 소요
- **처리량 한계**: 블록 가스 제한으로 블록당 검증 가능한 증명 수 제한
- **저장 오버헤드**: 많은 증명을 저장하면 상당한 calldata 소비
- **지연시간**: 순차 검증으로 지연시간 증가

재귀적 증명 집계는 다음을 통해 이를 해결합니다:
- 단일 증명 내에서 여러 증명이 유효함을 증명
- N개의 검증을 1개의 상수 시간 검증으로 축소
- 고정된 온체인 비용으로 무제한 오프체인 계산 가능
- 점진적 증명 생성 지원

ZK-DEX의 경우, 이를 통해 L1 보안 보장을 유지하면서 대규모 처리량을 달성합니다.

## 기술 명세

### 아키텍처 개요

```
Individual Proofs              Aggregation Layer                   L1 Verification
+-------------+                +------------------------+          +-------------+
|             |                |                        |          |             |
| Proof 1     |--------------->|                        |          |             |
| Proof 2     |--------------->|  Aggregation           |  Single  |  Verifier   |
| Proof 3     |--------------->|  Circuit               |  Proof   |  Contract   |
| ...         |--------------->|                        |--------->|             |
| Proof N     |--------------->|                        |          |  ~200K gas  |
|             |                |                        |          |  (constant) |
+-------------+                +------------------------+          +-------------+
                                        |
                                        v
                               +------------------------+
                               |  Proves:               |
                               |  "All N proofs valid"  |
                               +------------------------+
```

### 구성 요소 목록

| 구성 요소 | 설명 |
|-----------|-------------|
| **Leaf Proofs** | 개별 트랜잭션/작업 증명 |
| **Aggregation Circuit** | 여러 증명을 재귀적으로 검증 |
| **Accumulator** | 모든 검증된 증명의 실행 증명 유지 |
| **Final Proof Generator** | 최종 집계 증명 생성 |
| **Batch Coordinator** | 효율적인 집계를 위해 증명 그룹화 |
| **Verifier Contract** | 집계 증명의 온체인 검증 |

### 데이터 흐름

1. **증명 수집**
   - 트랜잭션에 대한 개별 증명 생성
   - 증명을 집계 대기열에 추가
   - 임계값 도달 시 배치 형성

2. **재귀적 집계**
   - 첫 번째 레벨: 증명 쌍을 집계
   - 각 레벨에서 증명 수를 절반으로 축소
   - 단일 증명이 남을 때까지 계속

3. **온체인 검증**
   - 단일 집계 증명 제출
   - 검증자가 모든 원본 증명이 유효함을 확인
   - 전체 배치에 대한 상태 업데이트

### 재귀적 집계 회로

```circom
pragma circom 2.1.0;

// Note: This is conceptual - real recursive circuits use
// specialized proof systems like Nova, Halo2, or PLONK with recursion

include "../utils/poseidon/poseidon.circom";

template RecursiveAggregator(numProofs) {
    // Public inputs
    signal input aggregateHash;      // Hash of all proof commitments
    signal input oldStateRoot;       // State before all proofs
    signal input newStateRoot;       // State after all proofs

    // Private inputs - proof verification witnesses
    signal input proofCommitments[numProofs];
    signal input stateTransitions[numProofs][2];  // [oldRoot, newRoot] per proof
    signal input verificationWitnesses[numProofs][100];  // Proof-specific data

    // Verify state chain
    stateTransitions[0][0] === oldStateRoot;
    for (var i = 0; i < numProofs - 1; i++) {
        stateTransitions[i][1] === stateTransitions[i + 1][0];
    }
    stateTransitions[numProofs - 1][1] === newStateRoot;

    // Compute aggregate hash
    component aggHash = Poseidon(numProofs);
    for (var i = 0; i < numProofs; i++) {
        aggHash.inputs[i] <== proofCommitments[i];
    }
    aggHash.out === aggregateHash;

    // In real implementation: verify each proof using recursive verifier
    // This requires proof system support (Nova IVC, Halo2 recursion, etc.)
}

component main {public [aggregateHash, oldStateRoot, newStateRoot]} = RecursiveAggregator(1000);
```

### 재귀적 증명 시스템

| 시스템 | 접근 방식 | 특성 |
|--------|----------|-----------------|
| **Nova/SuperNova** | 폴딩 기반 IVC | 매우 효율적; 점진적 검증 가능 |
| **Halo2** | 내적 증명 | 신뢰 설정 불필요; 중간 재귀 비용 |
| **PLONK + KZG** | 다항식 커밋먼트 | 효율적; 신뢰 설정 필요 |
| **STARKs** | 해시 기반 | 신뢰 설정 불필요; 더 큰 증명 |

## 효과

| 측면 | 영향 |
|--------|--------|
| **검증 비용** | N개 증명에 대해 O(N) 대신 O(1) |
| **처리량** | 배치당 무제한 트랜잭션 |
| **가스 효율성** | 대규모 배치에서 99%+ 감소 |
| **완결성** | 배치 완결성; 전부 아니면 전무 정산 |
| **조합 가능성** | 다양한 소스의 증명 집계 |
| **확장성** | 선형 증명 비용; 상수 검증 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **재귀 건전성** | 잘 분석된 재귀적 증명 시스템 사용 |
| **집계자 조작** | 결정론적 집계; 검증 가능한 순서 지정 |
| **증명 가변성** | 바인딩 커밋먼트; 표준 증명 형식 |
| **대규모 배치로 인한 DoS** | 배치 크기 제한; 증명자 리소스 관리 |
| **검증자 버그** | 검증자 컨트랙트의 형식 검증 |
| **신뢰 설정 (해당 시)** | 다자간 의식; 범용 설정 재사용 |

## 구현 과제

1. **재귀 회로 복잡성**
   - 검증자 회로가 재귀 형식에서 효율적이어야 함
   - 일부 증명 시스템은 자연스럽게 재귀적이지 않음
   - 재귀 깊이에 따라 회로 크기 증가

2. **증명 시간**
   - 재귀적 증명 생성이 더 비용 많이 듦
   - 병렬 증명 인프라 필요
   - 배치 크기와 지연시간 간의 트레이드오프

3. **증명 시스템 선택**
   - 다양한 시스템이 다양한 트레이드오프 보유
   - Nova: 빠른 폴딩, 더 새로운/덜 검증된 시스템
   - Halo2: 성숙, 중간 재귀 오버헤드

4. **점진적 대 배치**
   - 점진적: 각 추가마다 증명 증가
   - 배치: 배치를 기다려 한 번에 증명
   - 하이브리드 접근 가능

5. **크로스 회로 집계**
   - 다양한 트랜잭션 유형이 다양한 회로 보유
   - 범용 집계 또는 유형별 배치 필요
   - 회로 균일성 고려

## 파생형

1. **Nova Folding** - 폴딩 스킴을 사용한 점진적 검증 가능 계산. 각 단계가 이전 증명을 새 증명으로 폴딩. 순차 계산에 매우 효율적.

2. **PLONK Recursion** - 다항식 커밋먼트를 사용한 재귀적 PLONK 증명. 좋은 도구를 갖춘 성숙한 증명 시스템. 신뢰 설정 필요.

3. **Incremental Verification** - 도착하는 증명을 검증; 실행 집계 유지. 배치 지연 없음. 실시간 애플리케이션에 이상적.

4. **Proof Batching** - 증명을 수집하고 주기적으로 집계. 더 높은 지연시간; 잠재적으로 더 효율적. 고처리량 시나리오에 적합.

5. **Universal Circuits** - 모든 증명 유형을 검증할 수 있는 단일 회로. 집계 인프라 간소화. 회로당 효율성 희생 가능.

## 사용 사례

1. **ZK-DEX 트랜잭션 배치**
   - 배치당 수천 건의 거래
   - 각 거래는 개별 증명 보유
   - 집계 증명이 전체 배치 검증
   - 단일 L1 트랜잭션으로 모든 거래 정산

2. **멀티체인 집계**
   - 여러 ZK-롤업의 증명
   - 단일 이더리움 트랜잭션으로 집계
   - 체인 간 검증 상각
   - 공유 보안 레이어

3. **점진적 상태 업데이트**
   - 지속적인 상태 변경 스트림
   - 각 변경을 실행 증명으로 폴딩
   - 주기적으로 온체인 집계 정산
   - 배치 정산으로 실시간 유효성

4. **크로스 애플리케이션 증명**
   - DeFi 프로토콜이 증명 생성
   - 게임 프로토콜이 증명 생성
   - 애플리케이션 간 집계
   - 공유 증명 인프라

## 실제 제품 및 사용자 경험

### 1. "패턴 숨김 배치" - 여러 거래를 하나로 합쳐 개별 분석 방지

**제품 설명**:
수천 건의 프라이빗 거래를 재귀 증명으로 압축하여 개별 거래 패턴 분석이 불가능하게 만드는 프라이버시 강화 서비스.

**일반 사용자 경험**:
- 김거래씨는 하루 50건 프라이빗 거래 실행
- 개별 증명: "50개 증명이 같은 시간에" → 패턴 분석 가능
- 재귀 배치: 10,000건이 하나의 증명으로 압축
- 김씨의 50건이 다른 9,950건과 섞여 구분 불가
- 거래 빈도, 타이밍 패턴 완전 숨김

**관찰 가능한 이점**:
- 개별 사용자 거래 패턴 분석 불가
- 대규모 익명 세트에서 프라이버시 강화
- 타이밍 상관관계 분석 차단

### 2. "크로스롤업 프라이버시 허브" - 롤업 간 자산 흐름 숨김

**제품 설명**:
여러 롤업의 증명을 집계할 때 어느 롤업에서 어느 롤업으로 자산이 이동했는지 추적이 불가능하게 만드는 프라이버시 허브.

**일반 사용자 경험 (롤업 운영자 관점)**:
- A, B, C 롤업이 각각 독립적으로 운영
- 일반 집계: "A에서 B로 얼마 이동" 추적 가능
- 프라이버시 허브: 모든 롤업 상태가 하나의 증명으로 합쳐짐
- 롤업 간 자금 흐름이 집계 안에서 숨겨짐
- 크로스롤업 MEV 및 추적 방지

**관찰 가능한 이점**:
- 멀티롤업 사용자의 전체 활동 숨김
- 롤업 간 자산 흐름 분석 차단
- 크로스롤업 트래킹 방지

### 3. "시간 윈도우 난독화" - 거래 시점 정보 제거

**제품 설명**:
재귀 증명으로 폴딩할 때 개별 거래의 정확한 타이밍 정보가 제거되어 "언제 거래했는지" 분석이 불가능한 서비스.

**일반 사용자 경험**:
- 게임에서 실시간 아이템 거래 실행
- 일반 배치: "3시 15분에 거래 포함" 타이밍 추론 가능
- 시간 난독화: 폴딩 시점에 개별 타이밍 정보 삭제
- "이 거래가 언제 발생했는지" 정확히 알 수 없음
- 행동 패턴 시간 분석 차단

**관찰 가능한 이점**:
- 거래 시점 기반 분석 차단
- 활동 시간대 프라이버시 보호
- 실시간 활동 모니터링 방지

---

[Back to Index](../../README.md)
