# A4. 익절 주문 (Take-Profit Order)

가격이 임계값 이상으로 상승할 때 자동 실행하여 지속적인 모니터링 없이 이익 실현을 가능하게 합니다.

**제약 조건**: ~150K | **복잡도**: Low

---

## 배경

익절 주문은 효과적인 거래 전략에 필수적입니다:

- **규율 시행**: 감정적인 거래를 방지하고 체계적인 이익 실현을 보장합니다
- **지속적인 모니터링 불가능**: 트레이더는 24/7 시장을 볼 수 없습니다; 자동화가 필수적입니다
- **프라이버시 누출 방지**: 목표 가격에서의 수동 청산은 거래 전략을 공개합니다
- **MEV 보호**: 사전 커밋된 트리거는 예측 가능한 청산의 프론트러닝을 방지합니다

전통적인 금융에서 익절 주문은 표준입니다. DeFi에서 대부분의 구현은 투명하여 트레이더의 의도를 노출합니다. ZK 익절 주문은 실행될 때까지 목표 가격을 숨깁니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 판매되는 노트의 해시 |
| `outputHash` | field | 출력 노트의 해시 (다른 토큰) |
| `targetPrice` | uint | 실행을 위한 최소 가격 (트리거될 때까지 숨김) |
| `currentPrice` | uint | 오라클이 제공하는 현재 가격 |
| `tokenType` | uint | 판매되는 토큰 타입 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개키 |
| `value` | uint | 노트 값 |
| `salt` | field | 노트 무작위성 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `outPkX, outPkY` | field | 출력 노트 소유자 (동일하거나 다를 수 있음) |
| `outValue` | uint | 전환 후 출력 값 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template TakeProfit() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input targetPrice;      // Minimum acceptable price
    signal input currentPrice;     // From oracle
    signal input tokenType;

    // ===== Private Inputs =====
    signal input pkX, pkY, value, salt, sk;
    signal input outPkX, outPkY, outValue, outToken, outSalt;

    // ===== 1. Verify Input Note =====
    component inputNote = PoseidonRegularNote();
    inputNote.pkX <== pkX;
    inputNote.pkY <== pkY;
    inputNote.value <== value;
    inputNote.tokenType <== tokenType;
    inputNote.salt <== salt;
    inputNote.out === noteHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 3. Price Condition: currentPrice >= targetPrice =====
    component priceCheck = GreaterEqThan(64);
    priceCheck.in[0] <== currentPrice;
    priceCheck.in[1] <== targetPrice;
    priceCheck.out === 1;

    // ===== 4. Value Calculation (price * quantity) =====
    // outValue should equal value * currentPrice / PRICE_PRECISION
    // This is verified off-chain; circuit only checks bounds
    signal expectedMinOutput;
    expectedMinOutput <== value * targetPrice;

    component outputCheck = GreaterEqThan(128);
    outputCheck.in[0] <== outValue * 1000000;  // PRICE_PRECISION
    outputCheck.in[1] <== expectedMinOutput;
    outputCheck.out === 1;

    // ===== 5. Verify Output Note =====
    component outputNote = PoseidonRegularNote();
    outputNote.pkX <== outPkX;
    outputNote.pkY <== outPkY;
    outputNote.value <== outValue;
    outputNote.tokenType <== outToken;
    outputNote.salt <== outSalt;
    outputNote.out === outputHash;
}

component main {public [noteHash, outputHash, targetPrice, currentPrice, tokenType]} =
    TakeProfit();
```

### 주요 제약 조건

1. **소유권 검증**: 노트 소유자만이 익절 주문을 생성할 수 있습니다
2. **가격 임계값**: `currentPrice >= targetPrice`가 성립해야 합니다
3. **최소 출력**: 출력 값은 목표 가격에서 예상되는 전환을 충족해야 합니다
4. **노트 형식 준수**: 입력 및 출력 노트 모두 표준 형식을 따릅니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **이익 포착** | 최적 수준에서 자동화된 이익 실현 |
| **자본 효율성** | 자금이 자동으로 기준 통화로 회전 |
| **프라이버시** | 실행될 때까지 목표 가격 숨김 |
| **MEV 보호** | 실행 매개변수가 탐색자에게 예측 불가능 |
| **가스 효율성** | 모니터링 + 수동 실행 대비 단일 증명 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **오라클 조작** | TWAP, 여러 오라클 소스 또는 커밋-공개 사용 |
| **오래된 가격** | 타임스탬프 확인 포함; 가격이 너무 오래되면 거부 |
| **실행 방해** | 실행자 보증금 요구; 성공적인 실행 시 환불 |
| **프론트러닝** | 가격이 이미 트리거되었다는 것은 실행이 유효함을 의미 |
| **재생 공격** | 무효화자는 소스 노트의 이중 지불을 방지 |

## 구현 과제

1. **오라클 통합**
   - 신뢰할 수 있고 조작 저항성 있는 가격 피드 필요
   - Chainlink, Uniswap TWAP 또는 여러 소스 고려
   - 가격 정밀도와 스케일링은 표준화되어야 함

2. **실행 인센티브**
   - 누가 가격을 모니터링하고 증명을 제출하는가?
   - 실행자 보상 메커니즘 필요 (출력에서 작은 수수료)
   - 키퍼 네트워크 통합 (Gelato, Chainlink Keepers)

3. **부분 체결**
   - 현재 설계는 전부 아니면 전무
   - 다른 가격 수준에서 부분 실행을 위한 확장 고려

4. **트리거 시 가스 비용**
   - 증명 검증 비용 (~200K 가스)이 작은 주문의 이익을 초과할 수 있음
   - 배치 실행이 비용을 상각할 수 있음

## 파생 상품

1. **추적 익절** - 목표 가격이 시장과 함께 상승하여 이익을 고정하면서 추가 상승을 허용합니다. 회로에서 과거 가격 추적이 필요합니다.

2. **단계별 익절** - 여러 목표 수준 (예: 2배에서 25%, 3배에서 25%, 5배에서 50% 판매). 단일 증명이 여러 출력 노트에 커밋합니다.

3. **시간 가중 익절** - 목표 가격이 시간이 지남에 따라 증가하여 기회 비용을 보상합니다. 타임스탬프 기반 가격 조정을 추가합니다.

4. **재투자가 있는 익절** - 출력이 자동으로 새 포지션에 진입합니다 (예: ETH를 USDC로 판매한 다음 풀에 LP). 원자적 다단계 실행.

5. **비율 기반 익절** - 절대 값이 아닌 진입 가격으로부터 +X%로 목표 지정. 진입 가격 커밋먼트가 필요합니다.

## 사용 사례

1. **스윙 트레이딩**
   - $100에 토큰을 구매하고 $150에 익절 설정
   - 떠나십시오; 목표에 도달하면 주문이 자동으로 실행됩니다
   - 청산 전략에 대한 정보 누출 없음

2. **DCA 청산 전략**
   - 투자자가 시간 경과에 따라 포지션을 축적했습니다
   - 점진적으로 청산하기 위해 여러 익절 수준을 설정합니다
   - 대규모 청산의 시장 영향을 줄입니다

3. **차익거래 보호**
   - 봇이 차익거래 기회를 식별합니다
   - 가격이 유리하게 움직이면 이익을 고정하기 위해 익절을 설정합니다
   - 시장이 반전되면 하락을 제한합니다

4. **기관 실행**
   - 펀드가 대규모 포지션을 청산해야 합니다
   - 다양한 수준에서 익절 주문이 단일 실패 지점을 피합니다
   - 프라이버시는 시장이 기관 흐름을 프론트러닝하는 것을 방지합니다

## 실제 제품 및 사용자 경험

전용 제품 문서 참조: [제품 응용](../../../product/a-core-trading/a4-take-profit-products.md)

---

[인덱스로 돌아가기](../../README.md)
