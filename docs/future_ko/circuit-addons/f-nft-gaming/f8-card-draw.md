# F8. Card Draw Verify

숨겨진 핸드와 검증 가능한 무작위성을 갖춘 블록체인 카드 게임을 위한 증명 가능하게 공정한 카드 추첨 및 덱 셔플.

**제약 조건**: ~200K | **복잡도**: High

---

## 배경

카드 게임은 암호화 공정성 보장이 필요합니다:

- **셔플 무결성**: 덱 순서가 어떤 당사자에게도 예측 불가능하고 조작 불가능해야 합니다
- **핸드 프라이버시**: 플레이어의 핸드가 상대로부터 숨겨져야 합니다
- **추첨 검증**: 각 추첨이 커밋된 덱 순서에서 증명 가능해야 합니다
- **안티 치팅**: 다가오는 카드를 엿보거나 추첨을 조작하는 것이 불가능해야 합니다

전통적인 온라인 카드 게임은 신뢰할 수 있는 서버에 의존합니다. 블록체인 카드 게임은 플레이어도 하우스도 속일 수 없는 무신뢰 메커니즘이 필요합니다. ZK 증명은 실용적인 효율성으로 정신적 포커 프로토콜을 가능하게 합니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `deckCommitment` | field | 셔플된 덱 상태에 대한 커밋먼트 |
| `drawCommitment` | field | 추첨된 카드에 대한 커밋먼트 |
| `drawIndex` | uint | 추첨되는 덱의 위치 |
| `gameId` | uint | 고유 게임 세션 식별자 |
| `playerCommitment` | field | 플레이어의 신원 커밋먼트 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `playerPkX, playerPkY` | field | 플레이어의 공개 키 |
| `playerSk` | field | 플레이어의 비밀 키 |
| `shuffleSeed` | field | 결합된 셔플 무작위성 |
| `deckCards` | uint[52] | 셔플 후 전체 덱 순서 |
| `drawnCard` | uint | 추첨되는 카드 |
| `handSalt` | field | 핸드 커밋먼트를 위한 랜덤성 |
| `deckSalt` | field | 덱 커밋먼트를 위한 랜덤성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/shuffle/fisher_yates.circom";

template CardDrawVerify(DECK_SIZE) {
    // ===== Public Inputs =====
    signal input deckCommitment;
    signal input drawCommitment;
    signal input drawIndex;
    signal input gameId;
    signal input playerCommitment;

    // ===== Private Inputs =====
    signal input playerPkX, playerPkY, playerSk;
    signal input shuffleSeed;
    signal input deckCards[DECK_SIZE];
    signal input drawnCard;
    signal input handSalt;
    signal input deckSalt;

    // ===== 1. Verify Player Identity =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== playerSk;
    ownership.pkX <== playerPkX;
    ownership.pkY <== playerPkY;

    // ===== 2. Generate Player Commitment =====
    component playerCommit = Poseidon(3);
    playerCommit.inputs[0] <== playerPkX;
    playerCommit.inputs[1] <== playerPkY;
    playerCommit.inputs[2] <== gameId;
    playerCommit.out === playerCommitment;

    // ===== 3. Verify Deck Shuffled Correctly =====
    // Regenerate shuffled deck from seed
    component shuffle = FisherYatesShuffle(DECK_SIZE);
    shuffle.seed <== shuffleSeed;
    for (var i = 0; i < DECK_SIZE; i++) {
        shuffle.inputDeck[i] <== i;  // Standard deck 0-51
    }

    // Verify provided deck matches shuffle output
    for (var i = 0; i < DECK_SIZE; i++) {
        shuffle.outputDeck[i] === deckCards[i];
    }

    // ===== 4. Verify Deck Commitment =====
    // Deck commitment = Hash(cards..., salt)
    // Using recursive hashing for large deck
    component deckHash[DECK_SIZE];
    signal deckHashAccum[DECK_SIZE + 1];
    deckHashAccum[0] <== deckSalt;

    for (var i = 0; i < DECK_SIZE; i++) {
        deckHash[i] = Poseidon(2);
        deckHash[i].inputs[0] <== deckHashAccum[i];
        deckHash[i].inputs[1] <== deckCards[i];
        deckHashAccum[i + 1] <== deckHash[i].out;
    }
    deckHashAccum[DECK_SIZE] === deckCommitment;

    // ===== 5. Verify Draw Index Valid =====
    component indexCheck = LessThan(8);
    indexCheck.in[0] <== drawIndex;
    indexCheck.in[1] <== DECK_SIZE;
    indexCheck.out === 1;

    // ===== 6. Verify Drawn Card Matches Deck Position =====
    // Select card at drawIndex from deckCards
    component cardSelect[DECK_SIZE];
    signal isSelectedIndex[DECK_SIZE];
    signal selectedCard[DECK_SIZE + 1];
    selectedCard[0] <== 0;

    for (var i = 0; i < DECK_SIZE; i++) {
        cardSelect[i] = IsEqual();
        cardSelect[i].in[0] <== i;
        cardSelect[i].in[1] <== drawIndex;
        isSelectedIndex[i] <== cardSelect[i].out;
        selectedCard[i + 1] <== selectedCard[i] + isSelectedIndex[i] * deckCards[i];
    }

    // Verify drawn card matches
    drawnCard === selectedCard[DECK_SIZE];

    // ===== 7. Generate Draw Commitment =====
    // Hidden commitment to drawn card
    component drawCommit = Poseidon(4);
    drawCommit.inputs[0] <== drawnCard;
    drawCommit.inputs[1] <== drawIndex;
    drawCommit.inputs[2] <== gameId;
    drawCommit.inputs[3] <== handSalt;
    drawCommit.out === drawCommitment;

    // ===== 8. Verify Card Valid =====
    component cardValid = LessThan(8);
    cardValid.in[0] <== drawnCard;
    cardValid.in[1] <== DECK_SIZE;
    cardValid.out === 1;
}

component main {public [deckCommitment, drawCommitment, drawIndex, gameId, playerCommitment]} =
    CardDrawVerify(52);
```

### 주요 제약 조건

1. **셔플 무결성**: 덱 순서가 커밋된 시드에서 결정론적으로 파생됩니다
2. **추첨 정확성**: 추첨된 카드가 지정된 인덱스의 덱과 일치합니다
3. **카드 유효성**: 추첨된 카드가 유효합니다 (표준 덱의 경우 0-51)
4. **인덱스 유효성**: 추첨 인덱스가 덱 범위 내에 있습니다
5. **커밋먼트 바인딩**: 모든 커밋먼트가 그 내용에 암호화적으로 바인딩됩니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **공정한 셔플** | 어떤 당사자도 덱 순서를 예측하거나 조작할 수 없음 |
| **핸드 프라이버시** | 상대가 추첨된 카드를 볼 수 없음 |
| **추첨 검증** | 각 추첨이 올바른 덱 위치에서 증명 가능 |
| **치팅 방지** | 앞을 내다보거나 추첨을 조작할 수 없음 |
| **무신뢰 게임** | 신뢰할 수 있는 딜러나 서버 불필요 |
| **분쟁 해결** | 모든 행동이 암호화적으로 검증 가능 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **시드 조작** | commit-reveal을 사용한 다자간 시드 생성 |
| **덱 예측** | 예측 불가능한 시드에서의 암호화 셔플 |
| **카드 카운팅** | 덱 상태 숨김; 추첨 커밋먼트만 보임 |
| **담합** | 각 플레이어가 셔플에 무작위성 기여 |
| **재생 공격** | gameId가 각 게임을 고유하게 만듦 |
| **핸드 공개** | handSalt가 커밋먼트 무차별 대입 방지 |

## 구현 과제

1. **다자간 셔플**
   - 모든 플레이어가 무작위성 기여
   - 개별 기여를 공개하지 않고 시드를 안전하게 결합
   - 셔플 단계 중 플레이어 탈락 처리

2. **효율적인 덱 표현**
   - 52장의 카드가 효율적인 인코딩 필요
   - 커밋먼트를 위한 재귀 해싱
   - 성능을 위한 배치 작업 고려

3. **게임 상태 관리**
   - 어떤 카드가 추첨되었는지 추적
   - 올바른 순서로 추첨 검증
   - 여러 플레이어의 추첨 처리

4. **공개 메커니즘**
   - 카드가 언제 어떻게 공개되는가?
   - 검증을 위한 게임 종료 공개
   - 게임 행동을 위한 부분 공개 (카드 보여주기)

## 파생 상품

1. **덱 빌딩 검증** - 구성을 공개하지 않고 덱에 합법적인 카드만 포함되어 있음을 증명합니다. 회로가 허용된 목록에 대해 각 카드를 확인합니다. 덱 제한이 있는 구성 형식을 지원합니다.

2. **핸드 프라이버시** - 카드를 공개하지 않고 핸드 속성을 증명합니다. 회로가 핸드에 특정 조합이 포함되어 있는지 검증합니다 (예: "페어가 있음"). 숨겨진 정보 게임 행동을 가능하게 합니다.

3. **추첨 예측 방지** - 다자간 무작위성이 단일 당사자가 추첨을 예측할 수 없도록 보장합니다. 회로가 모든 당사자가 셔플 시드에 기여했는지 검증합니다. 시드 지식으로 인한 이점을 제거합니다.

4. **멀리건 규칙** - 멀리건이 규칙에 따라 유효했음을 증명합니다. 회로가 원래 핸드가 멀리건 조건을 충족했는지 검증합니다. 멀리건 메커니즘의 남용을 방지합니다.

5. **토너먼트 합법 덱** - 덱이 토너먼트 규칙을 따른다는 것을 증명합니다. 회로가 카드 수, 금지된 카드, 사이드보드 제한을 확인합니다. 토너먼트를 위한 blind 덱 등록을 가능하게 합니다.

## 사용 사례

1. **블록체인 포커**
   - 플레이어가 셔플 기여에 커밋
   - 결합된 시드가 덱을 셔플
   - 각 플레이어가 숨겨진 커밋먼트로 카드 추첨
   - 쇼다운이 팟 결정을 위해 카드 공개
   - 게임 후 모든 핸드 검증 가능

2. **트레이딩 카드 게임**
   - 플레이어가 비공개로 덱 구축
   - 카드를 공개하지 않고 덱이 합법적임을 증명
   - 상대로부터 숨겨진 추첨
   - 공개될 때 행동이 증명 가능
   - 경쟁 플레이를 위한 안티 치팅

3. **카지노 카드 게임**
   - 증명 가능하게 공정한 딜링을 갖춘 블랙잭
   - 플레이어가 각 추첨이 합법적이었는지 검증 가능
   - 카드 순서의 하우스 조작 없음
   - 검증 가능성을 통한 규제 준수

4. **드래프트 형식**
   - 팩 내용이 숨겨져 있지만 커밋됨
   - 각 픽이 팩 상태에서 증명 가능
   - 미래 픽을 보는 것 방지
   - 낯선 사람 간의 무신뢰 드래프팅 가능

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F8. Card Draw Verify - Products](../../product/f-nft-gaming/f8-card-draw-products.md)

---

[목차로 돌아가기](../../README.md)
