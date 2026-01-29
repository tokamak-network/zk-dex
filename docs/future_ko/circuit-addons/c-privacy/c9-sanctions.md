# C9. Sanctions Compliance

비회원 증명을 사용하여 트랜잭션 이력에 제재 대상 주소와의 상호 작용이 없음을 증명합니다.

**제약 조건**: ~800K (100 트랜잭션) | **복잡도**: 높음

---

## 배경

글로벌 제재 규정 준수는 합법적인 금융 시스템의 중요한 요구 사항입니다:

- **OFAC 요구 사항**: 미국 재무부는 제재 대상 개인, 기관 및 국가 목록을 유지합니다
- **EU/UK 제재**: 중복되지만 별개의 요구 사항이 있는 추가 제재 체제
- **금융 기관 의무**: 은행과 거래소는 모든 트랜잭션을 심사해야 합니다
- **프라이버시 딜레마**: 전통적인 심사는 전체 트랜잭션 이력을 노출해야 합니다
- **비회원 증명**: ZK 기술로 제재 목록에 없음을 증명할 수 있습니다

제재 규정 준수는 전통적으로 심사를 위해 모든 거래 상대방을 드러내야 합니다. 프라이버시 시스템은 비회원 증명을 사용하여 사용자의 거래 상대방 중 누구도 제재 목록에 나타나지 않음을 증명할 수 있으며, 실제로 거래 상대방이 누구인지 드러내지 않습니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `historyRoot` | field | 사용자의 트랜잭션 이력의 Merkle 루트 |
| `sanctionsListRoot` | field | 현재 제재 목록의 Merkle 루트 |
| `complianceResult` | uint | 완전히 준수하면 1 |
| `listVersion` | uint | 제재 목록 버전/타임스탬프 |
| `numTransactions` | uint | 검증 중인 트랜잭션 수 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `txHashes[NUM_TXS]` | field[] | 사용자 이력의 트랜잭션 해시 |
| `counterparties[NUM_TXS]` | field[] | 각 트랜잭션의 거래 상대방 주소 |
| `historyPaths[NUM_TXS][TREE_DEPTH]` | field[][] | 이력 포함을 위한 Merkle 증명 |
| `historyIndexes[NUM_TXS]` | uint[] | 이력 트리의 위치 |
| `sanctionsProofs[NUM_TXS]` | NonMembershipProof[] | 각 거래 상대방에 대한 비회원 증명 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/merkle/sorted_merkle_non_membership.circom";
include "../utils/comparators.circom";

template SanctionsCheck(NUM_TXS, HISTORY_DEPTH, SANCTIONS_DEPTH) {
    // ===== Public Inputs =====
    signal input historyRoot;
    signal input sanctionsListRoot;
    signal input complianceResult;
    signal input listVersion;
    signal input numTransactions;

    // ===== Private Inputs =====
    signal input txHashes[NUM_TXS];
    signal input counterparties[NUM_TXS];
    signal input historyPaths[NUM_TXS][HISTORY_DEPTH];
    signal input historyIndexes[NUM_TXS];
    // Non-membership proof components
    signal input leftNeighbors[NUM_TXS];      // Left neighbor in sorted list
    signal input rightNeighbors[NUM_TXS];     // Right neighbor in sorted list
    signal input leftPaths[NUM_TXS][SANCTIONS_DEPTH];
    signal input rightPaths[NUM_TXS][SANCTIONS_DEPTH];
    signal input leftIndexes[NUM_TXS];
    signal input rightIndexes[NUM_TXS];

    // ===== 1. Verify numTransactions is Valid =====
    component numCheck = LessEqThan(16);
    numCheck.in[0] <== numTransactions;
    numCheck.in[1] <== NUM_TXS;
    numCheck.out === 1;

    // ===== 2. Process Each Transaction =====
    component historyProof[NUM_TXS];
    component nonMembership[NUM_TXS];
    signal txActive[NUM_TXS];
    signal txCompliant[NUM_TXS];

    for (var i = 0; i < NUM_TXS; i++) {
        // Check if this tx slot is active
        component activeCheck = LessThan(16);
        activeCheck.in[0] <== i;
        activeCheck.in[1] <== numTransactions;
        txActive[i] <== activeCheck.out;

        // Verify tx is in user's history (if active)
        historyProof[i] = MerkleProof(HISTORY_DEPTH);
        historyProof[i].leaf <== txHashes[i];
        historyProof[i].root <== historyRoot;
        for (var j = 0; j < HISTORY_DEPTH; j++) {
            historyProof[i].path[j] <== historyPaths[i][j];
        }
        historyProof[i].index <== historyIndexes[i];

        // Verify counterparty NOT in sanctions list (non-membership proof)
        // Using sorted Merkle tree: prove element falls between two adjacent leaves
        nonMembership[i] = SortedMerkleNonMembership(SANCTIONS_DEPTH);
        nonMembership[i].element <== counterparties[i];
        nonMembership[i].root <== sanctionsListRoot;
        nonMembership[i].leftNeighbor <== leftNeighbors[i];
        nonMembership[i].rightNeighbor <== rightNeighbors[i];
        for (var j = 0; j < SANCTIONS_DEPTH; j++) {
            nonMembership[i].leftPath[j] <== leftPaths[i][j];
            nonMembership[i].rightPath[j] <== rightPaths[i][j];
        }
        nonMembership[i].leftIndex <== leftIndexes[i];
        nonMembership[i].rightIndex <== rightIndexes[i];

        // Compliance: either inactive slot OR passed non-membership
        // Inactive slots are always compliant (dummy data)
        txCompliant[i] <== (1 - txActive[i]) + txActive[i] * nonMembership[i].valid;
    }

    // ===== 3. Aggregate Compliance =====
    signal partialCompliance[NUM_TXS + 1];
    partialCompliance[0] <== 1;
    for (var i = 0; i < NUM_TXS; i++) {
        partialCompliance[i + 1] <== partialCompliance[i] * txCompliant[i];
    }
    signal allCompliant <== partialCompliance[NUM_TXS];

    // ===== 4. Verify Result =====
    complianceResult === allCompliant;
}

// Helper template for sorted Merkle non-membership
template SortedMerkleNonMembership(DEPTH) {
    signal input element;
    signal input root;
    signal input leftNeighbor;
    signal input rightNeighbor;
    signal input leftPath[DEPTH];
    signal input rightPath[DEPTH];
    signal input leftIndex;
    signal input rightIndex;
    signal output valid;

    // Verify left < element < right
    component leftCheck = LessThan(256);
    leftCheck.in[0] <== leftNeighbor;
    leftCheck.in[1] <== element;

    component rightCheck = LessThan(256);
    rightCheck.in[0] <== element;
    rightCheck.in[1] <== rightNeighbor;

    // Verify left and right are in the tree
    component leftProof = MerkleProof(DEPTH);
    leftProof.leaf <== leftNeighbor;
    leftProof.root <== root;
    for (var i = 0; i < DEPTH; i++) {
        leftProof.path[i] <== leftPath[i];
    }
    leftProof.index <== leftIndex;

    component rightProof = MerkleProof(DEPTH);
    rightProof.leaf <== rightNeighbor;
    rightProof.root <== root;
    for (var i = 0; i < DEPTH; i++) {
        rightProof.path[i] <== rightPath[i];
    }
    rightProof.index <== rightIndex;

    // Verify left and right are adjacent (rightIndex = leftIndex + 1)
    component adjacentCheck = IsEqual();
    adjacentCheck.in[0] <== rightIndex;
    adjacentCheck.in[1] <== leftIndex + 1;

    // All conditions must hold for valid non-membership
    valid <== leftCheck.out * rightCheck.out * adjacentCheck.out;
}

component main {public [historyRoot, sanctionsListRoot, complianceResult, listVersion, numTransactions]} =
    SanctionsCheck(100, 20, 16);
```

### 주요 제약 조건

1. **이력 멤버십**: 각 트랜잭션이 사용자의 이력 트리에 존재합니다
2. **비회원 증명**: 각 거래 상대방이 제재 목록에 없음이 증명됩니다
3. **정렬된 트리 구조**: 비회원을 위해 제재 목록이 정렬된 Merkle 트리에 있습니다
4. **인접성 증명**: 정렬된 트리의 이웃이 실제로 인접합니다
5. **집계 규정 준수**: 전체 규정 준수를 위해 모든 트랜잭션이 통과해야 합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **규제 준수** | 제재 요구 사항 준수를 증명합니다 |
| **프라이버시 보존** | 트랜잭션 거래 상대방이 절대 드러나지 않습니다 |
| **목록 최신성** | 현재 제재 목록 루트를 사용합니다 |
| **배치 검증** | 단일 증명으로 여러 트랜잭션 |
| **기관 활성화** | 규제 기관이 참여할 수 있습니다 |
| **글로벌 적용 가능성** | 여러 제재 체제를 지원합니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **구식 제재 목록** | listVersion 및 루트 신선도 확인 |
| **불완전한 이력** | 검증자가 최소 이력 깊이를 요구할 수 있습니다 |
| **제재 회피** | 목록에 없는 주소에 대한 규정 준수를 증명할 수 없습니다 |
| **목록 조작** | 공식적이고 증명된 제재 목록 루트 사용 |
| **새로운 제재** | 목록 업데이트 후 재증명 |
| **이력 정리** | 규정 준수 기간을 위한 충분한 이력 유지 |
| **거래 상대방 정의** | 무엇이 상호 작용을 구성하는지 명확한 정의 |

## 구현 과제

1. **정렬된 Merkle 트리 유지 관리**
   - 제재 목록이 정렬된 순서여야 합니다
   - 삽입은 트리 재구성이 필요합니다
   - 스파스 Merkle 트리 대안 고려

2. **목록 업데이트 빈도**
   - OFAC는 주당 여러 번 업데이트합니다
   - EU/UK 목록은 정기적으로 업데이트됩니다
   - 효율적인 재증명 메커니즘 필요

3. **이력 축적**
   - 긴 트랜잭션 이력은 큰 증명을 의미합니다
   - 롤링 윈도우 규정 준수 고려
   - 이력을 위한 재귀 증명 집계

4. **다중 관할권 목록**
   - 미국, EU, 영국 등의 다른 목록
   - 여러 목록에 대한 단일 증명은 복잡성을 증가시킵니다
   - 관할권당 별도 증명이 필요할 수 있습니다

5. **거래 상대방 식별**
   - 직접 거래 상대방은 명확합니다
   - 중간 홉은 더 복잡합니다
   - "상호 작용"을 명확하게 정의합니다

## 파생물

1. **실시간 제재 심사** - 실행 전에 각 트랜잭션을 라이브 제재 목록과 심사합니다. 거래 상대방이 세션 중에 제재 대상이 되면 트랜잭션을 방지합니다. 지속적인 규정 준수 모니터링입니다.

2. **과거 규정 준수 증명** - 과거 제재 목록 스냅샷을 사용하여 특정 과거 날짜의 규정 준수를 증명합니다. 과거 기간을 포함하는 감사에 유용합니다. 보관된 목록 루트가 필요합니다.

3. **거래 상대방 위험 평가** - 이진 제재 확인을 넘어 제재 대상 기관과의 근접성을 평가합니다. 분리 정도 분석입니다. 경계 사례에 대한 위험 점수입니다.

4. **제재 목록 업데이트 구독** - 제재 목록이 업데이트되면 자동 재증명. 지속적인 규정 준수 인증을 유지합니다. 상태가 변경되면 경고합니다.

5. **교차 체인 규정 준수 검증** - 사용자가 활동이 있는 여러 블록체인에 걸쳐 규정 준수를 증명합니다. 교차 체인 이력을 통합 규정 준수 증명으로 집계합니다. 다중 체인 기관을 지원합니다.

## 사용 사례

1. **거래소 규정 준수**
   - 암호화폐 거래소가 제재 심사가 필요합니다
   - 사용자가 모든 거래 상대방이 제재 대상이 아님을 증명합니다
   - 거래소가 규제 요구 사항을 충족합니다
   - 사용자 트랜잭션 이력이 비공개로 유지됩니다

2. **은행 DeFi 통합**
   - 은행이 DeFi 프로토콜과 상호 작용하고자 합니다
   - 제재 대상 기관과의 상호 작용이 없음을 증명해야 합니다
   - ZK 증명이 규정 준수 팀을 만족시킵니다
   - DeFi 포지션이 기밀로 유지됩니다

3. **국경 간 지급**
   - 결제 처리자가 국제 이체를 처리합니다
   - 송신자/수신자가 제재 목록에 없음을 증명합니다
   - OFAC 및 EU 심사 요구 사항을 충족합니다
   - 지급 세부 정보가 비공개로 유지됩니다

4. **기관 펀드 관리**
   - 헤지 펀드가 프라이버시 보존 DeFi를 사용합니다
   - 포트폴리오에 제재 대상 노출이 없음을 증명해야 합니다
   - 감사관을 위한 분기별 규정 준수 증명
   - 거래 전략이 기밀로 유지됩니다

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Sanctions Compliance - Products & UX](../../../product/c-privacy/c9-sanctions-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
