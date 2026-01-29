# I10. 프로버 마켓플레이스

품질 보증 및 효율적인 리소스 할당을 통해 경쟁적인 증명 생성을 가능하게 하는 ZK 증명 생성 서비스를 위한 탈중앙화 마켓플레이스.

**요구사항**: 증명 요청 프로토콜 | 프로버 등록 | 품질 검증 | 결제 정산

---

## 배경

ZK 증명 생성은 계산 집약적이며 상당한 과제가 있습니다:

- **하드웨어 요구사항**: 증명에는 고가의 GPU/FPGA 인프라 필요
- **중앙화 위험**: 소수의 엔티티만 증명 인프라를 감당할 수 있음
- **지연 시간 민감성**: 사용자는 빠른 증명을 원함; 하드웨어는 느림
- **리소스 비효율성**: 증명 용량이 종종 활용도가 낮거나 불충분함

프로버 마켓플레이스는 다음을 통해 이를 해결합니다:
- 증명 서비스를 위한 경쟁 시장 생성
- 하드웨어 소유자가 유휴 용량을 수익화할 수 있게 함
- 사용자에게 빠르고 신뢰할 수 있는 증명 생성 제공
- ZK 시스템의 증명 레이어 탈중앙화

ZK-DEX의 경우, 이것은 중앙화된 인프라 없이 신뢰할 수 있고 빠른 증명 생성을 보장합니다.

## 기술 사양

### 아키텍처 개요

```
Proof Requesters              Prover Marketplace                 Provers
+------------+                +------------------------+         +----------+
|            |  Request       |                        |         |          |
| User 1     |--------------->|  Job Dispatcher        |-------->| Prover 1 |
|            |                |                        |         | (GPU)    |
+------------+                |  +----------------+    |         +----------+
|            |  Request       |  | Reputation     |    |         |          |
| User 2     |--------------->|  | System         |    |-------->| Prover 2 |
|            |                |  +----------------+    |         | (FPGA)   |
+------------+                |         |              |         +----------+
                              |         v              |         |          |
                              |  +----------------+    |-------->| Prover 3 |
                              |  | Auction/Match  |    |         | (Cloud)  |
                              |  +----------------+    |         +----------+
                              |         |              |
                              |         v              |
                              |  Payment Settlement    |
                              +------------------------+
```

### 구성 요소 목록

| 구성 요소 | 설명 |
|-----------|-------------|
| **Job Dispatcher** | 증명 요청 수신; 프로버에게 라우팅 |
| **Prover Registry** | 등록된 프로버 및 기능 추적 |
| **Matching Engine** | 요청을 최적의 프로버에 매칭 |
| **Reputation System** | 프로버 신뢰성 및 성능 추적 |
| **Verification Layer** | 제출된 증명 검증 |
| **Payment Contract** | 에스크로 및 정산 처리 |

### 데이터 흐름

1. **요청 제출**
   - 사용자가 증인 데이터와 함께 증명 요청 제출
   - 요구사항 명시 (지연 시간, 회로 유형, 가격)
   - 결제 에스크로

2. **프로버 매칭**
   - 디스패처가 요청을 가능한 프로버에 매칭
   - 경매 또는 선착순 할당
   - 프로버가 작업 수락

3. **증명 생성 및 정산**
   - 프로버가 증명 생성
   - 검증 레이어가 증명 검증
   - 결제 릴리스; 평판 업데이트

### 프로버 등록 회로

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template ProverRegistration() {
    // Public inputs
    signal input proverCommitment;    // Commitment to prover identity
    signal input capabilityHash;      // Hash of supported circuits
    signal input stakeAmount;         // Slashable stake
    signal input registrationTime;

    // Private inputs
    signal input proverPk;            // Prover public key
    signal input capabilities[10];    // Supported circuit types
    signal input hardwareSpec;        // Hardware capabilities
    signal input salt;

    // Verify prover commitment
    component proverHash = Poseidon(3);
    proverHash.inputs[0] <== proverPk;
    proverHash.inputs[1] <== hardwareSpec;
    proverHash.inputs[2] <== salt;
    proverHash.out === proverCommitment;

    // Verify capability commitment
    component capHash = Poseidon(11);
    for (var i = 0; i < 10; i++) {
        capHash.inputs[i] <== capabilities[i];
    }
    capHash.inputs[10] <== salt;
    capHash.out === capabilityHash;
}

component main {public [proverCommitment, capabilityHash, stakeAmount, registrationTime]} = ProverRegistration();
```

### 증명 작업 회로

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template ProofJob() {
    // Public inputs
    signal input jobId;               // Unique job identifier
    signal input circuitHash;         // Which circuit to prove
    signal input inputCommitment;     // Commitment to witness
    signal input deadline;            // Required completion time
    signal input maxPrice;            // Maximum payment

    // Private inputs
    signal input witness[100];        // Actual witness data
    signal input requesterPk;         // Requester identity
    signal input salt;

    // Verify input commitment matches witness
    component inputHash = Poseidon(101);
    for (var i = 0; i < 100; i++) {
        inputHash.inputs[i] <== witness[i];
    }
    inputHash.inputs[100] <== salt;
    inputHash.out === inputCommitment;
}

component main {public [jobId, circuitHash, inputCommitment, deadline, maxPrice]} = ProofJob();
```

## 영향

| 측면 | 영향 |
|--------|--------|
| **탈중앙화** | 단일 증명 엔티티 없음; 경쟁 시장 |
| **비용 효율성** | 경쟁이 증명 비용 하락 |
| **지연 시간 감소** | 여러 프로버가 대기 시간 단축 |
| **리소스 활용** | 유휴 용량 수익화 |
| **신뢰성** | 중복 프로버; 페일오버 기능 |
| **확장성** | 시장이 수요에 따라 성장 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **증인 프라이버시** | 암호화된 증인 전송; TEE 옵션 |
| **증명 위조** | 온체인 검증; 잘못된 증명에 대한 슬래싱 |
| **프로버 담합** | 다양한 프로버 집합; 무작위 할당 |
| **DoS 공격** | 속도 제한; 스테이크 요구사항 |
| **결제 분쟁** | 에스크로; 중재 메커니즘 |
| **타이밍 공격** | 일괄 작업 할당; 무작위 지연 |

## 구현 과제

1. **증인 기밀성**
   - 프로버는 증명을 생성하기 위해 증인 필요
   - 증인에는 민감한 데이터가 포함될 수 있음
   - 신뢰할 수 있는 하드웨어 (TEE) 또는 MPC 증명 고려

2. **증명 검증 비용**
   - 증명이 올바른지 검증해야 함
   - 검증에도 비용 발생
   - 이의 제기가 있는 낙관적 검증

3. **지연 시간 보장**
   - 사용자에게 예측 가능한 타이밍 필요
   - 하드웨어 성능 다양함
   - 페널티가 있는 SLA 약속

4. **가격 발견**
   - 바닥 경쟁 없이 공정한 가격 책정
   - 수요/공급 변동
   - Dutch 경매 또는 게시된 가격 고려

5. **회로 전문화**
   - 다른 회로는 다른 요구사항을 가짐
   - 프로버가 전문화할 수 있음
   - 풍부한 기능 매칭 필요

## 파생물

1. **Proof Auctions** - 증명 작업에 대한 경쟁 입찰. 프로버가 가격과 시간에 입찰. 요청자가 최적 제안 선택.

2. **Proof Verification** - 제출된 증명을 검증하는 별도 서비스. 결제 전에 잘못된 증명 포착. 온체인 검증 부하 감소.

3. **Prover Reputation** - 장기 평판 점수. 신뢰성, 속도, 정확도 기반. 더 높은 평판 = 더 많은 작업.

4. **Hardware Acceleration** - 특화된 하드웨어 (FPGA, ASIC) 증명. 더 높은 처리량; 더 낮은 단위 비용. 빠른 프로버에 대한 프리미엄.

5. **Proof Aggregation** - 여러 증명 요청 결합. 배치에 대한 단일 집계 증명. 증명당 비용 감소.

## 사용 사례

1. **사용자 거래 증명**
   - 사용자가 ZK-DEX 거래 생성
   - 마켓플레이스에 증인 제출
   - 프로버가 증명 생성; 사용자가 수수료 지불
   - 거래가 체인에 제출됨

2. **배치 증명 생성**
   - ZK-DEX가 보류 중인 거래 누적
   - 배치가 마켓플레이스에 제출됨
   - 프로버가 집계된 증명 생성
   - 효율적인 배치 정산

3. **실시간 증명**
   - 시간에 민감한 거래가 빠른 증명 필요
   - 신속한 서비스에 대한 프리미엄 가격
   - 고성능 프로버가 수락
   - 몇 초 내에 증명 전달

4. **증명 중복성**
   - 중요한 거래가 신뢰성 필요
   - 여러 프로버 할당
   - 첫 번째 유효한 증명 사용; 나머지 폐기
   - 보장된 완료

## 실제 제품 및 사용자 경험

### 1. "블라인드 프루빙" - 프로버도 거래 내용 모름

**제품 설명**:
외부 프로버에게 증명 생성을 위임하면서도 거래 내용(금액, 상대방)이 프로버에게 노출되지 않는 프라이버시 증명 서비스.

**일반 사용자 경험**:
- 김사용자(35세)는 $10,000 프라이빗 거래 실행
- 일반 프루빙: 프로버가 "김씨가 $10K 거래" 알게 됨
- 블라인드 프루빙: witness가 암호화되어 프로버에게 전달
- 프로버는 "유효한 증명 요청"만 알고 내용은 모름
- 증명 생성 후에도 거래 세부사항은 비공개

**관찰 가능한 이점**:
- 외부 인프라 사용해도 프라이버시 유지
- 프로버가 사용자 거래 데이터 축적 불가
- 증명 위임의 프라이버시 문제 해결

### 2. "익명 증명 요청" - 요청자 신원 숨김

**제품 설명**:
증명 요청 시 누가 요청했는지가 프로버에게 공개되지 않아 "이 사람이 얼마나 자주 거래하는지" 패턴 분석이 불가능한 서비스.

**일반 사용자 경험 (프로버 관점)**:
- 프로버가 여러 증명 요청 수신
- 일반 요청: "사용자 A가 하루 100건 요청" 패턴 파악
- 익명 요청: 요청마다 새로운 익명 식별자 사용
- 프로버는 "여러 익명 요청"만 보고 같은 사람인지 모름
- 사용 빈도로 거래 활동량 추론 불가

**관찰 가능한 이점**:
- 거래 빈도 패턴 숨김
- "활발한 트레이더" 식별 방지
- 프로버의 사용자 프로파일링 차단

### 3. "분산 프루빙 프라이버시" - 증명 조각 분산

**제품 설명**:
증명 생성을 여러 프로버에게 분산하여 어떤 단일 프로버도 전체 거래 정보를 알 수 없게 하는 MPC 기반 프루빙.

**일반 사용자 경험 (기업 관점)**:
- XYZ 거래소는 대량 증명 생성 필요
- 일반 프루빙: 하나의 프로버가 모든 거래 정보 접근
- 분산 프루빙: 증명이 여러 프로버에게 분산 처리
- 각 프로버는 암호화된 일부분만 처리
- 어떤 프로버도 전체 거래 내역 파악 불가

**관찰 가능한 이점**:
- 프로버 담합에도 프라이버시 유지
- 단일 실패점 없는 프라이버시 인프라
- 대규모 프루빙에서도 거래 비밀 보호

---

[Back to Index](../../README.md)
