# D4. Delegated Voting

위임 관계의 프라이버시를 유지하면서 신뢰할 수 있는 대표에게 투표권을 이전합니다.

**제약 조건**: ~160K | **복잡도**: Low

---

## 배경

위임 투표는 효과적인 거버넌스 참여를 가능하게 합니다:

- **전문성 확장**: 대부분의 토큰 보유자는 모든 제안을 평가할 시간이나 지식이 부족합니다
- **참여 없는 기여**: 수동적 보유자는 활발한 대표를 통해 기여할 수 있습니다
- **대의 민주주의**: 대표는 거버넌스를 전문으로 하여 의사 결정 품질을 향상시킵니다
- **프라이버시 보존**: 위임 관계는 영향력 거래를 방지하기 위해 숨길 수 있습니다

DAO에서 투표자 참여율은 일반적으로 낮습니다(종종 10% 미만). 위임은 수동적 보유자가 지식이 풍부한 커뮤니티 구성원에게 권한을 부여할 수 있게 합니다. 프라이버시 보존 위임은 누가 누구에게 위임했는지 숨겨 사회적 압박과 위임 시장을 방지합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `delegationHash` | field | 위임 세부 정보에 대한 해시 커밋먼트 |
| `voteCommitment` | field | 투표 선택에 대한 커밋먼트 |
| `proposalId` | uint | 투표 중인 제안의 식별자 |
| `votingPower` | uint | 행사되는 투표권 |
| `delegationRoot` | field | 유효한 위임의 Merkle root |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `delegatorPkX, delegatorPkY` | field | 원래 토큰 보유자의 public key |
| `delegatePkX, delegatePkY` | field | 대표의 public key |
| `delegateSk` | field | 대표의 secret key (대표 신원 증명) |
| `delegatedPower` | uint | 위임된 투표권의 양 |
| `expiry` | uint | 위임 만료 타임스탬프 |
| `delegationSalt` | field | 위임 note 무작위성 |
| `choice` | uint | 투표 선택 (0 = 반대, 1 = 찬성) |
| `voteSalt` | field | 투표 커밋먼트 무작위성 |
| `currentTime` | uint | 만료 확인을 위한 현재 타임스탬프 |
| `merklePath[20]` | field[] | 위임의 Merkle 증명 |
| `merkleIndex` | uint | 위임 tree 내 위치 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template DelegatedVoting(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input delegationHash;
    signal input voteCommitment;
    signal input proposalId;
    signal input votingPower;
    signal input delegationRoot;

    // ===== Private Inputs =====
    signal input delegatorPkX, delegatorPkY;
    signal input delegatePkX, delegatePkY, delegateSk;
    signal input delegatedPower;
    signal input expiry;
    signal input delegationSalt;
    signal input choice, voteSalt;
    signal input currentTime;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Delegation Commitment =====
    component delegation = Poseidon(7);
    delegation.inputs[0] <== delegatorPkX;
    delegation.inputs[1] <== delegatorPkY;
    delegation.inputs[2] <== delegatePkX;
    delegation.inputs[3] <== delegatePkY;
    delegation.inputs[4] <== delegatedPower;
    delegation.inputs[5] <== expiry;
    delegation.inputs[6] <== delegationSalt;
    delegation.out === delegationHash;

    // ===== 2. Verify Delegation Inclusion in Tree =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== delegationHash;
    merkle.root <== delegationRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Verify Delegate Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== delegateSk;
    ownership.pkX <== delegatePkX;
    ownership.pkY <== delegatePkY;

    // ===== 4. Verify Delegation Not Expired =====
    component expiryCheck = LessThan(64);
    expiryCheck.in[0] <== currentTime;
    expiryCheck.in[1] <== expiry;
    expiryCheck.out === 1;

    // ===== 5. Voting Power Matches Delegation =====
    votingPower === delegatedPower;

    // ===== 6. Validate Choice (0 or 1) =====
    choice * (1 - choice) === 0;

    // ===== 7. Create Vote Commitment =====
    component commit = Poseidon(4);
    commit.inputs[0] <== choice;
    commit.inputs[1] <== votingPower;
    commit.inputs[2] <== proposalId;
    commit.inputs[3] <== voteSalt;
    commit.out === voteCommitment;
}

component main {public [delegationHash, voteCommitment, proposalId, votingPower, delegationRoot]} =
    DelegatedVoting(20);
```

### 주요 제약 조건

1. **위임 진위성**: 위임 해시는 위임자, 대표, 권력, 만료를 바인딩함
2. **위임 유효성**: 활성 위임의 merkle tree에 존재해야 함
3. **대표 권한**: 대표의 secret key만이 위임을 행사할 수 있음
4. **시간적 유효성**: 위임이 만료되지 않았어야 함
5. **권력 정확성**: 투표권이 위임된 양과 정확히 일치함

## 효과

| 측면 | 영향 |
|--------|--------|
| **참여율** | 수동적 보유자가 활발한 대표를 통해 기여함 |
| **의사 결정 품질** | 전문 대표가 거버넌스 결과를 개선함 |
| **위임 프라이버시** | 관계가 숨겨져 영향력 거래를 방지함 |
| **유연성** | 위임은 제안 간에 변경될 수 있음 |
| **책임성** | 대표는 투표 기록을 통해 평판을 구축함 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **위임 판매** | 프라이버시가 위임 증명을 방지함; 경제적 인센티브 불명확 |
| **대표 담합** | 대표당 최대 위임 제한; 다양성 요구 사항 |
| **만료 조작** | 만료 타임스탬프는 위임 생성 시 미래여야 함 |
| **철회 지연** | Nullifier 세트를 통한 즉시 철회 고려 |
| **오래된 위임** | 주기적 갱신 요구; 자동 만료 |
| **이중 투표** | (위임자, 제안)당 nullifier가 위임자와 대표 모두 투표하는 것을 방지함 |

## 구현 과제

1. **위임 생성**
   - 위임자는 오프체인에서 위임 커밋먼트에 서명함
   - 위임이 온체인 merkle tree에 추가됨
   - 효율적인 위임 tree 업데이트 필요

2. **철회 메커니즘**
   - 위임자는 언제든지 철회할 수 있어야 함
   - 위임을 무효화하기 위해 nullifier 추가
   - 철회 중 진행 중인 투표 처리

3. **다중 위임**
   - 사용자는 대표 간 권력을 분할하기를 원할 수 있음
   - 또는 다른 제안 유형에 대해 위임
   - 과도한 위임을 방지하기 위한 합계 확인 필요

4. **대표 발견**
   - 위임자는 자격을 갖춘 대표를 어떻게 찾는가?
   - 투표 이력이 있는 대표 레지스트리
   - 대표 품질에 대한 평판 시스템

## 파생 변형

1. **Liquid Democracy** - 대표는 다른 대표에게 재위임할 수 있어 위임 체인을 생성합니다. 권력은 네트워크를 통해 전이적으로 흐릅니다. 최종 책임성을 유지하면서 전문성 계층을 가능하게 합니다.

2. **Partial Delegation** - 여러 대표 간 투표권 분할(예: 50%는 대표 A에게, 30%는 B에게, 20%는 유지). ZK 증명은 총 위임이 사용 가능한 권력을 초과하지 않음을 보여줍니다. 거버넌스에 대한 포트폴리오 접근 방식을 가능하게 합니다.

3. **Topic-Specific Delegation** - 다른 제안 카테고리(재무, 기술, 파트너십)에 대한 다른 대표. Circuit은 제안 유형이 위임 범위와 일치하는지 확인합니다. 전문화된 대표를 가능하게 합니다.

4. **Time-Limited Delegation** - 위임은 지정된 기간 후 자동으로 만료됩니다(예: 30일). 유지하려면 주기적 갱신이 필요합니다. 좀비 위임을 방지하고 지속적인 위임자 동의를 보장합니다.

5. **Revocable Instant Delegation** - 위임자는 투표 기간 중에도 언제든지 위임을 철회할 수 있습니다. 철회는 보류 중인 투표를 무효화하는 nullifier를 추가합니다. 대표 자율성과 위임자 통제 간의 균형을 맞춥니다.

## 사용 사례

1. **기술 거버넌스**
   - 프로토콜 업그레이드 제안은 깊은 기술 전문성이 필요함
   - 평균 토큰 보유자는 존경받는 개발자에게 위임함
   - 개발자 대표는 기술적 장점에 따라 투표함
   - 위임 프라이버시는 대표를 대상으로 하는 영향력 캠페인을 방지함

2. **기관 위임**
   - 펀드가 많은 프로토콜에 걸쳐 거버넌스 토큰을 보유함
   - 전문 거버넌스 서비스 제공업체에 위임함
   - 제공업체는 펀드의 정책 지침에 따라 투표함
   - 위임 관계는 기밀로 유지됨

3. **커뮤니티 대표**
   - 지리적 또는 언어적 커뮤니티가 위임을 풀링함
   - 커뮤니티 리더가 공유 이익을 대표함
   - 대상 지정을 방지하기 위해 위임이 비공개로 추적됨
   - 리더의 투표 기록은 공개적으로 감사 가능함

4. **전문성 기반 투표**
   - 프로토콜 분석으로 알려진 보안 연구원
   - 커뮤니티 구성원이 보안 제안에 대해 위임함
   - 연구원은 감사 관련 결정을 평가하고 투표함
   - 일관된 품질 투표를 통해 평판 구축

## 실제 제품 및 사용자 경험

참조: [Delegated Voting Products & UX](../../../product/d-governance/d4-delegated-products.md)

---

[목차로 돌아가기](../../README.md)
