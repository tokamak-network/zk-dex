# J2. 증명 압축 (Proof Compression)

보안 보장과 검증 효율성을 유지하면서 증명 크기와 온체인 공간을 줄이는 기술.

**요구사항**: 압축 알고리즘 | 간결한 증명 시스템 | 온체인 압축 해제 | Calldata 최적화

---

## 배경

증명 크기는 온체인 비용과 확장성에 직접적인 영향을 미칩니다:

- **Calldata 비용**: 바이트당 약 16 가스; 대형 증명은 비용 많이 듦
- **저장 요구사항**: 증명이 온체인 저장 필요할 수 있음
- **대역폭 제한**: 대형 증명은 전송 및 검증이 느림
- **블록 공간 경쟁**: 증명 데이터를 위한 제한된 공간

증명 압축은 다음을 통해 이를 해결합니다:
- 정보 손실 없이 증명 표현 최소화
- 더 작은 네이티브 증명을 가진 간결한 증명 시스템 사용
- 크기를 상각하기 위해 여러 증명 집계
- 온체인 계산 대 데이터 트레이드오프 활용

ZK-DEX의 경우, 압축을 통해 비용 효율적인 대량 증명 검증이 가능합니다.

## 기술 명세

### 아키텍처 개요

```
Prover                        Compression Layer                  On-Chain
+-------------+               +------------------------+         +-------------+
|             |               |                        |         |             |
| Generate    |  Full Proof   |  Compression           |  Small  |  Decompress |
| Proof       |-------------->|  Algorithm             |  Proof  |  & Verify   |
| (~1MB)      |               |                        |-------->|             |
|             |               |  +----------------+    |  (~256B)|             |
+-------------+               |  | SNARK Wrapper  |    |         +-------------+
                              |  +----------------+    |
                              |         |              |
                              |         v              |
                              |  +----------------+    |
                              |  | Calldata       |    |
                              |  | Optimization   |    |
                              |  +----------------+    |
                              +------------------------+
```

### 구성 요소 목록

| 구성 요소 | 설명 |
|-----------|-------------|
| **SNARK Wrapper** | 더 간결한 증명 시스템으로 증명 래핑 |
| **Proof Serializer** | calldata를 위한 증명 인코딩 최적화 |
| **Compression Engine** | 알고리즘 압축 적용 |
| **Decompression Contract** | 온체인 증명 재구성 |
| **Batching Layer** | 압축 전 증명 집계 |
| **Verification Adapter** | 압축된 증명을 검증자와 인터페이스 |

### 데이터 흐름

1. **증명 생성**
   - 원본 증명 생성 (대형 STARK일 수 있음)
   - 증명이 압축 레이어로 전달

2. **압축 파이프라인**
   - SNARK 래퍼가 간결한 증명의 증명 생성
   - Calldata 최적화 적용
   - 최종 압축된 증명 생성

3. **온체인 검증**
   - 압축된 증명을 트랜잭션으로 제출
   - 필요 시 압축 해제
   - 압축 해제된/래핑된 증명 검증

### 압축 전략

| 전략 | 압축 비율 | 검증 비용 | 트레이드오프 |
|----------|-------------------|-------------------|-----------|
| **STARK-to-SNARK** | 100-1000x | 낮음 | 증명 시간 증가 |
| **Proof Aggregation** | Nx | 상수 | 배치 지연 |
| **Encoding Optimization** | 1.5-2x | 없음 | 제한된 압축 |
| **Deferred Verification** | N/A | 상각 | 챌린지 기간 |

### SNARK 래퍼 회로

```circom
pragma circom 2.1.0;

// Conceptual: SNARK that verifies a STARK proof
// Real implementations use specialized libraries

include "../utils/poseidon/poseidon.circom";

template STARKVerifierSNARK() {
    // Public inputs
    signal input starkPublicInputs[10];  // Original STARK public inputs
    signal input proofCommitment;         // Commitment to STARK proof

    // Private inputs (the STARK proof data)
    signal input starkProof[1000];        // STARK proof elements
    signal input auxiliaryData[100];      // Verification hints

    // Verify STARK proof within SNARK circuit
    // This is computationally intensive but produces small proof

    // 1. Verify Merkle roots of STARK trace
    component traceVerifier = STARKTraceVerifier();
    // ... verification logic

    // 2. Verify FRI layer consistency
    component friVerifier = FRIVerifier();
    // ... verification logic

    // 3. Verify constraint satisfaction
    component constraintChecker = ConstraintChecker();
    // ... verification logic

    // 4. Commit to proof for reference
    component proofHash = Poseidon(1000);
    for (var i = 0; i < 1000; i++) {
        proofHash.inputs[i] <== starkProof[i];
    }
    proofHash.out === proofCommitment;
}

component main {public [starkPublicInputs, proofCommitment]} = STARKVerifierSNARK();
```

## 효과

| 측면 | 영향 |
|--------|--------|
| **가스 비용** | calldata 비용 10-100배 감소 |
| **처리량** | 블록당 더 많은 증명 |
| **지연시간** | 트레이드오프: 압축으로 증명 시간 추가 |
| **유연성** | 모든 증명 시스템 사용 가능, 효율성을 위해 래핑 |
| **조합 가능성** | 소스와 관계없이 균일한 증명 형식 |
| **저장** | 보관 및 인덱싱을 위한 더 작은 증명 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **압축 건전성** | 잘 분석된 래퍼 증명 시스템 |
| **압축 해제 버그** | 압축 해제기의 형식 검증 |
| **사이드 채널 공격** | 상수 시간 압축 알고리즘 |
| **증명 가변성** | 표준 압축 형식 |
| **래퍼 오버헤드** | 효율적인 래퍼 회로 설계 |
| **신뢰 설정 (SNARK 래퍼)** | 기존 의식 재사용; 투명한 대안 |

## 구현 과제

1. **STARK-to-SNARK 복잡성**
   - SNARK 회로에서 STARK 검증은 비용 많이 듦
   - 완전한 검증을 위해 수백만 개의 제약 조건
   - 최적화된 STARK 검증자 회로 필요

2. **증명 시간 트레이드오프**
   - 압축으로 총 증명 시간 증가
   - 병렬 증명 인프라 필요할 수 있음
   - 압축과 지연시간 간의 균형

3. **증명 시스템 호환성**
   - 다양한 증명 시스템이 다양한 구조 보유
   - 범용 래퍼 또는 시스템별 최적화 필요
   - 증명 집계 호환성 고려

4. **온체인 가스 최적화**
   - 작은 증명도 가스 오버헤드 있음
   - calldata 인코딩 최적화
   - blob 트랜잭션 고려 (EIP-4844)

5. **검증 컨트랙트 복잡성**
   - 복잡한 검증자는 더 많은 공격 표면 보유
   - 가스와 보안 간의 균형
   - 일반 작업을 위한 프리컴파일 고려

## 파생형

1. **Succinct Proofs** - 본질적으로 간결한 증명 시스템 사용 (Groth16, PLONK). 기본적으로 약 256바이트 증명. 트레이드오프: 신뢰 설정 필요.

2. **Aggregated Verification** - 여러 증명을 배치; 단일 집계 검증. 증명당 오버헤드 상각. 로그 또는 상수 검증 비용.

3. **Proof Streaming** - 생성되는 대로 증명을 점진적으로 전송. 부분 증명의 조기 검증. 인지된 지연시간 감소.

4. **Deferred Verification** - 커밋먼트 게시, 요청 시 지연 검증. 챌린지 기간이 있는 낙관적 모델. 정직한 경우 극단적인 비용 절감.

5. **Proof Caching** - 재사용을 위해 검증된 증명 캐싱. 알려진 증명의 재검증 건너뛰기. 반복 작업에 유용.

## 사용 사례

1. **STARK to Ethereum**
   - 애플리케이션이 STARK 사용 (신뢰 설정 없음)
   - STARK 증명은 100KB 이상
   - SNARK로 래핑하여 온체인 약 256B
   - 양쪽의 장점

2. **대량 거래 DEX**
   - 수천 건의 거래가 증명 생성
   - 일일 배치 집계 및 압축
   - 단일 작은 증명으로 모든 것 정산
   - 극적인 비용 절감

3. **크로스 롤업 증명**
   - 여러 롤업이 증명 생성
   - 효율적인 브릿징을 위해 각각 압축
   - 압축된 증명 집계
   - 효율적인 멀티 롤업 정산

4. **모바일 검증**
   - 모바일 장치가 증명 검증
   - 대역폭 및 계산 제한
   - 압축된 증명 필수
   - 모바일 우선 애플리케이션 가능

## 실제 제품 및 사용자 경험

### 1. "프라이버시 유지 압축" - 압축해도 정보 노출 없음

**제품 설명**:
증명을 압축할 때 프라이빗 정보가 압축 과정에서 노출되지 않도록 보장하는 프라이버시 보존 압축 서비스.

**일반 사용자 경험**:
- 이모바일씨(25세)는 프라이빗 거래를 모바일에서 사용
- 일반 압축: 압축 과정에서 일부 메타데이터 노출 가능
- 프라이버시 압축: 압축된 증명에서도 거래 정보 추출 불가
- 작은 256B 증명이지만 프라이버시는 그대로 유지
- 압축으로 인한 정보 누출 제로

**관찰 가능한 이점**:
- 효율성과 프라이버시 동시 확보
- 압축 과정에서 메타데이터 보호
- 모바일 환경에서도 완전한 프라이버시

### 2. "익명 크로스롤업" - 롤업 이동 시 연결고리 제거

**제품 설명**:
롤업 간 브릿지 증명을 압축할 때 "어느 롤업에서 어느 롤업으로" 연결 정보를 제거하는 프라이버시 브릿지.

**일반 사용자 경험**:
- 박브릿저씨는 A 롤업에서 B 롤업으로 이동
- 일반 브릿지 증명: "A→B 이동" 연결 정보 포함
- 익명 브릿지: 압축 시 연결 정보가 숨겨짐
- 최종 증명에서 "어디서 왔는지" 추론 불가
- 크로스롤업 추적 완전 차단

**관찰 가능한 이점**:
- 롤업 간 자산 흐름 추적 방지
- 멀티롤업 사용 패턴 숨김
- 프라이버시 보존 크로스롤업 이동

### 3. "제로 메타데이터 압축" - 증명 시스템 정보도 숨김

**제품 설명**:
STARK-to-SNARK 변환 시 어떤 증명 시스템을 사용했는지, 어떤 프로토콜에서 왔는지 정보가 모두 제거되는 서비스.

**일반 사용자 경험 (프로토콜 운영자 관점)**:
- XYZ 프로토콜은 특정 STARK 시스템 사용
- 일반 변환: "이 증명은 XYZ에서 온 것" 추론 가능
- 제로 메타데이터: 변환 후 출처 프로토콜 정보 없음
- 모든 압축 증명이 동일하게 보임
- 프로토콜별 사용자 활동 분리

**관찰 가능한 이점**:
- 프로토콜 사용 내역 비공개
- 증명 출처 추적 방지
- 프로토콜 간 활동 연결 차단

---

[Back to Index](../../README.md)
