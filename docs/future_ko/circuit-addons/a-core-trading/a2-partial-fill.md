# A2. 부분 체결 주문 (Partial Fill Orders)

자동 잔여 주문 생성과 함께 주문의 일부 금액을 실행하여 유연한 유동성 매칭을 가능하게 합니다.

**제약 조건**: ~400K | **복잡도**: Medium

---

## 배경

부분 체결은 실용적인 거래소 기능에 필수적입니다:

- **유동성 분산**: 정확한 금액 매칭은 비현실적입니다; 주문은 거의 완벽한 상대방을 찾지 못합니다
- **대규모 주문 실행**: 고래는 시장을 움직이지 않고 대규모 주문을 점진적으로 체결해야 합니다
- **시장 깊이 활용**: 부분 체결은 주문이 가격 수준에 걸쳐 사용 가능한 유동성을 소비할 수 있게 합니다
- **자본 효율성**: 트레이더는 전체 주문이 즉시 매칭될 수 없어도 자본을 배포할 수 있습니다
- **오더북 역학**: 전문 거래는 알고리즘 전략을 위해 부분 실행 지원이 필요합니다

전통적인 거래소에서 부분 체결은 표준입니다. 현재 ZK-DEX 구현은 일반적으로 정확한 매칭이 필요하여 유동성 활용을 심각하게 제한합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `makerNoteHash` | field | 메이커의 주문 노트 해시 |
| `takerStakeHash` | field | 테이커의 커밋먼트 노트 해시 |
| `makerOutputHash` | field | 메이커가 받은 지불의 해시 |
| `takerOutputHash` | field | 테이커가 받은 상품의 해시 |
| `residualHash` | field | 남은 주문의 해시 (완전히 체결되면 0) |
| `fillAmount` | uint | 이 실행에서 체결되는 금액 |
| `price` | uint | 실행 가격 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `makerPkX, makerPkY` | field | 메이커의 공개키 |
| `makerValue` | uint | 원래 주문 값 |
| `makerToken` | uint | 판매되는 토큰 타입 |
| `makerSalt` | field | 메이커 노트 무작위성 |
| `makerSk` | field | 메이커의 비밀키 |
| `takerParent` | field | 테이커를 메이커에 연결하는 부모 해시 |
| `takerRecipientX, takerRecipientY` | field | 테이커의 수령 공개키 |
| `takerValue` | uint | 테이커의 스테이크 값 |
| `takerToken` | uint | 테이커의 토큰 타입 |
| `takerSalt` | field | 테이커 노트 무작위성 |
| `residualValue` | uint | 체결 후 남은 주문 값 |
| `residualSalt` | field | 잔여 노트 무작위성 |
| `makerOutValue` | uint | 메이커가 받는 값 |
| `makerOutSalt` | field | 메이커 출력 무작위성 |
| `takerOutValue` | uint | 테이커가 받는 값 |
| `takerOutSalt` | field | 테이커 출력 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_smart_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template PartialFill() {
    // ===== Public Inputs =====
    signal input makerNoteHash;
    signal input takerStakeHash;
    signal input makerOutputHash;
    signal input takerOutputHash;
    signal input residualHash;
    signal input fillAmount;
    signal input price;

    // ===== Private Inputs =====
    // Maker note
    signal input makerPkX, makerPkY, makerValue, makerToken, makerSalt, makerSk;
    // Taker stake
    signal input takerParent, takerRecipientX, takerRecipientY;
    signal input takerValue, takerToken, takerSalt;
    // Residual
    signal input residualValue, residualSalt;
    // Outputs
    signal input makerOutValue, makerOutSalt;
    signal input takerOutValue, takerOutSalt;

    // ===== 1. Verify Maker Note =====
    component makerNote = PoseidonRegularNote();
    makerNote.pkX <== makerPkX;
    makerNote.pkY <== makerPkY;
    makerNote.value <== makerValue;
    makerNote.tokenType <== makerToken;
    makerNote.salt <== makerSalt;
    makerNote.out === makerNoteHash;

    // ===== 2. Verify Maker Ownership =====
    component makerOwn = ProofOfOwnershipStrict();
    makerOwn.sk <== makerSk;
    makerOwn.pkX <== makerPkX;
    makerOwn.pkY <== makerPkY;

    // ===== 3. Verify Taker Stake Links to Maker =====
    component takerNote = PoseidonSmartNote();
    takerNote.parentHash <== takerParent;
    takerNote.recipientPkX <== takerRecipientX;
    takerNote.recipientPkY <== takerRecipientY;
    takerNote.value <== takerValue;
    takerNote.tokenType <== takerToken;
    takerNote.salt <== takerSalt;
    takerNote.out === takerStakeHash;

    // Parent must be maker's order
    takerParent === makerNoteHash;

    // ===== 4. Fill Amount Constraints =====
    // fillAmount must be <= makerValue
    component fillCheck = LessEqThan(64);
    fillCheck.in[0] <== fillAmount;
    fillCheck.in[1] <== makerValue;
    fillCheck.out === 1;

    // fillAmount must be > 0
    component fillNonZero = GreaterThan(64);
    fillNonZero.in[0] <== fillAmount;
    fillNonZero.in[1] <== 0;
    fillNonZero.out === 1;

    // ===== 5. Residual Calculation =====
    residualValue === makerValue - fillAmount;

    // ===== 6. Price Calculation =====
    // makerOutValue = fillAmount * price / PRICE_PRECISION
    signal expectedPayment;
    expectedPayment <== fillAmount * price;

    // Verify maker receives correct payment (within rounding tolerance)
    component paymentCheck = LessEqThan(128);
    paymentCheck.in[0] <== makerOutValue * 1000000;  // PRICE_PRECISION
    paymentCheck.in[1] <== expectedPayment + 1000000;  // Allow 1 unit rounding
    paymentCheck.out === 1;

    component paymentMin = GreaterEqThan(128);
    paymentMin.in[0] <== makerOutValue * 1000000;
    paymentMin.in[1] <== expectedPayment - 1000000;
    paymentMin.out === 1;

    // takerOutValue = fillAmount (taker receives the filled goods)
    takerOutValue === fillAmount;

    // ===== 7. Create Residual Note (if partial fill) =====
    component residualNote = PoseidonRegularNote();
    residualNote.pkX <== makerPkX;
    residualNote.pkY <== makerPkY;
    residualNote.value <== residualValue;
    residualNote.tokenType <== makerToken;
    residualNote.salt <== residualSalt;

    // Conditional hash check: if residualValue > 0, hash must match
    // If residualValue == 0, residualHash must be 0
    component isFullFill = IsZero();
    isFullFill.in <== residualValue;

    // residualHash = isFullFill ? 0 : residualNote.out
    signal expectedResidualHash;
    expectedResidualHash <== (1 - isFullFill.out) * residualNote.out;
    residualHash === expectedResidualHash;

    // ===== 8. Verify Maker Output Note =====
    component makerOut = PoseidonRegularNote();
    makerOut.pkX <== makerPkX;
    makerOut.pkY <== makerPkY;
    makerOut.value <== makerOutValue;
    makerOut.tokenType <== takerToken;  // Maker receives taker's token
    makerOut.salt <== makerOutSalt;
    makerOut.out === makerOutputHash;

    // ===== 9. Verify Taker Output Note =====
    component takerOut = PoseidonRegularNote();
    takerOut.pkX <== takerRecipientX;
    takerOut.pkY <== takerRecipientY;
    takerOut.value <== takerOutValue;
    takerOut.tokenType <== makerToken;  // Taker receives maker's token
    takerOut.salt <== takerOutSalt;
    takerOut.out === takerOutputHash;
}

component main {public [makerNoteHash, takerStakeHash, makerOutputHash,
    takerOutputHash, residualHash, fillAmount, price]} = PartialFill();
```

### 주요 제약 조건

1. **부모 연결**: 테이커의 스테이크는 메이커의 주문 해시를 참조해야 합니다
2. **체결 범위**: 체결 금액은 양수여야 하며 주문 크기를 초과할 수 없습니다
3. **잔여 보존**: residualValue = makerValue - fillAmount
4. **가격 정확도**: 지불은 반올림 범위 내에서 fillAmount * price와 일치해야 합니다
5. **조건부 잔여**: 0이 아닌 잔여는 유효한 노트를 생성합니다; 0 잔여는 0 해시를 생성합니다
6. **토큰 교환**: 메이커는 테이커의 토큰 타입을 받고; 테이커는 메이커의 토큰 타입을 받습니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **유동성 활용** | 유연한 매칭을 통한 2-3배 개선 |
| **실행 속도** | 부분 상대방 매치로 더 빠른 체결 |
| **오더북 깊이** | 부분 실행 후 주문이 활성 상태로 유지됨 |
| **자본 효율성** | 배포된 자본이 점진적으로 수익을 얻음 |
| **마켓 메이킹** | 전문 마켓 메이킹 전략 가능 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **잔여 조작** | 회로는 정확한 잔여 계산을 강제합니다 |
| **가격 편차** | 최소 반올림 허용 오차를 가진 엄격한 가격 확인 |
| **이중 체결** | 원래 노트 무효화; 잔여는 새 해시를 가짐 |
| **체결 금액 인플레이션** | LessEqThan 제약이 초과 체결을 방지 |
| **고아 잔여** | 동일한 소유자 공개키가 복구 가능성을 보장 |
| **반올림 악용** | 제한된 허용 오차가 체계적인 추출을 방지 |

## 구현 과제

1. **상태 관리**
   - 컨트랙트는 원래 주문과 잔여 관계를 추적해야 합니다
   - 원래 노트에 대한 무효화자; 잔여에 대한 새 항목
   - 체결 전반에 걸친 추적을 위한 주문 ID 커밋먼트 고려

2. **최소 체결 임계값**
   - 매우 작은 체결은 경제적으로 실행 가능하지 않을 수 있습니다
   - 최소 체결 크기 구현 (예: 주문의 1%)
   - 노트 증식을 피하기 위한 먼지 방지

3. **가격 정밀도 처리**
   - 정수 산술은 신중한 정밀도 관리가 필요합니다
   - 표준 정밀도: 6 소수점 (1000000)
   - 사용자를 위한 반올림 동작 문서화

4. **다중 체결 조정**
   - 여러 테이커가 동일한 주문을 체결하려고 시도할 수 있습니다
   - 첫 번째 유효한 증명이 승리합니다; 다른 것은 오래된 오류를 받습니다
   - 결제 경쟁이 있는 낙관적 매칭 고려

5. **잔여 노트 관리**
   - 사용자는 시간이 지남에 따라 잔여 노트를 축적합니다
   - 통합을 위해 배치 전송과 통합
   - UI는 잔여 주문을 추적하고 표시해야 합니다

## 파생 상품

1. **스트리밍 주문 실행** - 시간 경과에 따라 미리 결정된 증분으로 대규모 주문이 체결됩니다. 시장 영향을 최소화하기 위해 부분 체결과 TWAP 로직을 결합합니다. 각 체결은 다음 체결 창에 대해 잠금 해제되는 시간 잠금 잔여를 생성합니다.

2. **주문 수정** - 기존 주문의 미체결 부분을 수정합니다 (가격, 부분 취소). 회로는 잔여 노트의 소유권을 증명하고 업데이트된 매개변수로 새 주문을 생성합니다. 전체 취소 없이 동적 주문 관리를 가능하게 합니다.

3. **최소값이 있는 Fill-or-Kill** - 주문이 최소 체결 임계값을 지정합니다; 최소값을 충족할 수 없으면 실행이 실패합니다. 임계값 이하의 부분 체결이 경제적으로 실행 가능하지 않은 주문에 유용합니다. 회로가 최소 체결 확인을 추가합니다.

4. **비례 다중 자산 결제** - 단일 주문이 모든 토큰에 걸쳐 비례 체결로 여러 토큰을 판매합니다. 각 부분 체결은 모든 토큰 금액을 비례적으로 줄입니다. 다중 토큰 포지션에 대한 복잡한 잔여 추적.

5. **잔여 주문 집계** - 동일한 소유자의 작은 잔여를 자동으로 단일 주문으로 결합합니다. 백그라운드 서비스가 잔여를 모니터링하고 가스 효율적일 때 집계를 트리거합니다. 노트 관리 오버헤드를 줄입니다.

## 사용 사례

1. **대규모 기관 주문**
   - 펀드가 시장을 움직이지 않고 1000 ETH를 판매해야 합니다
   - 제한 주문을 배치합니다; 구매자가 도착함에 따라 점진적으로 체결됩니다
   - 각 체결은 남은 금액에 대한 잔여를 생성합니다
   - 전체 실행은 최소한의 가격 영향으로 몇 시간/며칠이 걸릴 수 있습니다

2. **마켓 메이킹**
   - 마켓 메이커가 스프레드의 양쪽에 주문을 배치합니다
   - 가격이 움직임에 따라 주문이 부분적으로 체결됩니다
   - 잔여는 재고에 따라 자동으로 조정됩니다
   - 위험 관리를 통한 지속적인 유동성 제공

3. **DCA 판매**
   - 사용자가 점진적으로 포지션을 청산하고자 합니다
   - 높은 제한으로 주문을 설정합니다; 부분 체결을 수락합니다
   - 각 체결은 이익을 취합니다; 잔여는 향후 체결을 위해 남습니다
   - 여러 주문 관리 없이 자연스러운 DCA 청산

4. **차익거래 실행**
   - 차익거래자가 거래소 간 가격 불일치를 발견합니다
   - 대규모 주문을 배치합니다; 사용 가능한 유동성을 취합니다
   - 스프레드가 비용을 초과하면 부분 체결도 수익성이 있습니다
   - 잔여는 취소되거나 향후 기회를 위해 남겨둘 수 있습니다

## 실제 제품 및 사용자 경험

전용 제품 문서 참조: [제품 응용](../../../product/a-core-trading/a2-partial-fill-products.md)

---

[인덱스로 돌아가기](../../README.md)
