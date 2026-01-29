# A8. TWAP 주문 (TWAP Order)

정의된 기간 동안 대규모 주문을 작은 청크로 분할하여 시장 영향을 최소화하는 시간 가중 평균 가격 실행.

**제약 조건**: ~200K per chunk | **복잡도**: Medium

---

## 배경

TWAP는 불리한 시장 영향 없이 대규모 주문을 실행하는 데 필수적입니다:

- **시장 영향 최소화**: 한 번에 실행되는 대규모 주문은 가격을 불리하게 움직입니다; 시간 경과에 따른 실행 분산은 더 나은 평균 가격을 달성합니다
- **기관 표준**: TWAP는 전통적인 금융에서 가장 일반적인 알고리즘 실행 전략입니다
- **숨겨진 주문 크기**: 총 주문 수량이 프론트러닝할 수 있는 시장 관찰자로부터 숨겨집니다
- **예측 가능한 실행**: 알려진 실행 일정이 자본 가용성에 대한 계획을 허용합니다
- **벤치마크 성능**: TWAP는 실행 품질 측정을 위한 명확한 벤치마크를 제공합니다

전통적인 금융에서 TWAP는 모든 주요 브로커가 제공합니다. DeFi에서 TWAP 구현은 드물고 일반적으로 투명하여 주문 크기와 타이밍을 MEV 탐색자에게 노출합니다. ZK TWAP는 총 크기와 실행 일정을 모두 숨깁니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `orderHash` | field | 전체 TWAP 주문 커밋먼트의 해시 |
| `executionHash` | field | 이 청크의 출력 해시 |
| `newOrderHash` | field | 업데이트된 주문의 해시 (남은 청크) |
| `chunkIndex` | uint | 현재 청크 번호 (0부터 시작) |
| `totalChunks` | uint | 주문의 총 청크 수 |
| `currentTime` | uint | 현재 타임스탬프 |
| `tokenType` | uint | 실행되는 토큰 타입 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | 주문 소유자의 공개키 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `totalAmount` | uint | 총 주문 금액 (숨김) |
| `executedAmount` | uint | 이미 실행된 금액 |
| `startTime` | uint | TWAP 주문 시작 시간 |
| `endTime` | uint | TWAP 주문 종료 시간 |
| `orderSalt` | field | 주문 무작위성 |
| `chunkAmount` | uint | 이 청크의 실행 금액 |
| `chunkPrice` | uint | 이 청크의 실행 가격 |
| `chunkSalt` | field | 청크 출력 무작위성 |
| `outPkX, outPkY` | field | 출력 노트 소유자 |
| `outValue` | uint | 출력 값 (받은 토큰) |
| `outToken` | uint | 출력 토큰 타입 |
| `outSalt` | field | 출력 노트 무작위성 |
| `newOrderSalt` | field | 업데이트된 주문 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/math/safe_div.circom";

template TWAPExecution() {
    // ===== Public Inputs =====
    signal input orderHash;
    signal input executionHash;
    signal input newOrderHash;
    signal input chunkIndex;
    signal input totalChunks;
    signal input currentTime;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, sk;
    signal input totalAmount, executedAmount;
    signal input startTime, endTime, orderSalt;
    signal input chunkAmount, chunkPrice, chunkSalt;
    signal input outPkX, outPkY, outValue, outToken, outSalt;
    signal input newOrderSalt;

    // ===== 1. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== 2. Verify Order Hash =====
    component orderCommit = Poseidon(7);
    orderCommit.inputs[0] <== ownerPkX;
    orderCommit.inputs[1] <== ownerPkY;
    orderCommit.inputs[2] <== totalAmount;
    orderCommit.inputs[3] <== executedAmount;
    orderCommit.inputs[4] <== startTime;
    orderCommit.inputs[5] <== endTime;
    orderCommit.inputs[6] <== orderSalt;
    orderCommit.out === orderHash;

    // ===== 3. Time Window Validation =====
    // Calculate chunk time window
    signal duration;
    duration <== endTime - startTime;

    component chunkDuration = SafeDiv(64);
    chunkDuration.dividend <== duration;
    chunkDuration.divisor <== totalChunks;

    signal chunkStart;
    chunkStart <== startTime + chunkIndex * chunkDuration.quotient;

    signal chunkEnd;
    chunkEnd <== chunkStart + chunkDuration.quotient;

    // currentTime must be in [chunkStart, chunkEnd]
    component timeCheck1 = GreaterEqThan(64);
    timeCheck1.in[0] <== currentTime;
    timeCheck1.in[1] <== chunkStart;
    timeCheck1.out === 1;

    component timeCheck2 = LessEqThan(64);
    timeCheck2.in[0] <== currentTime;
    timeCheck2.in[1] <== chunkEnd;
    timeCheck2.out === 1;

    // ===== 4. Chunk Index Validation =====
    // chunkIndex must match executedAmount / (totalAmount / totalChunks)
    signal expectedChunksExecuted;
    component chunkSize = SafeDiv(64);
    chunkSize.dividend <== totalAmount;
    chunkSize.divisor <== totalChunks;

    component expectedIndex = SafeDiv(64);
    expectedIndex.dividend <== executedAmount;
    expectedIndex.divisor <== chunkSize.quotient;
    expectedChunksExecuted <== expectedIndex.quotient;

    chunkIndex === expectedChunksExecuted;

    // ===== 5. Chunk Amount Validation =====
    // Standard chunk size (last chunk may be smaller due to rounding)
    signal remainingAmount;
    remainingAmount <== totalAmount - executedAmount;

    // chunkAmount should be min(chunkSize, remainingAmount)
    component isLastChunk = IsZero();
    isLastChunk.in <== totalChunks - chunkIndex - 1;

    signal standardChunkAmount;
    standardChunkAmount <== chunkSize.quotient;

    // For non-last chunks, must equal standard size
    // For last chunk, must equal remaining amount
    signal expectedChunkAmount;
    expectedChunkAmount <== isLastChunk.out * remainingAmount +
                           (1 - isLastChunk.out) * standardChunkAmount;

    chunkAmount === expectedChunkAmount;

    // ===== 6. Output Value Calculation =====
    // outValue = chunkAmount * chunkPrice / PRICE_PRECISION
    signal expectedOutValue;
    expectedOutValue <== chunkAmount * chunkPrice;

    component outValueCheck = GreaterEqThan(128);
    outValueCheck.in[0] <== outValue * 1000000 + 1000000;  // With tolerance
    outValueCheck.in[1] <== expectedOutValue;
    outValueCheck.out === 1;

    // ===== 7. Create Execution Output Note =====
    component execOut = PoseidonRegularNote();
    execOut.pkX <== outPkX;
    execOut.pkY <== outPkY;
    execOut.value <== outValue;
    execOut.tokenType <== outToken;
    execOut.salt <== outSalt;
    execOut.out === executionHash;

    // ===== 8. Update Order State =====
    signal newExecutedAmount;
    newExecutedAmount <== executedAmount + chunkAmount;

    // If order complete, newOrderHash should be 0
    component isComplete = IsZero();
    isComplete.in <== totalAmount - newExecutedAmount;

    component newOrderCommit = Poseidon(7);
    newOrderCommit.inputs[0] <== ownerPkX;
    newOrderCommit.inputs[1] <== ownerPkY;
    newOrderCommit.inputs[2] <== totalAmount;
    newOrderCommit.inputs[3] <== newExecutedAmount;
    newOrderCommit.inputs[4] <== startTime;
    newOrderCommit.inputs[5] <== endTime;
    newOrderCommit.inputs[6] <== newOrderSalt;

    // If complete, hash is 0; otherwise, updated order hash
    signal expectedNewOrderHash;
    expectedNewOrderHash <== (1 - isComplete.out) * newOrderCommit.out;
    newOrderHash === expectedNewOrderHash;
}

component main {public [orderHash, executionHash, newOrderHash, chunkIndex,
    totalChunks, currentTime, tokenType]} = TWAPExecution();
```

### 주요 제약 조건

1. **소유권 검증**: 주문 소유자만이 청크를 실행할 수 있습니다
2. **시간 창**: 각 청크는 지정된 시간 창에서만 실행할 수 있습니다
3. **순차 실행**: 청크 인덱스는 실행된 청크 수와 일치해야 합니다
4. **청크 크기**: 비최종 청크는 고정 크기를 가짐; 최종 청크는 나머지를 취합니다
5. **값 계산**: 출력 값이 chunkAmount * price와 일치합니다
6. **상태 업데이트**: 새 주문 해시가 업데이트된 실행 금액을 반영합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **시장 영향** | 대규모 주문에서 최소화된 가격 슬리피지 |
| **실행 품질** | 단일 지점 실행 대 기간 동안의 평균 가격 |
| **전략 노출** | 숨겨진 총 주문 크기가 프론트러닝 방지 |
| **예측 가능성** | 자본 계획을 위한 알려진 실행 일정 |
| **벤치마크** | 품질 측정을 위한 명확한 지표 (실제 대 TWAP) |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **타이밍 조작** | 블록 타임스탬프 검증; 합리적인 범위 강제 |
| **주문 크기 발견** | 총 금액 숨김; 청크 크기만 보임 |
| **청크 건너뛰기** | 순차 인덱스 확인이 청크 건너뛰기 방지 |
| **조기/지연 실행** | 시간 창 제약이 일정 강제 |
| **가격 조작** | 각 청크가 시장 가격에서 실행; TWAP 오라클 고려 |
| **주문 취소 남용** | 취소 수수료 또는 지연 고려 |

## 구현 과제

1. **나눗셈 회로 복잡성**
   - 청크 타이밍 및 크기 조정을 위한 여러 나눗셈
   - 각 나눗셈에 SafeDiv 컴포넌트 필요
   - 불균등 분할에 대한 나머지 처리

2. **상태 지속성**
   - 주문 상태는 여러 트랜잭션에 걸쳐 지속되어야 함
   - 새 주문 해시가 실행 진행 상황을 추적
   - 온체인 주문 레지스트리 고려

3. **실행 인센티브**
   - 누가 청크 실행 증명을 제출하는가?
   - 키퍼 네트워크 통합 필요
   - 출력의 일부에서 실행 보상

4. **청크의 가격 소스**
   - 각 청크는 공정한 실행 가격이 필요
   - 청크 창 시간에 시장 주문
   - 청크당 제한 주문 통합 고려

5. **슬리피지 누적**
   - 청크당 작은 슬리피지가 누적될 수 있음
   - 총 슬리피지 허용 오차 매개변수 필요
   - 슬리피지가 과도한 경우 중단 메커니즘 고려

## 파생 상품

1. **VWAP (Volume-Weighted Average Price)** - 과거 볼륨 패턴에 가중된 실행. 높은 볼륨 기간 동안 더 많은 주식, 낮은 볼륨 동안 적게. 자연스러운 시장 흐름에 더 잘 일치합니다. 볼륨 오라클 또는 과거 데이터 커밋먼트가 필요합니다.

2. **적응형 TWAP** - 시장 조건에 따라 실행 속도를 조정합니다. 스프레드가 좁을 때 실행을 가속화합니다; 변동성이 있을 때 감속합니다. 실시간 시장 데이터 통합이 필요합니다. 회로에는 스프레드/변동성 확인이 포함됩니다.

3. **가격 한계가 있는 TWAP** - 각 청크는 최대 허용 가능한 가격을 가집니다. 시장 가격이 한계를 초과하면 청크가 다음 창으로 연기됩니다. 불리한 가격에서의 실행을 방지합니다. 청크당 가격 상한 확인을 추가합니다.

4. **무작위 TWAP** - 청크 실행 시간이 창 내에서 무작위화됩니다. 예측 가능한 실행 타이밍을 방지합니다. 프론트러닝을 더 어렵게 만듭니다. 검증 가능한 무작위성 통합이 필요합니다.

5. **크로스 베뉴 TWAP** - 여러 DEX/유동성 소스에 걸쳐 실행을 분할합니다. 경쟁을 통한 더 나은 가격 발견. 단일 증명이 다중 베뉴 라우팅을 커버합니다. 여러 프로토콜과의 복잡한 통합.

## 사용 사례

1. **기관 축적**
   - 펀드가 1천만 달러 상당의 ETH를 구매하고자 합니다
   - 단일 시장 주문이 가격을 2-3% 움직일 것입니다
   - 1주일에 걸친 TWAP: 168개의 시간별 청크
   - 각 청크 ~$60K는 최소한의 영향을 가집니다
   - 시장 평균 가격에 가까운 총 실행

2. **재무 다각화**
   - 프로토콜 재무가 100만 개의 거버넌스 토큰을 보유합니다
   - 분기 동안 스테이블로 다각화해야 합니다
   - TWAP는 매일 ~11K 토큰을 판매합니다
   - 시장이 패닉 없이 판매를 흡수합니다
   - "재무 덤핑"의 신호 없음

3. **베스팅 일정 실행**
   - 직원이 4년 토큰 베스팅을 가지고 있습니다
   - 토큰이 잠금 해제됨에 따라 판매하고자 합니다
   - 베스팅 일정에 맞춰진 TWAP
   - 토큰이 베스팅됨에 따라 자동 실행
   - 잠금 해제 날짜를 모니터링할 필요 없음

4. **포트폴리오 리밸런싱**
   - 투자 펀드 분기별 리밸런스
   - ETH에서 BTC로 20%를 이동해야 합니다
   - TWAP는 일주일에 걸쳐 양쪽을 실행합니다
   - 매수 및 매도가 시간에 걸쳐 분산됩니다
   - 두 자산에 대한 영향을 최소화합니다

## 실제 제품 및 사용자 경험

전용 제품 문서 참조: [제품 응용](../../product/a-core-trading/a8-twap-products.md)

---

[인덱스로 돌아가기](../../README.md)
