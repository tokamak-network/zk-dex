# HC1. 배치 Merkle Tree 업데이트

단일 증명으로 여러 노트를 업데이트하여 효율적인 배치 작업을 가능하게 합니다.

**제약조건**: ~800K | **복잡도**: 매우 높음

---

## 배경

전통적인 zkSNARK 시스템은 한 번에 하나의 노트만 처리하며, N개의 트랜잭션에 대해 N개의 증명이 필요합니다. 이는 다음과 같은 이유로 병목 현상이 됩니다:
- 각 증명은 고정된 검증 가스 비용이 발생합니다 (Groth16의 경우 ~200K gas)
- 순차 처리는 처리량을 제한합니다
- L1 calldata 비용은 트랜잭션 수에 선형적으로 증가합니다
- 유사한 작업에 대해 증명자 연산이 중복됩니다

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 개별 증명 | 트랜잭션당 200K gas, 소액 전송에는 경제적으로 비현실적 |
| 단순 배치 (ZK 없음) | 트랜잭션 세부 정보 노출, 프라이버시 보존 없음 |
| Optimistic 배치 | 7일 챌린지 기간, 사용자 경험 저하 |
| 병렬 트리 업데이트 | 상태 충돌로 복잡한 조정 필요 |

배치 처리는 여러 트랜잭션에 걸쳐 증명 검증 비용을 분산시켜 이러한 문제를 해결하며, ZK 프라이버시 보장을 유지하면서 롤업 확장성에 필수적입니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `oldRoot` | field | 배치 업데이트 이전의 Merkle root |
| `newRoot` | field | 배치 업데이트 이후의 Merkle root |
| `nullifierHashes` | field[BATCH_SIZE] | 소비된 노트의 nullifier들 |
| `newCommitments` | field[BATCH_SIZE] | 새로운 노트의 commitment들 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `oldNotes` | field[BATCH_SIZE][5] | 노트 데이터: [pkX, pkY, value, tokenType, salt] |
| `oldPaths` | field[BATCH_SIZE][TREE_DEPTH] | 이전 노트들의 Merkle proof |
| `oldIndices` | uint[BATCH_SIZE] | 이전 노트들의 리프 인덱스 |
| `sks` | field[BATCH_SIZE] | 소유권 증명을 위한 비밀 키 |
| `newNotes` | field[BATCH_SIZE][5] | 새로운 노트 데이터 |
| `intermediateRoots` | field[BATCH_SIZE+1] | 업데이트 사이의 상태 root들 |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **Gas 효율성** | 트랜잭션당 검증 비용 ~95% 감소 (16 배치시 200K에서 ~12K로) |
| **처리량** | 블록당 트랜잭션 10-50배 증가 |
| **지연시간** | 트레이드오프: 배치가 지연을 발생시킴 (전체 배치 대기) |
| **증명자 비용** | 배치 증명 생성에 더 높은 하드웨어 요구사항 |
| **사용자 경험** | 배치 포함 후 거의 즉각적인 최종성 |
| **Calldata 비용** | 개별 증명 대비 ~80% 감소 (공유 증명 오버헤드) |

## 파생물

1. **재귀 배치 업데이트** - 재귀 SNARK(예: Nova, Halo2)를 사용하여 여러 배치 증명을 연결하여 이론적으로 무제한 처리량을 구현합니다. 각 증명은 이전 배치를 검증하여 증명 체인을 생성합니다. 일정한 검증 비용으로 수천 개의 트랜잭션 처리가 가능합니다.

2. **선택적 공개 배치** - 다른 트랜잭션은 비공개로 유지하면서 감사자에게 설정 가능한 트랜잭션 하위 집합을 공개하는 배치입니다. 감사자 공개 키를 사용한 선택적 commitment 공개를 사용합니다. 기관 환경에서 규제 준수에 필수적입니다.

3. **크로스 샤드 배치** - 수평적 확장을 위해 여러 Merkle 트리에 걸친 배치 업데이트를 조정합니다. 크로스 샤드 통신 프로토콜과 샤드 간 원자적 commitment가 필요합니다. 파티션 허용 확장을 가능하게 합니다.

4. **우선순위 배치** - 더 높은 수수료로 긴급 트랜잭션을 위한 빠른 경로 배치입니다. 2계층 시스템 구현: 표준 배치(낮은 수수료, 높은 지연) 및 우선순위 배치(높은 수수료, 즉시 처리). 배치 포함 우선순위를 위한 수수료 시장.

5. **압축 배치** - 최소 L1 공간을 위해 데이터 압축(예: BLS 서명 집계, calldata 압축)과 결합합니다. 활성 슬롯에 대한 비트맵 인코딩과 같은 기법을 통해 calldata를 추가로 50-70% 줄일 수 있습니다.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

template BatchMerkleUpdate(BATCH_SIZE, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input oldRoot;
    signal input newRoot;
    signal input nullifierHashes[BATCH_SIZE];
    signal input newCommitments[BATCH_SIZE];

    // ===== Private Inputs =====
    signal input oldNotes[BATCH_SIZE][5];  // [pkX, pkY, value, tokenType, salt]
    signal input oldPaths[BATCH_SIZE][TREE_DEPTH];
    signal input oldIndices[BATCH_SIZE];
    signal input sks[BATCH_SIZE];
    signal input newNotes[BATCH_SIZE][5];
    signal input intermediateRoots[BATCH_SIZE + 1];

    // ===== Component Declarations (must be outside loops) =====
    component oldNoteHash[BATCH_SIZE];
    component ownership[BATCH_SIZE];
    component oldMerkle[BATCH_SIZE];
    component nullifier[BATCH_SIZE];
    component newNoteHash[BATCH_SIZE];
    component updateMerkle[BATCH_SIZE];

    // ===== Root Chain Validation =====
    intermediateRoots[0] === oldRoot;
    intermediateRoots[BATCH_SIZE] === newRoot;

    // ===== Process Each Transaction in Batch =====
    for (var i = 0; i < BATCH_SIZE; i++) {
        // 1. Hash old note
        oldNoteHash[i] = Poseidon(5);
        for (var j = 0; j < 5; j++) {
            oldNoteHash[i].inputs[j] <== oldNotes[i][j];
        }

        // 2. Verify ownership
        ownership[i] = ProofOfOwnershipStrict();
        ownership[i].sk <== sks[i];
        ownership[i].pkX <== oldNotes[i][0];
        ownership[i].pkY <== oldNotes[i][1];

        // 3. Verify Merkle inclusion against current intermediate root
        oldMerkle[i] = MerkleProof(TREE_DEPTH);
        oldMerkle[i].leaf <== oldNoteHash[i].out;
        oldMerkle[i].root <== intermediateRoots[i];
        for (var j = 0; j < TREE_DEPTH; j++) {
            oldMerkle[i].path[j] <== oldPaths[i][j];
        }
        oldMerkle[i].index <== oldIndices[i];

        // 4. Compute and verify nullifier
        nullifier[i] = Poseidon(2);
        nullifier[i].inputs[0] <== oldNoteHash[i].out;
        nullifier[i].inputs[1] <== sks[i];
        nullifier[i].out === nullifierHashes[i];

        // 5. Hash new note and verify commitment
        newNoteHash[i] = Poseidon(5);
        for (var j = 0; j < 5; j++) {
            newNoteHash[i].inputs[j] <== newNotes[i][j];
        }
        newNoteHash[i].out === newCommitments[i];

        // 6. Compute next intermediate root
        updateMerkle[i] = MerkleUpdate(TREE_DEPTH);
        updateMerkle[i].oldRoot <== intermediateRoots[i];
        updateMerkle[i].oldLeaf <== oldNoteHash[i].out;
        updateMerkle[i].newLeaf <== newNoteHash[i].out;
        updateMerkle[i].index <== oldIndices[i];
        for (var j = 0; j < TREE_DEPTH; j++) {
            updateMerkle[i].path[j] <== oldPaths[i][j];
        }
        updateMerkle[i].newRoot === intermediateRoots[i + 1];
    }

    // ===== Value Conservation =====
    var totalOldValue = 0;
    var totalNewValue = 0;
    for (var i = 0; i < BATCH_SIZE; i++) {
        totalOldValue += oldNotes[i][2];
        totalNewValue += newNotes[i][2];
    }
    totalOldValue === totalNewValue;
}

component main {public [oldRoot, newRoot, nullifierHashes, newCommitments]} =
    BatchMerkleUpdate(16, 20);
```

### 주요 제약조건

1. **순차적 Root 체인**: 각 중간 root는 이전 root로부터의 유효한 전환이어야 함
2. **소유권 검증**: 모든 소비된 노트는 트랜잭션 서명자가 소유해야 함
3. **Nullifier 고유성**: 컨트랙트는 소비된 집합에 대해 nullifier를 확인해야 함
4. **가치 보존**: 입력의 합은 출력의 합과 같아야 함 (생성/소멸 없음)

### 설계 참고사항: 중간 Root vs 병렬 처리

중간 root 접근 방식(순차 업데이트)은 여러 이유로 병렬 처리보다 선택되었습니다:

| 접근 방식 | 장점 | 단점 |
|----------|------|------|
| **중간 Root (현재)** | 더 간단한 회로, 결정론적 순서, 충돌 해결 불필요 | O(n) 상태 업데이트, 더 긴 증명 시간 |
| **병렬 Merkle 업데이트** | 여러 코어로 잠재적으로 더 빠른 증명 | 충돌 감지 필요, 복잡한 경로 병합, 비결정론적 순서 |
| **Sparse Merkle Tree** | O(1) 업데이트, 자연스러운 병렬성 | 더 높은 스토리지 오버헤드, 다른 증명 구조 |

BATCH_SIZE=16의 경우, 순차 접근 방식은 증명 시간에 ~10%를 추가하지만 회로를 크게 단순화하고 경쟁 조건을 제거합니다. 더 큰 배치(64+)의 경우, 충돌 해결을 사용한 병렬 접근 방식이 정당화될 수 있습니다.

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **배치 내 이중 지불** | 증명 생성 전에 배치 내에서 nullifier 고유성 확인 |
| **순서 조작** | 중간 root가 결정론적 순서를 강제; 시퀀서가 재정렬할 수 없음 |
| **불완전한 배치** | 패딩으로 부분 배치 허용 (비활성 슬롯); 경제적 실행 가능성을 위한 최소 배치 크기 |
| **증명자 검열** | 분산 증명자 네트워크; 사용자가 더 긴 타임아웃으로 자체 증명 가능 |
| **상태 Root 비동기화** | 컨트랙트가 root 저장; 증명은 현재 온체인 root를 참조해야 함 |
| **재생 공격** | Nullifier 영구 저장; 오래된 배치는 재생 불가 |
| **가치 오버플로우** | 252비트 비교 사용; 필드 산술에서 합계 검증 |

## 구현 과제

1. **중간 Root 계산**
   - 증명자는 모든 중간 Merkle root를 오프체인에서 계산해야 함
   - 전체 Merkle 트리 상태에 대한 액세스 필요
   - 증분 Merkle 트리 라이브러리 사용 고려 (예: @zk-kit/incremental-merkle-tree)

2. **배치 조정**
   - 여러 사용자의 트랜잭션을 하나의 배치로 어떻게 수집할 것인가?
   - 대기 중인 트랜잭션을 위한 Mempool 설계
   - 배치 참가자 간 수수료 분할 메커니즘

3. **증명자 하드웨어 요구사항**
   - ~800K 제약조건은 상당한 RAM 필요 (신뢰 설정을 위해 ~32GB)
   - 증명 생성 시간: 소비자 하드웨어에서 30-60초
   - GPU 가속 또는 분산 증명 고려

4. **부분 배치 처리**
   - 배치가 가득 차지 않으면? (더미/패딩 트랜잭션 사용)
   - 최소 경제적 배치 크기 vs. 지연 트레이드오프
   - 부분 배치 처리를 강제하는 타임아웃 메커니즘

5. **실패 복구**
   - 증명 생성이 실패하면 대기 중인 트랜잭션을 어떻게 복구할 것인가?
   - 업데이트된 Merkle 경로로 트랜잭션 재생 메커니즘 필요
   - 중간 상태 체크포인트 고려

## 사용 사례

1. **롤업 배치 처리**
   - L2 시퀀서가 16개의 전송을 수집하여 단일 증명 생성
   - 95% 가스 절감으로 경제적으로 마이크로 트랜잭션 가능
   - 배치 간격: 매 블록 또는 매 N초

2. **거래소 결제**
   - DEX가 주문 매칭에서 여러 거래를 배치
   - 배치의 모든 거래가 원자적으로 결제
   - MEV 추출 기회 감소

3. **급여 분배**
   - 회사가 하나의 증명으로 16명의 직원에게 급여 분배
   - 프라이버시 보존: 개별 금액 공개되지 않음
   - 16개의 별도 전송 대비 상당한 비용 절감

4. **에어드롭 분배**
   - 여러 수신자에게 토큰 분배
   - 자격 증명의 Merkle proof와 결합
   - 재귀 배치로 수천 명까지 확장

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../../future/product/high-complexity/hc1-batch-merkle-update-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
