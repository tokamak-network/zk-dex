# J4. 낙관적 롤업 모드 (Optimistic Rollup Mode)

ZK 증명 폴백을 통한 낙관적 실행을 사용하여 정상 운영 중 비용을 절감하면서 사기 증명을 통해 보안을 유지하는 하이브리드 프로토콜 모드.

**요구사항**: 낙관적 실행자 | 사기 증명 회로 | 챌린지 메커니즘 | ZK 모드로 폴백

---

## 배경

순수 ZK 롤업은 높은 계산 오버헤드가 있습니다:

- **증명 비용**: ZK 증명 생성이 계산적으로 비용 많이 듦
- **하드웨어 요구사항**: 효율적인 증명을 위해 특수 하드웨어 필요
- **지연시간**: 증명 생성으로 완결성에 지연 추가
- **복잡성**: ZK 회로는 개발 및 감사가 어려움

낙관적 모드는 다음을 통해 이를 해결합니다:
- 기본적으로 모든 트랜잭션이 유효하다고 가정
- 챌린지 시에만 ZK 증명 생성
- 정상 경우 비용 극적 감소
- 경제적 인센티브를 통해 보안 유지

ZK-DEX의 경우, 이를 통해 ZK 수준 보안 옵션을 보존하면서 비용 효율적인 운영이 가능합니다.

## 기술 명세

### 아키텍처 개요

```
Transactions                  Hybrid Rollup                      L1 Settlement
+-------------+               +------------------------+         +-------------+
|             |               |                        |         |             |
| Tx 1        |               |  Optimistic Path       |         |             |
| Tx 2        |-------------->|  (assume valid)        |-------->|  State Root |
| Tx 3        |               |                        |         |  Posted     |
| ...         |               +------------------------+         |             |
+-------------+                        |                         +-------------+
                                       |                              |
                                Challenge?                            v
                                       |                         +-------------+
                                       v                         |             |
                              +------------------------+         |  Challenge  |
                              |                        |         |  Period     |
                              |  ZK Fallback           |         |  (7 days)   |
                              |  (generate proof)      |-------->|             |
                              |                        |         +-------------+
                              +------------------------+
```

### 구성 요소 목록

| 구성 요소 | 설명 |
|-----------|-------------|
| **Sequencer** | 낙관적으로 트랜잭션 순서 지정 및 실행 |
| **State Poster** | L1에 상태 루트 게시 |
| **Challenge Contract** | 사기 주장 수락 및 처리 |
| **Fraud Proof Generator** | 무효한 실행 증명 생성 |
| **ZK Fallback Prover** | 필요 시 ZK 증명 생성 |
| **Dispute Resolver** | 챌린지 결과 결정 |

### 데이터 흐름

1. **낙관적 실행**
   - 시퀀서가 트랜잭션 실행
   - L1에 상태 루트 게시
   - 유효하다고 가정; 증명 불필요

2. **챌린지 윈도우**
   - 누구든 게시된 상태에 챌린지 가능
   - 챌린지는 보증금 필요
   - 사기 증명 게임 트리거

3. **분쟁 해결**
   - 대화형 또는 비대화형 사기 증명
   - 무효한 상태: 되돌리고 시퀀서 슬래시
   - 유효한 상태: 챌린저 슬래시

### 사기 증명 회로

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/merkle/sparse_merkle_tree.circom";

template FraudProof() {
    // Public inputs
    signal input claimedStateRoot;    // State root posted by sequencer
    signal input correctStateRoot;    // Actual correct state root
    signal input transactionHash;     // Transaction being disputed
    signal input preStateRoot;        // State before transaction

    // Private inputs
    signal input transaction[10];     // Transaction data
    signal input preStateWitness[32]; // Merkle proof of pre-state
    signal input stateTransition[10]; // Correct state changes

    // Verify pre-state is in claimed history
    component preCheck = MerkleProof(32);
    // ... verify preStateRoot leads to valid chain

    // Execute transaction correctly
    component executor = TransactionExecutor();
    executor.preState <== preStateRoot;
    for (var i = 0; i < 10; i++) {
        executor.tx[i] <== transaction[i];
    }

    // Verify correct execution differs from claimed
    signal computedRoot;
    computedRoot <== executor.postState;
    computedRoot === correctStateRoot;

    // Prove claimed root is wrong
    component notEqual = IsZero();
    notEqual.in <== claimedStateRoot - correctStateRoot;
    notEqual.out === 0;  // Must be different (fraud occurred)
}

component main {public [claimedStateRoot, correctStateRoot, transactionHash, preStateRoot]} = FraudProof();
```

## 효과

| 측면 | 영향 |
|--------|--------|
| **비용 (정상)** | 순수 ZK 대비 약 90% 감소 |
| **비용 (분쟁)** | 사기 증명 생성으로 더 높음 |
| **지연시간 (정상)** | 즉각적인 소프트 확인 |
| **지연시간 (최종)** | 완결성을 위한 7일 챌린지 기간 |
| **보안** | 경제적 보안; 합리적 행위자 |
| **복잡성** | 더 단순한 실행; 복잡한 분쟁 로직 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **시퀀서 사기** | 경제적 보증금; 슬래싱 |
| **챌린지 스팸** | 챌린저 보증금; 패자 지불 |
| **데이터 보류** | 데이터 가용성 요구사항 |
| **공모** | 분산 챌린저; 내부고발자 보상 |
| **활성 실패** | 강제 포함 메커니즘 |
| **긴 완결성** | 빠른 인출 브릿지; 유동성 공급자 |

## 구현 과제

1. **완결성 지연**
   - 7일 챌린지 기간이 표준
   - 빠른 완결성 필요에 대한 불량한 UX
   - 더 빠른 인출을 위해 유동성 브릿지 필요

2. **데이터 가용성**
   - 모든 트랜잭션 데이터 게시 필요
   - 누구든 검증 및 챌린지 가능
   - 데이터 비용이 상당할 수 있음

3. **사기 증명 복잡성**
   - 대화형 증명은 여러 라운드 필요
   - 비대화형 증명은 완전한 증명 필요
   - 둘 다 구현 과제 있음

4. **챌린저 인센티브**
   - 정직한 모니터링 인센티브화 필요
   - 보상과 스팸 방지 간 균형
   - 보험/스테이킹 모델 고려

5. **하이브리드 모드 전환**
   - 언제 ZK 모드로 전환?
   - 모드 전환을 어떻게 처리?
   - 모드 간 일관성

## 파생형

1. **Hybrid ZK/Optimistic** - 정상 운영에는 낙관적 사용; 고가치 또는 분쟁 트랜잭션에는 ZK. 트랜잭션 특성에 기반한 동적 모드 선택.

2. **Challenge Games** - 대화형 분쟁 해결 프로토콜. 사기를 격리하기 위한 이진 탐색. 로그 수의 온체인 단계.

3. **Fraud Proof Generation** - 챌린지 시 자동 증명 생성. 일반 분쟁을 위한 사전 계산 증명. 효율적인 증명 회로.

4. **Sequencer Selection** - 분산 시퀀서 로테이션. 스테이크를 통한 경제적 보안. 단일 실패 지점 방지.

5. **Data Availability** - 트랜잭션 데이터 가용성 보장. 온체인 calldata 또는 별도 DA 레이어. 사기 증명 생성에 중요.

## 사용 사례

1. **비용 민감 애플리케이션**
   - 많은 저가치 트랜잭션을 가진 게임
   - ZK 증명은 트랜잭션당 너무 비쌈
   - 낙관적 모드로 비용 90% 이상 감소
   - 보안 보장을 위한 ZK 폴백

2. **빠르지만 안전한 거래**
   - 낙관적으로 즉각적인 거래 실행
   - 챌린지 기간 후 완전한 완결성
   - 긴급한 필요를 위한 빠른 인출 브릿지
   - 양쪽의 장점

3. **점진적 ZK 마이그레이션**
   - 낙관적 모드로 시작
   - 점진적으로 구성 요소에 ZK 증명 추가
   - 시간이 지나면서 완전한 ZK 마이그레이션
   - 개발 위험 감소

4. **고빈도 마켓메이킹**
   - 초당 수천 건의 호가
   - 호가당 ZK 증명은 비실용적
   - 속도를 위한 낙관적 실행
   - 순 포지션에 대한 ZK 정산

## 실제 제품 및 사용자 경험

### 1. "프라이버시 폴백" - 분쟁 시에도 프라이버시 유지

**제품 설명**:
낙관적 모드에서 분쟁 발생 시 ZK 증명으로 해결하되, 분쟁 과정에서도 거래 세부내용이 공개되지 않는 프라이버시 보존 분쟁 해결.

**일반 사용자 경험**:
- 김하이브리드씨의 거래에 챌린지 발생
- 일반 분쟁: "김씨가 $500 거래에서 문제" 공개됨
- 프라이버시 분쟁: ZK 증명이 "유효/무효"만 판정
- 거래 금액, 상대방, 내용은 분쟁 과정에서도 비공개
- 챌린저도 "무엇이 잘못됐는지"만 알고 세부내용 모름

**관찰 가능한 이점**:
- 분쟁 시에도 거래 프라이버시 유지
- 챌린지로 인한 정보 노출 방지
- 프라이버시와 분쟁 해결의 양립

### 2. "숨겨진 가치 계층" - 어떤 거래가 ZK인지 숨김

**제품 설명**:
고가치 거래에 ZK 증명을 사용하되, 어떤 거래가 ZK로 처리되었는지 외부에서 구분할 수 없게 하는 서비스.

**일반 사용자 경험**:
- 게이머 박플레이씨가 레어 아이템 거래 ($1,000+)
- 일반 하이브리드: "이 거래는 ZK" → 고가치 거래 식별
- 숨겨진 계층: 모든 거래가 외부에서 동일하게 보임
- 공격자가 "고가 거래는 어느 것인지" 타겟팅 불가
- 레어 아이템 소유자 식별 방지

**관찰 가능한 이점**:
- 고가치 거래자 타겟팅 방지
- ZK/낙관적 구분으로 인한 정보 누출 차단
- 거래 가치 추론 방지

### 3. "프라이버시 우선 마이그레이션" - 전환 과정도 비공개

**제품 설명**:
낙관적에서 ZK로 마이그레이션할 때 어떤 사용자가 어느 단계에 있는지 추적이 불가능한 프라이버시 마이그레이션.

**일반 사용자 경험 (프로토콜 운영자 관점)**:
- ABC 프로토콜이 ZK로 점진적 전환 중
- 일반 마이그레이션: "사용자 X는 이미 ZK, Y는 아직 낙관적"
- 프라이버시 마이그레이션: 모든 사용자 상태가 동일하게 보임
- 공격자가 "ZK 전환 안 한 사용자" 타겟팅 불가
- 마이그레이션 진행 상황도 비공개

**관찰 가능한 이점**:
- 마이그레이션 상태로 사용자 분류 방지
- 보안 수준 차이를 악용한 공격 차단
- 균일한 보안 인식 유지

---

[Back to Index](../../README.md)
