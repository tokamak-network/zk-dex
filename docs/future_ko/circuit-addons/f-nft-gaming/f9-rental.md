# F9. NFT Rental Create

private 조건, 자동 만료 및 소유자를 위한 담보 보호가 있는 시간 제한 NFT 임대 계약을 생성합니다.

**제약 조건**: ~180K | **복잡도**: Medium

---

## 배경

NFT 임대는 영구적 전송 없이 유틸리티 공유를 가능하게 합니다:

- **유틸리티 액세스**: 고가치 NFT가 경험에 대한 액세스를 제공합니다; 임대가 액세스를 민주화합니다
- **소유자 수익**: NFT 소유자가 판매하지 않고 자산을 수익화할 수 있습니다; 수동 소득 스트림
- **임차인 프라이버시**: 어떤 NFT가 누구에 의해 임대되는지 숨깁니다; 임차인 표적화 방지
- **조건 프라이버시**: 임대 기간과 가격이 기밀로 유지됩니다; 경쟁 정보

게임 NFT, 메타버스 토지 및 멤버십 NFT는 소유권을 넘어 유틸리티를 가집니다. 임대 시장은 소유자가 수익을 얻고 임차인이 혜택에 액세스할 수 있게 합니다. ZK 임대는 조건을 암호화적으로 강제하면서 숨깁니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `rentalCommitment` | field | 임대 계약에 대한 커밋먼트 |
| `nftNoteHash` | field | 임대되는 NFT의 해시 |
| `usageNoteHash` | field | 임차인의 사용 권한 note의 해시 |
| `collateralNoteHash` | field | 임차인의 담보 해시 |
| `expirationBlock` | uint | 임대가 만료되는 블록 번호 |
| `nullifier` | field | 이중 임대 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | NFT 소유자의 공개 키 |
| `ownerSk` | field | 소유자의 비밀 키 |
| `renterPkX, renterPkY` | field | 임차인의 공개 키 |
| `nftId` | uint | NFT 식별자 |
| `collectionAddress` | address | NFT 컬렉션 컨트랙트 |
| `nftSalt` | field | NFT note 랜덤성 |
| `rentalPrice` | uint | 합의된 임대 가격 |
| `collateralAmount` | uint | 필요한 담보 |
| `duration` | uint | 블록 단위 임대 기간 |
| `rentalSalt` | field | 임대 계약 랜덤성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template NFTRentalCreate() {
    // ===== Public Inputs =====
    signal input rentalCommitment;
    signal input nftNoteHash;
    signal input usageNoteHash;
    signal input collateralNoteHash;
    signal input expirationBlock;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, ownerSk;
    signal input renterPkX, renterPkY;
    signal input nftId, collectionAddress, nftSalt;
    signal input rentalPrice, collateralAmount, duration;
    signal input rentalSalt, usageSalt, collateralSalt;
    signal input collateralToken;
    signal input startBlock;

    // ===== 1. Verify NFT Ownership =====
    component nftNote = Poseidon(5);
    nftNote.inputs[0] <== ownerPkX;
    nftNote.inputs[1] <== ownerPkY;
    nftNote.inputs[2] <== nftId;
    nftNote.inputs[3] <== collectionAddress;
    nftNote.inputs[4] <== nftSalt;
    nftNote.out === nftNoteHash;

    // ===== 2. Verify Owner Identity =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== ownerSk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== 3. Compute Nullifier =====
    // Prevents same NFT being rented twice simultaneously
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== nftId;
    nullifierCalc.inputs[1] <== nftSalt;
    nullifierCalc.inputs[2] <== ownerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Create Rental Agreement Commitment =====
    // Agreement includes all terms hidden
    component rentalHash = Poseidon(7);
    rentalHash.inputs[0] <== nftId;
    rentalHash.inputs[1] <== renterPkX;
    rentalHash.inputs[2] <== renterPkY;
    rentalHash.inputs[3] <== rentalPrice;
    rentalHash.inputs[4] <== collateralAmount;
    rentalHash.inputs[5] <== duration;
    rentalHash.inputs[6] <== rentalSalt;
    rentalHash.out === rentalCommitment;

    // ===== 5. Create Usage Rights Note =====
    // Renter gets usage note valid until expiration
    component usageNote = Poseidon(6);
    usageNote.inputs[0] <== renterPkX;
    usageNote.inputs[1] <== renterPkY;
    usageNote.inputs[2] <== nftId;
    usageNote.inputs[3] <== collectionAddress;
    usageNote.inputs[4] <== expirationBlock;
    usageNote.inputs[5] <== usageSalt;
    usageNote.out === usageNoteHash;

    // ===== 6. Verify Collateral Note =====
    // Collateral locked for rental period
    component collateral = Poseidon(5);
    collateral.inputs[0] <== renterPkX;
    collateral.inputs[1] <== renterPkY;
    collateral.inputs[2] <== collateralAmount;
    collateral.inputs[3] <== collateralToken;
    collateral.inputs[4] <== collateralSalt;
    collateral.out === collateralNoteHash;

    // ===== 7. Verify Expiration Calculation =====
    signal computedExpiration;
    computedExpiration <== startBlock + duration;
    computedExpiration === expirationBlock;

    // ===== 8. Verify Collateral Sufficient =====
    // Collateral should cover potential damages (e.g., >= rental price)
    component collateralCheck = GreaterEqThan(64);
    collateralCheck.in[0] <== collateralAmount;
    collateralCheck.in[1] <== rentalPrice;
    collateralCheck.out === 1;
}

component main {public [rentalCommitment, nftNoteHash, usageNoteHash, collateralNoteHash, expirationBlock, nullifier]} =
    NFTRentalCreate();
```

### 주요 제약 조건

1. **소유자 검증**: NFT 소유자만 임대 계약을 생성할 수 있습니다
2. **조건 커밋먼트**: 모든 임대 조건이 암호화적으로 바인딩됩니다
3. **사용 권한**: 임차인이 시간 제한 사용 note를 받습니다
4. **담보 잠금**: 임차인의 담보가 임대 기간 동안 잠깁니다
5. **만료 정확성**: 만료 블록이 시작과 기간에서 올바르게 계산됩니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **유틸리티 민주화** | 임대를 통해 접근 가능한 비싼 NFT |
| **수동 소득** | NFT 소유자가 판매하지 않고 수익 |
| **조건 프라이버시** | 임대 가격과 기간 숨김 |
| **담보 보안** | 임차인 채무 불이행에 대해 소유자 보호 |
| **자동 만료** | 임대 반환에 신뢰 불필요 |
| **유연한 조건** | 모든 기간과 가격 협상 가능 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **이중 임대** | Nullifier가 동일한 NFT의 동시 임대 방지 |
| **미반환** | 사용 note가 자동으로 만료됨; 조치 불필요 |
| **과소 담보** | 최소 담보 요구사항 강제 |
| **조건 조작** | 임대 시작 전에 조건 커밋됨 |
| **조기 종료** | 페널티 메커니즘 또는 조건 보험 고려 |
| **담보 변동성** | 스테이블코인 사용 또는 과담보 |

## 구현 과제

1. **임대 발견**
   - 임차인이 사용 가능한 NFT를 어떻게 찾는가?
   - 속성 힌트가 있는 숨겨진 목록
   - 협상을 위한 암호화된 통신

2. **사용 검증**
   - 서비스가 유효한 임대를 어떻게 검증하는가?
   - 임차인이 사용 note 소유권을 증명
   - 온체인 만료 확인

3. **반환 프로세스**
   - 만료 시 무엇이 발생하는가?
   - 사용 note가 무효가 됨; 담보 해제
   - 소유자 NFT note가 변경되지 않은 채 유지

4. **손상 평가**
   - 소비 가능하거나 손상 가능한 NFT의 경우
   - 담보에서 평가하고 청구하는 방법
   - 분쟁을 위한 중재자 시스템

## 파생 상품

1. **시간 제한 임대** - 블록 기반이 아닌 특정 시작 및 종료 시간이 있는 임대. 회로가 타임스탬프 범위를 검증합니다. 이벤트 기반 액세스 (콘서트, 컨퍼런스)에 유용합니다.

2. **수익 공유** - 여러 소유자 간의 임대 소득 분할. 회로가 소유권 비율에 따라 지불을 배분합니다. 분할 NFT 임대를 가능하게 합니다.

3. **임대 연장** - 재담보 없이 활성 임대를 연장합니다. 회로가 추가 지불이 연장을 커버하는지 검증합니다. 공백 없는 지속적인 임대.

4. **전대** - 임차인이 제3자에게 전대할 수 있습니다. 원래 소유자는 여전히 담보로 보호됩니다. 임대 시장 내에 임대 시장을 생성합니다.

5. **임대 보험** - 제3자가 임대 채무 불이행에 대해 보험을 듭니다. 보험 풀이 임차인이 도망가는 경우 소유자를 커버합니다. 담보 요구사항을 줄입니다.

## 사용 사례

1. **게임 자산 임대**
   - 플레이어가 $10,000 가치의 전설적인 무기 소유
   - 새로운 플레이어에게 주당 $100에 임대
   - 임차인이 $500 담보 예치
   - 임대 기간 후 무기가 자동으로 반환
   - 양 당사자의 신원이 private로 유지

2. **메타버스 토지 임대**
   - 가상 토지 소유자가 이벤트를 위해 구획 임대
   - 이벤트 주최자가 임시 건축 권한 획득
   - 임대 조건 (가격, 기간)이 경쟁자로부터 숨겨짐
   - 이벤트 후 토지가 소유자에게 반환

3. **멤버십 NFT 액세스**
   - 독점 클럽 멤버십 NFT
   - 소유자가 특정 날짜에 대한 액세스 임대
   - 임차인이 임시 멤버십 혜택 획득
   - 멤버십의 영구 전송 없음

4. **장학금 프로그램**
   - 길드가 게임 NFT를 학자에게 임대
   - 학자가 빌린 자산으로 플레이-투-언
   - 임대 조건을 통한 수익 공유
   - 학자가 소유권을 향해 구축

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F9. NFT Rental Create - Products](../../product/f-nft-gaming/f9-rental-products.md)

---

[목차로 돌아가기](../../README.md)
