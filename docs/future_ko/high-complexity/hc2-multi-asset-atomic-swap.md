# HC2. 다중 자산 원자적 스왑

여러 당사자 간에 여러 다른 자산을 원자적으로 교환합니다.

**제약조건**: ~600K | **복잡도**: 높음

---

## 배경

현재 DEX 시스템은 복잡한 거래 시나리오에서 한계에 직면합니다:
- 양자 간 스왑은 다자간 거래를 효율적으로 처리할 수 없음
- 순차적 스왑은 MEV 추출 기회를 생성
- 자산 간 차익거래는 여러 트랜잭션이 필요
- 순차적 작업 간에 결제 위험이 존재

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 순차적 스왑 | 트랜잭션 간 MEV 샌드위치 공격; 상대방 위험 |
| AMM 라우팅 | 홉에 걸쳐 슬리피지 복합; 비영구적 손실 노출 |
| 주문서 매칭 | 각 쌍에 유동성 필요; 희소 주문서 |
| OTC 데스크 | 신뢰할 수 있는 중개자; 높은 최소 규모; 느린 결제 |

다중 자산 원자적 스왑은 Alice가 B를 원하고, Bob이 C를 원하고, Charlie가 A를 원하는 "욕구의 일치" 문제를 해결합니다 - 모두 중개자 없이 원자적으로 거래할 수 있습니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inputHashes` | field[N_PARTIES][N_ASSETS] | 각 당사자가 제공하는 노트 |
| `outputHashes` | field[N_PARTIES][N_ASSETS] | 각 당사자가 받는 노트 |
| `swapConfigHash` | field | 스왑 구성 매트릭스에 대한 commitment |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inPkX/Y, inValue, inToken, inSalt` | field 배열 | 당사자별 자산별 입력 노트 세부 정보 |
| `inSk` | field[N_PARTIES] | 소유권 증명을 위한 비밀 키 |
| `inIsActive` | bool[N_PARTIES][N_ASSETS] | 어느 입력 슬롯이 활성인지 |
| `outPkX/Y, outValue, outToken, outSalt` | field 배열 | 출력 노트 세부 정보 |
| `outIsActive` | bool[N_PARTIES][N_ASSETS] | 어느 출력 슬롯이 활성인지 |
| `swapMatrix` | uint[N_PARTIES][N_PARTIES][N_ASSETS] | 누가 무엇을 누구에게 주는지 |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **자본 효율성** | 순차적 스왑 간 자금 잠김 없음 |
| **MEV 보호** | 전체 다자 스왑이 원자적, 샌드위치 공격 없음 |
| **결제 위험** | 상대방 위험 제로 - 전체 또는 무 실행 |
| **유동성** | 이전에는 비실용적이었던 복잡한 거래 가능 |
| **프라이버시** | 스왑 구성 해시만 공개 |
| **Gas 비용** | N*M 개별 스왑 대비 단일 증명 (~300K gas) |

## 파생물

1. **링 스왑** - 순환 스왑의 N개 당사자 (A->B->C->...->A). 각 당사자는 하나의 자산 유형을 주고 다른 것을 받습니다. 스왑 매트릭스를 단일 사이클로 단순화합니다. 외환 및 상품 시장에서 일반적입니다.

2. **조건부 다중 스왑** - 오라클 조건이 충족되는 경우에만 스왑 실행 (예: ETH 가격 > $2000). 회로에 가격 오라클 검증을 통합합니다. 복잡한 거래 전략을 가능하게 합니다.

3. **부분 체결 다중 스왑** - 우선순위 순서로 부분 실행을 허용합니다. 전체 스왑이 불가능한 경우 최대 가능한 하위 집합을 실행합니다. 체결 우선순위 규칙 및 비례 분배 로직이 필요합니다.

4. **만료 다중 스왑** - 시간 제한이 있는 스왑으로 자동 환불. 타임스탬프 확인 포함; 만료 후 누구나 환불 증명을 트리거할 수 있습니다. 시간에 민감한 거래에 필수적입니다.

5. **크로스체인 다중 스왑** - HTLC(Hash Time-Locked Contract)를 사용하여 여러 체인으로 확장합니다. 체인 간 해시 프리이미지 공개가 필요합니다. 크로스체인 노트 검증을 위한 브리지 통합.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";

template MultiAssetAtomicSwap(N_PARTIES, N_ASSETS) {
    // ===== Public Inputs =====
    signal input inputHashes[N_PARTIES][N_ASSETS];
    signal input outputHashes[N_PARTIES][N_ASSETS];
    signal input swapConfigHash;

    // ===== Private Inputs =====
    signal input inPkX[N_PARTIES][N_ASSETS];
    signal input inPkY[N_PARTIES][N_ASSETS];
    signal input inValue[N_PARTIES][N_ASSETS];
    signal input inToken[N_PARTIES][N_ASSETS];
    signal input inSalt[N_PARTIES][N_ASSETS];
    signal input inSk[N_PARTIES];
    signal input inIsActive[N_PARTIES][N_ASSETS];

    signal input outPkX[N_PARTIES][N_ASSETS];
    signal input outPkY[N_PARTIES][N_ASSETS];
    signal input outValue[N_PARTIES][N_ASSETS];
    signal input outToken[N_PARTIES][N_ASSETS];
    signal input outSalt[N_PARTIES][N_ASSETS];
    signal input outIsActive[N_PARTIES][N_ASSETS];

    signal input swapMatrix[N_PARTIES][N_PARTIES][N_ASSETS];

    // ===== Component Declarations =====
    component partyOwnership[N_PARTIES];
    component inNote[N_PARTIES][N_ASSETS];
    component outNote[N_PARTIES][N_ASSETS];
    component configHash;

    // ===== Verify Input Notes =====
    for (var p = 0; p < N_PARTIES; p++) {
        // Verify party's ownership once (using first active note's pk)
        partyOwnership[p] = ProofOfOwnershipStrict();
        partyOwnership[p].sk <== inSk[p];
        partyOwnership[p].pkX <== inPkX[p][0];
        partyOwnership[p].pkY <== inPkY[p][0];

        for (var a = 0; a < N_ASSETS; a++) {
            // Verify input note hash
            inNote[p][a] = PoseidonRegularNote();
            inNote[p][a].pkX <== inPkX[p][a];
            inNote[p][a].pkY <== inPkY[p][a];
            inNote[p][a].value <== inValue[p][a];
            inNote[p][a].tokenType <== inToken[p][a];
            inNote[p][a].salt <== inSalt[p][a];

            // Hash must match if active
            (inNote[p][a].out - inputHashes[p][a]) * inIsActive[p][a] === 0;

            // All active inputs must belong to same party
            (inPkX[p][a] - inPkX[p][0]) * inIsActive[p][a] === 0;
            (inPkY[p][a] - inPkY[p][0]) * inIsActive[p][a] === 0;
        }
    }

    // ===== Verify Output Notes =====
    for (var p = 0; p < N_PARTIES; p++) {
        for (var a = 0; a < N_ASSETS; a++) {
            outNote[p][a] = PoseidonRegularNote();
            outNote[p][a].pkX <== outPkX[p][a];
            outNote[p][a].pkY <== outPkY[p][a];
            outNote[p][a].value <== outValue[p][a];
            outNote[p][a].tokenType <== outToken[p][a];
            outNote[p][a].salt <== outSalt[p][a];

            (outNote[p][a].out - outputHashes[p][a]) * outIsActive[p][a] === 0;
        }
    }

    // ===== Verify Value Conservation per Asset =====
    for (var a = 0; a < N_ASSETS; a++) {
        var totalIn = 0;
        var totalOut = 0;
        for (var p = 0; p < N_PARTIES; p++) {
            totalIn += inValue[p][a] * inIsActive[p][a];
            totalOut += outValue[p][a] * outIsActive[p][a];
        }
        totalIn === totalOut;
    }

    // ===== Verify Swap Configuration =====
    for (var receiver = 0; receiver < N_PARTIES; receiver++) {
        for (var a = 0; a < N_ASSETS; a++) {
            var expectedValue = 0;
            for (var sender = 0; sender < N_PARTIES; sender++) {
                expectedValue += swapMatrix[sender][receiver][a];
            }
            outValue[receiver][a] * outIsActive[receiver][a] === expectedValue;
        }
    }

    // ===== Verify Swap Config Commitment =====
    configHash = Poseidon(N_PARTIES * N_PARTIES * N_ASSETS);
    var idx = 0;
    for (var i = 0; i < N_PARTIES; i++) {
        for (var j = 0; j < N_PARTIES; j++) {
            for (var a = 0; a < N_ASSETS; a++) {
                configHash.inputs[idx] <== swapMatrix[i][j][a];
                idx++;
            }
        }
    }
    configHash.out === swapConfigHash;
}

component main {public [inputHashes, outputHashes, swapConfigHash]} =
    MultiAssetAtomicSwap(4, 5);  // 4 parties, 5 asset types
```

### 주요 제약조건

1. **소유권 검증**: 각 당사자는 모든 입력 노트의 소유권을 증명함
2. **자산별 보존**: 각 자산 유형에 대해 총 입력은 총 출력과 같음
3. **스왑 매트릭스 준수**: 출력 값은 스왑 매트릭스에서 예상 수령과 일치
4. **구성 바인딩**: 스왑 매트릭스 해시는 commitment 후 변경을 방지

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **당사자 사칭** | 각 당사자는 비밀 키로 소유권을 증명해야 함 |
| **스왑 매트릭스 변조** | 실행 전에 온체인에 구성 해시 커밋됨 |
| **부분 실행** | 전체 또는 무 원자적 실행; 부분 상태 없음 |
| **선행 거래** | 스왑 구성 해시가 실행까지 금액을 숨김 |
| **재생 공격** | 입력 노트가 소비됨 (nullify됨); 재사용 불가 |
| **당사자 간 담합** | 회로는 합의된 조건만 강제; 오프체인 조정 필요 |
| **더스트 공격** | 자산 유형당 최소 가치 임계값 |

## 구현 과제

1. **다자 조정**
   - 모든 당사자가 오프체인에서 스왑 조건에 동의해야 함
   - 각 당사자는 증명자에게 비밀 키 자료를 제공해야 함
   - 키 공유 없이 분산 증명을 위한 MPC(Multi-Party Computation) 고려

2. **스왑 발견**
   - 호환되는 욕구를 가진 N개의 당사자가 어떻게 서로를 찾는가?
   - 의도 기반 매칭 엔진 필요
   - 그래프 기반 "욕구" 매칭 알고리즘 (욕구 그래프에서 사이클 찾기)

3. **타임아웃 및 취소**
   - 증명 생성 전에 한 당사자가 오프라인되면?
   - 잠긴 의도를 해제하는 타임아웃 메커니즘 필요
   - 스왑이 완료될 수 없는 경우 부분 환불 로직

4. **제약조건 폭발**
   - N_PARTIES * N_ASSETS^2은 잘 확장되지 않음
   - 4개 당사자, 5개 자산의 경우: 4*5*5 = 100개의 스왑 매트릭스 항목
   - 효율성을 위한 희소 매트릭스 표현 고려

5. **대규모 스왑의 Gas 비용**
   - Public input은 당사자 및 자산과 함께 증가
   - calldata: 32 * (N_PARTIES * N_ASSETS * 2 + 1) 바이트
   - 매우 큰 스왑의 경우 입력 집계 필요할 수 있음

## 사용 사례

1. **DEX 다자간 거래**
   - Alice가 Bob에게 ETH를 주고, Bob이 Charlie에게 DAI를 주고, Charlie가 Alice에게 USDC를 줌
   - 중간 노출 없이 모두 원자적으로 결제
   - 순차적 스왑 MEV 추출 제거

2. **OTC 데스크 대체**
   - 기관 당사자가 신뢰할 수 있는 중개자 없이 대규모 블록을 거래
   - 전통적인 T+2 대비 몇 초 만에 결제
   - 상대방 신용 위험 없음

3. **포트폴리오 스왑**
   - 펀드 매니저 간 리밸런싱
   - 매니저 A가 기술주를 상품과 교환하며 매니저 B와 거래
   - 단일 원자적 작업에서 여러 자산 유형

4. **크로스 마진 결제**
   - 여러 무기한 계약에 걸쳐 포지션 닫기
   - 순 결제로 자본 요구사항 감소
   - 부분 청산을 방지하는 원자적

5. **삼각 차익거래**
   - 세 쌍에 걸친 가격 불일치 악용
   - 세 다리를 모두 원자적으로 실행
   - 모든 다리가 성공하는 경우에만 이익 실현

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../product/high-complexity/hc2-multi-asset-atomic-swap-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
