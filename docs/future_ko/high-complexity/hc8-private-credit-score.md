# HC8. 프라이빗 신용 점수

기본 데이터를 공개하지 않고 여러 금융 요소에서 신용 점수를 계산합니다.

**제약조건**: ~450K | **복잡도**: 높음

---

## 배경

전통적인 신용 점수는 근본적인 프라이버시 문제가 있습니다:
- 신용 기관이 민감한 금융 데이터를 집계
- 점수 계산이 불투명
- 데이터 유출로 개인 정보 노출
- 국경 간 신용은 거의 불가능

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 전통적인 신용 기관 | 중앙화된 데이터; 유출 위험; 불투명한 알고리즘 |
| 온체인 평판 | 모든 금융 이력이 공개; 프라이버시 없음 |
| 자체 보고 신용 | 검증 없음; 사기 위험 |
| 은행 참조 | 단일 소스; 이동 불가; 느림 |

프라이빗 신용 점수는 데이터 노출 없이 검증 가능한 신용도를 가능하게 합니다. 사용자는 기본 금융 데이터를 공개하지 않고 점수 범위를 증명합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `userCommitment` | field | 사용자 신원의 해시 |
| `scoreRangeMin` | uint | 주장된 최소 점수 |
| `scoreRangeMax` | uint | 주장된 최대 점수 |
| `factorWeights` | uint[N_FACTORS] | 공개 점수 알고리즘 가중치 |
| `timestamp` | uint | 점수 계산 타임스탬프 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `userPkX/Y, userSk, userSalt` | field | 사용자 자격 증명 |
| `factors` | uint[N_FACTORS] | 개별 신용 요소 (자산, 소득 등) |
| `factorNoteHashes` | field[N_FACTORS] | 요소를 증명하는 Merkle root 또는 노트 해시 |
| `factorProofs` | field[N_FACTORS][DEPTH] | 요소 검증을 위한 Merkle proof |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **데이터 프라이버시** | 기본 요소가 절대 공개되지 않음 |
| **이동성** | 크로스 플랫폼, 국경 간 신용 |
| **검증 가능성** | 점수 계산의 암호화 증명 |
| **자기 주권** | 사용자가 자신의 데이터를 제어 |
| **투명성** | 점수 알고리즘이 공개되고 감사 가능 |
| **조합 가능성** | DeFi 프로토콜 전반에 걸쳐 사용 가능한 점수 |

## 파생물

1. **다중 소스 신용** - 여러 데이터 소스(거래소, 은행, 온체인)의 점수를 집계합니다. 하위 점수의 가중 조합. 사기 탐지를 위한 크로스 검증 데이터.

2. **이력 신용** - 온체인 지불 이력을 포함합니다. 대출 상환, 청산 회피를 추적합니다. 시간 가중 최근 활동이 더 가치 있음.

3. **소셜 신용 그래프** - 신뢰할 수 있는 연결 및 보증을 요소로 포함합니다. 네트워크 효과로 점수 향상. 스테이크 요구사항을 통한 시빌 저항.

4. **평판 점수** - 비금융 평판 요소. DAO 참여, 거버넌스 투표 이력. 프로토콜 기여 및 버그 바운티.

5. **동적 신용 한도** - 점수 변경에 따라 신용 한도를 자동 조정합니다. 실시간 점수 업데이트가 한도 재계산을 트리거합니다. 수동 검토가 필요 없음.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/merkle/merkle_proof.circom";

template PrivateCreditScore(N_FACTORS, MERKLE_DEPTH) {
    // ===== Public Inputs =====
    signal input userCommitment;
    signal input scoreRangeMin;
    signal input scoreRangeMax;
    signal input factorWeights[N_FACTORS];
    signal input factorDataRoot;  // Merkle root of verified factor data
    signal input timestamp;

    // ===== Private Inputs =====
    signal input userPkX, userPkY, userSk, userSalt;

    // Financial factors (all private)
    // 0: Total assets value (USD)
    // 1: Total liabilities (USD)
    // 2: Monthly income (USD)
    // 3: Account age (months)
    // 4: Payment history (% on-time, 0-100)
    // 5: Credit utilization (%, 0-100)
    // 6: Number of accounts
    // 7: Recent inquiries (last 6 months)
    // 8: Longest account age (months)
    // 9: Debt-to-income ratio (%, 0-100)
    signal input factors[N_FACTORS];
    signal input factorSalts[N_FACTORS];
    signal input factorProofPaths[N_FACTORS][MERKLE_DEPTH];
    signal input factorProofIndices[N_FACTORS];

    // ===== Component Declarations =====
    component userHash;
    component ownership;
    component factorHash[N_FACTORS];
    component factorMerkle[N_FACTORS];
    component minCheck;
    component maxCheck;
    component boundsCheck[N_FACTORS];

    // Intermediate signals
    signal normalizedFactors[N_FACTORS];
    signal weightedFactors[N_FACTORS];
    signal rawScore;
    signal normalizedScore;

    // ===== Verify User =====
    userHash = Poseidon(3);
    userHash.inputs[0] <== userPkX;
    userHash.inputs[1] <== userPkY;
    userHash.inputs[2] <== userSalt;
    userHash.out === userCommitment;

    ownership = ProofOfOwnershipStrict();
    ownership.sk <== userSk;
    ownership.pkX <== userPkX;
    ownership.pkY <== userPkY;

    // ===== Verify Each Factor via Merkle Proof =====
    for (var i = 0; i < N_FACTORS; i++) {
        // Hash factor commitment
        factorHash[i] = Poseidon(4);
        factorHash[i].inputs[0] <== userPkX;
        factorHash[i].inputs[1] <== factors[i];
        factorHash[i].inputs[2] <== i;  // Factor index
        factorHash[i].inputs[3] <== factorSalts[i];

        // Verify factor in data root
        factorMerkle[i] = MerkleProof(MERKLE_DEPTH);
        factorMerkle[i].leaf <== factorHash[i].out;
        factorMerkle[i].root <== factorDataRoot;
        for (var j = 0; j < MERKLE_DEPTH; j++) {
            factorMerkle[i].path[j] <== factorProofPaths[i][j];
        }
        factorMerkle[i].index <== factorProofIndices[i];

        // Normalize factors to 0-100 range (simplified)
        // In practice, each factor has its own normalization curve
        normalizedFactors[i] <== factors[i];

        // Apply weights
        weightedFactors[i] <== normalizedFactors[i] * factorWeights[i];

        // Bounds check on factors (prevent overflow)
        boundsCheck[i] = LessThan(64);
        boundsCheck[i].in[0] <== factors[i];
        boundsCheck[i].in[1] <== 10000000000;  // Max factor value
        boundsCheck[i].out === 1;
    }

    // ===== Compute Credit Score =====
    var weightedSum = 0;
    var totalWeight = 0;

    for (var i = 0; i < N_FACTORS; i++) {
        weightedSum += weightedFactors[i];
        totalWeight += factorWeights[i];
    }

    // Score = weightedSum / totalWeight (scaled to avoid division)
    // Verify: rawScore * totalWeight == weightedSum (within tolerance)
    rawScore <-- weightedSum / totalWeight;
    rawScore * totalWeight === weightedSum;

    // Normalize to 300-850 range (standard credit score range)
    // normalizedScore = 300 + (rawScore * 550 / 100)
    normalizedScore <== rawScore;  // Simplified; real impl needs scaling

    // ===== Verify Score in Claimed Range =====
    minCheck = LessThan(16);
    minCheck.in[0] <== scoreRangeMin;
    minCheck.in[1] <== normalizedScore + 1;
    minCheck.out === 1;

    maxCheck = LessThan(16);
    maxCheck.in[0] <== normalizedScore;
    maxCheck.in[1] <== scoreRangeMax + 1;
    maxCheck.out === 1;
}

component main {public [userCommitment, scoreRangeMin, scoreRangeMax, factorWeights,
    factorDataRoot, timestamp]} = PrivateCreditScore(10, 20);
```

### 주요 제약조건

1. **사용자 신원**: 사용자가 신원 commitment의 소유권을 증명
2. **요소 검증**: 각 요소가 데이터 root에 대한 Merkle proof를 통해 검증됨
3. **점수 계산**: 가중 합이 공개 알고리즘을 따름
4. **범위 증명**: 계산된 점수가 주장된 범위 내에 있음
5. **경계 확인**: 요소 값이 유효한 범위 내에 있음

### 신용 요소 세부 정보

| 요소 | 설명 | 가중치 (일반적) | 범위 |
|--------|-------------|-----------------|-------|
| 총 자산 | 검증 가능한 온체인 자산의 합 | 15% | USD 가치 |
| 총 부채 | 미결제 부채 및 대출 | 15% | USD 가치 |
| 월 소득 | 정기 소득 흐름 | 20% | USD 가치 |
| 계좌 연령 | 첫 계좌 이후 시간 | 10% | 개월 |
| 지불 이력 | 정시 지불 % | 25% | 0-100% |
| 신용 사용률 | 사용된 신용 / 사용 가능한 신용 | 10% | 0-100% |
| 계좌 수 | 신용 유형의 다양성 | 5% | 개수 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **요소 위조** | 검증된 데이터 root에 대한 Merkle proof |
| **오래된 데이터** | 타임스탬프 확인; 최근 데이터 필요 |
| **점수 게이밍** | 여러 요소 유형; 모두 최적화하기 어려움 |
| **신원 도용** | 비밀 키로 소유권 증명 |
| **데이터 제공자 담합** | 여러 독립 데이터 소스 |
| **알고리즘 조작** | 가중치 공개; 감사 가능 |
| **재생 공격** | Commitment에 타임스탬프 및 nonce |

## 구현 과제

1. **데이터 오라클 통합**
   - 요소 데이터가 어디에서 오는가?
   - 옵션: CEX API, 은행 연결, 온체인 이력
   - 증명이 있는 신뢰할 수 있는 데이터 제공자 필요
   - 오프체인 데이터를 위한 Chainlink Functions 또는 API3 고려

2. **요소 정규화**
   - 다른 요소는 다른 규모를 가짐
   - 정규화 곡선이 표준화되어야 함
   - 비선형 관계 (예: 사용률 최적점)
   - 회로에서 룩업 테이블 고려

3. **이력 데이터**
   - 신용 점수는 이력에 의존
   - 지불 이력을 증명하는 효율적인 방법 필요
   - 시계열을 위한 롤링 Merkle 트리 고려
   - 또는 증명이 있는 정기 스냅샷

4. **크로스 플랫폼 데이터**
   - 사용자가 여러 플랫폼에 걸쳐 데이터를 가질 수 있음
   - 표준화된 요소 형식 필요
   - 소스를 공개하지 않고 데이터 집계
   - 여러 소스의 재귀 증명 고려

5. **점수 신선도**
   - 점수를 얼마나 자주 재계산해야 하는가?
   - 정확성과 계산 비용 간의 균형
   - 증분 업데이트 vs. 전체 재계산 고려

## 사용 사례

1. **DeFi 대출 신용도**
   - 소득을 공개하지 않고 신용 점수가 700-750임을 증명
   - 증명된 신용도로 더 나은 이자율에 접근
   - 높은 점수 사용자를 위한 과소 담보 대출

2. **아파트 임대 신청**
   - 정확한 급여를 공개하지 않고 소득 > 임대료의 3배임을 증명
   - 프라이버시 보존 임차인 심사
   - 부동산 관리자 간 이동 가능

3. **고용 확인**
   - 최소 소득 임계값 증명
   - 전체 데이터 공개 없는 신원 조회
   - 긱 이코노미 근로자에게 유용

4. **보험 인수**
   - 전체 금융 공개 없는 위험 평가
   - 프라이버시 보존 보험료 계산
   - 이상 패턴을 통한 사기 탐지

5. **국경 간 신용**
   - 관할권 간 이동 가능한 신용 점수
   - 현지 신용 이력이 필요 없음
   - 글로벌 금융 포용 가능

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../../future/product/high-complexity/hc8-private-credit-score-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
