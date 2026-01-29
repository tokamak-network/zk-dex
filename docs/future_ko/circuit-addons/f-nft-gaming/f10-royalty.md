# F10. Royalty Payment

숨겨진 판매 가격과 크리에이터에 대한 자동 배분으로 private NFT 판매에 대한 크리에이터 로열티를 강제합니다.

**제약 조건**: ~160K | **복잡도**: Medium

---

## 배경

NFT 로열티는 공개 및 private 판매에서 집행 문제에 직면합니다:

- **로열티 회피**: 공개 마켓플레이스가 로열티를 우회할 수 있습니다; private 판매가 이를 악화시킵니다
- **크리에이터 보상**: 아티스트가 2차 판매에 대한 지속적인 보상을 받을 자격이 있습니다
- **판매 가격 프라이버시**: 판매 가격을 공개하면 시장 정보가 노출됩니다; 프라이버시가 가치 있습니다
- **다중 크리에이터 분할**: 협업 작품은 복잡한 로열티 배분이 필요합니다

전통적인 로열티 집행은 마켓플레이스 협력에 의존합니다. Private 판매는 로열티를 완전히 회피할 수 있습니다. ZK 로열티 증명은 판매 가격을 공개하지 않고 private 전송에 로열티를 강제하여 크리에이터 권리와 거래 프라이버시를 모두 보호합니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `saleCommitment` | field | 판매 세부사항에 대한 커밋먼트 |
| `royaltyNoteHash` | field | 로열티 지불 note의 해시 |
| `nftNullifier` | field | 판매되는 NFT의 nullifier |
| `newNftNoteHash` | field | 새 NFT note의 해시 (구매자) |
| `collectionAddress` | address | NFT 컬렉션 컨트랙트 |
| `royaltyBps` | uint | 베이시스 포인트의 로열티 비율 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX, sellerPkY` | field | 판매자의 공개 키 |
| `sellerSk` | field | 판매자의 비밀 키 |
| `buyerPkX, buyerPkY` | field | 구매자의 공개 키 |
| `creatorPkX, creatorPkY` | field | 크리에이터의 공개 키 (로열티 수신자) |
| `nftId` | uint | NFT 식별자 |
| `salePrice` | uint | 판매 가격 (숨김) |
| `royaltyAmount` | uint | 계산된 로열티 (숨김) |
| `nftSalt` | field | 현재 NFT note 랜덤성 |
| `newNftSalt` | field | 새 NFT note 랜덤성 |
| `royaltySalt` | field | 로열티 note 랜덤성 |
| `paymentToken` | uint | 지불을 위한 토큰 유형 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template RoyaltyPayment() {
    // ===== Public Inputs =====
    signal input saleCommitment;
    signal input royaltyNoteHash;
    signal input nftNullifier;
    signal input newNftNoteHash;
    signal input collectionAddress;
    signal input royaltyBps;  // e.g., 500 = 5%

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY, sellerSk;
    signal input buyerPkX, buyerPkY;
    signal input creatorPkX, creatorPkY;
    signal input nftId, nftSalt, newNftSalt;
    signal input salePrice, royaltyAmount;
    signal input royaltySalt, paymentToken;

    // ===== 1. Verify Seller Ownership =====
    component oldNftNote = Poseidon(5);
    oldNftNote.inputs[0] <== sellerPkX;
    oldNftNote.inputs[1] <== sellerPkY;
    oldNftNote.inputs[2] <== nftId;
    oldNftNote.inputs[3] <== collectionAddress;
    oldNftNote.inputs[4] <== nftSalt;

    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sellerSk;
    ownership.pkX <== sellerPkX;
    ownership.pkY <== sellerPkY;

    // ===== 2. Compute NFT Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== nftId;
    nullifierCalc.inputs[1] <== nftSalt;
    nullifierCalc.inputs[2] <== sellerSk;
    nullifierCalc.out === nftNullifier;

    // ===== 3. Create New NFT Note for Buyer =====
    component newNftNote = Poseidon(5);
    newNftNote.inputs[0] <== buyerPkX;
    newNftNote.inputs[1] <== buyerPkY;
    newNftNote.inputs[2] <== nftId;
    newNftNote.inputs[3] <== collectionAddress;
    newNftNote.inputs[4] <== newNftSalt;
    newNftNote.out === newNftNoteHash;

    // ===== 4. Verify Royalty Calculation =====
    // royaltyAmount = salePrice * royaltyBps / 10000
    signal expectedRoyalty;
    expectedRoyalty <== salePrice * royaltyBps;

    // Verify royaltyAmount * 10000 >= expectedRoyalty (handles rounding)
    component royaltyCheck = GreaterEqThan(128);
    royaltyCheck.in[0] <== royaltyAmount * 10000;
    royaltyCheck.in[1] <== expectedRoyalty;
    royaltyCheck.out === 1;

    // Verify not overpaying (royaltyAmount * 10000 < expectedRoyalty + 10000)
    component royaltyMax = LessThan(128);
    royaltyMax.in[0] <== royaltyAmount * 10000;
    royaltyMax.in[1] <== expectedRoyalty + 10000;
    royaltyMax.out === 1;

    // ===== 5. Create Royalty Payment Note =====
    // Payment to creator
    component royaltyNote = Poseidon(5);
    royaltyNote.inputs[0] <== creatorPkX;
    royaltyNote.inputs[1] <== creatorPkY;
    royaltyNote.inputs[2] <== royaltyAmount;
    royaltyNote.inputs[3] <== paymentToken;
    royaltyNote.inputs[4] <== royaltySalt;
    royaltyNote.out === royaltyNoteHash;

    // ===== 6. Create Sale Commitment =====
    // Binds all sale details for verification
    component saleHash = Poseidon(6);
    saleHash.inputs[0] <== nftId;
    saleHash.inputs[1] <== salePrice;
    saleHash.inputs[2] <== royaltyAmount;
    saleHash.inputs[3] <== sellerPkX;
    saleHash.inputs[4] <== buyerPkX;
    saleHash.inputs[5] <== paymentToken;
    saleHash.out === saleCommitment;

    // ===== 7. Verify Sale Price Positive =====
    component priceCheck = GreaterThan(64);
    priceCheck.in[0] <== salePrice;
    priceCheck.in[1] <== 0;
    priceCheck.out === 1;
}

component main {public [saleCommitment, royaltyNoteHash, nftNullifier, newNftNoteHash, collectionAddress, royaltyBps]} =
    RoyaltyPayment();
```

### 주요 제약 조건

1. **판매자 소유권**: NFT 소유자만 판매를 시작할 수 있습니다
2. **로열티 계산**: 로열티 금액이 판매 가격의 비율과 일치합니다
3. **크리에이터 지불**: 올바른 수신자를 위한 로열티 note 생성
4. **NFT 전송**: 올바른 NFT ID로 구매자를 위한 새 note 생성
5. **가격 유효성**: 판매 가격이 양수여야 함 (제로 로열티 전송 방지)

## 효과

| 측면 | 영향 |
|--------|--------|
| **크리에이터 보호** | private 판매에서도 로열티 강제 |
| **가격 프라이버시** | 공개에서 숨겨진 판매 금액 |
| **자동 배분** | 수동 로열티 수집 불필요 |
| **우회 방지** | 로열티 지불 없이 전송 불가 |
| **컬렉션 준수** | 컬렉션별 로열티 비율 준수 |
| **다중 크리에이터 지원** | 로열티 분할로 확장 가능 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **로열티 과소 지불** | 회로가 선언된 가격에 기반한 최소치 강제 |
| **가격 조작** | 최소 로열티를 위한 하한 가격 oracle 고려 |
| **제로 가격 판매** | 양의 판매 가격 또는 하한 사용 요구 |
| **크리에이터 키 분실** | 키 회전 또는 복구 메커니즘 지원 |
| **래핑/언래핑 우회** | 래핑과 언래핑에도 로열티 적용 |
| **오프체인 지불** | 경제적 인센티브; 부분 집행이 전무보다 나음 |

## 구현 과제

1. **크리에이터 레지스트리**
   - 각 NFT의 크리에이터를 어떻게 결정하는가?
   - 컬렉션당 온체인 레지스트리
   - 크리에이터 주소의 Merkle 트리

2. **로열티 비율 변경**
   - 크리에이터가 로열티 비율을 변경할 수 있는가?
   - 통지 기간이 있는 시간 잠금 변경
   - 최대 비율 상한 고려

3. **다중 크리에이터 분할**
   - 여러 크리에이터가 있는 협업 작품
   - 온체인에 커밋된 분할 비율
   - 단일 증명에 여러 로열티 note

4. **하한 가격 집행**
   - 제로 또는 사소하게 낮은 가격 방지
   - oracle 하한 가격 사용
   - 최소 절대 로열티 금액

## 파생 상품

1. **계층화된 로열티** - 판매 가격 브라켓에 기반한 다른 로열티 비율. 회로가 가격 범위를 확인하고 해당 비율을 적용합니다. 고가치 판매가 다른 비율을 가질 수 있습니다.

2. **다중 크리에이터 분할** - 로열티가 여러 크리에이터 간에 자동으로 분할됩니다. 회로가 각 크리에이터를 위한 별도 note를 생성합니다. 복잡한 협업 배열을 지원합니다.

3. **2차 판매 추적** - NFT가 판매된 횟수를 추적합니다. 로열티 비율이 판매 횟수에 따라 변경될 수 있습니다. 더 낮은 비율로 얼리 어답터에게 보상합니다.

4. **로열티 우회 방지** - 로열티 회피 시도를 탐지하고 페널티를 부과합니다. 회로가 시장 데이터에 대해 가격을 검증합니다. 의심스러운 판매에 대한 담보 몰수가 필요합니다.

5. **소급 로열티** - 집행 전에 이루어진 과거 판매에 로열티를 적용합니다. 회로가 과거 판매를 검증하고 빚진 로열티를 계산합니다. 과거 회피에 대한 크리에이터 보상을 가능하게 합니다.

## 사용 사례

1. **아티스트 지속적인 보상**
   - 디지털 아티스트가 생성 컬렉션 생성
   - 모든 2차 판매에 7.5% 로열티 설정
   - Private 판매도 여전히 아티스트에게 로열티 지불
   - 판매 가격이 기밀로 유지
   - 아티스트가 컬렉션 거래에서 꾸준한 수입 받음

2. **협업 예술 프로젝트**
   - 세 명의 아티스트가 협업 작품 생성
   - 로열티가 40/40/20으로 분할
   - 각 판매가 세 개의 로열티 note 생성
   - 개별 아티스트 수입이 private로 유지
   - 조정 없는 자동 배분

3. **게임 스튜디오 수익**
   - 스튜디오가 게임 내 아이템을 NFT로 생성
   - 10% 로열티가 지속적인 개발 자금 조달
   - 플레이어 간 private 거래가 여전히 기여
   - 스튜디오가 개별 판매를 보지 않고 집계 로열티 추적

4. **음악 NFT 로열티**
   - 뮤지션이 노래를 NFT로 출시
   - 프로듀서 및 레이블과 15% 로열티 분할
   - 팬이 비공개로 거래; 로열티가 여전히 흐름
   - 아티스트 친화적인 2차 시장 가능

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F10. Royalty Payment - Products](../../product/f-nft-gaming/f10-royalty-products.md)

---

[목차로 돌아가기](../../README.md)
