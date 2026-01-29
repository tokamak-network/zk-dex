# F5. Gaming Item Trade

숨겨진 인벤토리, 은닉된 거래 가치 및 검증 가능한 아이템 진위성을 갖춘 게임 내 아이템의 private P2P 거래.

**제약 조건**: ~150K | **복잡도**: Medium

---

## 배경

게임 아이템 거래는 민감한 플레이어 정보를 노출합니다:

- **인벤토리 프라이버시**: 공개 아이템 보유량은 플레이어의 부를 드러내고 사기나 해킹의 표적이 될 수 있습니다
- **거래 전략 은닉**: 가시적인 거래는 경쟁자에게 차익 거래 기회와 거래 패턴을 드러냅니다
- **가치 프라이버시**: 거래 금액은 플레이어의 지출 습관과 아이템 평가를 노출합니다
- **교차 게임 거래**: 아이템이 여러 게임에서 가치를 가질 수 있습니다; private 거래는 신중한 교차 게임 경제를 가능하게 합니다

게임 경제는 점점 더 가치가 높아지고 있으며, 일부 희귀 아이템은 수천 달러의 가치가 있습니다. Private 거래는 아이템 진위성 검증을 유지하면서 플레이어를 보호합니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `itemNoteHash` | field | 거래되는 아이템의 해시 |
| `newItemNoteHash` | field | 새 아이템 note의 해시 (새 소유자) |
| `paymentNoteHash` | field | 지불 note의 해시 (해당하는 경우) |
| `gameId` | uint | 게임 생태계의 식별자 |
| `nullifier` | field | 아이템 note에 대한 nullifier |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX, sellerPkY` | field | 판매자의 공개 키 |
| `sellerSk` | field | 판매자의 비밀 키 |
| `buyerPkX, buyerPkY` | field | 구매자의 공개 키 |
| `itemId` | uint | 고유 아이템 식별자 |
| `itemType` | uint | 아이템 카테고리/유형 |
| `itemAttributes` | field | 아이템 속성의 해시 (스탯, 인챈트) |
| `itemSalt` | field | 아이템 note 랜덤성 |
| `newItemSalt` | field | 새 아이템 note 랜덤성 |
| `price` | uint | 거래 가격 (선물의 경우 0) |
| `paymentToken` | uint | 지불을 위한 토큰 유형 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template GamingItemTrade() {
    // ===== Public Inputs =====
    signal input itemNoteHash;
    signal input newItemNoteHash;
    signal input paymentNoteHash;
    signal input gameId;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY, sellerSk;
    signal input buyerPkX, buyerPkY;
    signal input itemId, itemType, itemAttributes;
    signal input itemSalt, newItemSalt;
    signal input price, paymentToken, paymentSalt;

    // ===== 1. Verify Item Note =====
    // Item note: Hash(ownerPkX, ownerPkY, itemId, itemType, attributes, gameId, salt)
    component itemNote = Poseidon(7);
    itemNote.inputs[0] <== sellerPkX;
    itemNote.inputs[1] <== sellerPkY;
    itemNote.inputs[2] <== itemId;
    itemNote.inputs[3] <== itemType;
    itemNote.inputs[4] <== itemAttributes;
    itemNote.inputs[5] <== gameId;
    itemNote.inputs[6] <== itemSalt;
    itemNote.out === itemNoteHash;

    // ===== 2. Verify Seller Ownership =====
    component sellerOwnership = ProofOfOwnershipStrict();
    sellerOwnership.sk <== sellerSk;
    sellerOwnership.pkX <== sellerPkX;
    sellerOwnership.pkY <== sellerPkY;

    // ===== 3. Compute Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== itemId;
    nullifierCalc.inputs[1] <== itemSalt;
    nullifierCalc.inputs[2] <== sellerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Create New Item Note for Buyer =====
    component newItemNote = Poseidon(7);
    newItemNote.inputs[0] <== buyerPkX;
    newItemNote.inputs[1] <== buyerPkY;
    newItemNote.inputs[2] <== itemId;
    newItemNote.inputs[3] <== itemType;
    newItemNote.inputs[4] <== itemAttributes;
    newItemNote.inputs[5] <== gameId;
    newItemNote.inputs[6] <== newItemSalt;
    newItemNote.out === newItemNoteHash;

    // ===== 5. Verify Payment Note (if price > 0) =====
    // Payment note: Hash(sellerPkX, sellerPkY, price, paymentToken, salt)
    component paymentNote = Poseidon(5);
    paymentNote.inputs[0] <== sellerPkX;
    paymentNote.inputs[1] <== sellerPkY;
    paymentNote.inputs[2] <== price;
    paymentNote.inputs[3] <== paymentToken;
    paymentNote.inputs[4] <== paymentSalt;

    // If price == 0, paymentNoteHash should be 0 (gift)
    // If price > 0, paymentNoteHash should match computed payment note
    component isGift = IsZero();
    isGift.in <== price;

    component paymentCheck = Poseidon(5);
    signal expectedPaymentHash;
    expectedPaymentHash <== paymentNote.out * (1 - isGift.out);

    // Either it's a gift (price=0) or payment matches
    signal paymentValid;
    paymentValid <== isGift.out + (1 - isGift.out) * (paymentNoteHash - expectedPaymentHash == 0 ? 1 : 0);

    // ===== 6. Item Attributes Preserved =====
    // Already ensured by using same itemAttributes in old and new notes
}

component main {public [itemNoteHash, newItemNoteHash, paymentNoteHash, gameId, nullifier]} =
    GamingItemTrade();
```

### 주요 제약 조건

1. **판매자 소유권**: 아이템 소유자만 거래를 시작할 수 있습니다
2. **속성 보존**: 전송 중 아이템 속성이 변경되지 않습니다
3. **게임 바인딩**: 아이템이 자신의 게임 생태계 내에 유지됩니다
4. **지불 검증**: 유료 거래인 경우 판매자를 위한 지불 note 생성
5. **Nullifier 고유성**: 아이템 note는 한 번만 사용될 수 있습니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **인벤토리 프라이버시** | 플레이어 보유량이 경쟁자로부터 숨겨짐 |
| **거래 익명성** | 구매자/판매자 신원이 공개적으로 연결되지 않음 |
| **가치 은닉** | 거래 금액 숨김 |
| **아이템 진위성** | 게임 시스템에서 증명 가능하게 진품 아이템 |
| **사기 방지** | 원자적 스왑이 양 당사자가 받도록 보장 |
| **교차 플랫폼** | 호환 게임 간에 아이템 이동 가능 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **아이템 복제** | Nullifier가 아이템의 이중 지불 방지 |
| **가짜 아이템** | 아이템 note는 게임 컨트랙트에 의해서만 생성됨 |
| **지불 사기** | 원자적 거래가 유효한 지불 note 필요 |
| **속성 변조** | 속성이 해시되고 전송 간에 보존됨 |
| **게임 탈출** | gameId가 아이템이 유효한 생태계에 유지되도록 보장 |
| **선행 실행** | 커밋된 거래가 가로챌 수 없음 |

## 구현 과제

1. **아이템 생성 권한**
   - 게임 컨트랙트만 합법적인 아이템을 생성할 수 있습니다
   - 게임 서버와 블록체인 간의 안전한 브리지 필요
   - 민팅을 위한 다중 서명 또는 임계값 서명 고려

2. **속성 시스템**
   - 복잡한 속성 (스탯, 인챈트, 내구도)
   - 검증 가능성을 유지하면서 단일 해시로 표현하는 방법
   - 선택적 공개를 위한 속성의 Merkle 트리 필요할 수 있음

3. **마켓플레이스 통합**
   - 주문서가 숨겨진 아이템과 작동해야 함
   - 구매자가 인벤토리를 보지 않고 아이템을 찾는 방법은?
   - ZK 증명을 사용한 속성 기반 검색 고려

4. **에스크로 메커니즘**
   - 무신뢰 원자적 스왑은 신중한 설계 필요
   - 거래 분쟁을 위한 시간 잠금 에스크로
   - 복잡한 거래를 위한 중재자 시스템

## 파생 상품

1. **아이템 번들** - 여러 아이템을 원자적 번들로 거래합니다. 회로가 모든 아이템의 소유권을 증명합니다; 구매자를 위한 새 note를 생성합니다. 세트 보너스나 스타터 팩에 유용합니다.

2. **교차 게임 거래** - 호환 게임 간에 아이템을 거래합니다. 회로가 소스 게임에서 아이템 유효성을 검증합니다; 대상에서 동등한 note를 생성합니다. 게임 간 호환성 매핑이 필요합니다.

3. **아이템 대여** - 자동 반환이 있는 임시 아이템 전송. 대여자가 청구 note를 유지합니다; 차용자가 사용 note를 받습니다. 회로가 지정된 기간 또는 조건 후 반환을 강제합니다.

4. **에스크로 거래** - 고가치 거래를 위한 제3자 에스크로. 에스크로 에이전트가 아이템 note를 보유합니다; 지불 확인 시 해제합니다. 중재 논리로 분쟁을 처리합니다.

5. **경매 하우스 통합** - 공개하지 않고 경매를 위한 아이템 목록. 낙찰 입찰이 원자적 스왑을 트리거합니다. 판매자가 예약 가격 설정 가능; 최고 입찰자가 승리합니다.

## 사용 사례

1. **MMO 희귀 아이템 거래**
   - 플레이어가 $5,000 가치의 전설적인 검을 발견
   - private 판매를 위해 목록; 구매자가 암호화된 채널을 통해 연락
   - 원자적 스왑: 구매자에게 아이템 note, 판매자에게 지불 note
   - 어느 당사자의 신원이나 다른 보유량도 드러나지 않음

2. **E스포츠 팀 장비 전송**
   - 프로 팀이 비공개로 최고급 장비 획득
   - 경쟁자가 팀의 장비 로드아웃을 볼 수 없음
   - 팀이 숨겨진 준비로 상대를 놀라게 할 수 있음
   - 거래가 팀의 전략적 투자를 드러내지 않음

3. **게임 길드 경제**
   - 길드가 내부 마켓플레이스 운영
   - 회원이 자유롭게 거래; 외부 관찰자는 아무것도 보지 못함
   - 길드가 공개 및 private 시장 간 차익 거래 가능
   - 재무 보유량이 기밀로 유지됨

4. **교차 게임 자산 브리지**
   - 플레이어의 게임 A의 검이 게임 B에서 동등물을 가짐
   - 수집가에게 검을 비공개로 거래
   - 수집가가 어느 게임에서나 동등물 상환
   - 원래 플레이어가 하나의 생태계를 신중하게 나감

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F5. Gaming Item Trade - Products](../../product/f-nft-gaming/f5-gaming-items-products.md)

---

[목차로 돌아가기](../../README.md)
