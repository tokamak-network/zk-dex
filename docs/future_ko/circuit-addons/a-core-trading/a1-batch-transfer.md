# A1. 배치 전송 (Batch Transfer)

단일 트랜잭션에서 N-to-M 노트 전송을 수행하여 효율적인 통합, 배포 및 복잡한 지불 흐름을 가능하게 합니다.

**제약 조건**: ~500K | **복잡도**: Medium

---

## 배경

배치 전송은 개별 노트 처리의 중요한 한계를 해결합니다:

- **가스 비용 누적**: 많은 작은 노트를 가진 사용자는 개별 전송에 대해 엄청난 가스 비용을 지불해야 합니다
- **지불 처리**: 기업은 여러 수령인에게 효율적으로 지불해야 합니다 (급여, 배당금, 에어드롭)
- **노트 분산**: 거래 활동은 많은 작은 노트를 생성하여 주기적인 통합이 필요합니다
- **프라이버시 향상**: 배치 작업은 더 큰 익명성 집합을 생성하여 트랜잭션 그래프 분석을 더 어렵게 만듭니다
- **원자성 작업**: 다자간 결제는 전부 실행 또는 전부 취소 보장이 필요합니다

전통적인 금융에서 배치 처리는 ACH, 전신 송금 및 급여에 표준입니다. ZK 시스템에서는 증명당 비용이 높기 때문에 배치 처리가 더욱 중요합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `merkleRoot` | field | 현재 상태 트리 루트 |
| `inputHash[N_IN]` | field[] | 사용될 입력 노트의 해시 |
| `outputHash[N_OUT]` | field[] | 생성될 출력 노트의 해시 |
| `tokenType` | uint | 토큰 타입 (모든 노트가 일치해야 함) |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `inPkX[N_IN], inPkY[N_IN]` | field[] | 입력 노트 소유자 공개키 |
| `inValue[N_IN]` | uint[] | 입력 노트 값 |
| `inSalt[N_IN]` | field[] | 입력 노트 무작위성 |
| `inSk[N_IN]` | field[] | 소유권 증명을 위한 비밀키 |
| `inPath[N_IN][TREE_DEPTH]` | field[][] | Merkle 증명 경로 |
| `inIndex[N_IN]` | uint[] | Merkle 증명 인덱스 |
| `outPkX[N_OUT], outPkY[N_OUT]` | field[] | 출력 노트 소유자 공개키 |
| `outValue[N_OUT]` | uint[] | 출력 노트 값 |
| `outSalt[N_OUT]` | field[] | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template BatchTransfer(N_IN, N_OUT, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input merkleRoot;
    signal input inputHash[N_IN];
    signal input outputHash[N_OUT];
    signal input tokenType;

    // ===== Private Inputs =====
    signal input inPkX[N_IN], inPkY[N_IN];
    signal input inValue[N_IN], inSalt[N_IN], inSk[N_IN];
    signal input inPath[N_IN][TREE_DEPTH], inIndex[N_IN];
    signal input outPkX[N_OUT], outPkY[N_OUT];
    signal input outValue[N_OUT], outSalt[N_OUT];

    // ===== Components =====
    component inNote[N_IN];
    component inOwn[N_IN];
    component inMerkle[N_IN];
    component outNote[N_OUT];

    // ===== 1. Verify Each Input Note =====
    signal inValueSum[N_IN + 1];
    inValueSum[0] <== 0;

    for (var i = 0; i < N_IN; i++) {
        // Verify note hash
        inNote[i] = PoseidonRegularNote();
        inNote[i].pkX <== inPkX[i];
        inNote[i].pkY <== inPkY[i];
        inNote[i].value <== inValue[i];
        inNote[i].tokenType <== tokenType;
        inNote[i].salt <== inSalt[i];
        inNote[i].out === inputHash[i];

        // Verify ownership
        inOwn[i] = ProofOfOwnershipStrict();
        inOwn[i].sk <== inSk[i];
        inOwn[i].pkX <== inPkX[i];
        inOwn[i].pkY <== inPkY[i];

        // Verify Merkle inclusion
        inMerkle[i] = MerkleProof(TREE_DEPTH);
        inMerkle[i].leaf <== inputHash[i];
        inMerkle[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            inMerkle[i].path[j] <== inPath[i][j];
        }
        inMerkle[i].index <== inIndex[i];

        // Accumulate input value
        inValueSum[i + 1] <== inValueSum[i] + inValue[i];
    }

    // ===== 2. Verify Each Output Note =====
    signal outValueSum[N_OUT + 1];
    outValueSum[0] <== 0;

    for (var i = 0; i < N_OUT; i++) {
        // Verify note hash
        outNote[i] = PoseidonRegularNote();
        outNote[i].pkX <== outPkX[i];
        outNote[i].pkY <== outPkY[i];
        outNote[i].value <== outValue[i];
        outNote[i].tokenType <== tokenType;
        outNote[i].salt <== outSalt[i];
        outNote[i].out === outputHash[i];

        // Accumulate output value
        outValueSum[i + 1] <== outValueSum[i] + outValue[i];
    }

    // ===== 3. Balance Check: Total In == Total Out =====
    inValueSum[N_IN] === outValueSum[N_OUT];

    // ===== 4. Non-Zero Validation =====
    // At least one input must have non-zero value (prevents empty batch)
    signal hasValue[N_IN + 1];
    hasValue[0] <== 0;
    for (var i = 0; i < N_IN; i++) {
        component isNonZero = IsZero();
        isNonZero.in <== inValue[i];
        hasValue[i + 1] <== hasValue[i] + (1 - isNonZero.out);
    }
    component atLeastOne = GreaterThan(8);
    atLeastOne.in[0] <== hasValue[N_IN];
    atLeastOne.in[1] <== 0;
    atLeastOne.out === 1;
}

component main {public [merkleRoot, inputHash, outputHash, tokenType]} =
    BatchTransfer(8, 8, 20);
```

### 주요 제약 조건

1. **개별 노트 검증**: 각 입력 노트는 올바르게 해싱되어야 하며 Merkle 트리에 존재해야 합니다
2. **소유권 증명**: 모든 입력 노트는 각각의 비밀키로부터 유효한 소유권 증명이 필요합니다
3. **잔액 보존**: 입력 값의 합계는 출력 값의 합계와 정확히 같아야 합니다
4. **토큰 동질성**: 배치의 모든 노트는 동일한 토큰 타입이어야 합니다
5. **비어있지 않은 배치**: 최소 하나의 입력이 0이 아닌 값을 가져야 합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **가스 효율성** | 개별 전송 대비 60-80% 절감 |
| **프라이버시** | 여러 입력/출력으로부터 더 큰 익명성 집합 |
| **UX** | 복잡한 지불 흐름에 대한 단일 트랜잭션 |
| **원자성** | 전부 실행 또는 전부 취소 실행이 부분 실패를 방지 |
| **노트 관리** | 효율적인 통합 및 배포 가능 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **이중 지불** | 각 입력 노트 해시는 고유한 무효화자를 생성합니다; 컨트랙트는 사용된 무효화자를 추적합니다 |
| **잔액 조작** | 회로는 엄격한 입출력 잔액 동등성을 강제합니다 |
| **프론트러닝** | 노트 해시는 금액을 숨깁니다; 관찰자는 수익성 있는 재정렬을 결정할 수 없습니다 |
| **재생 공격** | 무효화자가 특정 노트에 연결되어 재생을 방지합니다 |
| **Merkle 루트 오래됨** | 컨트랙트는 merkleRoot가 현재 상태인지 검증합니다 |
| **소유자 위장** | BabyJubJub 서명 검증은 소유자만이 사용할 수 있음을 보장합니다 |

## 구현 과제

1. **증명 생성 시간**
   - 큰 배치 (8x8)는 상당한 계산이 필요합니다
   - 매우 큰 배치의 경우 클라이언트 측 청킹을 고려하십시오
   - WebAssembly witness 생성은 10-30초가 걸릴 수 있습니다

2. **Merkle 증명 집계**
   - 여러 Merkle 증명은 회로 크기를 선형적으로 증가시킵니다
   - 공통 하위 트리에 대한 증명 배치 전략을 고려하십시오
   - 자주 액세스하는 노트에 대한 공통 경로를 사전 계산하십시오

3. **동적 배치 크기 조정**
   - 고정된 N_IN/N_OUT은 작은 배치에 대해 패딩이 필요합니다
   - 유연성을 위해 여러 회로 크기 (2x2, 4x4, 8x8)를 배포하십시오
   - 패딩으로 사용되는 0 값 노트는 잔액에 영향을 주지 않아야 합니다

4. **가스 한계 제약**
   - 큰 배치는 블록 가스 한계에 접근할 수 있습니다
   - 증명 검증 ~200K 가스 + 무효화자당 ~20K
   - 현재 네트워크에서 최대 실용적인 배치 크기 ~16x16

5. **상태 동기화**
   - Merkle 루트는 증명 생성 중에 유효하게 유지되어야 합니다
   - 제출 시 루트 검증을 통한 낙관적 증명 생성을 고려하십시오
   - 오래된 루트 거부를 위한 재시도 로직을 구현하십시오

## 파생 상품

1. **배치 급여 시스템** - 고용주가 단일 트랜잭션으로 여러 직원에게 급여를 배포합니다. 고용주 서명, 지불 일정 커밋먼트 및 직원 공개키 레지스트리로 회로가 확장됩니다. 금액과 수령인이 관찰자로부터 숨겨진 프라이빗 급여를 가능하게 합니다.

2. **노트 조각 모음 서비스** - 작은 노트를 더 큰 단위로 자동 통합합니다. 백그라운드 프로세스가 사용자의 노트 인벤토리를 모니터링하고 가스가 저렴할 때 최적의 통합 배치를 생성합니다. 향후 트랜잭션 효율성을 개선하고 장기 저장 비용을 줄입니다.

3. **프라이빗 크라우드펀딩** - 여러 기여자가 개별 금액을 공개하지 않고 단일 수령인에게 보냅니다. 기여 커밋먼트 해시, 펀딩 목표 임계값 및 목표 미달성 시 환불 메커니즘으로 확장됩니다. 기여자는 프로젝트 생성자에게도 익명으로 남습니다.

4. **크로스체인 배치 브리지** - 단일 증명으로 여러 노트를 다른 체인으로 브리징하기 위해 배치합니다. 대상 체인 식별자, 브리지 컨트랙트 주소 및 도전 기간을 위한 타임락을 포함합니다. 노트당 브리징 오버헤드를 90% 줄입니다.

5. **MEV 저항 다중 전송** - 샌드위치 공격을 방지하는 암호화된 라우팅이 있는 배치 전송. 실행 순서, 최소 허용 가능한 비율 및 타임아웃 조건에 대한 커밋먼트를 포함합니다. 탐색자는 배치 내용에서 가치를 추출할 수 없습니다.

## 사용 사례

1. **기업 급여**
   - 50명의 직원을 가진 회사가 월간 급여 배포가 필요합니다
   - 단일 배치 전송이 모든 급여를 원자적으로 보냅니다
   - 직원은 회사의 총 급여를 공개하지 않고 자금을 받습니다
   - 한 직원에 대한 실패한 지불은 다른 직원에게 영향을 미치지 않습니다 (배치가 성공하거나 완전히 실패합니다)

2. **트레이딩 봇 통합**
   - 차익거래 봇이 거래로부터 수백 개의 작은 노트를 축적합니다
   - 주간 통합이 관리 가능한 노트 크기로 결합합니다
   - 향후 트랜잭션 비용과 증명 생성 시간을 줄입니다
   - 거래 빈도와 볼륨을 모호하게 하여 프라이버시를 유지합니다

3. **DAO 재무 배포**
   - 거버넌스 제안이 10개의 다른 프로젝트에 대한 보조금을 승인합니다
   - 단일 배치 전송이 모든 보조금을 원자적으로 실행합니다
   - 각 수령인은 제안에 따라 다른 금액을 받습니다
   - 온체인 관찰자는 배치를 보지만 개별 할당을 결정할 수 없습니다

4. **에어드롭 배포**
   - 프로토콜이 적격 주소에 토큰을 배포합니다
   - Merkle 기반 자격과 배치 전송이 결합됩니다
   - 수령인은 배치로 청구하여 총 가스 비용을 줄입니다
   - 배포 금액은 청구될 때까지 프라이빗으로 유지됩니다

## 실제 제품 및 사용자 경험

전용 제품 문서 참조: [제품 응용](../../../product/a-core-trading/a1-batch-transfer-products.md)

---

[인덱스로 돌아가기](../../README.md)
