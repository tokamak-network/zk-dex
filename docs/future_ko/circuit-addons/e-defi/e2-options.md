# E2. Options Write/Exercise

숨겨진 행사가격과 포지션 크기로 옵션 계약을 작성하고 행사하여 프라이빗 파생상품 거래를 가능하게 합니다.

**제약조건**: ~300K | **복잡도**: High

---

## 배경

DeFi의 옵션 거래는 경쟁 우위를 위해 프라이버시가 필요합니다:

- **행사가격 노출**: 가시적인 행사가격은 거래자의 기대치를 드러내고 표적 조작을 가능하게 함
- **포지션 크기 유출**: 대규모 옵션 포지션은 시장 심리를 신호하고 반대 거래를 유도함
- **전략 공개**: 옵션 조합(스프레드, 스트래들)이 정교한 전략을 드러냄
- **만기 헌팅**: 가시적인 만기일이 만료일 근처에서 조작을 가능하게 함

Opyn이나 Lyra와 같은 전통적인 DeFi 옵션 프로토콜은 모든 옵션 매개변수를 온체인에 노출합니다. 프라이빗 옵션은 ZK 증명을 통해 유효한 옵션 메커니즘을 증명하면서 행사가격, 포지션 크기, 전략 구성을 숨깁니다.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `optionNoteHash` | field | 옵션 포지션 노트의 해시 |
| `collateralNoteHash` | field | 옵션을 뒷받침하는 담보의 해시 |
| `premiumNoteHash` | field | 프리미엄 지불 노트의 해시 |
| `optionType` | uint | 콜 (0) 또는 풋 (1) |
| `underlyingAsset` | uint | 기초 자산의 토큰 타입 |
| `expirationTime` | uint | 옵션 만기 타임스탬프 |
| `nullifier` | field | 이중 행사 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `writerPkX, writerPkY` | field | 옵션 작성자의 공개 키 |
| `writerSk` | field | 작성자의 비밀 키 |
| `holderPkX, holderPkY` | field | 옵션 보유자의 공개 키 |
| `strikePrice` | uint | 행사가격 (숨겨짐) |
| `quantity` | uint | 계약 수 |
| `premiumAmount` | uint | 옵션에 대해 지불된 프리미엄 |
| `collateralValue` | uint | 담보 금액 |
| `optionSalt` | field | 옵션 노트 무작위성 |
| `collateralSalt` | field | 담보 노트 무작위성 |
| `premiumSalt` | field | 프리미엄 노트 무작위성 |
| `currentPrice` | uint | 현재 기초 가격 (행사용) |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template OptionWrite() {
    // ===== Public Inputs =====
    signal input optionNoteHash;
    signal input collateralNoteHash;
    signal input premiumNoteHash;
    signal input optionType;           // 0 = Call, 1 = Put
    signal input underlyingAsset;
    signal input expirationTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input writerPkX, writerPkY, writerSk;
    signal input holderPkX, holderPkY;
    signal input strikePrice;
    signal input quantity;
    signal input premiumAmount;
    signal input collateralValue;
    signal input optionSalt, collateralSalt, premiumSalt;

    // ===== 1. Verify Writer Ownership =====
    component writerOwnership = ProofOfOwnershipStrict();
    writerOwnership.sk <== writerSk;
    writerOwnership.pkX <== writerPkX;
    writerOwnership.pkY <== writerPkY;

    // ===== 2. Verify Option Note =====
    // Option note contains: writer, holder, strike, quantity, type, expiration
    component optionNote = Poseidon(8);
    optionNote.inputs[0] <== writerPkX;
    optionNote.inputs[1] <== writerPkY;
    optionNote.inputs[2] <== holderPkX;
    optionNote.inputs[3] <== holderPkY;
    optionNote.inputs[4] <== strikePrice;
    optionNote.inputs[5] <== quantity;
    optionNote.inputs[6] <== optionType;
    optionNote.inputs[7] <== optionSalt;
    optionNote.out === optionNoteHash;

    // ===== 3. Verify Collateral Sufficiency =====
    // For calls: collateral >= quantity (underlying tokens)
    // For puts: collateral >= quantity * strikePrice (quote tokens)
    signal requiredCollateral;
    signal callCollateral;
    signal putCollateral;

    callCollateral <== quantity;
    putCollateral <== quantity * strikePrice;

    // Select based on option type (0=call, 1=put)
    requiredCollateral <== (1 - optionType) * callCollateral + optionType * putCollateral;

    component collateralCheck = GreaterEqThan(128);
    collateralCheck.in[0] <== collateralValue;
    collateralCheck.in[1] <== requiredCollateral;
    collateralCheck.out === 1;

    // ===== 4. Verify Collateral Note =====
    component collateralNote = PoseidonRegularNote();
    collateralNote.pkX <== writerPkX;
    collateralNote.pkY <== writerPkY;
    collateralNote.value <== collateralValue;
    // Collateral token: underlying for calls, quote for puts
    signal collateralToken;
    collateralToken <== (1 - optionType) * underlyingAsset + optionType * 1;
    collateralNote.tokenType <== collateralToken;
    collateralNote.salt <== collateralSalt;
    collateralNote.out === collateralNoteHash;

    // ===== 5. Verify Premium Note =====
    component premiumNote = PoseidonRegularNote();
    premiumNote.pkX <== writerPkX;  // Premium goes to writer
    premiumNote.pkY <== writerPkY;
    premiumNote.value <== premiumAmount;
    premiumNote.tokenType <== 1;    // Premium in quote currency
    premiumNote.salt <== premiumSalt;
    premiumNote.out === premiumNoteHash;

    // ===== 6. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== optionNoteHash;
    nullifierHash.inputs[1] <== writerSk;
    nullifierHash.out === nullifier;

    // ===== 7. Verify Expiration in Future =====
    // This would be checked against block timestamp on-chain
    signal output expirationOut;
    expirationOut <== expirationTime;
}

template OptionExercise() {
    // ===== Public Inputs =====
    signal input optionNoteHash;
    signal input settlementNoteHash;
    signal input currentPrice;
    signal input currentTime;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input holderPkX, holderPkY, holderSk;
    signal input writerPkX, writerPkY;
    signal input strikePrice;
    signal input quantity;
    signal input optionType;
    signal input expirationTime;
    signal input optionSalt;
    signal input settlementValue;
    signal input settlementSalt;

    // ===== 1. Verify Holder Ownership =====
    component holderOwnership = ProofOfOwnershipStrict();
    holderOwnership.sk <== holderSk;
    holderOwnership.pkX <== holderPkX;
    holderOwnership.pkY <== holderPkY;

    // ===== 2. Verify Option Note =====
    component optionNote = Poseidon(8);
    optionNote.inputs[0] <== writerPkX;
    optionNote.inputs[1] <== writerPkY;
    optionNote.inputs[2] <== holderPkX;
    optionNote.inputs[3] <== holderPkY;
    optionNote.inputs[4] <== strikePrice;
    optionNote.inputs[5] <== quantity;
    optionNote.inputs[6] <== optionType;
    optionNote.inputs[7] <== optionSalt;
    optionNote.out === optionNoteHash;

    // ===== 3. Verify Not Expired =====
    component expiryCheck = LessThan(64);
    expiryCheck.in[0] <== currentTime;
    expiryCheck.in[1] <== expirationTime;
    expiryCheck.out === 1;

    // ===== 4. Verify In-The-Money =====
    // Call: currentPrice > strikePrice
    // Put: currentPrice < strikePrice
    component callITM = GreaterThan(64);
    callITM.in[0] <== currentPrice;
    callITM.in[1] <== strikePrice;

    component putITM = LessThan(64);
    putITM.in[0] <== currentPrice;
    putITM.in[1] <== strikePrice;

    signal isITM;
    isITM <== (1 - optionType) * callITM.out + optionType * putITM.out;
    isITM === 1;

    // ===== 5. Calculate Settlement Amount =====
    // Call: (currentPrice - strikePrice) * quantity
    // Put: (strikePrice - currentPrice) * quantity
    signal callPayout;
    signal putPayout;
    callPayout <== (currentPrice - strikePrice) * quantity;
    putPayout <== (strikePrice - currentPrice) * quantity;

    signal expectedSettlement;
    expectedSettlement <== (1 - optionType) * callPayout + optionType * putPayout;

    component settlementCheck = GreaterEqThan(128);
    settlementCheck.in[0] <== settlementValue;
    settlementCheck.in[1] <== expectedSettlement;
    settlementCheck.out === 1;

    // ===== 6. Verify Settlement Note =====
    component settlementNote = PoseidonRegularNote();
    settlementNote.pkX <== holderPkX;
    settlementNote.pkY <== holderPkY;
    settlementNote.value <== settlementValue;
    settlementNote.tokenType <== 1;  // Settlement in quote currency
    settlementNote.salt <== settlementSalt;
    settlementNote.out === settlementNoteHash;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== optionNoteHash;
    nullifierHash.inputs[1] <== holderSk;
    nullifierHash.out === nullifier;
}

component main {public [optionNoteHash, collateralNoteHash, premiumNoteHash,
    optionType, underlyingAsset, expirationTime, nullifier]} = OptionWrite();
```

### Key Constraints

1. **소유권 검증**: 작성자/보유자가 비밀 키를 통해 통제를 증명
2. **담보 충분성**: 옵션 작성에 전액 담보 필요
3. **옵션 매개변수**: 행사가격, 수량, 타입이 옵션 노트에 인코딩됨
4. **만기 확인**: 만기 전에만 행사 유효
5. **ITM 검증**: 내가격(in-the-money) 옵션만 행사 가능
6. **정산 계산**: 지불금이 옵션 메커니즘과 일치

## 효과

| 측면 | 영향 |
|--------|--------|
| **행사가격 프라이버시** | 행사가격이 시장 관찰자로부터 숨겨짐 |
| **포지션 기밀성** | 옵션 크기가 온체인에서 보이지 않음 |
| **전략 보호** | 복잡한 옵션 전략이 비공개로 유지됨 |
| **MEV 방지** | 옵션 행사를 선행 거래할 수 없음 |
| **공정한 가격 책정** | 숨겨진 흐름이 시장 조작을 방지 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **오라클 조작** | 정산 가격에 TWAP 및 다중 오라클 소스 사용 |
| **담보 도난** | 만기 또는 행사까지 담보 잠금 |
| **이중 행사** | Nullifier가 동일 옵션의 여러 행사 방지 |
| **만기 게이밍** | 만기에 버퍼가 있는 블록 타임스탬프 사용 |
| **프리미엄 조작** | 커밋먼트 방식의 오프체인 매칭 |
| **플래시 론 공격** | 정산 가격이 스팟이 아닌 TWAP 기반 |

## 구현 과제

1. **오라클 통합**
   - 정산을 위한 신뢰할 수 있는 가격 피드 필수
   - 적절한 기간에 대한 TWAP 계산
   - 오라클 실패를 우아하게 처리

2. **담보 관리**
   - 옵션 기간 동안 담보 잠금
   - 지원되는 경우 부분 행사 처리
   - 만기 후 미사용 담보 반환

3. **미국식 vs 유럽식 옵션**
   - 표시된 회로는 유럽식 (만기 시에만 행사)
   - 미국식 옵션은 행사 기간 추적 필요
   - 조기 행사가 추가 복잡성 도입

4. **프리미엄 발견**
   - 옵션 가격 모델(Black-Scholes)에 변동성 입력 필요
   - 온체인 커밋먼트가 있는 오프체인 가격 책정
   - 시장 조성자 통합

## 파생상품

1. **Private Covered Calls** - 기초 소유권을 공개하지 않고 보유 기초 포지션에 대해 콜 작성. 정확한 보유량과 행사가격 선택 전략을 숨기면서 충분한 담보가 존재함을 증명.

2. **Private Puts for Insurance** - 포트폴리오나 헤지 크기를 공개하지 않고 하방 보호 구매. 보유 자산에 대한 우려를 신호하지 않고 기관의 헤지 가능.

3. **Option Spreads** - 단일 증명으로 여러 옵션(불 스프레드, 아이언 콘도르) 결합. 모든 레그가 적절히 담보화되었음을 증명하면서 복잡한 전략 숨김.

4. **Binary Options** - 숨겨진 행사가격의 고정 지불금 옵션. 예측 시장 애플리케이션을 위한 동일한 프라이버시 보장으로 더 간단한 정산 로직.

5. **Perpetual Options** - 지속적인 자금 조달을 청구하는 만기 없는 옵션. 지속적인 헤징을 위해 무기한 메커니즘과 옵션 지불금 구조 결합.

## 사용 사례

1. **포트폴리오 보험**
   - 펀드 매니저가 하방 보호 원함
   - 포지션 크기나 행사가격 수준을 공개하지 않고 풋 매수
   - 경쟁자가 헤징 전략을 추론할 수 없음

2. **수익 향상**
   - 투자자가 보유 자산에 대해 커버드 콜 작성
   - 행사가격과 프리미엄 숨김
   - 출구 목표를 공개하지 않고 수입 창출

3. **변동성 거래**
   - 거래자가 높은 변동성을 예상하지만 방향 불확실
   - 스트래들(동일 행사가격의 콜 + 풋) 매수
   - 전략이 시장 조성자로부터 숨겨짐

4. **제한된 위험으로 투기**
   - 개인 거래자가 자산에 대해 낙관적
   - 정의된 최대 손실로 콜 매수
   - 포지션 크기와 레버리지가 보이지 않음

## 실제 제품 및 사용자 경험

참조: [Options Write/Exercise - Real-World Products](../../product/e-defi/e2-options-products.md)

---

[목차로 돌아가기](../../README.md)
