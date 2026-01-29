# A7. 경매 (Auction - Dutch/English)

숨겨진 입찰 매개변수를 가진 하강 (Dutch) 또는 상승 (English) 경매 메커니즘을 통한 시간 기반 가격 발견.

**제약 조건**: ~250K | **복잡도**: Medium

---

## 배경

경매 메커니즘은 고유하거나 비유동성 자산에 대한 효율적인 가격 발견을 제공합니다:

- **가격 발견**: 지속적인 유동성이 필요 없이 공정한 시장 가치를 찾습니다
- **고유 자산 판매**: NFT, 대규모 토큰 블록 및 비유동성 자산은 경매 스타일 판매가 필요합니다
- **정보 누출 감소**: 밀봉 입찰은 스나이핑 및 전략적 저입찰을 방지합니다
- **시간 구조화된 판매**: 명확한 시작/종료 시간이 있는 조직화된 판매 프로세스
- **MEV 저항**: 숨겨진 입찰은 프론트러닝 및 샌드위치 공격을 방지합니다

전통적인 금융에서 경매는 IPO, 재무 판매 및 희귀 자산에 사용됩니다. DeFi에서 대부분의 경매는 투명하여 정교한 입찰자가 마지막 순간까지 기다리거나 (스나이핑) 경쟁 입찰을 볼 수 있습니다. ZK 경매는 결제까지 입찰 금액을 숨깁니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `auctionId` | field | 경매의 고유 식별자 |
| `itemNoteHash` | field | 경매되는 아이템의 해시 |
| `bidNoteHash` | field | 낙찰 입찰 노트의 해시 |
| `sellerOutputHash` | field | 판매자의 지불 노트 해시 |
| `bidderOutputHash` | field | 입찰자의 아이템 노트 해시 |
| `startPrice` | uint | 시작 가격 (Dutch의 경우 최고, English의 경우 최저) |
| `endPrice` | uint | 종료 가격 (Dutch의 경우 최저, English의 경우 예비) |
| `startTime` | uint | 경매 시작 타임스탬프 |
| `endTime` | uint | 경매 종료 타임스탬프 |
| `currentTime` | uint | 가격 계산을 위한 현재 타임스탬프 |
| `tokenType` | uint | 지불을 위한 토큰 타입 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `sellerPkX, sellerPkY` | field | 판매자의 공개키 |
| `sellerSk` | field | 판매자의 비밀키 |
| `itemValue` | uint | 아이템 노트 값 (대체 가능한 수량의 경우) |
| `itemSalt` | field | 아이템 노트 무작위성 |
| `bidderPkX, bidderPkY` | field | 입찰자의 공개키 |
| `bidValue` | uint | 실제 입찰 금액 |
| `bidSalt` | field | 입찰 노트 무작위성 |
| `outSellerValue` | uint | 판매자에게 지불 |
| `outSellerSalt` | field | 판매자 출력 무작위성 |
| `outBidderSalt` | field | 입찰자 출력 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/math/safe_div.circom";

template DutchAuction() {
    // ===== Public Inputs =====
    signal input auctionId;
    signal input itemNoteHash;
    signal input bidNoteHash;
    signal input sellerOutputHash;
    signal input bidderOutputHash;
    signal input startPrice;
    signal input endPrice;
    signal input startTime;
    signal input endTime;
    signal input currentTime;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY, sellerSk;
    signal input itemValue, itemToken, itemSalt;
    signal input bidderPkX, bidderPkY;
    signal input bidValue, bidSalt;
    signal input outSellerValue, outSellerSalt;
    signal input outBidderSalt;

    // ===== 1. Verify Seller Owns Item =====
    component itemNote = PoseidonRegularNote();
    itemNote.pkX <== sellerPkX;
    itemNote.pkY <== sellerPkY;
    itemNote.value <== itemValue;
    itemNote.tokenType <== itemToken;
    itemNote.salt <== itemSalt;
    itemNote.out === itemNoteHash;

    component sellerOwn = ProofOfOwnershipStrict();
    sellerOwn.sk <== sellerSk;
    sellerOwn.pkX <== sellerPkX;
    sellerOwn.pkY <== sellerPkY;

    // ===== 2. Time Validation =====
    // currentTime must be in [startTime, endTime]
    component timeStart = GreaterEqThan(64);
    timeStart.in[0] <== currentTime;
    timeStart.in[1] <== startTime;
    timeStart.out === 1;

    component timeEnd = LessEqThan(64);
    timeEnd.in[0] <== currentTime;
    timeEnd.in[1] <== endTime;
    timeEnd.out === 1;

    // ===== 3. Calculate Current Price (Dutch Auction: Linear Decrease) =====
    // currentPrice = startPrice - (elapsed * priceRange / duration)
    signal elapsed;
    elapsed <== currentTime - startTime;

    signal duration;
    duration <== endTime - startTime;

    signal priceRange;
    priceRange <== startPrice - endPrice;

    // Price decrease = elapsed * priceRange / duration
    signal priceDecrease;
    component divPrice = SafeDiv(128);
    divPrice.dividend <== elapsed * priceRange;
    divPrice.divisor <== duration;
    priceDecrease <== divPrice.quotient;

    signal currentPrice;
    currentPrice <== startPrice - priceDecrease;

    // ===== 4. Verify Bid Note =====
    component bidNote = PoseidonRegularNote();
    bidNote.pkX <== bidderPkX;
    bidNote.pkY <== bidderPkY;
    bidNote.value <== bidValue;
    bidNote.tokenType <== tokenType;
    bidNote.salt <== bidSalt;
    bidNote.out === bidNoteHash;

    // ===== 5. Bid Must Meet Current Price =====
    component bidCheck = GreaterEqThan(64);
    bidCheck.in[0] <== bidValue;
    bidCheck.in[1] <== currentPrice;
    bidCheck.out === 1;

    // ===== 6. Create Seller Output (Payment) =====
    // Seller receives bid amount (or currentPrice if bid exceeds)
    signal sellerReceives;
    sellerReceives <== currentPrice;  // Dutch: seller gets current price, not bid

    component sellerOut = PoseidonRegularNote();
    sellerOut.pkX <== sellerPkX;
    sellerOut.pkY <== sellerPkY;
    sellerOut.value <== outSellerValue;
    sellerOut.tokenType <== tokenType;
    sellerOut.salt <== outSellerSalt;
    sellerOut.out === sellerOutputHash;

    // Verify seller receives current price
    outSellerValue === currentPrice;

    // ===== 7. Create Bidder Output (Item) =====
    component bidderOut = PoseidonRegularNote();
    bidderOut.pkX <== bidderPkX;
    bidderOut.pkY <== bidderPkY;
    bidderOut.value <== itemValue;
    bidderOut.tokenType <== itemToken;
    bidderOut.salt <== outBidderSalt;
    bidderOut.out === bidderOutputHash;

    // ===== 8. Refund Excess Bid =====
    // If bidValue > currentPrice, create refund note
    signal refundAmount;
    refundAmount <== bidValue - currentPrice;
    // Refund handling would create additional output note if refundAmount > 0
}

component main {public [auctionId, itemNoteHash, bidNoteHash, sellerOutputHash,
    bidderOutputHash, startPrice, endPrice, startTime, endTime, currentTime,
    tokenType]} = DutchAuction();
```

### 주요 제약 조건

1. **판매자 소유권**: 판매자는 경매되는 아이템의 소유권을 증명해야 합니다
2. **시간 창**: 현재 시간은 경매 기간 내에 있어야 합니다
3. **가격 계산**: 현재 가격은 선형 보간으로 계산됩니다
4. **최소 입찰**: 입찰은 현재 가격을 충족하거나 초과해야 합니다
5. **가치 전송**: 판매자는 지불을 받고; 입찰자는 아이템을 받습니다
6. **환불 처리**: 초과 입찰 금액이 입찰자에게 반환됩니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **가격 발견** | 경쟁 입찰을 통한 공정한 시장 가치 |
| **유동성** | 지속적인 시장 없이 비유동성 자산 판매 |
| **프라이버시** | 결제까지 입찰 금액 숨김 |
| **시간 구조** | 예측 가능한 종료가 있는 명확한 경매 기간 |
| **MEV 보호** | 숨겨진 입찰이 막판 스나이핑을 방지 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **타임스탬프 조작** | 블록 타임스탬프 사용; 회로가 범위를 검증 |
| **입찰 스나이핑** | 밀봉 입찰이 다른 사람의 금액을 보는 것을 방지 |
| **판매자 공모** | 경매 ID 커밋먼트가 입찰 선택을 방지 |
| **가격 곡선 조작** | 선형 곡선은 결정론적이고 검증 가능 |
| **이중 지불** | 입찰 노트가 낙찰 시 무효화됨 |
| **예비가 충족되지 않음** | 회로가 최소 가격을 강제 (endPrice) |

## 구현 과제

1. **나눗셈 회로**
   - 회로에서 정수 나눗셈은 신중한 구현이 필요합니다
   - SafeDiv 컴포넌트가 나머지를 가진 나눗셈을 처리합니다
   - 정밀도 손실은 제한되고 문서화되어야 합니다

2. **시간 소스 신뢰성**
   - 블록 타임스탬프는 채굴자에 의해 조작될 수 있습니다 (~15초)
   - 시간에 민감한 경매에 대해 커밋-공개 고려
   - 고가치 경매에 대한 다중 블록 확인

3. **English 경매 변형**
   - 여러 입찰자 간 입찰 비교가 필요합니다
   - 증가하는 입찰에 대한 더 복잡한 상태 관리
   - 별도의 회로 또는 다중 라운드 프로토콜 고려

4. **경매 발견**
   - 입찰자가 관심을 공개하지 않고 활성 경매를 어떻게 찾는가?
   - 온체인 결제를 가진 오프체인 인덱싱
   - 입찰 프라이버시를 위한 커밋먼트 방식 고려

5. **환불 복잡성**
   - 초과 입찰은 환불 노트가 필요합니다
   - 여러 출력이 회로 복잡성을 증가시킵니다
   - 정확한 입찰 요구 고려 (환불 없음)

## 파생 상품

1. **밀봉 입찰 차가 경매 (Vickrey)** - 낙찰자는 두 번째로 높은 입찰가를 지불하며, 자신의 입찰가가 아닙니다. 과입찰에 페널티가 없으므로 진실한 입찰을 장려합니다. 공개 전에 모든 입찰을 수집하기 위한 커밋-공개 단계가 필요합니다. 비교를 위한 더 복잡한 다자간 회로.

2. **예비 가격 경매** - 아이템이 판매되지 않을 숨겨진 최소 가격. 최고 입찰가가 예비 가격 아래이면 경매가 실패하고 아이템이 판매자에게 반환됩니다. 예비를 공개하지 않고 최저 가격 아래의 판매를 방지합니다. 회로에는 조건부 결제를 가진 예비 확인이 포함됩니다.

3. **배치 경매** - 여러 아이템 또는 여러 단위가 동시에 경매됩니다. 모든 성공적인 입찰자는 동일한 청산 가격을 지불합니다. IPO 북 빌딩과 유사한 균일 가격 발견. 효율적인 가격 찾기를 위해 수요를 집계합니다.

4. **최소 참여가 있는 경매** - 최소 수의 입찰자가 참여하는 경우에만 경매가 결제됩니다. 인위적으로 낮은 가격을 가진 얇은 경매를 방지합니다. 커밋-공개 단계가 입찰 공개 전에 참여자를 계산합니다. 회로에는 참여 수 확인이 포함됩니다.

5. **시간 연장 경매 (안티 스나이핑)** - 마지막 N분에 입찰이 배치되면 경매가 M분 연장됩니다. English 경매에서 막판 스나이핑을 방지합니다. 타이밍 게임보다 진정한 가격 발견을 장려합니다. 연장 로직이 시간 처리에 복잡성을 추가합니다.

## 사용 사례

1. **NFT 판매**
   - 아티스트가 NFT로 고유한 디지털 예술 작품을 만듭니다
   - Dutch 경매가 높은 가격에서 시작하여 24시간 동안 감소합니다
   - 현재 가격을 지불할 의향이 있는 첫 번째 구매자가 승리합니다
   - 입찰 전쟁이나 가스 경매가 없습니다
   - 가격은 진정한 지불 의향을 반영합니다

2. **대규모 토큰 블록 판매**
   - 프로토콜 재무가 100만 개의 토큰을 판매해야 합니다
   - 경매는 단일 대규모 판매의 시장 영향을 방지합니다
   - 기관 구매자가 전체 블록에 입찰합니다
   - 현물 시장에 영향을 주지 않고 가격 발견
   - 판매자는 공정한 가격을 받고; 구매자는 슬리피지를 피합니다

3. **프로토콜 수수료 배포**
   - 프로토콜이 다양한 토큰으로 수수료를 수집합니다
   - 월간 경매가 수수료 토큰을 ETH로 판매합니다
   - 커뮤니티 구성원이 할인에 입찰합니다
   - 우선 액세스 없이 공정한 배포
   - 숨겨진 입찰 금액을 가진 투명한 프로세스

4. **청산 경매**
   - 담보 부족 포지션이 청산이 필요합니다
   - 담보에 대한 Dutch 경매가 가격을 낮춥니다
   - 가격을 수락하는 첫 번째 입찰자가 담보를 획득합니다
   - 시간에 민감한 청산을 위해 English 경매보다 빠릅니다
   - 프로토콜 안전을 유지하면서 공정한 가격을 보장합니다

## 실제 제품 및 사용자 경험

전용 제품 문서 참조: [제품 응용](../../product/a-core-trading/a7-auction-products.md)

---

[인덱스로 돌아가기](../../README.md)
