# D5. Rage Quit

재무의 비례적 몫으로 DAO를 떠나 다수의 횡포로부터 소수 구성원을 보호합니다.

**제약 조건**: ~250K | **복잡도**: Medium

---

## 배경

Rage quit은 집단 거버넌스에서 소수자 권리를 보호합니다:

- **탈퇴 권리**: 구성원은 근본적으로 반대하는 조직에 갇혀서는 안 됩니다
- **다수의 책임**: 구성원이 떠날 수 있다는 것을 알면 다수가 가치 추출을 하지 못하도록 제약합니다
- **비례적 공정성**: 떠나는 구성원은 집단 자산의 공정한 몫을 받을 자격이 있습니다
- **거버넌스 정당성**: 자발적 결사는 실행 가능한 탈퇴 옵션을 필요로 합니다

전통적인 조직에서 소수 주주는 다수 결정에 대한 제한된 구제책을 가집니다. DAO는 비례적 재무 상환을 허용하는 rage quit을 구현할 수 있습니다. 이것은 개인의 자율성을 보존하면서 거버넌스에 책임 압박을 생성합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `membershipNullifier` | field | 이중 탈퇴를 방지하는 nullifier |
| `outputHashes[N]` | field[] | 출력 note의 해시 (받은 토큰) |
| `treasuryRoot` | field | 재무 잔액의 Merkle root |
| `membershipRoot` | field | 구성원 지분의 Merkle root |
| `totalShares` | uint | 총 미결제 회원 지분 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | 구성원의 public key |
| `sk` | field | 소유권을 증명하는 secret key |
| `shareAmount` | uint | 구성원의 지분 수 |
| `membershipSalt` | field | 회원 note 무작위성 |
| `memberMerklePath[20]` | field[] | 회원 자격 증명 |
| `memberMerkleIndex` | uint | 회원 tree 내 위치 |
| `treasuryBalances[N]` | uint | 각 토큰에 대한 재무 잔액 |
| `treasuryMerklePaths[N][20]` | field[][] | 재무 잔액 증명 |
| `exitAmounts[N]` | uint | 토큰당 인출할 금액 |
| `outputSalts[N]` | field | 출력 note의 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template RageQuit(NUM_TOKENS, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input membershipNullifier;
    signal input outputHashes[NUM_TOKENS];
    signal input treasuryRoot;
    signal input membershipRoot;
    signal input totalShares;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input shareAmount;
    signal input membershipSalt;
    signal input memberMerklePath[TREE_DEPTH];
    signal input memberMerkleIndex;
    signal input treasuryBalances[NUM_TOKENS];
    signal input tokenTypes[NUM_TOKENS];
    signal input treasuryMerklePaths[NUM_TOKENS][TREE_DEPTH];
    signal input treasuryMerkleIndexes[NUM_TOKENS];
    signal input exitAmounts[NUM_TOKENS];
    signal input outputSalts[NUM_TOKENS];

    // ===== 1. Verify Membership =====
    component membership = Poseidon(4);
    membership.inputs[0] <== pkX;
    membership.inputs[1] <== pkY;
    membership.inputs[2] <== shareAmount;
    membership.inputs[3] <== membershipSalt;

    component memberMerkle = MerkleProof(TREE_DEPTH);
    memberMerkle.leaf <== membership.out;
    memberMerkle.root <== membershipRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        memberMerkle.path[i] <== memberMerklePath[i];
    }
    memberMerkle.index <== memberMerkleIndex;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 3. Compute Nullifier =====
    component nullifier = Poseidon(2);
    nullifier.inputs[0] <== sk;
    nullifier.inputs[1] <== membershipRoot;  // Binds to specific membership state
    nullifier.out === membershipNullifier;

    // ===== 4. Verify Proportional Exit for Each Token =====
    component treasuryProofs[NUM_TOKENS];
    component treasuryNotes[NUM_TOKENS];
    component proportionChecks[NUM_TOKENS];
    component outputNotes[NUM_TOKENS];

    for (var i = 0; i < NUM_TOKENS; i++) {
        // 4a. Verify treasury balance for this token
        treasuryNotes[i] = Poseidon(2);
        treasuryNotes[i].inputs[0] <== tokenTypes[i];
        treasuryNotes[i].inputs[1] <== treasuryBalances[i];

        treasuryProofs[i] = MerkleProof(TREE_DEPTH);
        treasuryProofs[i].leaf <== treasuryNotes[i].out;
        treasuryProofs[i].root <== treasuryRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            treasuryProofs[i].path[j] <== treasuryMerklePaths[i][j];
        }
        treasuryProofs[i].index <== treasuryMerkleIndexes[i];

        // 4b. Verify proportional exit amount
        // exitAmount * totalShares <= treasuryBalance * shareAmount
        // (allows for rounding down)
        signal leftSide;
        signal rightSide;
        leftSide <== exitAmounts[i] * totalShares;
        rightSide <== treasuryBalances[i] * shareAmount;

        proportionChecks[i] = LessEqThan(128);
        proportionChecks[i].in[0] <== leftSide;
        proportionChecks[i].in[1] <== rightSide;
        proportionChecks[i].out === 1;

        // 4c. Verify output note
        outputNotes[i] = PoseidonRegularNote();
        outputNotes[i].pkX <== pkX;
        outputNotes[i].pkY <== pkY;
        outputNotes[i].value <== exitAmounts[i];
        outputNotes[i].tokenType <== tokenTypes[i];
        outputNotes[i].salt <== outputSalts[i];
        outputNotes[i].out === outputHashes[i];
    }

    // ===== 5. Ensure Positive Shares =====
    component sharesPositive = GreaterThan(64);
    sharesPositive.in[0] <== shareAmount;
    sharesPositive.in[1] <== 0;
    sharesPositive.out === 1;

    // ===== 6. Ensure totalShares >= shareAmount =====
    component totalCheck = GreaterEqThan(64);
    totalCheck.in[0] <== totalShares;
    totalCheck.in[1] <== shareAmount;
    totalCheck.out === 1;
}

component main {public [membershipNullifier, outputHashes, treasuryRoot, membershipRoot, totalShares]} =
    RageQuit(5, 20);
```

### 주요 제약 조건

1. **회원 자격 유효성**: 구성원은 회원 merkle tree에 존재해야 함
2. **소유권 증명**: Secret key가 회원 자격 소유권을 증명함
3. **Nullifier 고유성**: 동일한 회원 자격으로 이중 탈퇴를 방지함
4. **비례 계산**: 탈퇴 금액 <= (재무 * 지분) / 총지분
5. **재무 검증**: 모든 재무 잔액이 merkle 증명을 통해 증명됨

## 효과

| 측면 | 영향 |
|--------|--------|
| **탈퇴 권리** | 구성원은 언제든지 비례적 자산과 함께 떠날 수 있음 |
| **소수 보호** | 불리한 다수 결정에 갇힐 수 없음 |
| **거버넌스 규율** | 다수는 탈퇴 옵션이 착취적 행동을 제약한다는 것을 앎 |
| **공정한 평가** | 비례적 지분 계산이 공평한 분배를 보장함 |
| **재무 영향** | 계산된 상환이 재무에 대한 뱅크런 패닉을 방지함 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **이중 탈퇴** | 회원 자격에서 파생된 nullifier가 재사용을 방지함 |
| **반올림 악용** | 탈퇴 금액을 내림; 잔액은 재무에 남음 |
| **재무 상태 경쟁** | 재무 root는 실행 시 온체인 상태와 일치해야 함 |
| **플래시 론 회원 자격** | 회원 자격은 rage quit 전 베스팅 기간 필요 |
| **조정된 고갈** | 일일/주간 총 탈퇴에 대한 선택적 속도 제한 |
| **샌드위치 공격** | Rage quit 실행 창 동안 재무 잠금 |

## 구현 과제

1. **재무 추적**
   - 다중 토큰 재무는 효율적인 잔액 추적이 필요함
   - (토큰, 잔액) 쌍의 Merkle tree
   - 모든 재무 트랜잭션에서 업데이트

2. **지분 회계**
   - 회원 지분은 시간이 지남에 따라 변경될 수 있음 (발행, 소각)
   - 각 회원 자격 변경 시 총 지분 업데이트
   - Rage quit 계산을 위한 히스토리컬 스냅샷

3. **실행 원자성**
   - Rage quit은 모든 재무 토큰에 걸쳐 원자적이어야 함
   - 일관성 없는 상태를 남기는 부분 실패 불가
   - 가스 제한이 탈퇴당 토큰 수를 제한할 수 있음

4. **유예 기간**
   - Rage quit 시작과 실행 사이의 지연 고려
   - 거버넌스가 대량 탈퇴 시나리오에 대응할 수 있게 함
   - 보호와 구성원 권리 간의 균형

## 파생 변형

1. **Delayed Rage Quit** - Rage quit 선언과 실행 사이의 의무적 대기 기간(예: 7일)입니다. DAO가 협상하거나 반대 제안을 할 수 있게 합니다. 탈퇴 차익 거래를 방지하기 위해 대기 기간 동안 구성원의 지분이 잠깁니다.

2. **Partial Rage Quit** - 회원 자격을 유지하면서 지분의 일부로 탈퇴합니다. 전체 헌신 이탈 없이 점진적 탈퇴를 가능하게 합니다. 노출을 줄이고 싶지만 참여를 유지하려는 구성원에게 유용합니다.

3. **Rage Quit with Penalty** - 전략적 탈퇴를 억제하고 남은 구성원에게 자금을 조달하기 위해 rage quit에 소액 수수료(예: 2%)를 부과합니다. 벌금은 장기 구성원 또는 거버넌스가 정의한 특정 상황에서 면제될 수 있습니다.

4. **Rage Quit Threshold** - 거버넌스 결정이 구성원이 정의한 임계값을 넘을 때만 rage quit을 사용할 수 있습니다. 구성원은 탈퇴 조건을 사전에 약속합니다(예: "수수료 > 1%이면"). 자동화된 탈퇴가 특정 불리한 결과로부터 보호합니다.

5. **Coordinated Rage Quit** - 여러 구성원이 가스 효율성을 위해 rage quit을 결합할 수 있습니다. 단일 증명이 여러 탈퇴를 비례적으로 커버합니다. 개별 프라이버시를 유지하면서 집단 행동을 가능하게 합니다.

## 사용 사례

1. **논쟁의 여지가 있는 프로토콜 변경**
   - DAO가 논란이 많은 토크노믹스 변경을 구현하기로 투표함
   - 소수는 방향에 강하게 반대함
   - 반대 구성원은 비례적 재무 지분으로 rage quit함
   - 탈퇴가 반대의 강도를 검증함; 재고를 촉구할 수 있음

2. **펀드 해산**
   - 투자 DAO가 운영을 중단하기로 결정함
   - 모든 구성원이 비례적으로 rage quit함
   - 재무는 복잡한 법적 절차 없이 공정하게 분배됨
   - 효율적이고 무신뢰 펀드 종료

3. **전략적 불일치**
   - DAO가 전략을 크게 전환함
   - 원래 비전을 위해 가입한 초기 구성원은 탈퇴할 수 있음
   - 기여 기간에 대한 공정한 가치를 받음
   - 새로운 방향은 일치된 회원 자격으로 진행할 수 있음

4. **포획으로부터의 보호**
   - 고래가 다수 지분을 축적하고 가치 추출을 제안함
   - 소수 구성원이 포획 시도를 인식함
   - 추출이 완료되기 전에 rage quit함
   - 고래는 빈 재무에 대한 무가치한 거버넌스를 갖게 됨

## 실제 제품 및 사용자 경험

참조: [Rage Quit Products & UX](../../../product/d-governance/d5-rage-quit-products.md)

---

[목차로 돌아가기](../../README.md)
