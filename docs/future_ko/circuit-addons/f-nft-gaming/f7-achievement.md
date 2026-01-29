# F7. Achievement Prove

완전한 플레이어 이력이나 특정 업적 세부사항을 공개하지 않고 게임 성과를 검증하고 보상을 잠금 해제합니다.

**제약 조건**: ~130K | **복잡도**: Low-Medium

---

## 배경

게임 업적은 자랑 권리를 넘어 가치 있는 응용 프로그램을 가지고 있습니다:

- **선택적 공개**: 플레이어가 모든 통계나 이력을 공개하지 않고 성취를 증명하기를 원합니다
- **교차 플랫폼 인정**: 업적은 게임과 플랫폼 전체에서 이식 가능해야 합니다
- **보상 자격**: 정확한 성능을 노출하지 않고 보상 자격을 증명합니다
- **경쟁에서의 프라이버시**: 최소 능력을 증명하면서 스킬 수준을 숨깁니다

전통적인 업적 시스템은 전체 플레이어 프로필을 노출합니다. ZK 업적 증명은 플레이어가 언제, 어떻게 또는 다른 무엇을 성취했는지 공개하지 않고 무언가를 획득했음을 증명할 수 있게 합니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `achievementClaim` | field | 증명되는 업적에 대한 커밋먼트 |
| `gameId` | uint | 업적이 획득된 게임 |
| `rewardEligibility` | field | 특정 보상에 대한 자격을 증명하는 해시 |
| `minimumThreshold` | uint | 공개 최소 요구사항 (해당하는 경우) |
| `nullifier` | field | 중복 청구 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `playerPkX, playerPkY` | field | 플레이어의 공개 키 |
| `playerSk` | field | 플레이어의 비밀 키 |
| `achievementId` | uint | 특정 업적 식별자 |
| `achievementValue` | uint | 숫자 값 (점수, 레벨 등) |
| `achievementTimestamp` | uint | 업적이 획득된 시간 |
| `achievementProof` | field | 플레이어 이력에서 업적의 Merkle 증명 |
| `historyRoot` | field | 플레이어 업적 Merkle 트리의 루트 |
| `claimSalt` | field | 청구 커밋먼트를 위한 랜덤성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template AchievementProve(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input achievementClaim;
    signal input gameId;
    signal input rewardEligibility;
    signal input minimumThreshold;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input playerPkX, playerPkY, playerSk;
    signal input achievementId, achievementValue, achievementTimestamp;
    signal input achievementPathElements[TREE_DEPTH];
    signal input achievementPathIndices[TREE_DEPTH];
    signal input historyRoot;
    signal input claimSalt;

    // ===== 1. Verify Player Identity =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== playerSk;
    ownership.pkX <== playerPkX;
    ownership.pkY <== playerPkY;

    // ===== 2. Compute Achievement Leaf =====
    // Achievement = Hash(achievementId, value, timestamp, gameId)
    component achievementLeaf = Poseidon(4);
    achievementLeaf.inputs[0] <== achievementId;
    achievementLeaf.inputs[1] <== achievementValue;
    achievementLeaf.inputs[2] <== achievementTimestamp;
    achievementLeaf.inputs[3] <== gameId;

    // ===== 3. Verify Achievement in Player History =====
    component merkleVerify = MerkleTreeChecker(TREE_DEPTH);
    merkleVerify.leaf <== achievementLeaf.out;
    merkleVerify.root <== historyRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkleVerify.pathElements[i] <== achievementPathElements[i];
        merkleVerify.pathIndices[i] <== achievementPathIndices[i];
    }

    // ===== 4. Verify History Belongs to Player =====
    // Player history root = Hash(playerPkX, playerPkY, historyRoot)
    component playerHistory = Poseidon(3);
    playerHistory.inputs[0] <== playerPkX;
    playerHistory.inputs[1] <== playerPkY;
    playerHistory.inputs[2] <== historyRoot;

    // ===== 5. Verify Threshold Met =====
    component thresholdCheck = GreaterEqThan(64);
    thresholdCheck.in[0] <== achievementValue;
    thresholdCheck.in[1] <== minimumThreshold;
    thresholdCheck.out === 1;

    // ===== 6. Generate Achievement Claim =====
    component claim = Poseidon(4);
    claim.inputs[0] <== playerPkX;
    claim.inputs[1] <== playerPkY;
    claim.inputs[2] <== achievementId;
    claim.inputs[3] <== claimSalt;
    claim.out === achievementClaim;

    // ===== 7. Compute Nullifier =====
    // Prevents claiming same achievement multiple times
    component nullifierCalc = Poseidon(4);
    nullifierCalc.inputs[0] <== achievementId;
    nullifierCalc.inputs[1] <== gameId;
    nullifierCalc.inputs[2] <== playerSk;
    nullifierCalc.inputs[3] <== claimSalt;
    nullifierCalc.out === nullifier;

    // ===== 8. Generate Reward Eligibility Proof =====
    component eligibility = Poseidon(3);
    eligibility.inputs[0] <== achievementClaim;
    eligibility.inputs[1] <== minimumThreshold;
    eligibility.inputs[2] <== playerSk;
    eligibility.out === rewardEligibility;
}

component main {public [achievementClaim, gameId, rewardEligibility, minimumThreshold, nullifier]} =
    AchievementProve(20);  // Support history trees up to 2^20 achievements
```

### 주요 제약 조건

1. **플레이어 소유권**: 실제 플레이어만 자신의 업적을 증명할 수 있습니다
2. **업적 진위성**: 업적이 플레이어의 검증된 이력 트리에 존재합니다
3. **임계값 준수**: 업적 값이 필요한 최소치를 충족하거나 초과합니다
4. **단일 청구**: Nullifier가 중복 보상 청구를 방지합니다
5. **프라이버시**: 정확한 업적 값과 다른 이력이 공개되지 않습니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **선택적 공개** | 프로필을 노출하지 않고 특정 업적 증명 |
| **교차 플랫폼 이식성** | 다른 시스템에서 사용 가능한 업적 |
| **프라이버시 보존** | 전체 이력이 숨겨진 채 유지 |
| **시빌 저항** | 검증된 플레이어 신원에 연결 |
| **유연한 요구사항** | 정확한 값이 아닌 범위 증명 지원 |
| **보상 보안** | 진정한 업적 없이 청구 불가 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **가짜 업적** | 게임 권한에 의해 서명된 Merkle 트리 루트 |
| **이력 조작** | 불변 트리; 추가만 허용 |
| **업적 재생** | Nullifier가 동일한 증명 재사용 방지 |
| **루트 스푸핑** | 루트가 온체인 커밋먼트와 일치해야 함 |
| **타이밍 공격** | 블록체인 시간에 대해 검증된 타임스탬프 |
| **교차 게임 사기** | gameId가 업적과 nullifier에 포함됨 |

## 구현 과제

1. **업적 기록**
   - 업적이 트리에 어떻게 기록되는가?
   - 게임 서버 또는 oracle이 업적을 커밋
   - 신뢰할 수 있는 초기 기록 메커니즘 필요

2. **이력 트리 관리**
   - 플레이어당 업적의 증가하는 트리
   - 업데이트가 효율적이고 검증 가능해야 함
   - 추가 전용 Merkle 트리 구조 고려

3. **교차 게임 표준**
   - 업적 형식이 게임마다 다릅니다
   - 표준 업적 스키마 필요
   - 게임별 업적을 위한 번역 계층

4. **Oracle 통합**
   - 누가 업적 유효성을 증명하는가?
   - 게임 개발자가 업적 배치에 서명
   - 검증을 위한 분산 oracle 네트워크

## 파생 상품

1. **누적 업적 증명** - 여러 업적 전체의 합계를 증명합니다 (예: "모든 게임에서 10,000명의 적 처치"). 회로가 여러 Merkle 증명의 값을 집계합니다. 게임 전반에 걸친 메타 업적을 가능하게 합니다.

2. **시간 기반 업적** - 특정 시간 전후에 획득한 업적을 증명합니다. 회로가 타임스탬프를 목표와 비교합니다. "얼리 어답터" 또는 "스피드런" 보상에 유용합니다.

3. **비교 업적** - 임계값 백분위수보다 나은 업적을 증명합니다. 회로가 분포 커밋먼트에 대해 검증합니다. 정확한 순위를 공개하지 않고 "상위 10%"를 보여줍니다.

4. **교차 게임 업적** - 여러 게임의 업적을 동시에 증명합니다. 단일 증명이 여러 게임 이력을 커버합니다. 생태계 전반의 평판을 가능하게 합니다.

5. **업적 NFT** - 플레이어를 공개하지 않고 업적을 증명하는 NFT를 민팅합니다. NFT에 증명이 포함됩니다; 표시하거나 거래할 수 있습니다. 양도 불가능 또는 영혼 바인딩 옵션 사용 가능.

## 사용 사례

1. **독점 게임 액세스**
   - 새 게임이 이전 타이틀의 스킬 증명을 요구
   - 플레이어가 정확한 순위나 플레이 시간을 공개하지 않고 "다이아몬드 순위" 증명
   - 전체 게임 이력을 노출하지 않고 조기 액세스 부여
   - 여러 자격 경로가 익명으로 지원됨

2. **보상 에어드롭**
   - 게임 스튜디오가 특정 업적을 가진 플레이어에게 토큰 에어드롭
   - 플레이어가 신원을 공개하지 않고 업적을 증명하여 청구
   - 자격을 갖춘 지갑의 공개 목록 없음
   - 업적 기반 nullifier를 통한 시빌 저항

3. **교차 플랫폼 평판**
   - E스포츠 팀을 위한 구직 신청
   - 여러 게임에서 경쟁 업적 증명
   - 부끄러운 패배나 소요 시간 숨김
   - 상한선 공개 없는 검증 가능한 스킬 하한선

4. **커뮤니티 거버넌스**
   - 게임 기여에 기반한 DAO 투표 가중치
   - 가입 날짜를 공개하지 않고 베테랑 상태 증명
   - 업적 티어에 기반한 가중 투표
   - 혜택을 부여하면서 얼리 어답터 프라이버시 보호

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F7. Achievement Prove - Products](../../product/f-nft-gaming/f7-achievement-products.md)

---

[목차로 돌아가기](../../README.md)
