# D8. Proof of Reserves

개별 잔액이나 note 구조를 드러내지 않고 집계 보유량이 임계값을 초과함을 증명합니다.

**제약 조건**: ~600K | **복잡도**: High

---

## 배경

Proof of reserves는 무신뢰 지급 능력 검증을 가능하게 합니다:

- **수탁자 책임**: 거래소와 수탁자는 포트폴리오 구조를 드러내지 않고 사용자 자금을 보유하고 있음을 증명해야 합니다
- **프라이버시 보존**: 개별 계정 잔액은 기밀로 유지되면서 집계가 임계값을 초과합니다
- **지속적인 증명**: 정기적인 증명은 비용이 많이 드는 감사 없이 지속적인 신뢰를 유지합니다
- **위기 예방**: 준비금 부족에 대한 조기 경고는 뱅크런 시나리오를 방지합니다

유명 거래소 붕괴 이후, proof of reserves는 중앙화된 수탁자에게 중요해졌습니다. 전통적인 접근 방식은 너무 많이 드러내거나(완전한 투명성) 너무 적게 드러냅니다(신뢰할 수 있는 감사자). ZK proof of reserves는 최적의 균형을 달성합니다: 정보 누출 없는 암호학적 확실성입니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `merkleRoot` | field | 모든 note의 현재 merkle root |
| `minReserves` | uint | 증명할 최소 준비금 임계값 |
| `tokenType` | uint | 증명되는 토큰 유형 |
| `entityCommitment` | field | 수탁자 신원에 대한 커밋먼트 |
| `attestationTime` | uint | 이 증명의 타임스탬프 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `entityPkX, entityPkY` | field | 수탁자의 public key |
| `entitySk` | field | 수탁자의 secret key |
| `entitySalt` | field | 엔티티 커밋먼트 무작위성 |
| `noteHashes[N]` | field[] | 소유한 note의 해시 |
| `values[N]` | uint[] | 각 note의 값 |
| `salts[N]` | field[] | 각 note의 무작위성 |
| `isActive[N]` | bool[] | 실제 vs. 패딩 note에 대한 플래그 |
| `merklePaths[N][D]` | field[][] | 각 note에 대한 Merkle 증명 |
| `merkleIndexes[N]` | uint[] | Merkle tree 내 위치 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template ProofOfReserves(NUM_NOTES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input merkleRoot;
    signal input minReserves;
    signal input tokenType;
    signal input entityCommitment;
    signal input attestationTime;

    // ===== Private Inputs =====
    signal input entityPkX, entityPkY, entitySk, entitySalt;
    signal input noteHashes[NUM_NOTES];
    signal input values[NUM_NOTES];
    signal input salts[NUM_NOTES];
    signal input isActive[NUM_NOTES];
    signal input merklePaths[NUM_NOTES][TREE_DEPTH];
    signal input merkleIndexes[NUM_NOTES];

    // ===== 1. Verify Entity Commitment =====
    component entity = Poseidon(3);
    entity.inputs[0] <== entityPkX;
    entity.inputs[1] <== entityPkY;
    entity.inputs[2] <== entitySalt;
    entity.out === entityCommitment;

    // ===== 2. Verify Entity Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== entitySk;
    ownership.pkX <== entityPkX;
    ownership.pkY <== entityPkY;

    // ===== 3. Process Each Note =====
    signal runningTotal[NUM_NOTES + 1];
    runningTotal[0] <== 0;

    component notes[NUM_NOTES];
    component merkleProofs[NUM_NOTES];
    component activeChecks[NUM_NOTES];
    component hashMatches[NUM_NOTES];

    for (var i = 0; i < NUM_NOTES; i++) {
        // 3a. Verify isActive is binary (0 or 1)
        isActive[i] * (1 - isActive[i]) === 0;

        // 3b. Compute expected note hash
        notes[i] = PoseidonRegularNote();
        notes[i].pkX <== entityPkX;
        notes[i].pkY <== entityPkY;
        notes[i].value <== values[i];
        notes[i].tokenType <== tokenType;
        notes[i].salt <== salts[i];

        // 3c. Verify note hash matches (if active)
        // (computed - provided) * isActive === 0
        signal hashDiff;
        hashDiff <== notes[i].out - noteHashes[i];
        hashDiff * isActive[i] === 0;

        // 3d. Verify merkle inclusion (for all notes, active or not)
        merkleProofs[i] = MerkleProof(TREE_DEPTH);
        merkleProofs[i].leaf <== noteHashes[i];
        merkleProofs[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkleProofs[i].path[j] <== merklePaths[i][j];
        }
        merkleProofs[i].index <== merkleIndexes[i];

        // 3e. Accumulate value (only active notes)
        runningTotal[i + 1] <== runningTotal[i] + values[i] * isActive[i];
    }

    // ===== 4. Final Total =====
    signal totalReserves;
    totalReserves <== runningTotal[NUM_NOTES];

    // ===== 5. Verify Reserves >= Minimum =====
    component reserveCheck = GreaterEqThan(128);
    reserveCheck.in[0] <== totalReserves;
    reserveCheck.in[1] <== minReserves;
    reserveCheck.out === 1;

    // ===== 6. Ensure At Least One Active Note =====
    signal activeSum[NUM_NOTES + 1];
    activeSum[0] <== 0;
    for (var i = 0; i < NUM_NOTES; i++) {
        activeSum[i + 1] <== activeSum[i] + isActive[i];
    }
    component hasActive = GreaterThan(64);
    hasActive.in[0] <== activeSum[NUM_NOTES];
    hasActive.in[1] <== 0;
    hasActive.out === 1;
}

component main {public [merkleRoot, minReserves, tokenType, entityCommitment, attestationTime]} =
    ProofOfReserves(100, 20);
```

### 주요 제약 조건

1. **엔티티 바인딩**: 증명이 특정 수탁자 커밋먼트에 연결됨
2. **소유권 검증**: 수탁자가 주장된 모든 note의 통제를 증명함
3. **Note 유효성**: 각 활성 note가 merkle tree에 대해 검증됨
4. **값 집계**: 활성 note 값의 총계가 올바르게 계산됨
5. **임계값 충족**: 집계 준비금이 최소값을 충족하거나 초과함

## 효과

| 측면 | 영향 |
|--------|--------|
| **신뢰 검증** | 신뢰할 수 있는 감사자 없는 지급 능력의 암호학적 증명 |
| **프라이버시 보존** | 정확한 준비금과 note 구조는 숨겨진 채로 유지됨 |
| **지속적인 보증** | 자동화된 정기 증명이 가능함 |
| **시장 신뢰** | 검증 가능한 준비금이 시장 안정성을 지원함 |
| **규제 준수** | 완전한 투명성 없이 지급 능력 요구 사항 충족 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **빌린 준비금** | 타임스탬프 증명; 준비금은 증명 간에 지속되어야 함 |
| **Note 중복** | Merkle tree가 동일한 note가 두 번 계산되는 것을 방지함 |
| **오래된 증명** | 증명 타임스탬프는 최근이어야 함; 만료 고려 |
| **담합** | 엔티티 커밋먼트가 수탁자 간 증명 공유를 방지함 |
| **부분 준비금 은폐** | minReserves는 주장된 부채와 일치해야 함 |
| **키 손상** | 다중서명 엔티티 키; 정기적인 키 로테이션 |

## 구현 과제

1. **확장성**
   - 대형 수탁자는 수천 개의 note를 가질 수 있음
   - Circuit 크기는 NUM_NOTES 매개변수에 따라 스케일됨
   - 매우 큰 포트폴리오에 대한 재귀 증명 고려

2. **증명 생성 시간**
   - 600K 제약 조건은 상당한 계산이 필요함
   - 전용 증명 생성 인프라가 필요할 수 있음
   - 집계가 있는 배치로 증명 고려

3. **부채 매칭**
   - 일치하는 부채를 증명하지 않고 준비금을 증명하는 것은 불완전함
   - 보완적인 proof-of-liabilities circuit 고려
   - 지급 능력 = 준비금 - 부채 >= 0

4. **다중 자산 준비금**
   - 수탁자는 여러 토큰 유형을 보유함
   - 토큰당 별도 증명 또는 통합 다중 자산 circuit
   - 통합 지급 능력을 위한 환율 처리

## 파생 변형

1. **Proof of Liabilities** - 총 고객 예금을 증명하는 보완 circuit입니다. 준비금과 결합하여 지급 능력 비율을 증명합니다. 모든 계정에 걸친 프라이버시 보존 부채 합산이 필요합니다.

2. **Reserve Ratio Alerts** - 준비금이 임계값에 접근할 때 자동 알림이 있는 지속적인 모니터링입니다. Keeper 네트워크가 주기적으로 증명을 제출합니다. 유동성 스트레스에 대한 조기 경고 시스템입니다.

3. **Tiered Disclosure** - 다른 청중을 위한 다른 준비금 임계값입니다. 공개 증명은 준비금 > X를 보여주고, 규제 당국 증명은 정확한 금액을 보여줍니다. 신뢰 수준을 기반으로 한 세밀한 투명성입니다.

4. **Cross-Entity Aggregates** - 개별 보유량을 드러내지 않고 여러 수탁자에 걸친 집계 준비금을 증명합니다. 산업 전체 지급 능력 지표입니다. 시스템적 위험 평가에 유용합니다.

5. **Historical Continuity** - 시간이 지남에 따라 준비금이 유지되었음을 보여주는 증명 체인입니다. 각 증명은 이전 증명을 참조합니다. 일관된 실적을 통해 신뢰를 구축합니다.

## 사용 사례

1. **거래소 지급 능력 증명**
   - 중앙화된 거래소가 ZK-DEX note에 고객 자금을 보유함
   - 준비금이 고객 예금을 초과한다는 월간 증명
   - 공개 검증을 위해 온체인에 게시됨
   - 경쟁자로부터 정확한 보유량은 기밀로 유지됨

2. **스테이블코인 준비금 뒷받침**
   - 스테이블코인 발행자가 100% 담보 뒷받침을 주장함
   - 준비금 >= 유통 공급량이라는 주간 증명
   - 수동 감사 없이 자동화된 온체인 검증
   - 시장 스트레스 동안 신뢰 유지

3. **기관 수탁**
   - 펀드 관리자가 고객 자산을 수탁함
   - 규제 준수를 위한 분기별 증명
   - AUM 기반 특정 준비금 임계값
   - 수탁 의무를 비공개로 충족함

4. **보험 기금 적정성**
   - DeFi 프로토콜이 보험 기금을 유지함
   - 기금이 보장 의무를 초과한다는 지속적인 증명
   - 준비금이 임계값 근처로 떨어지면 자동 알림
   - 프로토콜 안전성에 대한 커뮤니티 신뢰

## 실제 제품 및 사용자 경험

참조: [Proof of Reserves Products & UX](../../product/d-governance/d8-reserves-products.md)

---

[목차로 돌아가기](../../README.md)
