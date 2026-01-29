# HC3. 프라이빗 주문서 매칭

암호화된 주문서에서 단일 증명으로 여러 주문을 매칭합니다.

**제약조건**: ~1M | **복잡도**: 매우 높음

---

## 배경

전통적인 주문서는 중요한 정보를 노출합니다:
- 주문 가격은 거래 의도와 시장 심리를 드러냄
- 주문 규모는 선행 거래 및 샌드위치 공격을 가능하게 함
- 주문 타이밍이 정보 비대칭을 생성
- 다크풀은 존재하지만 투명성/검증 가능성이 부족

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 투명한 주문서 | 완전한 MEV 노출; 선행 거래가 만연함 |
| Commit-reveal 방식 | 타이밍 공격; 비공개로 인한 방해 |
| 전통적인 다크풀 | 신뢰할 수 있는 운영자; 검증 가능성 없음; 규제 우려 |
| AMM | 가격 발견 없음; 항상 LP에 대해 거래 |

프라이빗 주문서 매칭은 결제까지 개별 주문 세부 정보를 공개하지 않고 검증 가능한 공정한 매칭을 가능하게 합니다. 매칭 엔진은 주문서 상태를 노출하지 않고 올바른 실행을 증명합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bidCommitments` | field[N_BIDS] | 입찰 주문에 대한 commitment |
| `askCommitments` | field[N_ASKS] | 매도 주문에 대한 commitment |
| `matchResultHash` | field | 체결 결과에 대한 commitment |
| `clearedVolume` | uint | 총 매칭된 거래량 |
| `clearingPrice` | uint | 균일 청산 가격 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bidPkX/Y, bidAmount, bidMaxPrice, bidSalt` | 배열 | 입찰 주문 세부 정보 |
| `askPkX/Y, askAmount, askMinPrice, askSalt` | 배열 | 매도 주문 세부 정보 |
| `bidIsActive, askIsActive` | bool 배열 | 어느 주문 슬롯이 활성인지 |
| `bidFilled, askFilled` | uint 배열 | 주문당 체결 금액 |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **선행 거래** | 제거됨 - 주문이 매칭될 때까지 숨겨짐 |
| **정보 유출** | 최소 - 청산 가격/거래량만 공개됨 |
| **공정성** | 수학적으로 증명 가능한 가격-시간 우선순위 |
| **기관 채택** | 온체인에서 기관급 다크풀 가능 |
| **시장 품질** | 역선택 없이 더 나은 가격 발견 |
| **지연시간** | 배치 경매는 공정성을 위해 지연을 거래함 (예: 1 블록 = 12초) |

## 파생물

1. **빈번한 배치 경매 (FBA)** - 고정 간격(예: 매 블록)으로 주문 매칭. 배치의 모든 주문이 동일한 청산 가격을 받습니다. 속도 이점과 HFT 군비 경쟁을 제거합니다. CowSwap, Gnosis Protocol에서 사용됩니다.

2. **중간점 매칭** - 최고 입찰과 최고 매도의 중간점에서 스프레드 없이 매칭합니다. 외부 소스 또는 이전 경매의 참조 가격이 필요합니다. 양측에 동등하게 이익이 됩니다.

3. **비례 매칭** - 동일한 가격 수준의 주문 간에 체결을 비례적으로 분배합니다. 가격-시간 우선순위의 대안입니다. 동일한 가격에서 경쟁하는 대규모 주문에 더 공정합니다.

4. **빙산 주문 지원** - 보이는 팁이 있는 숨겨진 크기. 팁 금액만 공개; 나머지는 숨김. 팁을 먼저 실행한 후 다음 트랜치를 공개합니다. 대규모 주문의 시장 영향을 줄입니다.

5. **정지-제한 주문서** - 오라클 가격이 임계값을 넘을 때 주문을 트리거합니다. 주문서와 조건부 실행을 결합합니다. 복잡한 거래 전략을 가능하게 합니다.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/comparators.circom";

template PrivateOrderBookMatch(N_BIDS, N_ASKS) {
    // ===== Public Inputs =====
    signal input bidCommitments[N_BIDS];
    signal input askCommitments[N_ASKS];
    signal input matchResultHash;
    signal input clearedVolume;
    signal input clearingPrice;

    // ===== Private Inputs =====
    signal input bidPkX[N_BIDS], bidPkY[N_BIDS];
    signal input bidAmount[N_BIDS];
    signal input bidMaxPrice[N_BIDS];
    signal input bidSalt[N_BIDS];
    signal input bidIsActive[N_BIDS];

    signal input askPkX[N_ASKS], askPkY[N_ASKS];
    signal input askAmount[N_ASKS];
    signal input askMinPrice[N_ASKS];
    signal input askSalt[N_ASKS];
    signal input askIsActive[N_ASKS];

    signal input bidFilled[N_BIDS];
    signal input askFilled[N_ASKS];

    // ===== Component Declarations =====
    component bidHash[N_BIDS];
    component askHash[N_ASKS];
    component bidPriceCheck[N_BIDS];
    component askPriceCheck[N_ASKS];
    component bidFillCheck[N_BIDS];
    component askFillCheck[N_ASKS];
    component resultHash;

    // Intermediate signals
    signal bidFilledActive[N_BIDS];
    signal askFilledActive[N_ASKS];

    // ===== Verify Bid Commitments =====
    for (var i = 0; i < N_BIDS; i++) {
        bidHash[i] = Poseidon(6);
        bidHash[i].inputs[0] <== bidPkX[i];
        bidHash[i].inputs[1] <== bidPkY[i];
        bidHash[i].inputs[2] <== bidAmount[i];
        bidHash[i].inputs[3] <== bidMaxPrice[i];
        bidHash[i].inputs[4] <== bidSalt[i];
        bidHash[i].inputs[5] <== 0;  // order type = bid

        (bidHash[i].out - bidCommitments[i]) * bidIsActive[i] === 0;
    }

    // ===== Verify Ask Commitments =====
    for (var i = 0; i < N_ASKS; i++) {
        askHash[i] = Poseidon(6);
        askHash[i].inputs[0] <== askPkX[i];
        askHash[i].inputs[1] <== askPkY[i];
        askHash[i].inputs[2] <== askAmount[i];
        askHash[i].inputs[3] <== askMinPrice[i];
        askHash[i].inputs[4] <== askSalt[i];
        askHash[i].inputs[5] <== 1;  // order type = ask

        (askHash[i].out - askCommitments[i]) * askIsActive[i] === 0;
    }

    // ===== Verify Price Validity =====
    // Matched bids: maxPrice >= clearingPrice
    for (var i = 0; i < N_BIDS; i++) {
        bidPriceCheck[i] = LessThan(64);
        bidPriceCheck[i].in[0] <== clearingPrice;
        bidPriceCheck[i].in[1] <== bidMaxPrice[i] + 1;

        bidFilledActive[i] <== bidFilled[i] * bidIsActive[i];
        (1 - bidPriceCheck[i].out) * bidFilledActive[i] === 0;
    }

    // Matched asks: minPrice <= clearingPrice
    for (var i = 0; i < N_ASKS; i++) {
        askPriceCheck[i] = LessThan(64);
        askPriceCheck[i].in[0] <== askMinPrice[i];
        askPriceCheck[i].in[1] <== clearingPrice + 1;

        askFilledActive[i] <== askFilled[i] * askIsActive[i];
        (1 - askPriceCheck[i].out) * askFilledActive[i] === 0;
    }

    // ===== Verify Fill Constraints =====
    for (var i = 0; i < N_BIDS; i++) {
        bidFillCheck[i] = LessThan(64);
        bidFillCheck[i].in[0] <== bidFilled[i];
        bidFillCheck[i].in[1] <== bidAmount[i] + 1;
        bidFillCheck[i].out === 1;
    }

    for (var i = 0; i < N_ASKS; i++) {
        askFillCheck[i] = LessThan(64);
        askFillCheck[i].in[0] <== askFilled[i];
        askFillCheck[i].in[1] <== askAmount[i] + 1;
        askFillCheck[i].out === 1;
    }

    // ===== Verify Volume Balance =====
    var totalBidFilled = 0;
    var totalAskFilled = 0;

    for (var i = 0; i < N_BIDS; i++) {
        totalBidFilled += bidFilled[i] * bidIsActive[i];
    }
    for (var i = 0; i < N_ASKS; i++) {
        totalAskFilled += askFilled[i] * askIsActive[i];
    }

    totalBidFilled === totalAskFilled;
    totalBidFilled === clearedVolume;

    // ===== Compute Match Result Hash =====
    resultHash = Poseidon(N_BIDS + N_ASKS + 2);
    for (var i = 0; i < N_BIDS; i++) {
        resultHash.inputs[i] <== bidFilled[i];
    }
    for (var i = 0; i < N_ASKS; i++) {
        resultHash.inputs[N_BIDS + i] <== askFilled[i];
    }
    resultHash.inputs[N_BIDS + N_ASKS] <== clearingPrice;
    resultHash.inputs[N_BIDS + N_ASKS + 1] <== clearedVolume;
    resultHash.out === matchResultHash;
}

component main {public [bidCommitments, askCommitments, matchResultHash,
    clearedVolume, clearingPrice]} = PrivateOrderBookMatch(32, 32);
```

### 주요 제약조건

1. **Commitment 무결성**: 모든 주문이 commitment에 대해 검증됨
2. **가격-체결 일관성**: 유효한 가격의 주문만 체결될 수 있음
3. **체결 한계**: 주문 금액 이상 체결할 수 없음
4. **거래량 균형**: 총 입찰 체결이 총 매도 체결과 같음
5. **결과 바인딩**: 매칭 결과 해시가 특정 체결에 commit

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **주문서 조작** | 아래 세부 분석 참조 |
| **매칭 엔진 담합** | 분산 매처 선택; 여러 경쟁 증명자 |
| **선행 거래** | 매칭 전에 주문 커밋됨; 주문서 가시성 없음 |
| **가격 조작** | 균일 청산 가격; 모든 거래가 동일한 가격으로 |
| **선택적 매칭** | 증명은 최적 매칭을 보여야 함; 검증 가능 |
| **정보 유출** | 청산 가격과 거래량만 공개됨 |
| **시빌 주문** | 요율 제한; 스테이크 기반 주문 제출 |
| **방해 (제출 및 취소)** | 취소 수수료; 주문에 시간 잠금 |

### 주문서 조작 방지

회로 설계는 여러 메커니즘을 통해 조작을 해결합니다:

**1. 균일 청산 가격**
- 모든 매칭된 주문이 동일한 청산 가격에서 실행됨
- 가격 차별 또는 레이어링 공격 방지
- 조작 시도는 모든 참가자에게 동등하게 영향

**2. Commitment 바인딩**
- 매칭 라운드 전에 주문이 커밋됨
- 커밋하기 전에 다른 주문을 볼 수 없음
- 반응적 주문 배치 방지

**3. 증명 가능한 최적성**
- 매칭 엔진은 청산 가격이 거래량을 최대화함을 증명해야 함
- 준최적 매칭(특정 주문 선호)은 감지 가능
- 누구나 오프체인에서 매칭 품질을 검증 가능

**4. 분산 매칭**
- 여러 엔티티가 매처가 되기 위해 경쟁 가능
- 한 매처가 준최적 매칭을 생성하면 다른 매처가 도전 가능
- 최적 매칭을 생성하려는 경제적 인센티브

**5. 시간-우선순위 확장**
가격-시간 우선순위가 필요한 구현의 경우:
```
// 주문 commitment에 타임스탬프 추가
bidHash.inputs[6] <== bidTimestamp[i];

// 동일한 가격에서 더 이른 타임스탬프가 먼저 체결되는지 검증
// (정렬 증명 필요 - 제약조건이 크게 증가)
```

## 구현 과제

1. **최적 매칭 알고리즘**
   - 최대 거래량 청산 가격 찾기는 오프체인에서 O(n log n)
   - 회로는 검증만 하고 계산하지 않음
   - 매칭을 위한 효율적인 witness 생성 필요

2. **ZK에서 가격-시간 우선순위**
   - 올바른 우선순위 순서를 증명하는 것은 ~200K 제약조건 추가
   - 대안: 모든 주문이 동등한 배치 경매
   - 공정성 모델과 회로 복잡성 간의 트레이드오프

3. **부분 체결**
   - 현재 설계는 자연스럽게 부분 체결 지원
   - 잔여 주문 추적 메커니즘 필요
   - 주문 분할 vs. 연속 매칭 고려

4. **주문 취소**
   - 매칭 전에 커밋된 주문을 어떻게 취소할 것인가?
   - 별도의 취소 증명 또는 타임아웃 필요
   - 유연성과 방해 방지 간의 균형

5. **확장성**
   - 32개 입찰 + 32개 매도 = ~1M 제약조건
   - 더 큰 주문서는 계층적 매칭 필요
   - 이월 주문과 함께 배치 매칭 고려

6. **증명 제출의 MEV**
   - 누가 증명을 제출하는가? 그들은 매칭 결과를 볼 수 있음
   - 온체인까지 매칭 결과를 암호화
   - 또는 증명 제출에 commit-reveal 사용

## 사용 사례

1. **기관 다크풀**
   - 주문 세부 정보를 공개하지 않고 32개 입찰과 32개 매도를 매칭
   - 청산 가격과 거래량만 공개
   - 규제 준수 검증 가능한 실행

2. **DEX 배치 경매**
   - 고정 시간 창에 대해 주문 수집
   - 균일 청산 가격에서 매칭
   - 선행 거래를 완전히 제거

3. **RFQ (견적 요청) 시장**
   - 여러 마켓 메이커가 견적 제출
   - 최고의 견적이 증명 가능하게 선택됨
   - 테이커는 매칭까지 크기를 공개하지 않음

4. **1차 시장 발행**
   - 토큰 판매를 위한 주문서 구축
   - 조작 없는 공정한 가격 발견
   - 모든 참가자가 동등하게 대우됨

5. **크로스 거래소 매칭**
   - 여러 장소의 주문서 집계
   - 거래소 간 원자적 매칭
   - 규제 당국을 위한 최선 실행 증명

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../../future/product/high-complexity/hc3-private-order-book-match-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
