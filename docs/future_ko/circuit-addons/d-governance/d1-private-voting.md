# D1. Private Voting

숨겨진 선택지로 커밋-리빌 투표를 진행하여, 검증 가능한 투표권을 유지하면서 매표와 강압을 방지합니다.

**제약 조건**: ~150K | **복잡도**: Low

---

## 배경

프라이빗 투표는 정당한 거버넌스에 필수적입니다:

- **강압 방지**: 공개 투표는 매표, 뇌물, 사회적 압박을 가능하게 하며, 비밀 투표는 투표자의 자율성을 보호합니다
- **솔직한 선호 표현**: 투표자는 선택이 관찰되거나 처벌받을 수 없을 때 진정한 선호를 드러냅니다
- **거버넌스 무결성**: 다른 사람의 선택을 관찰하여 이루어지는 막판 투표 조작을 방지합니다
- **민주주의 기준**: 비밀 투표는 전 세계 민주주의 선거에서 기본 원칙입니다

전통적인 거버넌스 시스템에서 비밀 투표는 표준 관행입니다. 온체인 거버넌스는 일반적으로 모든 투표를 공개적으로 노출하여 정교한 매표 계획을 가능하게 합니다. ZK 프라이빗 투표는 블록체인 시스템의 검증 가능성과 함께 물리적 투표함의 프라이버시 속성을 달성합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `voteCommitment` | field | 투표 선택과 salt에 대한 해시 커밋먼트 |
| `proposalId` | uint | 투표 중인 제안의 식별자 |
| `votingPower` | uint | 행사되는 투표권 (공개됨) |
| `merkleRoot` | field | 적격 투표자의 스냅샷 merkle root |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | 투표자의 public key |
| `sk` | field | 소유권을 증명하는 secret key |
| `noteHash` | field | 거버넌스 토큰 note의 해시 |
| `noteValue` | uint | 토큰 잔액 (votingPower와 동일해야 함) |
| `noteSalt` | field | Note 무작위성 |
| `choice` | uint | 투표 선택 (0 = 반대, 1 = 찬성, 2 = 기권) |
| `voteSalt` | field | 투표 커밋먼트의 무작위성 |
| `merklePath[20]` | field[] | Note 포함의 Merkle 증명 |
| `merkleIndex` | uint | Merkle tree 내 위치 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template PrivateVoting(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input voteCommitment;
    signal input proposalId;
    signal input votingPower;
    signal input merkleRoot;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input noteHash, noteValue, noteSalt;
    signal input choice, voteSalt;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Governance Token Note =====
    component note = PoseidonRegularNote();
    note.pkX <== pkX;
    note.pkY <== pkY;
    note.value <== noteValue;
    note.tokenType <== 0;  // Governance token type
    note.salt <== noteSalt;
    note.out === noteHash;

    // ===== 2. Verify Note Inclusion in Snapshot =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 4. Voting Power Equals Note Value =====
    votingPower === noteValue;

    // ===== 5. Validate Choice (0, 1, or 2) =====
    component choiceValid = LessThan(8);
    choiceValid.in[0] <== choice;
    choiceValid.in[1] <== 3;
    choiceValid.out === 1;

    // ===== 6. Create Vote Commitment =====
    // Commitment includes proposalId to prevent cross-proposal replay
    component commit = Poseidon(4);
    commit.inputs[0] <== choice;
    commit.inputs[1] <== votingPower;
    commit.inputs[2] <== proposalId;
    commit.inputs[3] <== voteSalt;
    commit.out === voteCommitment;
}

component main {public [voteCommitment, proposalId, votingPower, merkleRoot]} =
    PrivateVoting(20);
```

### 주요 제약 조건

1. **토큰 소유권**: 투표자는 note 해시와 merkle 포함을 통해 증명된 거버넌스 토큰을 소유해야 합니다
2. **스냅샷 유효성**: Note는 스냅샷 시점의 히스토리컬 merkle tree에 존재해야 합니다
3. **투표권 정확성**: 선언된 투표권은 note 값과 정확히 일치해야 합니다
4. **유효한 선택**: 투표 선택은 허용된 범위 내에 있어야 합니다 (0, 1, 또는 2)
5. **커밋먼트 바인딩**: 투표 커밋먼트는 선택을 투표자와 제안에 암호학적으로 바인딩합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **투표 프라이버시** | 리빌 단계까지 선택이 숨겨짐; 관찰자는 개별 투표를 결정할 수 없음 |
| **강압 방지** | 투표자는 잠재적 뇌물 제공자나 강압자에게 자신의 투표를 증명할 수 없음 |
| **거버넌스 무결성** | 다른 사람의 선택을 관찰하여 이루어지는 전략적 투표를 방지함 |
| **검증 가능한 참여** | 투표권은 선택을 드러내지 않고도 공개적으로 검증 가능함 |
| **이중 투표 방지** | Nullifier 시스템은 동일한 토큰으로 두 번 투표하는 것을 방지함 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **영수증을 통한 매표** | 커밋먼트 스킴은 투표자가 구매자에게 자신의 선택을 증명할 수 없도록 보장함 |
| **이중 투표** | Note + proposalId에서 파생된 nullifier가 재사용을 방지함 |
| **리빌 단계 조작** | 시간 제한된 리빌 단계; 공개되지 않은 투표는 기본값으로 처리될 수 있음 |
| **스냅샷 조작** | 먼 과거의 블록 해시 사용; merkle root는 온체인에 커밋됨 |
| **키 공개 강압** | 가짜 투표 또는 키 로테이션 메커니즘 지원 고려 |
| **리빌 프론트러닝** | 단일 트랜잭션에서 일괄 리빌 또는 리빌에도 커밋-리빌 적용 |

## 구현 과제

1. **리빌 조정**
   - 모든 투표자는 집계를 위해 시간 창 내에 공개해야 함
   - 공개되지 않은 투표는 최종 집계를 복잡하게 만듦
   - 적시 리빌을 위한 경제적 인센티브 고려 (리빌 시 예치금 반환)

2. **스냅샷 인프라**
   - 신뢰할 수 있는 히스토리컬 merkle tree 구성 필요
   - 온체인의 히스토리컬 root 저장
   - 많은 note를 가진 사용자를 위한 효율적인 증명 생성

3. **Nullifier 관리**
   - 제안당 투표자당 고유한 nullifier
   - Nullifier = hash(sk, proposalId)로 제안 간 연결 방지
   - Nullifier 레지스트리는 효율적으로 확인되어야 함

4. **투표 집계**
   - 리빌 단계에서 모든 투표를 수집하여 집계
   - 안전한 집계 메커니즘 필요
   - 온체인 vs. 오프체인 집계 트레이드오프 고려

## 파생 변형

1. **Shielded Vote Tallying** - 집계된 투표는 동형 커밋먼트 또는 MPC를 사용하여 개별 선택을 드러내지 않고 계산됩니다. 최종 집계는 모든 커밋먼트에 대한 ZK 증명을 통해 정확함이 증명됩니다. 투표가 끝난 후에도 프라이버시를 가능하게 합니다.

2. **Anti-Bribery Voting** - 투표자가 실제 영수증과 구별할 수 없는 가짜 영수증을 생성할 수 있는 확장된 스킴입니다. 잠재적 뇌물 제공자는 지불을 확인할 수 없어 뇌물 제공이 경제적으로 비합리적이 됩니다.

3. **Multi-Round Voting** - 초기 라운드의 결과가 이후 선택에 정보를 제공하는 순차적 투표 라운드입니다. 각 라운드는 새로운 커밋먼트를 사용합니다. 결선 투표 또는 반복적 합의 구축에 유용합니다.

4. **Emergency Voting** - 시간에 민감한 제안을 위한 단축된 커밋-리빌 주기입니다. 더 높은 정족수 요구 사항이 줄어든 심의 시간을 보상합니다. 비상 기간 이후 자동 리빌됩니다.

5. **Weighted Private Voting** - 투표권은 여러 요소(토큰, 평판, 재임 기간)에서 비공개로 파생됩니다. ZK 증명은 구성 요소 값을 드러내지 않고 정확한 가중치 계산을 입증합니다.

## 사용 사례

1. **프로토콜 매개변수 변경**
   - DAO가 수수료를 0.3%에서 0.25%로 조정하는 것을 제안함
   - 토큰 보유자는 7일 기간 동안 비공개로 투표함
   - 고래는 소규모 보유자에게 영향을 미치기 위해 신호를 보낼 수 없음
   - 리빌 단계에서 투명한 최종 집계를 위해 투표를 집계함

2. **재무 보조금 할당**
   - 여러 프로젝트 제안이 자금을 놓고 경쟁함
   - 프라이빗 투표는 조정 공격을 방지함
   - 프로젝트는 리빌까지 투표 수를 볼 수 없음
   - 밴드왜건 효과 없이 더 공정한 평가

3. **논쟁의 여지가 있는 거버넌스 결정**
   - 커뮤니티가 논란이 많은 프로토콜 변경에 대해 토론함
   - 목소리가 큰 소수는 반대 투표자를 식별하고 압박할 수 없음
   - 사회적 압박 없이 진정한 커뮤니티 감정이 나타남
   - 검증된 참여로 정당화된 결과

4. **이사회 선거**
   - DAO가 후보 풀에서 위원회 구성원을 선출함
   - 프라이빗 투표는 후보 간 투표 거래를 방지함
   - 각 토큰 보유자는 선호하는 후보자에게 투표함
   - 동시 리빌 후 승자가 결정됨

## 실제 제품 및 사용자 경험

참조: [Private Voting Products & UX](../../product/d-governance/d1-private-voting-products.md)

---

[목차로 돌아가기](../../README.md)
