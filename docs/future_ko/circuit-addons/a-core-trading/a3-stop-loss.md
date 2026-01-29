# A3. 손절매 주문 (Stop-Loss Order)

가격이 임계값 아래로 떨어질 때 자동 실행하여 포지션 세부 정보를 노출하지 않고 위험 관리를 가능하게 합니다.

**제약 조건**: ~150K | **복잡도**: Low

---

## 배경

손절매 주문은 책임 있는 거래와 위험 관리의 기본입니다:

- **자동화된 보호**: 트레이더는 24/7 시장을 모니터링할 수 없습니다; 자동화된 손실 한계가 필수적입니다
- **감정적 규율**: 사전 커밋된 청산은 더 나쁜 가격에서의 패닉 판매나 치명적인 손실을 통한 보유를 방지합니다
- **포지션 크기 조정**: 위험 관리는 거래당 알려진 최대 손실이 필요합니다
- **프라이버시 보존**: 수동 손절매 실행은 시장 관찰자에게 트리거 가격을 공개합니다
- **MEV 보호**: 숨겨진 트리거 가격은 MEV 탐색자에 의한 프론트러닝 및 손절 사냥을 방지합니다

전통적인 금융에서 손절매 주문은 표준 위험 관리 도구입니다. DeFi에서 대부분의 구현은 투명하여 정교한 행위자가 이익을 위해 손절매를 트리거할 수 있습니다 (손절 사냥). ZK 손절매 주문은 실행될 때까지 트리거 가격을 숨깁니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 보호되는 노트의 해시 |
| `outputHash` | field | 실행 후 출력 노트의 해시 |
| `triggerPrice` | uint | 주문이 실행되는 가격 이하 |
| `currentPrice` | uint | 오라클이 제공하는 현재 시장 가격 |
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
| `outToken` | uint | 출력 토큰 타입 (일반적으로 스테이블코인) |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template StopLoss() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input triggerPrice;
    signal input currentPrice;
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

    // ===== 3. Price Condition: currentPrice <= triggerPrice =====
    component priceCheck = LessEqThan(64);
    priceCheck.in[0] <== currentPrice;
    priceCheck.in[1] <== triggerPrice;
    priceCheck.out === 1;

    // ===== 4. Value Calculation =====
    // Output value = input value * currentPrice / PRICE_PRECISION
    // This ensures user receives fair value at execution price
    signal expectedMinOutput;
    expectedMinOutput <== value * currentPrice;

    // Output must be at least expected value (minus small slippage tolerance)
    component outputCheck = GreaterEqThan(128);
    outputCheck.in[0] <== outValue * 1000000 + 1000000;  // PRICE_PRECISION + tolerance
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

    // ===== 6. Output Token Validation =====
    // Ensure output is different token (actual swap occurred)
    component tokenDiff = IsZero();
    tokenDiff.in <== tokenType - outToken;
    tokenDiff.out === 0;  // Must be different tokens
}

component main {public [noteHash, outputHash, triggerPrice, currentPrice, tokenType]} =
    StopLoss();
```

### 주요 제약 조건

1. **소유권 검증**: 노트 소유자만이 손절매 주문을 생성할 수 있습니다
2. **가격 트리거**: 실행을 위해 `currentPrice <= triggerPrice`가 성립해야 합니다
3. **최소 출력**: 출력 값은 현재 가격에서 예상되는 전환을 충족해야 합니다
4. **노트 형식 준수**: 입력 및 출력 노트 모두 표준 형식을 따릅니다
5. **토큰 교환**: 출력은 다른 토큰 타입이어야 합니다 (no-op 방지)

## 효과

| 측면 | 영향 |
|--------|--------|
| **위험 관리** | 정의된 한계로 자동화된 손실 보호 |
| **프라이버시** | 실행될 때까지 트리거 가격 숨김 |
| **UX** | 설정하고 잊어버리는 포지션 보호 |
| **MEV 보호** | 손절 사냥이 수익성이 없게 됨 |
| **자본 보존** | 치명적인 손실 방지 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **오라클 조작** | TWAP, 여러 오라클 소스 또는 커밋-공개 방식 사용 |
| **오래된 가격 데이터** | 타임스탬프 검증 포함; 가격 데이터가 너무 오래되면 실행 거부 |
| **플래시론 공격** | TWAP 오라클은 단일 블록 조작에 저항 |
| **손절 사냥** | 트리거 가격 숨김; 공격자는 손절을 수익성 있게 타겟할 수 없음 |
| **실행 방해** | 실행자 보증금 요구; 성공적인 실행 시 환불 |
| **재생 공격** | 무효화자는 소스 노트의 이중 지불을 방지 |

## 구현 과제

1. **오라클 통합**
   - 신뢰할 수 있고 조작 저항성 있는 가격 피드 필요
   - Chainlink, Uniswap V3 TWAP 또는 여러 소스
   - 가격 정밀도와 스케일링은 표준화되어야 함
   - 오라클 지연 대 실행 속도 트레이드오프 고려

2. **실행 인센티브**
   - 누가 가격을 모니터링하고 트리거될 때 증명을 제출하는가?
   - 실행자 보상 메커니즘 (출력의 작은 비율)
   - 키퍼 네트워크와의 통합 (Gelato, Chainlink Automation)
   - 실행자를 위한 가스 비용 회수

3. **슬리피지 보호**
   - 시장이 트리거 가격을 통해 갭할 수 있음
   - 최대 슬리피지 매개변수 고려
   - 슬리피지가 초과되면 제한 주문으로 폴백

4. **주문 취소**
   - 사용자는 트리거 전에 취소할 수 있는 능력이 필요
   - 취소 증명은 실행 없이 주문을 무효화
   - 남용을 방지하기 위한 시간 잠금 취소 고려

5. **다중 트리거 시나리오**
   - 가격이 트리거 주변에서 진동할 수 있음
   - 첫 번째 유효한 실행이 주문을 소비
   - 재진입을 위한 쿨다운 기간 고려

## 파생 상품

1. **추적 손절매** - 시장이 상승함에 따라 손절 가격이 자동으로 상향 조정되어 이익을 고정하면서 추가 상승을 허용합니다. 주문 생성 이후 최고 가격 추적이 필요합니다. 회로에는 고수위 마크 커밋먼트와 조정 비율이 포함됩니다.

2. **시간 감쇠가 있는 조건부 손절** - 시간이 지남에 따라 손절 가격이 강화되어 가격이 정체되면 더 빨리 청산하도록 합니다. 시간 가치가 중요한 옵션 같은 전략에 유용합니다. 타임스탬프 기반 트리거 조정 계산을 추가합니다.

3. **다중 자산 손절 캐스케이드** - 단일 트리거가 여러 상관 포지션을 동시에 청산합니다. BTC 손절이 트리거되면 ETH 및 기타 상관 자산도 청산됩니다. 배치 실행과 결합된 증명이 가스 비용을 줄입니다.

4. **부분 청산이 있는 손절매** - 가격이 여러 트리거 수준을 통해 떨어짐에 따라 점진적인 청산. -5%에서 25% 판매, -10%에서 또 다른 25% 등. 제어된 포지션 축소를 위해 손절매와 부분 체결을 결합합니다.

5. **보장된 손절매 (오라클 지원)** - 오라클 제공자가 슬리피지에 관계없이 트리거 가격에서 실행을 보장하는 보험 같은 상품. 사전 지불된 프리미엄이 갭 위험에 대해 오라클을 보상합니다. 회로에는 보험 커밋먼트 검증이 포함됩니다.

## 사용 사례

1. **포지션 보호**
   - 트레이더가 $2000에 ETH를 구매하고 $1800에 손절매를 설정
   - 시장 붕괴에 관계없이 최대 손실은 10%로 제한됨
   - 최악의 경우가 정의되어 있다는 것을 알고 평화롭게 잠을 잘 수 있음
   - 차트를 지속적으로 모니터링할 필요 없음

2. **이익 보호**
   - 거래가 이미 수익성이 있음; ETH가 $2000 진입에서 현재 $2500
   - 손절매를 $2200으로 이동하여 최소 10% 이익 고정
   - 시장이 반전되면 이익이 자동으로 확보됨
   - 이익을 보장하면서 포지션이 실행되도록 허용

3. **포트폴리오 위험 관리**
   - 10개의 다른 토큰에 걸친 투자 포트폴리오
   - 각 포지션은 -15%에서 개별 손절매를 가짐
   - 어떤 자산이 붕괴하든 총 포트폴리오 하락이 제한됨
   - 손절이 실행됨에 따라 자동화된 리밸런싱

4. **레버리지 포지션 관리**
   - 레버리지 포지션을 위해 담보에 대해 차입
   - 손절매는 청산 캐스케이드를 방지
   - 청산 가격의 80%에서 청산하여 안전 버퍼 제공
   - 신용 등급을 보존하고 강제 판매를 방지

## 실제 제품 및 사용자 경험

전용 제품 문서 참조: [제품 응용](../../../product/a-core-trading/a3-stop-loss-products.md)

---

[인덱스로 돌아가기](../../README.md)
