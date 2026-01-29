# C1. Ring Signature Spend

링 서명을 통해 실제 지출자를 여러 디코이 노트 사이에 숨기고, 키 이미지 이중 지출 방지와 함께 트랜잭션 그래프의 연결 불가능성을 제공합니다.

**제약 조건**: ~600K (8 링 크기) | **복잡도**: 높음

---

## 배경

링 서명은 블록체인 트랜잭션의 근본적인 프라이버시 한계를 해결합니다:

- **트랜잭션 그래프 분석**: ZK 증명을 사용하더라도 일관된 송신자 패턴은 시간이 지나면서 신원을 드러냅니다
- **주소 클러스터링**: 온체인 분석가들은 공통 입력/출력을 통해 트랜잭션을 연결할 수 있습니다
- **Monero 선례**: 링 서명은 2014년 이후 프로덕션 프라이버시 시스템에서 효과적임이 입증되었습니다
- **키 이미지 혁신**: 어떤 노트가 실제로 지출되었는지 드러내지 않으면서 이중 지출을 방지합니다
- **익명성 집합 확장**: 더 큰 링은 기하급수적으로 더 나은 프라이버시 보장을 제공합니다

전통적인 ZK 시스템에서는 증명으로부터 지출자가 결정론적으로 결정됩니다. 링 서명은 어떤 것인지 드러내지 않으면서 여러 노트 중 하나의 소유권을 증명함으로써 합리적 부인 가능성을 도입합니다. 키 이미지 메커니즘은 각 노트가 모든 가능한 링 구성에 걸쳐 한 번만 지출될 수 있도록 보장합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `merkleRoot` | field | 노트 커밋먼트 트리의 루트 |
| `decoyHashes[RING_SIZE]` | field[] | 후보 노트 해시의 링 |
| `outputHash` | field | 출력 노트의 해시 |
| `tokenType` | uint | 지출되는 토큰 타입 |
| `keyImage` | field | 이중 지출을 방지하는 고유 이미지 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `realIndex` | uint | 링 내 실제 노트의 인덱스 (숨겨짐) |
| `pkX[RING_SIZE], pkY[RING_SIZE]` | field[] | 모든 링 멤버의 공개키 |
| `value[RING_SIZE]` | uint[] | 모든 링 멤버의 값 |
| `salt[RING_SIZE]` | field[] | 모든 링 멤버의 솔트 |
| `sk` | field | 실제 노트만의 비밀키 |
| `merklePath[RING_SIZE][TREE_DEPTH]` | field[][] | 각 링 멤버의 Merkle 증명 |
| `merkleIndex[RING_SIZE]` | uint[] | Merkle 트리 위치 |
| `outPkX, outPkY` | field | 출력 노트 소유자 공개키 |
| `outValue` | uint | 출력 노트 값 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/baby_jub_jub.circom";
include "../utils/babyjubjub/scalar_mul.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";
include "../utils/mux1.circom";

template ComputeKeyImage() {
    signal input sk;
    signal input pkX, pkY;
    signal output outX, outY;

    // Hash public key to curve point
    component hashToCurve = HashToCurve();
    hashToCurve.inX <== pkX;
    hashToCurve.inY <== pkY;

    // Key image = sk * H(pk)
    component scalarMul = BabyJubJubScalarMul();
    scalarMul.scalar <== sk;
    scalarMul.pointX <== hashToCurve.outX;
    scalarMul.pointY <== hashToCurve.outY;

    outX <== scalarMul.outX;
    outY <== scalarMul.outY;
}

template RingSpend(RING_SIZE, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input merkleRoot;
    signal input decoyHashes[RING_SIZE];
    signal input outputHash;
    signal input tokenType;
    signal input keyImageX, keyImageY;

    // ===== Private Inputs =====
    signal input realIndex;
    signal input pkX[RING_SIZE], pkY[RING_SIZE];
    signal input value[RING_SIZE], salt[RING_SIZE];
    signal input sk;
    signal input merklePath[RING_SIZE][TREE_DEPTH];
    signal input merkleIndex[RING_SIZE];
    signal input outPkX, outPkY, outValue, outSalt;

    // ===== 1. Verify All Notes Exist in Tree =====
    component note[RING_SIZE];
    component merkle[RING_SIZE];

    for (var i = 0; i < RING_SIZE; i++) {
        note[i] = PoseidonRegularNote();
        note[i].pkX <== pkX[i];
        note[i].pkY <== pkY[i];
        note[i].value <== value[i];
        note[i].tokenType <== tokenType;
        note[i].salt <== salt[i];
        note[i].out === decoyHashes[i];

        merkle[i] = MerkleProof(TREE_DEPTH);
        merkle[i].leaf <== decoyHashes[i];
        merkle[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkle[i].path[j] <== merklePath[i][j];
        }
        merkle[i].index <== merkleIndex[i];
    }

    // ===== 2. Verify realIndex is Valid =====
    component indexCheck = LessThan(8);
    indexCheck.in[0] <== realIndex;
    indexCheck.in[1] <== RING_SIZE;
    indexCheck.out === 1;

    // ===== 3. Compute Real Public Key from Secret Key =====
    component realPk = BabyJubJubScalarMulBase();
    realPk.scalar <== sk;

    // ===== 4. Verify sk Matches pk at realIndex =====
    component isReal[RING_SIZE];
    component eqCheck[RING_SIZE];
    signal matchX[RING_SIZE], matchY[RING_SIZE];

    for (var i = 0; i < RING_SIZE; i++) {
        isReal[i] = IsEqual();
        isReal[i].in[0] <== i;
        isReal[i].in[1] <== realIndex;

        matchX[i] <== (realPk.outX - pkX[i]) * isReal[i].out;
        matchY[i] <== (realPk.outY - pkY[i]) * isReal[i].out;
        matchX[i] === 0;
        matchY[i] === 0;
    }

    // ===== 5. Select Real Note Value Using Multiplexer =====
    component valueMux = MultiMux1(RING_SIZE);
    for (var i = 0; i < RING_SIZE; i++) {
        valueMux.c[i] <== value[i];
    }
    valueMux.s <== realIndex;
    signal realValue <== valueMux.out;

    // ===== 6. Compute and Verify Key Image =====
    component pkMuxX = MultiMux1(RING_SIZE);
    component pkMuxY = MultiMux1(RING_SIZE);
    for (var i = 0; i < RING_SIZE; i++) {
        pkMuxX.c[i] <== pkX[i];
        pkMuxY.c[i] <== pkY[i];
    }
    pkMuxX.s <== realIndex;
    pkMuxY.s <== realIndex;

    component keyImg = ComputeKeyImage();
    keyImg.sk <== sk;
    keyImg.pkX <== pkMuxX.out;
    keyImg.pkY <== pkMuxY.out;
    keyImg.outX === keyImageX;
    keyImg.outY === keyImageY;

    // ===== 7. Create Output Note with Real Value =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== realValue;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;

    // ===== 8. Verify Value Conservation =====
    outValue === realValue;
}

component main {public [merkleRoot, decoyHashes, outputHash, tokenType, keyImageX, keyImageY]} =
    RingSpend(8, 20);
```

### 주요 제약 조건

1. **링 멤버십**: 모든 디코이 노트가 Merkle 트리에 존재해야 합니다
2. **소유권 증명**: 비밀키가 링 내 하나의 공개키로 유도되어야 합니다
3. **키 이미지 고유성**: 키 이미지가 sk와 pk로부터 결정론적으로 유도됩니다
4. **값 보존**: 출력 값이 실제 입력 값과 같아야 합니다
5. **인덱스 은닉**: realIndex는 절대 드러나지 않으며, 조건부 로직에서만 사용됩니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **익명성 집합** | 지출자가 RING_SIZE 후보 중에 숨겨집니다 |
| **이중 지출 방지** | 온체인 키 이미지 추적으로 재사용을 방지합니다 |
| **트랜잭션 그래프** | 송신자의 완전한 연결 불가능성 |
| **증명 크기** | 더 큰 증명 (~2KB vs 표준 1KB) |
| **검증 비용** | ~400K 가스 (링 크기에 따라 확장) |
| **디코이 선택** | 효과적인 익명성에 중요합니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **디코이 선택 공격** | 결정론적이고 균일한 디코이 선택 알고리즘 사용 |
| **키 이미지 충돌** | 해시 함수 충돌 저항성 (Poseidon) |
| **타이밍 분석** | 증명 생성 시간 무작위화 |
| **링 재사용 패턴** | 동일한 디코이를 반복적으로 사용하지 않기 |
| **작은 익명성 집합** | 최소 링 크기 강제 (예: 8) |
| **Sybil 디코이** | 디코이가 다양한 시간대의 것이어야 합니다 |
| **통계 분석** | 디코이가 실제 노트 특성과 일치해야 합니다 |

## 구현 과제

1. **디코이 선택 알고리즘**
   - 검증을 위해 결정론적이어야 하지만 무작위로 보여야 합니다
   - 명백한 디코이를 피하기 위해 최근 활성 노트에서 선택해야 합니다
   - 타이밍 공격을 방지하기 위해 연령 가중 선택을 고려합니다

2. **키 이미지 저장**
   - 모든 지출된 키 이미지의 온체인 매핑이 필요합니다
   - 저장소는 트랜잭션과 선형적으로 증가합니다
   - 효율적인 멤버십 검사를 위해 Merkle 트리를 고려합니다

3. **링 크기 트레이드오프**
   - 더 큰 링: 더 나은 프라이버시, 더 높은 비용
   - 더 작은 링: 더 저렴, 익명성 감소
   - 풀 활동에 따른 동적 크기 조정

4. **디코이 노트 데이터 가용성**
   - 증명자는 모든 링 멤버의 전체 노트 데이터가 필요합니다
   - 암호화된 노트 레지스트리 또는 뷰 키 시스템을 고려합니다
   - 추가 인프라가 필요할 수 있습니다

5. **교차 토큰 링**
   - 현재 설계는 동일한 토큰 타입을 요구합니다
   - 다중 토큰 링은 복잡성을 증가시킵니다
   - 토큰 타입 매칭은 사용 가능한 디코이를 줄입니다

## 파생물

1. **연결 가능한 링 서명** - 동일한 사용자가 여러 링 지출이 신원을 드러내지 않으면서 동일한 신원에서 온 것임을 증명할 수 있습니다. 일관성이 중요하지만 익명성이 유지되는 평판 시스템에 유용합니다. 실제 서명자만이 유도할 수 있는 연결 가능성 태그를 추가합니다.

2. **다층 링** - 각 링 멤버가 그 자체로 링인 중첩 링 서명으로, 기하급수적인 익명성 증가를 제공합니다. 4x4 다층 링은 8개의 노트 검증만으로 16명의 가능한 지출자를 제공합니다.

3. **동적 링 선택** - 노트 특성(값, 연령, 활동 패턴)의 온체인 분석을 기반으로 자동 디코이 선택. 통계적 구별 불가능성을 보장하고 명백한 디코이 탐지를 방지합니다.

4. **임계값 링 서명** - 지출을 위해 k-of-n 링 멤버의 협력을 요구하여, 링 익명성을 유지하면서 다중 서명 기능을 활성화합니다. 참가자 신원이 숨겨진 공동 보관에 유용합니다.

5. **교차 풀 링 서명** - 다른 프라이버시 풀 또는 심지어 다른 체인의 노트를 단일 링으로 결합합니다. 더 큰 후보 풀에서 선택하여 익명성 집합을 극적으로 증가시킵니다.

## 사용 사례

1. **고래 트랜잭션 프라이버시**
   - 대규모 보유자가 시장 영향 없이 이체하고자 합니다
   - 링 서명이 어떤 큰 잔액이 이동하는지 숨깁니다
   - 선행 거래와 시장 조작을 방지합니다

2. **급여 지급 프라이버시**
   - 고용주가 같은 지갑에서 여러 직원에게 지급합니다
   - 링 서명이 어떤 지급이 어떤 직원에게 속하는지 숨깁니다
   - 체인 분석을 통한 급여 공개를 방지합니다

3. **DAO 재무 운영**
   - DAO가 투표 패턴을 드러내지 않고 자금을 이동합니다
   - 기여자가 보유 자산에 대한 프라이버시를 유지합니다
   - 대규모 이해관계자에 대한 표적 공격을 방지합니다

4. **내부고발자 보호**
   - 언론인이 민감한 정보에 대한 대가를 받습니다
   - 링 서명이 디코이 사이에 실제 지급을 숨깁니다
   - 암호화 익명성을 통한 출처 보호

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Ring Signature Spend - Products & UX](../../product/c-privacy/c1-ring-signature-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
