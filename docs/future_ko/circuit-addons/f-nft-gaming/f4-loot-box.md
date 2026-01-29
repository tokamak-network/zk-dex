# F4. Loot Box Open

증명 가능하게 공정한 결과 생성과 공개될 때까지 숨겨진 내용을 가진 검증 가능한 무작위 전리품 상자 개봉.

**제약 조건**: ~180K | **복잡도**: Medium-High

---

## 배경

전리품 상자는 무작위성과 공정성에 대한 신뢰가 필요합니다:

- **검증 가능한 무작위성**: 플레이어는 결과가 조작되지 않았다는 것을 신뢰해야 합니다; VRF는 암호화 보증을 제공합니다
- **예측 가능성 방지**: 결과를 예측할 수 있다면 플레이어가 시스템을 조작하거나 신뢰를 잃을 수 있습니다
- **숨겨진 내용**: 내용은 개봉 시에만 공개되어야 합니다; "좋은" 상자의 선택을 방지합니다
- **드롭률 투명성**: 플레이어는 결과가 예측 불가능하게 유지되는 동안 실제 확률을 알 자격이 있습니다

게임 규제 기관은 무작위 보상에서 증명 가능한 공정성을 점점 더 요구하고 있습니다. ZK 전리품 상자는 결과가 개봉될 때까지 무작위 시드나 결과를 드러내지 않고 커밋된 확률과 일치한다는 암호화 증명을 제공합니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `boxCommitment` | field | 봉인된 전리품 상자에 대한 커밋먼트 |
| `outcomeCommitment` | field | 공개된 아이템에 대한 커밋먼트 |
| `vrfOutput` | field | 무작위성을 증명하는 VRF 출력 |
| `vrfProof` | field | 검증을 위한 VRF 증명 |
| `boxId` | uint | 전리품 상자의 고유 식별자 |
| `nullifier` | field | 이중 개봉 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | 상자 소유자의 공개 키 |
| `ownerSk` | field | 소유자의 비밀 키 |
| `boxSalt` | field | 상자 커밋먼트의 랜덤성 |
| `boxType` | uint | 전리품 상자의 유형/티어 |
| `vrfSeed` | field | VRF에 사용된 시드 |
| `itemId` | uint | 개봉으로 인한 결과 아이템 |
| `itemRarity` | uint | 결과의 희귀도 티어 |
| `itemSalt` | field | 아이템 note를 위한 랜덤성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/vrf/vrf_verify.circom";
include "../utils/comparators.circom";

template LootBoxOpen(NUM_TIERS) {
    // ===== Public Inputs =====
    signal input boxCommitment;
    signal input outcomeCommitment;
    signal input vrfOutput;
    signal input vrfProof;
    signal input boxId;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, ownerSk;
    signal input boxSalt;
    signal input boxType;
    signal input vrfSeed;
    signal input itemId;
    signal input itemRarity;
    signal input itemSalt;

    // Drop rate thresholds for each tier (cumulative, out of 10000)
    // Example: [100, 500, 2000, 10000] = 1% legendary, 4% epic, 15% rare, 80% common
    signal input rarityThresholds[NUM_TIERS];

    // ===== 1. Verify Box Commitment =====
    component boxHash = Poseidon(5);
    boxHash.inputs[0] <== ownerPkX;
    boxHash.inputs[1] <== ownerPkY;
    boxHash.inputs[2] <== boxId;
    boxHash.inputs[3] <== boxType;
    boxHash.inputs[4] <== boxSalt;
    boxHash.out === boxCommitment;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== ownerSk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== 3. Compute Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== boxId;
    nullifierCalc.inputs[1] <== boxSalt;
    nullifierCalc.inputs[2] <== ownerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Verify VRF =====
    component vrf = VRFVerify();
    vrf.pk[0] <== ownerPkX;
    vrf.pk[1] <== ownerPkY;
    vrf.seed <== vrfSeed;
    vrf.output <== vrfOutput;
    vrf.proof <== vrfProof;

    // VRF seed must include box-specific data to prevent reuse
    component seedHash = Poseidon(3);
    seedHash.inputs[0] <== boxId;
    seedHash.inputs[1] <== boxSalt;
    seedHash.inputs[2] <== ownerSk;
    seedHash.out === vrfSeed;

    // ===== 5. Determine Rarity from VRF Output =====
    // Convert VRF output to range [0, 10000)
    signal vrfMod;
    vrfMod <-- vrfOutput % 10000;

    // Range check
    component rangeCheck = LessThan(64);
    rangeCheck.in[0] <== vrfMod;
    rangeCheck.in[1] <== 10000;
    rangeCheck.out === 1;

    // Verify division
    signal quotient;
    quotient <-- vrfOutput \ 10000;
    vrfOutput === quotient * 10000 + vrfMod;

    // Determine rarity tier
    component tierCheck[NUM_TIERS];
    signal inTier[NUM_TIERS];

    for (var i = 0; i < NUM_TIERS; i++) {
        tierCheck[i] = LessThan(64);
        tierCheck[i].in[0] <== vrfMod;
        tierCheck[i].in[1] <== rarityThresholds[i];

        if (i == 0) {
            inTier[i] <== tierCheck[i].out;
        } else {
            // In this tier if less than threshold[i] but not less than threshold[i-1]
            component prevCheck = GreaterEqThan(64);
            prevCheck.in[0] <== vrfMod;
            prevCheck.in[1] <== rarityThresholds[i-1];
            inTier[i] <== tierCheck[i].out * prevCheck.out;
        }
    }

    // Verify claimed rarity matches VRF result
    signal rarityMatch;
    rarityMatch <== inTier[itemRarity];
    rarityMatch === 1;

    // ===== 6. Create Outcome Note =====
    component outcomeNote = Poseidon(5);
    outcomeNote.inputs[0] <== ownerPkX;
    outcomeNote.inputs[1] <== ownerPkY;
    outcomeNote.inputs[2] <== itemId;
    outcomeNote.inputs[3] <== itemRarity;
    outcomeNote.inputs[4] <== itemSalt;
    outcomeNote.out === outcomeCommitment;
}

component main {public [boxCommitment, outcomeCommitment, vrfOutput, vrfProof, boxId, nullifier]} =
    LootBoxOpen(4);  // 4 rarity tiers: common, rare, epic, legendary
```

### 주요 제약 조건

1. **상자 소유권**: 상자 소유자만 개봉할 수 있습니다
2. **VRF 유효성**: 무작위 결과가 시드에서 검증 가능하게 생성되어야 합니다
3. **시드 고유성**: VRF 시드가 상자별 데이터에서 파생됩니다; 시드를 재사용할 수 없습니다
4. **희귀도 준수**: 결과 희귀도가 드롭률 임계값에 대한 VRF 출력과 일치합니다
5. **단일 개봉**: Nullifier가 상자를 한 번만 열 수 있도록 보장합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **증명 가능한 공정성** | 조작되지 않은 무작위성의 암호화 증명 |
| **드롭률 보장** | 플레이어가 주장된 확률을 검증 가능 |
| **결과 프라이버시** | 플레이어가 공개하기로 선택할 때까지 내용 숨김 |
| **안티 조작** | 개발자가 개별 결과를 선택적으로 조정할 수 없음 |
| **규제 준수** | 감사 가능한 무작위성이 게임 규정 충족 |
| **플레이어 신뢰** | 투명한 메커니즘이 신뢰 구축 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **VRF 시드 조작** | 시드가 커밋된 값에서 파생됨; 변경 불가 |
| **결과 미리보기** | VRF 출력이 비밀 키 없이 계산 불가 |
| **선택적 개봉** | Nullifier가 여러 결과 시도 방지 |
| **드롭률 사기** | 임계값이 상자 유형별로 공개적으로 커밋 가능 |
| **재생 공격** | 상자 ID와 salt가 각 개봉을 고유하게 만듦 |
| **선행 실행** | 개봉 증명이 결과가 보이기 전에 커밋됨 |

## 구현 과제

1. **VRF 구현**
   - 효율적인 VRF 회로 필요 (ECVRF 또는 유사)
   - VRF 검증이 상당한 제약 조건 추가
   - 특정 곡선에 대한 최적화된 구현 고려

2. **드롭률 커밋먼트**
   - 드롭률이 어떻게 커밋되고 검증되는가?
   - 온체인에 게시된 상자 유형별 커밋먼트
   - 업데이트는 투명성과 통지 기간 필요

3. **아이템 생성**
   - VRF가 희귀도를 결정합니다; 특정 아이템은 어떻게 선택되는가?
   - 희귀도 티어 내의 보조 무작위성
   - 희귀도당 아이템 풀이 정의되어야 함

4. **상자 획득**
   - 상자가 처음에 어떻게 배분되는가?
   - 구매, 획득 또는 에어드롭 메커니즘
   - 무료 상자에 대한 안티 시빌 조치

## 파생 상품

1. **계층화된 희귀도 시스템** - 하위 범주가 있는 복잡한 다단계 드롭 테이블. 회로가 중첩된 확률 분포를 지원합니다 (예: 5% 에픽에 호일 변형의 20% 확률). 풍부한 아이템 계층화를 가능하게 합니다.

2. **피티 타이머** - N번 개봉 후 희귀 아이템 없이 희귀 아이템 보장. 회로가 커밋먼트 체인을 통해 개봉 이력 추적. 무작위성을 유지하면서 장기간의 불운 방지.

3. **배치 개봉** - 결합된 VRF로 단일 증명으로 여러 상자 개봉. 많은 상자를 가진 플레이어에게 더 가스 효율적. 결과를 여러 아이템 note로 집계.

4. **거래 가능한 봉인된 상자** - 개봉 전에 상자 소유권 전송. 상자 note가 거래 가능; 새 소유자가 개봉 증명 제공. 상자 투기와 선물을 가능하게 합니다.

5. **드롭률 검증** - 실제 대 주장된 드롭률의 공개 감사. 회로가 통계 분석을 위해 집계 가능한 증명 생성. 커뮤니티가 개발자 정직성 검증 가능.

## 사용 사례

1. **블록체인 게임 보상**
   - 플레이어가 퀘스트를 완료하고 봉인된 전리품 상자 수령
   - 자신의 키를 사용하여 상자 개봉; VRF가 내용 결정
   - 게임 서버에 아이템이 공정하게 생성되었음을 증명
   - 2차 시장에서 봉인된 상자 거래 가능

2. **NFT 미스터리 컬렉션**
   - 아티스트가 10,000개의 미스터리 상자 출시
   - 각각 100개의 가능한 작품 중 하나 포함
   - 구매자가 개봉하여 공개하거나 봉인된 채로 거래 가능
   - 아티스트가 희귀도 전체에 공정한 배분 증명

3. **E스포츠 상금 상자**
   - 토너먼트 우승자가 상금 상자 수령
   - 내용이 상품부터 현금 상금까지 다양함
   - 증명 가능하게 공정한 배분이 편애 혐의 방지
   - 스폰서가 상금 할당 무결성 검증 가능

4. **규제 준수 가챠**
   - 모바일 게임이 ZK 전리품 상자로 가챠 구현
   - 규제 기관이 드롭률이 주장과 일치하는지 감사 가능
   - 플레이어가 공정성의 암호화 증명 보유
   - 회사가 알고리즘을 드러내지 않고 규정 준수 입증

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F4. Loot Box Open - Products](../../product/f-nft-gaming/f4-loot-box-products.md)

---

[목차로 돌아가기](../../README.md)
