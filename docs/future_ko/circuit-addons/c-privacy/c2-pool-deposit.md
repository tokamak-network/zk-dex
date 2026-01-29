# C2. Privacy Pool Deposit

고정된 액면가로 믹싱 풀에 자금을 예치하여, 나중에 출금할 수 있는 연결 불가능한 커밋먼트를 생성합니다.

**제약 조건**: ~120K | **복잡도**: 낮음

---

## 배경

믹싱 풀은 자금 풀링을 통해 근본적인 트랜잭션 그래프 프라이버시를 제공합니다:

- **트랜잭션 그래프 단절**: 예치금이 동일 액면가의 다른 예치금과 구별 불가능해집니다
- **Tornado Cash 선례**: 규모별 프라이버시에 효과적인 믹싱 풀을 증명했습니다 (제재 전)
- **고정 액면가**: 표준 금액 (0.1, 1, 10, 100 ETH)이 익명성 집합 크기를 최대화합니다
- **커밋먼트 스킴**: 해시 기반 커밋먼트로 예치를 드러내지 않고 출금을 가능하게 합니다
- **시간 지연 이점**: 예치와 출금 사이의 더 긴 대기 시간이 프라이버시를 증가시킵니다

표준 블록체인 트랜잭션에서는 송신자와 수신자가 직접 연결됩니다. 프라이버시 풀은 동일한 예치금을 풀링하여 이 연결을 끊어, 어떤 예치자가 어떤 출금에 해당하는지 결정하는 것을 불가능하게 합니다. 커밋먼트 스킴은 원래 예치자만 출금할 수 있도록 보장합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 예치되는 노트의 해시 |
| `commitment` | field | 출금을 위한 풀 커밋먼트 |
| `denomination` | uint | 고정 풀 크기 (예: 1 ETH) |
| `tokenType` | uint | 예치되는 토큰 타입 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개키 |
| `salt` | field | 노트 무작위성 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `secret` | field | 출금 증명을 위한 무작위 비밀 |
| `nullifierSeed` | field | 출금 시 널리파이어 유도를 위한 시드 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

template PoolDeposit() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input commitment;
    signal input denomination;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input salt;
    signal input sk;
    signal input secret;
    signal input nullifierSeed;

    // ===== 1. Verify Note Format and Value =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== denomination;
    note.tokenType <== tokenType;
    note.salt <== salt;
    note.out === noteHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 3. Create Pool Commitment =====
    // commitment = H(noteHash, secret, nullifierSeed)
    component comm = Poseidon(3);
    comm.inputs[0] <== noteHash;
    comm.inputs[1] <== secret;
    comm.inputs[2] <== nullifierSeed;
    comm.out === commitment;

    // ===== 4. Verify Denomination is Valid =====
    // Note: In practice, contract enforces valid denominations
    // Circuit ensures note value matches declared denomination
    signal denominationCheck;
    denominationCheck <== denomination * denomination;
    // Dummy constraint to ensure denomination is used
}

component main {public [noteHash, commitment, denomination, tokenType]} =
    PoolDeposit();
```

### 주요 제약 조건

1. **노트 유효성**: 입력 노트가 올바른 값으로 적절하게 포맷되어야 합니다
2. **소유권 증명**: 노트 소유자만 풀에 예치할 수 있습니다
3. **커밋먼트 바인딩**: 커밋먼트가 노트, 비밀, 널리파이어 시드를 암호학적으로 바인딩합니다
4. **액면가 일치**: 노트 값이 풀 액면가와 정확히 일치해야 합니다
5. **고유 커밋먼트**: 무작위 비밀이 커밋먼트 고유성을 보장합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **익명성 집합** | 동일 액면가의 모든 예치금이 구별 불가능합니다 |
| **트랜잭션 그래프** | 예치와 출금 사이의 완전한 단절 |
| **유동성** | 고정 액면가는 여러 예치를 요구할 수 있습니다 |
| **시간 프라이버시** | 더 긴 지연이 익명성을 증가시킵니다 |
| **풀 크기** | 더 큰 풀이 더 강력한 프라이버시 보장을 제공합니다 |
| **규제 위험** | 믹싱 풀은 일부 관할권에서 법적 조사를 받습니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **커밋먼트 재생** | 특정 예치에 바인딩하기 위해 커밋먼트에 noteHash 포함 |
| **비밀 엔트로피** | 암호학적으로 안전한 난수 생성기 사용 |
| **타이밍 분석** | 출금 전 최소 대기 시간 권장 |
| **예치 패턴 분석** | 일관된 예치 금액 및 타이밍 사용 |
| **선행 거래** | 노트가 무효화된 후에만 커밋먼트 공개 |
| **풀 오염** | 예치가 정당한 노트에서 온 것인지 검증 |
| **상관관계 공격** | 동시에 동일 금액 예치 및 출금 피하기 |

## 구현 과제

1. **액면가 선택**
   - 너무 적으면: 풀당 유동성 부족
   - 너무 많으면: 익명성 집합 분산
   - 표준 세트: 0.1, 1, 10, 100 ETH 상당

2. **풀 관리**
   - 커밋먼트의 온체인 Merkle 트리
   - 효율적인 삽입 (예치당 ~50K 가스)
   - 트리 깊이가 총 용량을 제한

3. **다중 토큰 지원**
   - 토큰 타입별 별도 풀
   - 스테이블코인 풀은 다른 액면가를 가질 수 있습니다
   - 교차 토큰 예치는 스왑 통합이 필요합니다

4. **규정 준수 후크**
   - 규제 준수를 위한 선택적 무결성 증명
   - 자금이 불법 출처에서 오지 않았음을 증명하는 연합 세트
   - 프라이버시와 법적 요구 사항 사이의 균형

5. **사용자 경험**
   - 비밀과 널리파이어 시드를 안전하게 저장해야 합니다
   - 비밀 분실은 영구적인 자금 손실을 의미합니다
   - 복구 메커니즘 고려 (소셜 복구, 하드웨어 백업)

## 파생물

1. **연합 세트 (무결성 증명)** - 예치자가 자금이 알려진 불법 주소에서 발생하지 않았음을 증명할 수 있습니다. 사용자가 속한 특정 예치를 드러내지 않고 검증할 수 있는 "깨끗한" 예치 출처의 허용 목록을 생성합니다. 프라이버시를 유지하면서 규정 준수를 가능하게 합니다.

2. **임의 금액 풀** - 동형 커밋먼트를 사용하여 고정 액면가 요구 사항을 제거합니다. 예치자는 임의 금액을 예치하고 나중에 다른 금액을 출금할 수 있습니다 (거스름돈 포함). 더 유연하지만 금액 범위당 더 작은 익명성 집합입니다.

3. **교차 풀 스왑** - 여러 풀 또는 토큰 타입에 걸친 원자적 예치. USDC 풀에 USDC를 예치하는 동시에 ETH 풀에 ETH를 예치합니다. 연결을 드러내지 않고 포트폴리오 재조정을 가능하게 합니다.

4. **시간 잠금 예치** - 출금이 가능하기 전 최소 잠금 기간 요구. 더 긴 잠금은 더 큰 익명성 집합을 제공합니다 (더 많은 예치가 축적됨). 더 긴 잠금 기간에 대한 인센티브를 제공할 수 있습니다.

5. **릴레이어 호환 예치** - 가스 없는 출금을 가능하게 하기 위해 예치에 릴레이어 수수료 커밋먼트를 포함합니다. 예치자가 수수료 금액에 커밋하고, 릴레이어가 출금을 제출하고 수수료를 청구합니다. 개인 지갑에서 가스 지불을 피하여 프라이버시를 유지합니다.

## 사용 사례

1. **급여 프라이버시**
   - 직원이 급여를 프라이버시 풀에 예치합니다
   - 지연 후 개인 지갑으로 출금합니다
   - 고용주가 지출 습관을 추적할 수 없습니다
   - 별도 기록을 통해 세금 준수를 유지합니다

2. **비즈니스 트랜잭션 프라이버시**
   - 회사가 수익을 풀에 예치합니다
   - 공급업체에 비공개로 지급하기 위해 출금합니다
   - 경쟁업체가 비즈니스 관계를 분석할 수 없습니다
   - 공급망 인텔리전스 수집을 방지합니다

3. **기부 익명성**
   - 기부자가 자금을 풀에 예치합니다
   - 자선 단체 지갑으로 출금합니다
   - 기부 금액과 타이밍이 모호해집니다
   - 민감한 목적에 대한 기부자 프라이버시를 보호합니다

4. **DeFi 진입 프라이버시**
   - 사용자가 DeFi 활동 전에 자금을 예치합니다
   - 수익 농사를 위해 새 지갑으로 출금합니다
   - 이전 보유 자산이 DeFi 포지션과 연결되지 않습니다
   - 표적 청산 공격을 방지합니다

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Privacy Pool Deposit - Products & UX](../../product/c-privacy/c2-pool-deposit-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
