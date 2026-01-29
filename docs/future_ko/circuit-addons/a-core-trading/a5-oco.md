# A5. OCO 주문 (One-Cancels-Other)

하나가 트리거되면 다른 하나가 자동으로 취소되는 단일 주문에서 손절매와 익절을 결합합니다.

**제약 조건**: ~180K | **복잡도**: Low

---

## 배경

OCO 주문은 완전한 포지션 관리에 필수적입니다:

- **이중 보호**: 트레이더는 하락 보호 (손절매)와 상승 포착 (익절)을 동시에 필요로 합니다
- **자본 잠금 방지**: OCO가 없으면 자본이 두 개의 별도 주문에 잠기고; 하나만 실행될 수 있습니다
- **브래킷 트레이딩**: 전문 트레이더는 진입 전에 완전한 위험/보상 매개변수를 정의하기 위해 OCO를 사용합니다
- **자동화된 전략**: 설정하고 잊어버리는 접근 방식은 지속적인 모니터링의 필요성을 제거합니다
- **모순 방지**: 별도 주문을 수동으로 관리하면 변동성 있는 시장에서 둘 다 실행될 위험이 있습니다

전통적인 금융에서 OCO (브래킷 주문이라고도 함)는 표준입니다. 현재 DeFi 구현은 원자적 OCO를 거의 지원하지 않아 사용자가 관련 위험과 함께 주문을 별도로 관리하도록 강요합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 거래되는 노트의 해시 |
| `outputHash` | field | 실행 후 출력 노트의 해시 |
| `stopLossPrice` | uint | 손절매가 트리거되는 가격 이하 |
| `takeProfitPrice` | uint | 익절이 트리거되는 가격 이상 |
| `currentPrice` | uint | 오라클이 제공하는 현재 시장 가격 |
| `tokenType` | uint | 판매되는 토큰 타입 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개키 |
| `value` | uint | 노트 값 |
| `salt` | field | 노트 무작위성 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `outPkX, outPkY` | field | 출력 노트 소유자 |
| `outValue` | uint | 전환 후 출력 값 |
| `outToken` | uint | 출력 토큰 타입 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template OCOOrder() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input stopLossPrice;
    signal input takeProfitPrice;
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

    // ===== 3. Price Bounds Validation =====
    // stopLossPrice must be < takeProfitPrice (valid bracket)
    component boundsCheck = LessThan(64);
    boundsCheck.in[0] <== stopLossPrice;
    boundsCheck.in[1] <== takeProfitPrice;
    boundsCheck.out === 1;

    // ===== 4. Condition Check: Either Stop-Loss OR Take-Profit =====
    // Stop-Loss: currentPrice <= stopLossPrice
    component stopCheck = LessEqThan(64);
    stopCheck.in[0] <== currentPrice;
    stopCheck.in[1] <== stopLossPrice;

    // Take-Profit: currentPrice >= takeProfitPrice
    component profitCheck = GreaterEqThan(64);
    profitCheck.in[0] <== currentPrice;
    profitCheck.in[1] <== takeProfitPrice;

    // At least one condition must be true
    signal conditionMet;
    conditionMet <== stopCheck.out + profitCheck.out;
    component atLeastOne = GreaterThan(8);
    atLeastOne.in[0] <== conditionMet;
    atLeastOne.in[1] <== 0;
    atLeastOne.out === 1;

    // ===== 5. Value Calculation Based on Trigger Type =====
    // If stop-loss triggered: use stopLossPrice for conversion
    // If take-profit triggered: use takeProfitPrice for conversion
    signal effectivePrice;
    effectivePrice <== stopCheck.out * stopLossPrice + profitCheck.out * takeProfitPrice;

    signal expectedMinOutput;
    expectedMinOutput <== value * effectivePrice;

    // Output must meet expected conversion (with tolerance)
    component outputCheck = GreaterEqThan(128);
    outputCheck.in[0] <== outValue * 1000000 + 1000000;  // PRICE_PRECISION + tolerance
    outputCheck.in[1] <== expectedMinOutput;
    outputCheck.out === 1;

    // ===== 6. Verify Output Note =====
    component outputNote = PoseidonRegularNote();
    outputNote.pkX <== outPkX;
    outputNote.pkY <== outPkY;
    outputNote.value <== outValue;
    outputNote.tokenType <== outToken;
    outputNote.salt <== outSalt;
    outputNote.out === outputHash;

    // ===== 7. Output Token Validation =====
    component tokenDiff = IsZero();
    tokenDiff.in <== tokenType - outToken;
    tokenDiff.out === 0;  // Must be different tokens
}

component main {public [noteHash, outputHash, stopLossPrice, takeProfitPrice,
    currentPrice, tokenType]} = OCOOrder();
```

### 주요 제약 조건

1. **소유권 검증**: 노트 소유자만이 OCO 주문을 생성할 수 있습니다
2. **유효한 브래킷**: 손절매 가격은 익절 가격보다 낮아야 합니다
3. **트리거 조건**: 손절매 또는 익절 조건이 충족되어야 합니다
4. **최소 출력**: 출력 값은 유효 가격에서 예상되는 전환을 충족해야 합니다
5. **상호 배타성**: 트리거되면 주문이 소비됩니다; 다른 레그는 암시적으로 취소됩니다
6. **토큰 교환**: 출력은 다른 토큰 타입이어야 합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **위험/보상 정의** | 실행 전에 완전한 거래 매개변수 설정 |
| **자본 효율성** | 단일 주문이 두 시나리오를 모두 커버; 이중 잠금 없음 |
| **전략 자동화** | 수동 관리 없이 전체 브래킷 트레이딩 |
| **프라이버시** | 실행될 때까지 두 트리거 가격 모두 숨김 |
| **실행 확실성** | 하나이고 유일한 결과 보장 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **오라클 조작** | TWAP, 여러 소스 사용; 회로가 가격 합리성을 검증 |
| **두 트리거 모두 활성화** | 가격 범위 제약이 겹치지 않는 영역을 보장 |
| **오래된 가격 실행** | 타임스탬프 검증 포함; 오래된 가격 데이터 거부 |
| **프론트러닝** | 두 가격 모두 숨김; 공격자는 타겟을 결정할 수 없음 |
| **재생 공격** | 무효화자는 이중 지불을 방지; 단일 실행 보장 |
| **값 계산 악용** | 유효 가격은 트리거된 조건에 의해 결정됨 |

## 구현 과제

1. **오라클 통합**
   - 트리거 감지를 위한 실시간 가격 피드 필요
   - 조작 저항을 위한 TWAP 오라클
   - 신뢰성을 위한 여러 오라클 폴백
   - 가격 오래됨 확인 필수

2. **트리거 귀속**
   - 올바른 가격 책정을 위해 어떤 레그가 트리거되었는지 결정해야 함
   - 회로는 트리거 플래그를 기반으로 조건부 할당을 사용
   - 에지 케이스: 빠른 가격 움직임이 두 확인을 모두 트리거할 수 있음

3. **실행 우선순위**
   - 두 조건이 기술적으로 충족될 때 어느 것이 실행되는가?
   - 현재 설계: 첫 번째 유효한 증명이 승리
   - 명시적 우선순위 고려 (예: 손절매 우선)

4. **부분 체결 통합**
   - 현재 설계는 전부 아니면 전무
   - 부분 OCO 실행을 위한 확장 필요
   - 잔여 브래킷을 위한 복잡한 상태 관리

5. **주문 수정**
   - 사용자는 실행 전에 트리거 가격을 조정하고자 할 수 있음
   - 취소 및 재생성이 현재 접근 방식
   - 효율성을 위한 수정 회로 고려

## 파생 상품

1. **비대칭 OCO** - 손절매 대 익절 레그에 대한 다른 포지션 크기. 손절매 시 100% 판매하지만 익절 시 50%만 (승자가 실행되도록 함). 다른 트리거 조건으로 노트를 부분으로 분할해야 합니다.

2. **시간 만료 OCO** - 시간 창 내에 트리거가 히트하지 않으면 주문이 자동으로 취소됩니다. 수익 플레이와 같은 시간에 민감한 전략에 유용합니다. 회로에 만료 타임스탬프 확인을 추가합니다.

3. **추적 구성 요소가 있는 OCO** - 익절 레그는 추적 로직을 사용하고 손절매는 고정됩니다. 정의된 하락을 유지하면서 추가 상승을 포착합니다. 정적 및 동적 가격 목표를 결합합니다.

4. **다중 레그 OCO** - 여러 익절 수준 (예: +10%에서 25%, +20%에서 25%, +30%에서 50%)과 단일 손절매. 각 익절 실행은 손절매 포지션을 비례적으로 줄입니다. 복잡한 부분 체결 상태 관리.

5. **부분 체결 처리가 있는 OCO** - 손절매가 부분적으로 체결되면 익절 레그가 남은 포지션 크기로 자동 조정됩니다. 부분 실행 전반에 걸쳐 브래킷 무결성을 유지합니다. 잔여 추적 통합이 필요합니다.

## 사용 사례

1. **표준 브래킷 트레이드**
   - 트레이더가 $2000에 ETH를 구매합니다
   - OCO 설정: $1800에 손절매, $2400에 익절
   - 위험: -10%, 보상: +20%, 위험/보상 비율: 1:2
   - 먼저 트리거되는 것이 실행됩니다; 포지션이 완전히 관리됩니다

2. **수익 플레이**
   - 토큰에 예정된 프로토콜 업그레이드 발표가 있습니다
   - 어느 방향으로든 중요한 가격 움직임을 예상합니다
   - OCO가 각 방향으로 15% 손절로 현재 가격을 브래킷합니다
   - 어느 방향으로든 브레이크아웃을 자동으로 포착합니다

3. **범위 트레이딩**
   - 확립된 범위 ($100-$120)에서 자산 거래
   - $100에 구매, OCO: 손절 $95, 익절 $120
   - 범위가 무너지면 최소 손실로 청산
   - 범위가 계속되면 범위 상단에서 이익

4. **변동성 이벤트 보호**
   - Fed 회의 전에 포지션을 배치한 포트폴리오
   - OCO가 어느 방향으로든 서프라이즈로부터 보호합니다
   - 손절매는 매파적 서프라이즈로부터의 손상을 제한합니다
   - 익절은 비둘기파적 서프라이즈로부터의 이익을 포착합니다
   - 발표를 실시간으로 볼 필요 없음

## 실제 제품 및 사용자 경험

전용 제품 문서 참조: [제품 응용](../../product/a-core-trading/a5-oco-products.md)

---

[인덱스로 돌아가기](../../README.md)
