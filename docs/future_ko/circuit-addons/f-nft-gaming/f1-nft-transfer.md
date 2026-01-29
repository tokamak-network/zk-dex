# F1. Private NFT Transfer

온체인 출처 검증과 이중 지불 방지를 유지하면서 NFT 소유권을 비밀리에 전송합니다.

**제약 조건**: ~120K | **복잡도**: Low

---

## 배경

Private NFT 전송은 디지털 수집품의 근본적인 프라이버시 문제를 해결합니다:

- **수집가 익명성**: 공개 전송은 수집가의 신원을 노출하여 고가치 수집가를 소셜 엔지니어링과 도난의 표적으로 만듭니다
- **포트폴리오 은닉**: 가시적인 NFT 보유량은 부, 거래 전략, 수집 선호도를 드러냅니다
- **선행 실행 방지**: 가치 있는 NFT의 공지된 전송은 MEV 봇에 의해 선행 실행되어 시장 가격을 조작할 수 있습니다
- **노출 없는 출처**: 예술품과 수집품은 현재 소유권을 드러내지 않고 검증 가능한 이력이 필요합니다

전통적인 미술 시장에서 소유권은 신뢰할 수 있는 중개자를 통해 출처가 검증되는 경우가 많습니다. ZK NFT 전송은 무신뢰 검증을 유지하면서 이 프라이버시 모델을 블록체인에 가져옵니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `oldNftHash` | field | 현재 NFT note의 해시 커밋먼트 |
| `newNftHash` | field | 새로운 NFT note의 해시 커밋먼트 |
| `nftId` | uint | 컬렉션 내 NFT의 고유 식별자 |
| `collectionAddress` | address | NFT 컬렉션의 컨트랙트 주소 |
| `nullifier` | field | 이중 지불을 방지하는 nullifier |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `oldOwnerPkX, oldOwnerPkY` | field | 현재 소유자의 공개 키 (BabyJubJub) |
| `oldOwnerSk` | field | 소유권 증명을 위한 현재 소유자의 비밀 키 |
| `oldSalt` | field | 현재 NFT note의 랜덤성 |
| `newOwnerPkX, newOwnerPkY` | field | 새 소유자의 공개 키 |
| `newSalt` | field | 새 NFT note를 위한 새로운 랜덤성 |
| `metadata` | field | 선택적 암호화된 메타데이터 해시 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/nullifier.circom";

template PrivateNFTTransfer() {
    // ===== Public Inputs =====
    signal input oldNftHash;
    signal input newNftHash;
    signal input nftId;
    signal input collectionAddress;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input oldOwnerPkX, oldOwnerPkY, oldOwnerSk, oldSalt;
    signal input newOwnerPkX, newOwnerPkY, newSalt;
    signal input metadata;

    // ===== 1. Verify Old NFT Note =====
    // NFT note structure: Hash(pkX, pkY, nftId, collectionAddress, salt)
    component oldNft = Poseidon(5);
    oldNft.inputs[0] <== oldOwnerPkX;
    oldNft.inputs[1] <== oldOwnerPkY;
    oldNft.inputs[2] <== nftId;
    oldNft.inputs[3] <== collectionAddress;
    oldNft.inputs[4] <== oldSalt;
    oldNft.out === oldNftHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== oldOwnerSk;
    ownership.pkX <== oldOwnerPkX;
    ownership.pkY <== oldOwnerPkY;

    // ===== 3. Compute Nullifier =====
    // Nullifier = Hash(nftId, oldSalt, sk) - prevents double-spend
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== nftId;
    nullifierCalc.inputs[1] <== oldSalt;
    nullifierCalc.inputs[2] <== oldOwnerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Create New NFT Note =====
    component newNft = Poseidon(5);
    newNft.inputs[0] <== newOwnerPkX;
    newNft.inputs[1] <== newOwnerPkY;
    newNft.inputs[2] <== nftId;
    newNft.inputs[3] <== collectionAddress;
    newNft.inputs[4] <== newSalt;
    newNft.out === newNftHash;

    // ===== 5. Metadata Integrity (Optional) =====
    // Metadata can be zero for basic transfers
    signal metadataSquare;
    metadataSquare <== metadata * metadata;  // Dummy constraint for optional field
}

component main {public [oldNftHash, newNftHash, nftId, collectionAddress, nullifier]} =
    PrivateNFTTransfer();
```

### 주요 제약 조건

1. **소유권 검증**: 커밋된 공개 키에 해당하는 비밀 키의 보유자만 전송할 수 있습니다
2. **NFT 정체성 보존**: 동일한 nftId와 collectionAddress가 이전 note와 새 note 모두에 있어야 합니다
3. **Nullifier 고유성**: 각 NFT note는 고유한 nullifier를 통해 한 번만 사용될 수 있습니다
4. **Note 형식 준수**: 두 note 모두 표준 5요소 Poseidon 해시 구조를 따릅니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **소유권 프라이버시** | 수집가 신원이 공개 보기에서 숨겨짐 |
| **출처 검증** | nullifier 체인을 통해 전송 이력 검증 가능 |
| **이중 지불 방지** | Nullifier 메커니즘이 각 note가 한 번 사용되도록 보장 |
| **컬렉션 프라이버시** | 보유량이 온체인에 노출되지 않음 |
| **MEV 보호** | 커밋먼트까지 전송 세부 정보를 알 수 없음 |
| **가스 효율성** | 단일 증명 검증 (~200K gas) |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **키 손상** | 하드웨어 지갑 사용; NFT note에 대한 소셜 복구 구현 |
| **Nullifier 유출** | Nullifier가 비밀 입력에서 파생됨; sk 없이 예측 불가 |
| **컬렉션 간 재생** | note 해시에 collectionAddress 포함하여 교차 컬렉션 재생 방지 |
| **선행 실행 등록** | 초기 NFT note 생성에 commit-reveal 사용 |
| **Note Grinding** | Salt가 충분한 엔트로피 제공; 254비트 랜덤 salt 권장 |
| **Merkle Tree 상태** | 컨트랙트는 nullifier 집합과 note 커밋먼트 트리를 유지해야 함 |

## 구현 과제

1. **초기 Note 생성**
   - 표준 ERC-721을 private note로 어떻게 변환할 것인가?
   - NFT를 잠그고 note 커밋먼트를 발행하는 에스크로 컨트랙트 필요
   - 래핑 중 선행 실행을 방지하기 위해 commit-reveal 고려

2. **언래핑 메커니즘**
   - 사용자가 표준 ERC-721로 돌아가기를 원할 수 있음
   - 소유권을 증명하고 note를 무효화하는 출금 회로 필요
   - 언래핑 시 컬렉션 로열티 요구사항 처리해야 함

3. **마켓플레이스 통합**
   - 기존 NFT 마켓플레이스는 private 소유권을 검증할 수 없음
   - note 커밋먼트와 작동하는 새로운 마켓플레이스 컨트랙트 필요
   - 선택적 프라이버시를 가진 하이브리드 접근 방식 고려

4. **메타데이터 프라이버시**
   - NFT 메타데이터는 종종 공개 링크와 함께 IPFS에 저장됨
   - 뷰어 키를 사용한 암호화된 메타데이터 고려
   - 발견 가능성과 프라이버시 간의 균형

## 파생 상품

1. **배치 NFT 전송** - 단일 증명으로 여러 NFT를 전송하여 컬렉션 전송의 가스 비용을 절감합니다. 회로는 N개의 NFT 소유권을 증명하고 잠재적으로 다른 수신자와 함께 N개의 새 note를 생성합니다. 대량 판매 또는 포트폴리오 재조정에 유용합니다.

2. **NFT 번들** - 함께만 전송할 수 있는 여러 NFT의 원자적 번들을 생성합니다. 번들 해시가 NFT ID 집합에 커밋됩니다; 번들 해제는 번들 소유권 증명이 필요합니다. 큐레이션된 컬렉션 판매를 가능하게 합니다.

3. **Private 컬렉션** - 개별 보유량을 드러내지 않고 단일 키가 소유한 NFT의 private 매핑을 유지합니다. 특정 NFT ID를 노출하지 않고 컬렉션의 멤버십을 증명합니다. 고가치 수집가에게 유용합니다.

4. **속성이 있는 NFT 래핑** - 추가 private 속성(예: 구매 가격, 출처 메모)으로 NFT를 래핑합니다. 속성은 NFT와 함께 이동하지만 숨겨진 채로 유지됩니다. private 감정 정보를 가능하게 합니다.

5. **교차 체인 NFT 브리지** - 릴레이 증명을 사용하여 체인 간에 private NFT note를 전송합니다. 대상 체인의 회로가 소스 체인의 소각 증명을 검증합니다. 체인 경계를 넘어 프라이버시를 유지합니다.

## 사용 사례

1. **고가치 예술품 수집가**
   - 수집가가 $500K에 희귀 디지털 예술품을 획득
   - private note로 전송하여 구매와 소유권 숨김
   - 공개 노출 없이 갤러리에 소유권 증명 가능
   - 다른 수집가에게 비공개로 판매; 시장은 거래 가격을 결코 보지 못함

2. **게임 길드 자산 관리**
   - 길드가 회원들에게 수천 개의 게임 NFT 보유
   - Private 전송으로 길드 전략을 드러내지 않고 내부 재분배 가능
   - 경쟁자는 어떤 길드가 어떤 자산을 보유하는지 추적할 수 없음
   - 전략적으로 유익할 때만 공개 시장으로 나감

3. **유명인 NFT 소유권**
   - 공인이 언론의 관심 없이 NFT를 수집하고 싶어함
   - private 전송을 사용하여 컬렉션 축적
   - 보증을 위해 선택적으로 소유권 공개 가능
   - 팬이 유명인 지갑을 추적하는 것으로 인한 가격 조작 방지

4. **유산 계획**
   - 수집가가 디지털 예술품에 대한 승계 계획 준비
   - 상속인의 주소로 공개적으로 숨겨진 전송
   - 상속인은 필요할 때 소유권 증명 가능
   - 공개적으로 보이는 자산으로 인한 검인 합병증 방지

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F1. Private NFT Transfer - Products](../../product/f-nft-gaming/f1-nft-transfer-products.md)

---

[목차로 돌아가기](../../README.md)
