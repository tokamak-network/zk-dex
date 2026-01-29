# D2. Quadratic Voting

투표는 2차적으로 증가하는 크레딧을 소비하며, 이는 선호 강도 표현을 가능하게 하면서 플루토크라시 영향력을 제한합니다.

**제약 조건**: ~140K | **복잡도**: Low

---

## 배경

Quadratic voting은 근본적인 거버넌스 문제를 해결합니다:

- **선호 강도**: 1토큰 1투표는 약한 선호와 강한 신념을 구별할 수 없습니다
- **플루토크라시 방지**: 선형 투표는 고래에게 집단적 결정에 대한 불균형적인 권력을 부여합니다
- **소수 보호**: 강렬한 선호를 가진 소규모 그룹은 무관심한 다수에 맞서 목소리를 낼 자격이 있습니다
- **경제적 효율성**: QV는 집단적 의사 결정 영향력의 최적 할당에 근사합니다

전통적인 투표는 강도에 관계없이 모든 선호를 동등하게 취급합니다. Quadratic voting(비용 = 투표^2)은 집중된 권력에 대한 수익 체감을 보장하면서 확신 강도를 표현할 수 있게 합니다. 이 메커니즘은 메커니즘 디자인 문헌에서 강력한 이론적 뒷받침을 받습니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `voteCommitment` | field | 선택, 투표 및 소비된 크레딧에 대한 커밋먼트 |
| `proposalId` | uint | 투표 중인 제안의 식별자 |
| `creditsSpent` | uint | 소비된 음성 크레딧 (회계를 위해 공개됨) |
| `creditRoot` | field | 크레딧 할당의 Merkle root |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | 투표자의 public key |
| `sk` | field | 소유권을 증명하는 secret key |
| `totalCredits` | uint | 투표자의 사용 가능한 크레딧 잔액 |
| `numVotes` | uint | 투표할 투표 수 (비용 = numVotes^2) |
| `choice` | uint | 투표 방향 (0 = 반대, 1 = 찬성) |
| `voteSalt` | field | 투표 커밋먼트의 무작위성 |
| `creditNoteHash` | field | 크레딧 할당 note의 해시 |
| `creditSalt` | field | 크레딧 note 무작위성 |
| `merklePath[20]` | field[] | 크레딧 할당의 Merkle 증명 |
| `merkleIndex` | uint | 크레딧 tree 내 위치 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template QuadraticVoting(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input voteCommitment;
    signal input proposalId;
    signal input creditsSpent;
    signal input creditRoot;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input totalCredits;
    signal input numVotes;
    signal input choice;
    signal input voteSalt;
    signal input creditNoteHash;
    signal input creditSalt;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Credit Allocation Note =====
    component creditNote = Poseidon(4);
    creditNote.inputs[0] <== pkX;
    creditNote.inputs[1] <== pkY;
    creditNote.inputs[2] <== totalCredits;
    creditNote.inputs[3] <== creditSalt;
    creditNote.out === creditNoteHash;

    // ===== 2. Verify Credit Inclusion in Tree =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== creditNoteHash;
    merkle.root <== creditRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 4. Quadratic Cost Calculation =====
    signal voteCost;
    voteCost <== numVotes * numVotes;

    // ===== 5. Verify Sufficient Credits =====
    component costCheck = LessEqThan(64);
    costCheck.in[0] <== voteCost;
    costCheck.in[1] <== totalCredits;
    costCheck.out === 1;

    // ===== 6. Credits Spent Matches Cost =====
    creditsSpent === voteCost;

    // ===== 7. Validate Choice (0 or 1) =====
    choice * (1 - choice) === 0;

    // ===== 8. Validate numVotes is Positive =====
    component votesPositive = GreaterThan(64);
    votesPositive.in[0] <== numVotes;
    votesPositive.in[1] <== 0;
    votesPositive.out === 1;

    // ===== 9. Create Vote Commitment =====
    component commit = Poseidon(5);
    commit.inputs[0] <== choice;
    commit.inputs[1] <== numVotes;
    commit.inputs[2] <== creditsSpent;
    commit.inputs[3] <== proposalId;
    commit.inputs[4] <== voteSalt;
    commit.out === voteCommitment;
}

component main {public [voteCommitment, proposalId, creditsSpent, creditRoot]} =
    QuadraticVoting(20);
```

### 주요 제약 조건

1. **크레딧 소유권**: 투표자는 merkle 포함을 통해 증명된 음성 크레딧을 소유해야 합니다
2. **2차 비용**: 투표 비용은 numVotes의 제곱과 정확히 같습니다
3. **충분한 잔액**: 소비된 크레딧은 사용 가능한 크레딧을 초과할 수 없습니다
4. **이진 선택**: 선택은 0(반대) 또는 1(찬성)이어야 합니다
5. **양수 투표**: 최소한 하나의 투표를 해야 합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **선호 강도** | 투표자는 크레딧 할당을 통해 확신 강도를 신호할 수 있음 |
| **플루토크라시 방지** | 수익 체감은 고래의 결과 지배를 방지함 |
| **소수 목소리** | 강렬한 소수는 주요 이슈에서 무관심한 다수를 압도할 수 있음 |
| **전략적 깊이** | 투표자는 여러 제안에 걸쳐 크레딧을 예산화해야 함 |
| **경제적 효율성** | 메커니즘 디자인에서 최적의 집단적 의사 결정에 접근함 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **크레딧 파밍** | 크레딧은 신원/회원 기간에 연결되며 양도 불가능한 토큰이 아님 |
| **Sybil 공격** | 크레딧 할당을 위한 신원 확인 또는 최소 스테이크 필요 |
| **크레딧 오버플로우** | 64비트 산술 사용; 기간당 최대 크레딧 제한 |
| **투표 분할** | 제안당 신원당 nullifier가 계정 간 분할을 방지함 |
| **담합 링** | 프라이빗 투표는 특정 투표 수에 대한 조정을 방지함 |
| **크레딧 조작** | 크레딧은 스냅샷에서 할당됨; 투표 중에 수정 불가 |

## 구현 과제

1. **크레딧 배분**
   - 음성 크레딧은 처음에 어떻게 할당되는가? (동등, 스테이크 가중, 평판 기반)
   - 진행 중인 거버넌스를 위한 크레딧 갱신 비율
   - 제안 간 크레딧 예산화 복잡성

2. **신원 요구사항**
   - 순수 QV는 Sybil 저항이 필요함
   - 옵션: proof-of-humanity, 소셜 보증, 스테이크 기반 신원
   - 프라이버시 vs. Sybil 저항 트레이드오프

3. **UX 복잡성**
   - 사용자는 2차 비용 구조를 이해해야 함
   - 추가 투표의 비용/혜택을 보여주는 명확한 UI 필요
   - 활성 제안에 걸친 크레딧 예산 추적

4. **크레딧 회계**
   - 소비된 크레딧 vs. 남은 크레딧 추적
   - 제안 취소 처리 (크레딧 환불)
   - 크레딧 이중 지출 방지

## 파생 변형

1. **Private Quadratic Voting** - 커밋-리빌 스킴으로 QV를 확장하여 리빌 단계까지 선택과 투표 수를 모두 숨깁니다. 다른 사람의 확신 수준을 관찰하여 이루어지는 전략적 조정을 방지합니다.

2. **Budget-Capped QV** - 각 투표자는 투표 기간당 고정된 크레딧 예산을 받습니다(예: 월 100 크레딧). 제안 간 우선순위를 강제합니다. 사용하지 않은 크레딧은 이월되거나 만료될 수 있습니다.

3. **QV for Fund Allocation** - QV를 사용하여 경쟁 제안에 걸쳐 재무 자금을 할당합니다. 투표 수가 비례적 자금 조달을 결정합니다. Gitcoin grants와 유사한 효율적인 공공재 자금 조달을 가능하게 합니다.

4. **Cross-Proposal QV** - 크레딧은 동시 제안에 걸쳐 공유됩니다. 하나에 투표하면 다른 제안에 사용할 수 있는 크레딧이 줄어듭니다. 경쟁 이니셔티브 간 상대적 우선순위를 드러냅니다.

5. **Conviction-Weighted QV** - 거버넌스 참여 이력을 기반으로 초기 크레딧 할당이 이루어집니다. 활발한 커뮤니티 구성원은 더 많은 크레딧을 받습니다. 최근 토큰 구매보다 장기 참여를 보상합니다.

## 사용 사례

1. **프로토콜 업그레이드 우선순위**
   - DAO에는 5개의 제안된 업그레이드가 있고 2개에 대한 리소스가 있음
   - 구성원은 제안에 걸쳐 크레딧을 할당함
   - 보안 업그레이드에 대한 강한 선호를 가진 사람들은 투표를 집중할 수 있음
   - 결과는 지지의 폭과 깊이를 모두 반영함

2. **보조금 위원회 할당**
   - 분기별 보조금 예산 $500K
   - 20개의 프로젝트 신청서 제출됨
   - 위원회 구성원은 QV를 사용하여 프로젝트에 걸쳐 할당함
   - QV 투표 합계에 비례하여 자금 조달됨

3. **기능 요청 우선순위**
   - DeFi 프로토콜이 기능 요청을 수집함
   - 사용자는 TVL 기여도에 따라 크레딧을 받음
   - QV가 개발 로드맵 우선순위를 결정함
   - 파워 유저는 지배하지 않으면서 중요한 요구 사항을 신호할 수 있음

4. **논쟁의 여지가 있는 이진 결정**
   - 논란이 많은 변경에 대해 커뮤니티가 분열됨
   - QV는 약한 다수에 대한 반대의 강도를 드러냄
   - 열정적인 소규모 그룹은 자신들이 실존적으로 여기는 변화를 막을 수 있음
   - 진정한 커뮤니티 선호 분포를 더 잘 반영함

## 실제 제품 및 사용자 경험

참조: [Quadratic Voting Products & UX](../../product/d-governance/d2-quadratic-products.md)

---

[목차로 돌아가기](../../README.md)
