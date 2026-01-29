# D3. Conviction Voting

투표는 시간이 지남에 따라 권력을 축적하여 장기적 헌신을 보상하고 플래시 론 거버넌스 공격을 방지합니다.

**제약 조건**: ~130K | **복잡도**: Low

---

## 배경

Conviction voting은 거버넌스를 장기 이해관계자와 일치시킵니다:

- **시간 헌신이 중요함**: 스냅샷 투표는 단기 거래자와 장기 보유자를 동등하게 취급합니다
- **플래시 론 저항**: 단일 블록 공격을 위해 빌린 토큰은 conviction을 축적할 수 없습니다
- **지속적인 신호**: 선호는 별도의 투표 기간 없이 언제든지 업데이트될 수 있습니다
- **인내 자본 일치**: 기회주의적 참여보다 지속적인 참여를 보상합니다

전통적인 거버넌스는 시점 스냅샷을 사용하여 일시적인 토큰 축적을 통한 조작을 가능하게 합니다. Conviction voting은 스테이킹 기간 동안 투표권을 축적하여 지속적인 지지자의 투표를 단발성 참가자보다 더 가치 있게 만듭니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `stakeHash` | field | 스테이크 세부 정보에 대한 해시 커밋먼트 |
| `proposalId` | uint | 지지하는 제안의 식별자 |
| `convictionPower` | uint | 계산된 conviction (수량 * 시간) |
| `currentTime` | uint | 시간 계산을 위한 현재 타임스탬프 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | 스테이커의 public key |
| `sk` | field | 소유권을 증명하는 secret key |
| `stakeAmount` | uint | 스테이킹된 토큰 양 |
| `stakeTime` | uint | 스테이크가 생성된 타임스탬프 |
| `stakeSalt` | field | 스테이크 note 무작위성 |
| `proposalStartTime` | uint | 제안 투표가 시작된 시간 |
| `maxConviction` | uint | Conviction 축적에 대한 제한 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template ConvictionVoting() {
    // ===== Public Inputs =====
    signal input stakeHash;
    signal input proposalId;
    signal input convictionPower;
    signal input currentTime;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input stakeAmount;
    signal input stakeTime;
    signal input stakeSalt;
    signal input proposalStartTime;
    signal input maxConviction;

    // ===== 1. Verify Stake Commitment =====
    component stake = Poseidon(5);
    stake.inputs[0] <== pkX;
    stake.inputs[1] <== pkY;
    stake.inputs[2] <== stakeAmount;
    stake.inputs[3] <== stakeTime;
    stake.inputs[4] <== stakeSalt;
    stake.out === stakeHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 3. Stake Must Predate Current Time =====
    component timeCheck = LessThan(64);
    timeCheck.in[0] <== stakeTime;
    timeCheck.in[1] <== currentTime;
    timeCheck.out === 1;

    // ===== 4. Calculate Effective Stake Duration =====
    // Duration counts from max(stakeTime, proposalStartTime)
    signal effectiveStartTime;
    component startTimeSelector = GreaterThan(64);
    startTimeSelector.in[0] <== stakeTime;
    startTimeSelector.in[1] <== proposalStartTime;

    // If stakeTime > proposalStartTime, use stakeTime; else use proposalStartTime
    effectiveStartTime <== stakeTime * startTimeSelector.out +
                           proposalStartTime * (1 - startTimeSelector.out);

    signal timeStaked;
    timeStaked <== currentTime - effectiveStartTime;

    // ===== 5. Calculate Raw Conviction =====
    signal rawConviction;
    rawConviction <== stakeAmount * timeStaked;

    // ===== 6. Apply Conviction Cap =====
    component capCheck = LessThan(128);
    capCheck.in[0] <== rawConviction;
    capCheck.in[1] <== maxConviction + 1;

    // If raw < max, use raw; else use max
    signal cappedConviction;
    cappedConviction <== rawConviction * capCheck.out +
                         maxConviction * (1 - capCheck.out);

    // ===== 7. Verify Conviction Power =====
    convictionPower === cappedConviction;

    // ===== 8. Ensure Positive Values =====
    component amountPositive = GreaterThan(64);
    amountPositive.in[0] <== stakeAmount;
    amountPositive.in[1] <== 0;
    amountPositive.out === 1;
}

component main {public [stakeHash, proposalId, convictionPower, currentTime]} =
    ConvictionVoting();
```

### 주요 제약 조건

1. **스테이크 진위성**: 스테이크 해시는 소유자 키, 금액, 시간, salt로부터 계산됨
2. **소유권 검증**: Secret key가 스테이크 소유권을 증명함
3. **시간적 유효성**: 스테이크는 현재 시간 이전에 존재해야 함
4. **Conviction 계산**: 권력 = 금액 * 시간 (선택적 제한 있음)
5. **기간 공정성**: 제안 시작부터의 시간만 계산 (사전 스테이킹 이점 방지)

## 효과

| 측면 | 영향 |
|--------|--------|
| **장기 일치** | 토큰 축적보다 지속적인 헌신을 보상함 |
| **플래시 론 면역** | 단일 블록 공격은 conviction이 없음 |
| **지속적인 거버넌스** | 별도의 투표 기간 없음; conviction은 지속적으로 축적됨 |
| **Sybil 저항** | 계정 간 토큰 분할이 총 conviction을 증가시키지 않음 |
| **공격 비용 증가** | 공격 위치 유지를 위해 지속적인 자본 잠금 필요 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **타임스탬프 조작** | 온체인 소스의 블록 타임스탬프 사용; 다중 블록 평균 |
| **사전 스테이킹 공격** | Conviction은 제안 생성 시간부터만 계산됨 |
| **Conviction 오버플로우** | 스테이크당 최대 conviction 제한; 128비트 산술 사용 |
| **스테이크 분할** | 분할에 관계없이 총 conviction 동일 (선형 함수) |
| **빠른 언스테이크** | 쿨다운 기간 구현; conviction은 점진적으로 감소함 |
| **오래된 스테이크 지배** | Conviction 감쇠 또는 주기적 리셋 메커니즘 고려 |

## 구현 과제

1. **지속적인 Conviction 추적**
   - 오프체인 인덱서가 각 스테이크에 대한 현재 conviction을 계산함
   - 증명 제출 시 conviction의 온체인 검증
   - Conviction 쿼리를 위한 효율적인 데이터 구조 필요

2. **감쇠 메커니즘**
   - 단순 선형 축적은 고대 스테이크를 과도하게 보상할 수 있음
   - 로그 성장 또는 주기적 감쇠 고려
   - 장기 보상과 거버넌스 응답성 간의 균형

3. **제안 라이프사이클**
   - 지속적인 투표는 제안이 명시적인 종료 조건을 필요로 함
   - Conviction이 정족수를 초과할 때 임계값 기반 실행
   - 제안 취소 및 스테이크 해제 처리

4. **스테이크 유동성**
   - 스테이킹된 토큰은 conviction을 위해 잠긴 상태로 유지되어야 할 수 있음
   - Conviction 보존 전송 또는 위임 고려
   - 헌신과 자본 효율성 간의 균형

## 파생 변형

1. **Decay-Adjusted Conviction** - Conviction은 로그 또는 제곱근 함수를 사용하여 수익 체감으로 성장합니다. 고대 스테이크가 지배하는 것을 방지하면서도 장기 헌신을 보상합니다. conviction = amount * sqrt(time)과 같은 공식을 구현합니다.

2. **Multi-Asset Conviction** - 여러 토큰(거버넌스 토큰, LP 토큰, 스테이킹 파생상품)에 걸쳐 conviction을 축적합니다. 다른 자산 유형에 다르게 가중치를 부여합니다. 단일 토큰 보유를 넘어선 다양한 프로토콜 참여를 보상합니다.

3. **Conviction Lending** - 스테이크 소유권을 유지하면서 다른 사람에게 conviction 권한을 위임합니다. 활발한 거버넌스 참가자가 수동적 보유자로부터 conviction을 빌릴 수 있는 conviction 시장을 가능하게 합니다.

4. **Conviction-Weighted Rewards** - 프로토콜 보상(수수료 공유, 배출)은 토큰 잔액이 아닌 conviction에 비례하여 분배됩니다. 장기 스테이킹 및 거버넌스 참여에 대한 복합 인센티브를 생성합니다.

5. **Threshold Conviction** - 축적된 conviction이 임계값을 넘을 때 제안이 자동으로 실행됩니다. 별도의 투표 기간이 필요하지 않습니다. Conviction은 철회될 수 있어 제안 지지가 줄어듭니다. 지속적이고 실시간 거버넌스를 생성합니다.

## 사용 사례

1. **지속적인 자금 조달 제안**
   - 프로젝트가 진행 중인 재무 자금 조달을 요청함
   - 커뮤니티 구성원이 제안을 향해 토큰을 스테이킹함
   - Conviction 임계값에 도달하면 자금 조달이 활성화됨
   - 지지가 약해지면 conviction이 떨어지고 자금 조달이 중단됨
   - 동적이고 반응적인 리소스 할당을 생성함

2. **프로토콜 매개변수 조정**
   - 커뮤니티가 수수료를 0.3%에서 0.25%로 조정하기를 원함
   - 매개변수 변경 제안이 생성됨
   - 장기 보유자는 몇 주 동안 conviction을 축적함
   - Conviction이 충분할 때 변경이 실행됨
   - 시간 요구 사항으로 인해 플래시 론 공격 불가능함

3. **보조금 위원회 선거**
   - 위원회 석에 대한 여러 후보자
   - 한 달간의 기간 동안 conviction 기반 투표
   - 지속적인 커뮤니티 지지를 받은 후보자 승리
   - 막판 투표 구매 또는 조작 방지
   - 장기 지지자 기반을 가진 후보자를 보상함

4. **비상 vs. 표준 제안**
   - 표준 제안은 높은 conviction 임계값 필요
   - 비상 제안은 낮은 임계값이지만 가디언 공동 서명 필요
   - 시간 기반 conviction은 성급한 악의적 제안을 방지함
   - 보안과 거버넌스 응답성 간의 균형

## 실제 제품 및 사용자 경험

참조: [Conviction Voting Products & UX](../../product/d-governance/d3-conviction-products.md)

---

[목차로 돌아가기](../../README.md)
