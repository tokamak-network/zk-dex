# D7. Snapshot Voting

특정 히스토리컬 블록의 토큰 잔액을 기반으로 투표하여 막판 투표 조작을 방지합니다.

**제약 조건**: ~200K | **복잡도**: Medium

---

## 배경

Snapshot voting은 공정한 투표권 계산을 보장합니다:

- **조작 방지**: 현재 잔액 기반 투표는 막판 토큰 구매로 결과를 좌우할 수 있게 합니다
- **플래시 론 저항**: 히스토리컬 스냅샷은 단일 블록 토큰 차입의 영향을 받지 않습니다
- **예측 가능한 투표권**: 투표자는 사전에 자신의 권력을 알고 있으며, 투표 기간 동안 게이밍이 없습니다
- **공정한 기준선**: 모든 투표자가 동일한 시점에 측정됩니다

현재 잔액 투표는 마감 직전에 토큰을 구매하고 투표한 후 판매하는 고래에 취약합니다. Snapshot voting은 제안 생성 시 투표권을 고정하여 이러한 조작 벡터를 제거하면서 공정하고 예측 가능한 거버넌스 프로세스를 제공합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `voteCommitment` | field | 투표 선택에 대한 커밋먼트 |
| `proposalId` | uint | 제안의 식별자 |
| `snapshotBlock` | uint | 잔액 스냅샷의 블록 번호 |
| `historicalRoot` | field | 스냅샷 블록의 note의 Merkle root |
| `voteNullifier` | field | 이중 투표를 방지하는 nullifier |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | 투표자의 public key |
| `sk` | field | 소유권을 증명하는 secret key |
| `noteHash` | field | 거버넌스 토큰 note의 해시 |
| `noteValue` | uint | 스냅샷 시점의 토큰 잔액 |
| `noteSalt` | field | Note 무작위성 |
| `choice` | uint | 투표 선택 (0 = 반대, 1 = 찬성) |
| `voteSalt` | field | 투표 커밋먼트 무작위성 |
| `merklePath[20]` | field[] | 히스토리컬 tree의 Merkle 증명 |
| `merkleIndex` | uint | 히스토리컬 tree 내 위치 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template SnapshotVoting(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input voteCommitment;
    signal input proposalId;
    signal input snapshotBlock;
    signal input historicalRoot;
    signal input voteNullifier;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input noteHash;
    signal input noteValue;
    signal input noteSalt;
    signal input choice;
    signal input voteSalt;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Governance Token Note =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== noteValue;
    note.tokenType <== 0;  // Governance token
    note.salt <== noteSalt;
    note.out === noteHash;

    // ===== 2. Verify Note in Historical Merkle Tree =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== historicalRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 4. Compute Vote Nullifier =====
    // Prevents double-voting: unique per (voter, proposal)
    component nullifier = Poseidon(3);
    nullifier.inputs[0] <== sk;
    nullifier.inputs[1] <== proposalId;
    nullifier.inputs[2] <== snapshotBlock;
    nullifier.out === voteNullifier;

    // ===== 5. Validate Choice =====
    choice * (1 - choice) === 0;

    // ===== 6. Validate Positive Balance =====
    component balancePositive = GreaterThan(64);
    balancePositive.in[0] <== noteValue;
    balancePositive.in[1] <== 0;
    balancePositive.out === 1;

    // ===== 7. Create Vote Commitment =====
    component commit = Poseidon(4);
    commit.inputs[0] <== choice;
    commit.inputs[1] <== noteValue;  // Voting power
    commit.inputs[2] <== proposalId;
    commit.inputs[3] <== voteSalt;
    commit.out === voteCommitment;
}

component main {public [voteCommitment, proposalId, snapshotBlock, historicalRoot, voteNullifier]} =
    SnapshotVoting(20);
```

### 주요 제약 조건

1. **Note 진위성**: Note 해시는 투표자 키, 값, salt로부터 계산됨
2. **히스토리컬 포함**: Note는 스냅샷 블록의 merkle tree에 존재해야 함
3. **소유권 검증**: Secret key가 note 소유권을 증명함
4. **이중 투표 방지**: 투표자와 제안당 고유한 nullifier
5. **유효한 선택**: 이진 투표 (0 또는 1)

## 효과

| 측면 | 영향 |
|--------|--------|
| **조작 저항** | 스냅샷 이후 투표를 구매할 수 없음 |
| **플래시 론 면역** | 단일 블록 차입은 영향이 없음 |
| **예측 가능한 권력** | 투표 시작 전에 투표권을 알 수 있음 |
| **공정한 측정** | 모든 투표자가 동일한 시간에 측정됨 |
| **히스토리컬 증명** | 과거 상태의 암호학적 검증 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **스냅샷 타이밍 공격** | 스냅샷 블록은 제안 생성 시 과거여야 함 |
| **히스토리컬 Root 위조** | Root는 스냅샷 블록에서 온체인에 커밋되어야 함 |
| **블록 Reorg** | 충분히 깊은 스냅샷 사용 (50+ 확인) |
| **다중 Note 투표** | 각 note는 별도의 nullifier를 가짐; 권력을 올바르게 집계함 |
| **오래된 투표권** | 긴 투표 기간에 대한 스냅샷 연령 제한 고려 |
| **Root 저장 비용** | 히스토리컬 root를 효율적으로 아카이브; 오래된 데이터 정리 |

## 구현 과제

1. **히스토리컬 상태 저장**
   - 모든 블록에 대한 merkle root 필요 (또는 주기적 스냅샷)
   - 긴 이력에 대한 저장 비용
   - 에포크 기반 스냅샷 고려 (N 블록마다)

2. **스냅샷 선택**
   - 스냅샷 블록은 언제 선택되는가? (제안 생성, 지연 기간)
   - 조작 저항과 투표자 편의성 간의 균형
   - 스냅샷에 영향을 미치는 블록 reorg 처리

3. **다중 Note 집계**
   - 여러 note를 가진 사용자는 여러 증명이 필요함
   - 소유한 모든 note에 걸쳐 투표권 집계
   - 가스 비용은 note 수에 따라 스케일됨

4. **크로스체인 스냅샷**
   - 토큰이 여러 체인에 존재할 수 있음
   - 모든 배포에 걸친 통합 스냅샷 필요
   - 브릿지 메시지 지연이 동기화를 복잡하게 만듦

## 파생 변형

1. **Rolling Snapshots** - 시간 기간 동안 여러 스냅샷, 투표권은 잔액의 평균입니다. 조작 시도를 완화합니다. 여러 히스토리컬 root 저장 및 증명 집계가 필요합니다.

2. **Time-Weighted Snapshots** - 스냅샷 시 보유 기간으로 가중된 잔액입니다. 최근 취득은 장기 보유 토큰보다 적게 계산됩니다. 전체 conviction voting 복잡성 없이 장기 보유자를 보상합니다.

3. **Multi-Block Average** - 스냅샷은 제안 전 N 블록에 걸친 평균 잔액입니다. 단일 블록 조작이 비효과적입니다. 더 많은 조작 저항이지만 증명 복잡성이 높습니다.

4. **Cross-Chain Snapshots** - 여러 체인의 토큰으로부터의 통합 투표권입니다. 각 체인의 merkle root가 집계됩니다. 분산된 토큰 공급에 걸친 거버넌스를 가능하게 합니다.

5. **Snapshot Dispute Resolution** - 잘못된 스냅샷에 대한 도전 메커니즘입니다. 도전자가 bond를 게시하고, 스냅샷이 잘못되면 보상을 받습니다. 스냅샷 무결성에 경제적 보안을 추가합니다.

## 사용 사례

1. **DAO 거버넌스 제안**
   - 제안이 블록 1,000,000에서 생성됨
   - 스냅샷이 블록 999,900에서 촬영됨 (100 블록 이전)
   - 투표가 7일 동안 열림
   - 블록 999,900 이후 토큰 구매는 투표에 영향이 없음
   - 최종 집계는 헌신적인 커뮤니티 구성원을 반영함

2. **토큰 마이그레이션 투표**
   - 커뮤니티가 토큰 업그레이드에 대해 투표함
   - 스냅샷은 기존 보유자만 투표하도록 보장함
   - 투표 기간 동안의 신규 구매자는 결과에 영향을 미칠 수 없음
   - 마이그레이션 결정은 기존 이해관계자에 의해 이루어짐

3. **비상 프로토콜 조치**
   - 보안 문제가 발견됨
   - 최근 스냅샷으로 신속한 제안
   - 비상 상황에 대해 더 짧은 지연이 허용됨
   - 플래시 론 공격으로부터는 여전히 보호됨
   - 보안을 희생하지 않고 빠른 대응

4. **에어드롭 적격성**
   - 거버넌스로 새 토큰 출시
   - 기존 프로토콜 사용자의 스냅샷
   - 히스토리컬 참여를 기반으로 한 투표권
   - 발표 후 적격성을 게임할 수 없음
   - 진정한 사용자에게 공정한 분배

## 실제 제품 및 사용자 경험

참조: [Snapshot Voting Products & UX](../../product/d-governance/d7-snapshot-products.md)

---

[목차로 돌아가기](../../README.md)
