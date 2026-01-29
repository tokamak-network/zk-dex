# E5. 합성 자산 발행/소각

숨겨진 담보 비율 및 포지션 크기로 합성 자산을 발행하고 소각하여 모든 자산에 대한 프라이빗 노출을 가능하게 합니다.

**제약 조건**: ~250K | **복잡도**: 중간

---

## 배경

합성 자산은 사용자 보호와 시장 무결성을 위해 프라이버시가 필요합니다:

- **담보 노출**: 가시적인 담보는 순자산과 위험 선호도를 드러냅니다
- **포지션 신호**: 대형 합성 포지션은 시장 견해를 신호합니다
- **청산 취약성**: 알려진 담보 비율은 공격을 초대합니다
- **전략 유출**: 합성 바스켓 구성은 투자 논제를 드러냅니다

Synthetix와 같은 현재 합성 프로토콜은 모든 포지션 세부 정보를 노출합니다. 프라이빗 합성은 ZK 증명을 통해 적절한 담보를 증명하면서 담보 금액과 합성 노출을 숨깁니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `positionNoteHash` | field | 합성 포지션 노트의 해시 |
| `collateralNoteHash` | field | 담보 예치 노트의 해시 |
| `syntheticNoteHash` | field | 발행된 합성 토큰 노트의 해시 |
| `syntheticAssetId` | uint | 합성 자산 식별자 |
| `oraclePrice` | uint | 합성에 대한 현재 오라클 가격 |
| `minCollateralRatio` | uint | 필요한 최소 담보 비율 |
| `nullifier` | field | 이중 지출 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `minterPkX, minterPkY` | field | 발행자의 공개키 |
| `minterSk` | field | 발행자의 비밀키 |
| `collateralAmount` | uint | 예치된 담보 (숨김) |
| `collateralTokenType` | uint | 담보 토큰 유형 |
| `syntheticAmount` | uint | 발행된 합성 금액 (숨김) |
| `collateralRatio` | uint | 실제 담보 비율 (숨김) |
| `positionSalt` | field | 포지션 노트 무작위성 |
| `collateralSalt` | field | 담보 노트 무작위성 |
| `syntheticSalt` | field | 합성 노트 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template SyntheticMint() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input collateralNoteHash;
    signal input syntheticNoteHash;
    signal input syntheticAssetId;
    signal input oraclePrice;
    signal input minCollateralRatio;  // e.g., 150 for 150%
    signal input nullifier;

    // ===== Private Inputs =====
    signal input minterPkX, minterPkY, minterSk;
    signal input collateralAmount;
    signal input collateralTokenType;
    signal input syntheticAmount;
    signal input collateralRatio;
    signal input positionSalt, collateralSalt, syntheticSalt;

    // ===== 1. Verify Minter Ownership =====
    component minterOwnership = ProofOfOwnershipStrict();
    minterOwnership.sk <== minterSk;
    minterOwnership.pkX <== minterPkX;
    minterOwnership.pkY <== minterPkY;

    // ===== 2. Calculate Synthetic Value =====
    signal syntheticValue;
    syntheticValue <== syntheticAmount * oraclePrice;

    // ===== 3. Verify Collateral Ratio =====
    // collateralAmount >= syntheticValue * minCollateralRatio / 100
    signal requiredCollateral;
    requiredCollateral <== syntheticValue * minCollateralRatio / 100;

    component collateralCheck = GreaterEqThan(128);
    collateralCheck.in[0] <== collateralAmount;
    collateralCheck.in[1] <== requiredCollateral;
    collateralCheck.out === 1;

    // ===== 4. Verify Claimed Ratio Matches =====
    // collateralRatio = collateralAmount * 100 / syntheticValue
    signal calculatedRatio;
    calculatedRatio <== collateralAmount * 100 / syntheticValue;

    // Allow small tolerance for rounding
    component ratioCheck = GreaterEqThan(32);
    ratioCheck.in[0] <== calculatedRatio;
    ratioCheck.in[1] <== collateralRatio;
    ratioCheck.out === 1;

    // ===== 5. Verify Minimum Ratio Met =====
    component minRatioCheck = GreaterEqThan(32);
    minRatioCheck.in[0] <== collateralRatio;
    minRatioCheck.in[1] <== minCollateralRatio;
    minRatioCheck.out === 1;

    // ===== 6. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== minterPkX;
    positionNote.inputs[1] <== minterPkY;
    positionNote.inputs[2] <== syntheticAssetId;
    positionNote.inputs[3] <== syntheticAmount;
    positionNote.inputs[4] <== collateralAmount;
    positionNote.inputs[5] <== collateralTokenType;
    positionNote.inputs[6] <== oraclePrice;  // Entry price snapshot
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 7. Verify Collateral Note =====
    component collateralNote = PoseidonRegularNote();
    collateralNote.pkX <== minterPkX;
    collateralNote.pkY <== minterPkY;
    collateralNote.value <== collateralAmount;
    collateralNote.tokenType <== collateralTokenType;
    collateralNote.salt <== collateralSalt;
    collateralNote.out === collateralNoteHash;

    // ===== 8. Verify Synthetic Note =====
    component syntheticNote = PoseidonRegularNote();
    syntheticNote.pkX <== minterPkX;
    syntheticNote.pkY <== minterPkY;
    syntheticNote.value <== syntheticAmount;
    syntheticNote.tokenType <== syntheticAssetId;
    syntheticNote.salt <== syntheticSalt;
    syntheticNote.out === syntheticNoteHash;

    // ===== 9. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== collateralNoteHash;
    nullifierHash.inputs[1] <== minterSk;
    nullifierHash.out === nullifier;
}

template SyntheticBurn() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input syntheticNoteHash;
    signal input returnCollateralNoteHash;
    signal input syntheticAssetId;
    signal input oraclePrice;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input minterPkX, minterPkY, minterSk;
    signal input syntheticAmount;
    signal input burnAmount;
    signal input collateralAmount;
    signal input collateralTokenType;
    signal input entryPrice;
    signal input positionSalt, syntheticSalt, returnSalt;
    signal input returnCollateralAmount;

    // ===== 1. Verify Minter Ownership =====
    component minterOwnership = ProofOfOwnershipStrict();
    minterOwnership.sk <== minterSk;
    minterOwnership.pkX <== minterPkX;
    minterOwnership.pkY <== minterPkY;

    // ===== 2. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== minterPkX;
    positionNote.inputs[1] <== minterPkY;
    positionNote.inputs[2] <== syntheticAssetId;
    positionNote.inputs[3] <== syntheticAmount;
    positionNote.inputs[4] <== collateralAmount;
    positionNote.inputs[5] <== collateralTokenType;
    positionNote.inputs[6] <== entryPrice;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Verify Synthetic Note Being Burned =====
    component syntheticNote = PoseidonRegularNote();
    syntheticNote.pkX <== minterPkX;
    syntheticNote.pkY <== minterPkY;
    syntheticNote.value <== burnAmount;
    syntheticNote.tokenType <== syntheticAssetId;
    syntheticNote.salt <== syntheticSalt;
    syntheticNote.out === syntheticNoteHash;

    // ===== 4. Verify Burn Amount Valid =====
    component burnCheck = LessEqThan(128);
    burnCheck.in[0] <== burnAmount;
    burnCheck.in[1] <== syntheticAmount;
    burnCheck.out === 1;

    // ===== 5. Calculate Collateral Return =====
    // Pro-rata: returnCollateral = collateralAmount * burnAmount / syntheticAmount
    signal expectedReturn;
    expectedReturn <== collateralAmount * burnAmount / syntheticAmount;

    component returnCheck = LessEqThan(128);
    returnCheck.in[0] <== returnCollateralAmount;
    returnCheck.in[1] <== expectedReturn;
    returnCheck.out === 1;

    // ===== 6. Verify Return Collateral Note =====
    component returnNote = PoseidonRegularNote();
    returnNote.pkX <== minterPkX;
    returnNote.pkY <== minterPkY;
    returnNote.value <== returnCollateralAmount;
    returnNote.tokenType <== collateralTokenType;
    returnNote.salt <== returnSalt;
    returnNote.out === returnCollateralNoteHash;

    // ===== 7. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== syntheticNoteHash;
    nullifierHash.inputs[1] <== minterSk;
    nullifierHash.out === nullifier;
}

template SyntheticLiquidate() {
    // ===== Public Inputs =====
    signal input positionNoteHash;
    signal input liquidatorRewardHash;
    signal input syntheticAssetId;
    signal input oraclePrice;
    signal input minCollateralRatio;
    signal input liquidationPenalty;  // e.g., 10 for 10%

    // ===== Private Inputs =====
    signal input minterPkX, minterPkY;
    signal input liquidatorPkX, liquidatorPkY, liquidatorSk;
    signal input syntheticAmount;
    signal input collateralAmount;
    signal input collateralTokenType;
    signal input entryPrice;
    signal input positionSalt;
    signal input rewardAmount;
    signal input rewardSalt;

    // ===== 1. Verify Liquidator Ownership =====
    component liquidatorOwnership = ProofOfOwnershipStrict();
    liquidatorOwnership.sk <== liquidatorSk;
    liquidatorOwnership.pkX <== liquidatorPkX;
    liquidatorOwnership.pkY <== liquidatorPkY;

    // ===== 2. Verify Position Note =====
    component positionNote = Poseidon(8);
    positionNote.inputs[0] <== minterPkX;
    positionNote.inputs[1] <== minterPkY;
    positionNote.inputs[2] <== syntheticAssetId;
    positionNote.inputs[3] <== syntheticAmount;
    positionNote.inputs[4] <== collateralAmount;
    positionNote.inputs[5] <== collateralTokenType;
    positionNote.inputs[6] <== entryPrice;
    positionNote.inputs[7] <== positionSalt;
    positionNote.out === positionNoteHash;

    // ===== 3. Verify Position is Undercollateralized =====
    signal syntheticValue;
    syntheticValue <== syntheticAmount * oraclePrice;

    signal currentRatio;
    currentRatio <== collateralAmount * 100 / syntheticValue;

    component underCollateralizedCheck = LessThan(32);
    underCollateralizedCheck.in[0] <== currentRatio;
    underCollateralizedCheck.in[1] <== minCollateralRatio;
    underCollateralizedCheck.out === 1;

    // ===== 4. Calculate Liquidation Reward =====
    signal penaltyAmount;
    penaltyAmount <== collateralAmount * liquidationPenalty / 100;

    component rewardCheck = LessEqThan(128);
    rewardCheck.in[0] <== rewardAmount;
    rewardCheck.in[1] <== penaltyAmount;
    rewardCheck.out === 1;

    // ===== 5. Verify Reward Note =====
    component rewardNote = PoseidonRegularNote();
    rewardNote.pkX <== liquidatorPkX;
    rewardNote.pkY <== liquidatorPkY;
    rewardNote.value <== rewardAmount;
    rewardNote.tokenType <== collateralTokenType;
    rewardNote.salt <== rewardSalt;
    rewardNote.out === liquidatorRewardHash;
}

component main {public [positionNoteHash, collateralNoteHash, syntheticNoteHash,
    syntheticAssetId, oraclePrice, minCollateralRatio, nullifier]} = SyntheticMint();
```

### 주요 제약 조건

1. **소유권 검증**: 발행자가 비밀키를 통해 제어 증명
2. **담보 충분성**: 담보가 최소 비율 요구사항 충족
3. **비율 검증**: 주장된 비율이 실제 계산과 일치
4. **포지션 무결성**: 모든 포지션 매개변수가 올바르게 인코딩됨
5. **소각 유효성**: 발행된 금액보다 더 많이 소각할 수 없음
6. **청산 임계값**: 담보 부족 포지션만 청산 가능

## 효과

| 측면 | 영향 |
|--------|--------|
| **포지션 프라이버시** | 담보 및 합성 금액이 숨겨짐 |
| **전략 기밀성** | 합성 노출이 보이지 않음 |
| **청산 보호** | 담보 비율이 공격자로부터 숨겨짐 |
| **시장 무결성** | 대형 발행이 시장 방향을 신호하지 않음 |
| **공정한 청산** | 담보 부족 포지션만 청산 가능 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **오라클 조작** | TWAP 및 다중 오라클 소스 사용 |
| **담보 부족** | 회로에서 최소 비율 강제 |
| **청산 선행 거래** | 청산까지 포지션 세부 정보 숨김 |
| **이중 발행** | Nullifier가 담보 재사용 방지 |
| **플래시 론 공격** | TWAP 가격이 즉각적인 조작 방지 |
| **연쇄 청산** | 숨겨진 포지션이 표적 공격 방지 |

## 구현 과제

1. **오라클 인프라**
   - 모든 합성 자산에 대한 신뢰할 수 있는 가격 피드 필요
   - 이국적 자산에 대한 크로스체인 가격 집계
   - 빠르게 움직이는 시장에 대한 지연 시간 고려

2. **담보 관리**
   - 다중 담보 지원 복잡성
   - 담보 요소 계산
   - 동적 비율 조정

3. **청산 메커니즘**
   - 프라이빗 청산을 위한 키퍼 인센티브
   - 부분 청산 지원
   - 청산 경매

4. **부채 풀 관리**
   - 프라이버시로 글로벌 부채 추적
   - 수수료 분배 메커니즘
   - 시스템 안정성 매개변수

## 파생 상품

1. **합성 인덱스 토큰** - 인덱스를 추적하는 바스켓 합성 생성 (DeFi 인덱스, NFT 인덱스). 바스켓의 각 자산에 대한 개별 노출을 숨기면서 구성 요소의 올바른 가중치 증명.

2. **역 합성** - 기초 자산과 반대로 움직이는 합성 발행 (sETH-inverse). 올바른 역 가격 추적을 증명하며 프라이버시로 숏 노출 가능.

3. **레버리지 합성** - 숨겨진 레버리지 비율로 2x 또는 3x 레버리지 합성 발행. 회로가 승수를 드러내지 않고 레버리지 노출에 대한 적절한 담보 증명.

4. **합성 바스켓** - 단일 포지션에서 사용자 정의 합성 바스켓. 단일 담보 풀이 숨겨진 할당으로 여러 합성 노출 지원.

5. **크로스체인 합성** - 크로스체인 담보 증명으로 지원되는 합성 발행. 브리지 검증이 다중 체인 포지션을 위한 발행 회로와 통합.

## 사용 사례

1. **포트폴리오 다각화**
   - 투자자가 보관 없이 금 노출 원함
   - 숨겨진 포지션 크기로 합성 금 발행
   - 담보 비율이 시장 관찰자로부터 비공개

2. **실제 노출 헤징**
   - 기업이 상품 가격 위험 헤징
   - 역 오일 합성을 비공개로 발행
   - 헤지 크기가 비즈니스 운영을 드러내지 않음

3. **인덱스 투자**
   - 트레이더가 DeFi 우량주 노출 원함
   - 합성 DeFi 인덱스 토큰 발행
   - 할당이 경쟁사로부터 숨겨짐

4. **크로스 자산 차익거래**
   - 차익거래자가 합성과 현물 간 가격 오류 발견
   - 스프레드 포착을 위해 발행/소각
   - 전략이 다른 차익거래자로부터 숨겨짐

## 실제 제품 및 사용자 경험

참조: [합성 자산 발행/소각 - 실제 제품](../../../product/e-defi/e5-synthetics-products.md)
---

[색인으로 돌아가기](../../README.md)
