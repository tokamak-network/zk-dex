# B3. 조건부 지급 (오라클)

오라클 검증 조건이 충족될 때 지급을 실행하여, 숨겨진 조건으로 비공개 예측 시장과 자동화된 트리거를 가능하게 합니다.

**제약 조건**: ~250K | **복잡도**: 중간

---

## 배경

조건부 지급은 정교한 금융 계약을 가능하게 합니다:

- **자동화된 실행**: 수동 개입 없이 실제 이벤트에 의해 트리거되는 지급
- **예측 시장**: 결과(가격 목표, 선거 결과, 스포츠)에 대한 베팅은 신뢰할 수 있는 해결이 필요
- **프라이버시 문제**: 현재 조건부 지급 시스템은 모든 조건을 공개적으로 노출하여 선행 거래를 가능하게 함
- **오라클 의존성**: 무신뢰 실행은 신뢰할 수 있는 외부 데이터 소스가 필요

스마트 컨트랙트는 조건을 강제할 수 있지만 모든 조건을 공개적으로 노출합니다. 적대자는 트리거 조건, 금액, 관련 당사자를 봅니다. ZK 조건부 지급은 조건 유형, 임계값, 당사자를 숨기면서도 오라클 데이터가 조건을 확인할 때 무신뢰 실행을 가능하게 합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 조건부 지급 노트의 해시 |
| `outputHash` | field | 수취인에게 보내는 출력 노트의 해시 |
| `conditionType` | uint | 타입: 0=PRICE_ABOVE, 1=PRICE_BELOW, 2=TIME_AFTER |
| `threshold` | uint | 조건 임계값 (가격 또는 타임스탬프) |
| `oracleValue` | uint | 오라클에서 제공하는 현재 값 |
| `currentTime` | uint | 현재 block.timestamp |
| `expiryTime` | uint | 지급 만료 타임스탬프 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `senderPkX, senderPkY` | field | 발신자의 공개 키 |
| `recipientPkX, recipientPkY` | field | 수취인의 공개 키 |
| `value` | uint | 지급 금액 (숨겨짐) |
| `tokenType` | uint | 토큰 타입 식별자 |
| `salt` | field | 노트 무작위성 |
| `sk` | field | 승인을 위한 발신자의 비밀 키 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/comparators.circom";
include "../utils/mux.circom";

template ConditionalPayment() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input conditionType;      // 0=PRICE_ABOVE, 1=PRICE_BELOW, 2=TIME_AFTER
    signal input threshold;
    signal input oracleValue;        // Current value from oracle
    signal input currentTime;
    signal input expiryTime;

    // ===== Private Inputs =====
    signal input senderPkX, senderPkY;
    signal input recipientPkX, recipientPkY;
    signal input value, tokenType, salt, sk;
    signal input outSalt;

    // ===== 1. Verify Conditional Note =====
    component note = Poseidon(10);
    note.inputs[0] <== senderPkX;
    note.inputs[1] <== senderPkY;
    note.inputs[2] <== recipientPkX;
    note.inputs[3] <== recipientPkY;
    note.inputs[4] <== value;
    note.inputs[5] <== tokenType;
    note.inputs[6] <== conditionType;
    note.inputs[7] <== threshold;
    note.inputs[8] <== expiryTime;
    note.inputs[9] <== salt;
    note.out === noteHash;

    // ===== 2. Check Not Expired =====
    component notExpired = LessThan(64);
    notExpired.in[0] <== currentTime;
    notExpired.in[1] <== expiryTime;
    notExpired.out === 1;

    // ===== 3. Evaluate Conditions =====
    // Condition 0: PRICE_ABOVE (oracleValue > threshold)
    component priceAbove = GreaterThan(252);
    priceAbove.in[0] <== oracleValue;
    priceAbove.in[1] <== threshold;

    // Condition 1: PRICE_BELOW (oracleValue < threshold)
    component priceBelow = LessThan(252);
    priceBelow.in[0] <== oracleValue;
    priceBelow.in[1] <== threshold;

    // Condition 2: TIME_AFTER (currentTime > threshold)
    component timeAfter = GreaterThan(64);
    timeAfter.in[0] <== currentTime;
    timeAfter.in[1] <== threshold;

    // ===== 4. Select Condition Based on Type =====
    // conditionType must be 0, 1, or 2
    component isType0 = IsEqual();
    isType0.in[0] <== conditionType;
    isType0.in[1] <== 0;

    component isType1 = IsEqual();
    isType1.in[0] <== conditionType;
    isType1.in[1] <== 1;

    component isType2 = IsEqual();
    isType2.in[0] <== conditionType;
    isType2.in[1] <== 2;

    // Validate conditionType is one of the valid types
    signal validType;
    validType <== isType0.out + isType1.out + isType2.out;
    validType === 1;

    // Select the appropriate condition result
    signal conditionMet;
    conditionMet <== isType0.out * priceAbove.out
                   + isType1.out * priceBelow.out
                   + isType2.out * timeAfter.out;
    conditionMet === 1;

    // ===== 5. Output Note to Recipient =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== recipientPkX;
    outNote.pkY <== recipientPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [noteHash, outputHash, conditionType, threshold,
    oracleValue, currentTime, expiryTime]} = ConditionalPayment();
```

### 핵심 제약 조건

1. **노트 형식 검증**: 조건부 노트는 발신자, 수취인, 조건 유형, 임계값, 만료를 포함
2. **만료 확인**: 지급은 만료 타임스탬프 전에 청구되어야 함
3. **조건 평가**: 오라클 값은 지정된 조건 유형을 충족해야 함
4. **타입 검증**: 조건 유형은 정확히 0, 1 또는 2여야 함
5. **수취인 정확성**: 출력 노트는 커밋된 수취인에게 전송

## 효과

| 측면 | 영향 |
|--------|--------|
| **자동화** | 수동 개입 없이 무신뢰 실행 |
| **프라이버시** | 트리거될 때까지 조건 조건이 숨겨짐 |
| **유연성** | 단일 회로에서 여러 조건 유형 지원 |
| **조합 가능성** | 복잡한 로직을 위해 다른 회로와 결합 가능 |
| **MEV 보호** | 숨겨진 임계값이 선행 거래 방지 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **오라클 조작** | 분산 오라클 사용 (Chainlink); 여러 소스 요구 |
| **오래된 데이터** | 오라클 타임스탬프에 신선도 확인 포함 |
| **만료 공격** | 충분한 시간 버퍼 보장; 유예 기간 고려 |
| **선행 거래 해결** | 오라클 업데이트를 위한 커밋-공개 체계 |
| **그리핑** | 실행자에게 보증금 요구; 유효하지 않은 실행 시 몰수 |
| **조건 게이밍** | 가격 조건에 TWAP 사용; 시점 가격 회피 |

## 구현 과제

1. **오라클 통합**
   - 가격/이벤트 오라클을 위한 표준화된 인터페이스 필요
   - Chainlink, UMA 또는 사용자 정의 오라클 솔루션 고려
   - 가격 정밀도와 소수점 처리가 일관되어야 함

2. **조건 확장성**
   - 현재 설계는 3가지 조건 유형 지원
   - 새로운 유형 추가는 회로 업데이트 필요
   - 사용자 정의 조건을 위한 플러그인 아키텍처 고려

3. **만료 처리**
   - 만료 후 자금은 어떻게 되는가?
   - 발신자에게 환불을 위한 별도 회로 필요
   - 자동 환불 메커니즘 고려

4. **다중 조건 로직**
   - 현재 설계는 단일 조건
   - 복잡한 계약은 AND/OR 조합 필요
   - 중첩된 조건부 노트 고려

## 파생 형태

1. **비공개 바이너리 옵션** - 만료 시 가격이 임계값 이상 또는 이하인지에 베팅합니다. 패자의 예치금은 승자에게 갑니다. 양 당사자가 자금을 커밋하고 오라클이 결과를 결정합니다. 포지션을 드러내지 않고 파생상품 거래를 가능하게 합니다.

2. **조건부 NFT 전송** - 조건이 충족될 때만 실행되는 NFT 전송 (예: 지급 수령, 마일스톤 달성). 실행될 때까지 거래 조건을 노출하지 않고 원자적 스왑 및 무신뢰 거래에 유용합니다.

3. **오라클 없는 조건부** - 신뢰할 수 있는 오라클을 외부 상태의 암호화 증명으로 대체합니다. zkBridge 또는 유사한 것을 사용하여 이더리움 상태를 검증합니다. 오라클 신뢰 가정 없이 크로스체인 조건부 지급을 가능하게 합니다.

4. **연쇄 조건부** - 하나가 다음을 트리거하는 조건부 지급 체인. 조건 A가 충족되면 B에게 지급하고, 이는 C를 위한 조건을 활성화합니다. 순차적 종속성이 있는 복잡한 다자간 계약을 가능하게 합니다.

5. **조건부 지급 네트워크** - 조건부 라우팅이 있는 Lightning과 유사한 지급 채널. 지급이 조건과 함께 중개자를 통해 라우팅됩니다. 지급당 온체인 거래 없이 즉각적인 조건부 정산을 가능하게 합니다.

## 사용 사례

1. **비공개 예측 시장**
   - 두 당사자가 연말 BTC 가격에 베팅
   - 각각 조건부 지급에 1 ETH 커밋
   - BTC > $100K이면 Alice가 승리, 그렇지 않으면 Bob이 승리
   - 프라이버시: 시장이 포지션을 볼 수 없어 조작 감소

2. **보험 지급**
   - 날씨 오라클이 있는 스마트 작물 보험
   - 농부가 보험료를 지불하고, 강수량이 임계값 미만이면 지급 수령
   - 조건이 충족되면 자동 청구 처리
   - 프라이버시: 농부의 보장 금액이 경쟁자에게 숨겨짐

3. **마일스톤 기반 계약**
   - 프로젝트 마일스톤 검증 시 프리랜서가 지급 수령
   - 클라이언트가 조건부 지급을 자금 조달하고, 오라클이 인도 확인
   - 마일스톤 완료 시 자동 출시
   - 프라이버시: 계약 조건이 당사자 간에 기밀로 유지됨

4. **거래 전략 자동화**
   - 트레이더가 조건부 지급 설정: ETH > $5000이면 스왑 실행
   - 가격 조건이 충족될 때까지 자금 잠금
   - 가격을 지속적으로 모니터링할 필요 없음
   - 프라이버시: 목표 가격이 시장 참여자에게 숨겨짐

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용자 스토리는 [조건부 지급 (오라클) - 제품 및 사용자 경험](../../../future/product/b-time-conditions/b3-conditional-products.md)을 참조하세요.

---

[색인으로 돌아가기](../../README.md)
