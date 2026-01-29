# F2. Blind Auction Bid

공개 단계까지 입찰 금액이 숨겨진 봉인 입찰 경매 메커니즘으로 입찰 조작과 저격을 방지합니다.

**제약 조건**: ~150K | **복잡도**: Medium

---

## 배경

Blind 경매는 온체인 NFT 판매의 중요한 문제를 해결합니다:

- **입찰 프라이버시**: 공개 경매에서는 경쟁자가 보고 최소 금액으로 추가 입찰 가능; 봉인 입찰은 진정한 평가를 강제합니다
- **저격 방지**: 입찰이 숨겨져 있을 때 현재 최고 입찰을 기준으로 마지막 순간 입찰을 계산할 수 없습니다
- **전략 보호**: 입찰 패턴은 수집가 선호도와 예산을 드러냅니다; 봉인 입찰은 이 정보를 숨깁니다
- **가격 발견**: 입찰자가 보이는 입찰에 고정할 수 없을 때 진정한 시장 가치가 나타납니다

전통적인 경매 하우스는 고가치 품목에 대해 봉인 입찰 형식을 사용합니다. ZK blind 경매는 이 모델에 암호화 보증을 가져와 지정된 시간 전에 입찰이 공개될 수 없도록 보장합니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bidCommitment` | field | 입찰 세부사항에 대한 해시 커밋먼트 |
| `auctionId` | uint | 경매의 고유 식별자 |
| `collateralHash` | field | 잠긴 담보 note의 해시 |
| `nullifier` | field | 담보 note에 대한 nullifier |
| `minBid` | uint | 필요한 최소 입찰 (공개 경매 매개변수) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bidAmount` | uint | 실제 입찰 값 (숨김) |
| `bidderPkX, bidderPkY` | field | 입찰자의 공개 키 |
| `bidderSk` | field | 입찰자의 비밀 키 |
| `bidSalt` | field | 입찰 커밋먼트를 위한 랜덤성 |
| `collateralValue` | uint | 잠긴 담보의 가치 |
| `collateralSalt` | field | 담보 note 랜덤성 |
| `tokenType` | uint | 담보의 토큰 유형 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template BlindAuctionBid() {
    // ===== Public Inputs =====
    signal input bidCommitment;
    signal input auctionId;
    signal input collateralHash;
    signal input nullifier;
    signal input minBid;

    // ===== Private Inputs =====
    signal input bidAmount;
    signal input bidderPkX, bidderPkY, bidderSk;
    signal input bidSalt;
    signal input collateralValue, collateralSalt, tokenType;

    // ===== 1. Verify Bid Commitment =====
    // Commitment = Hash(auctionId, bidAmount, bidderPkX, bidderPkY, bidSalt)
    component bidHash = Poseidon(5);
    bidHash.inputs[0] <== auctionId;
    bidHash.inputs[1] <== bidAmount;
    bidHash.inputs[2] <== bidderPkX;
    bidHash.inputs[3] <== bidderPkY;
    bidHash.inputs[4] <== bidSalt;
    bidHash.out === bidCommitment;

    // ===== 2. Verify Bidder Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== bidderSk;
    ownership.pkX <== bidderPkX;
    ownership.pkY <== bidderPkY;

    // ===== 3. Verify Collateral Note =====
    // Collateral note: Hash(pkX, pkY, value, tokenType, salt)
    component collateral = Poseidon(5);
    collateral.inputs[0] <== bidderPkX;
    collateral.inputs[1] <== bidderPkY;
    collateral.inputs[2] <== collateralValue;
    collateral.inputs[3] <== tokenType;
    collateral.inputs[4] <== collateralSalt;
    collateral.out === collateralHash;

    // ===== 4. Compute Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== collateralSalt;
    nullifierCalc.inputs[1] <== bidderSk;
    nullifierCalc.inputs[2] <== auctionId;
    nullifierCalc.out === nullifier;

    // ===== 5. Bid >= Minimum Bid =====
    component minCheck = GreaterEqThan(64);
    minCheck.in[0] <== bidAmount;
    minCheck.in[1] <== minBid;
    minCheck.out === 1;

    // ===== 6. Collateral >= Bid Amount =====
    component collateralCheck = GreaterEqThan(64);
    collateralCheck.in[0] <== collateralValue;
    collateralCheck.in[1] <== bidAmount;
    collateralCheck.out === 1;
}

component main {public [bidCommitment, auctionId, collateralHash, nullifier, minBid]} =
    BlindAuctionBid();
```

### 주요 제약 조건

1. **입찰 커밋먼트 바인딩**: 입찰 금액이 커밋먼트에 암호화적으로 바인딩됨; 제출 후 변경 불가
2. **소유권 검증**: 키 보유자만 자신의 담보를 사용하여 입찰 생성 가능
3. **충분한 담보**: 잠긴 담보가 입찰 금액을 커버해야 함
4. **최소 입찰 준수**: 입찰이 경매 최소 임계값을 충족해야 함
5. **담보당 단일 입찰**: Nullifier가 동일한 담보로 여러 입찰 방지

## 효과

| 측면 | 영향 |
|--------|--------|
| **입찰 프라이버시** | 공개 단계까지 입찰 금액 숨김 |
| **공정한 경쟁** | 점진적으로 추가 입찰하는 능력 없음 |
| **저격 방지** | 마지막 순간 입찰을 계산할 수 없음 |
| **담보 보안** | 경매 중 자금 잠금; 가짜 입찰 없음 |
| **입찰자 익명성** | 입찰 커밋먼트에 신원 숨김 |
| **가스 효율성** | 입찰 + 담보 잠금을 위한 단일 증명 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **조기 공개** | 커밋먼트 스킴이 추출을 방지; 강력한 랜덤성 사용 |
| **입찰 Grinding** | 높은 엔트로피 salt가 입찰의 무차별 대입 발견 방지 |
| **담보 재사용** | 경매에 연결된 nullifier가 다중 경매 담보 재사용 방지 |
| **가짜 입찰** | 담보 잠금이 입찰이 이행될 수 있도록 보장 |
| **공개 단계 그리핑** | 미공개에 대한 페널티; 담보의 일부 몰수 |
| **경매 조작** | 스마트 컨트랙트가 commit-reveal 타임라인 강제 |

## 구현 과제

1. **2단계 프로토콜**
   - 입찰 제출 단계: 커밋먼트 수집
   - 공개 단계: 입찰자가 공개 증명 제출
   - 승자 결정: 공개된 입찰 비교
   - 정산: NFT와 담보 전송

2. **공개 인센티브**
   - 패배한 입찰자는 공개하지 않을 수 있음
   - 자동 환불 메커니즘 고려
   - 미공개에 대한 페널티가 필요할 수 있음

3. **동점 처리**
   - 동일한 금액의 여러 입찰이 해결 필요
   - 옵션: 가장 이른 타임스탬프, 무작위 선택 또는 보조 기준
   - 결정론적이고 검증 가능해야 함

4. **가스 비용**
   - 각 입찰이 증명 검증 필요
   - 공개 단계가 추가 검증 추가
   - 대규모 경매의 경우 배치 검증 고려

## 파생 상품

1. **Second-Price Sealed Bid (Vickrey)** - 승자가 두 번째로 높은 입찰 금액을 지불하여 진실한 입찰을 장려합니다. 회로는 모든 금액을 공개하지 않고 입찰 순서를 증명합니다. 두 번째 가격을 식별하기 위한 추가 공개 논리가 필요합니다.

2. **다중 품목 경매** - 로트에 대한 단일 입찰로 여러 NFT를 동시에 경매합니다. 입찰자가 원하는 조합을 지정합니다; 회로가 최적 할당을 매칭합니다. 컬렉션 판매에 유용합니다.

3. **예약 가격 검증** - 예약을 공개하지 않고 입찰이 숨겨진 예약을 충족함을 증명합니다. 판매자가 예약에 커밋합니다; 회로가 입찰 >= 예약을 검증합니다. 적격 입찰이 없으면 경매 실패합니다.

4. **보상이 있는 입찰 스테이킹** - 입찰자가 경매 기간 동안 잠긴 담보에 대해 수익을 얻습니다. 담보를 위한 대출 프로토콜과의 통합. 참여의 기회 비용을 줄입니다.

5. **안티 실 입찰** - 판매자가 자신의 경매에 입찰하는 것을 방지합니다. 판매자가 신원에 커밋합니다; 회로가 입찰자 != 판매자를 증명합니다. 신원 프레임워크가 필요하지만 입찰 프라이버시를 유지합니다.

## 사용 사례

1. **고가치 예술품 경매**
   - 아티스트가 blind 경매를 통해 1/1 작품 출시
   - 수집가가 7일 동안 봉인 입찰 제출
   - 아무도 경쟁 입찰 금액을 모름
   - 공개 단계가 승자를 결정; 공정한 시장 가격 발견 보장

2. **도메인 이름 판매**
   - 가치 있는 ENS 도메인이 경매에 나옴
   - 투기꾼이 경쟁자의 평가를 볼 수 없음
   - 전략적 저입찰이나 과입찰 방지
   - 진정한 수요는 종료 시에만 공개됨

3. **한정판 드롭**
   - 프로젝트가 경매를 통해 100개의 NFT 출시
   - 각 입찰자가 지불할 의사가 있는 가격에 커밋
   - 상위 100개 입찰이 승리; 101번째 가격이 하한선 설정
   - 공개 경매의 고래 조작 방지

4. **부동산 NFT 판매**
   - 토큰화된 부동산이 봉인 입찰로 판매됨
   - 진지한 구매자가 진정한 제안 제출
   - 판매자가 입찰 전쟁을 만들기 위해 선택적으로 공개할 수 없음
   - 전통적인 부동산 봉인 입찰 관행을 준수

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F2. Blind Auction Bid - Products](../../product/f-nft-gaming/f2-blind-auction-products.md)

---

[목차로 돌아가기](../../README.md)
