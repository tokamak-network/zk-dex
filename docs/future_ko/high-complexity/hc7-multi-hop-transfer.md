# HC7. 다중 홉 프라이빗 전송

누구도 전체 경로를 볼 수 없도록 여러 중개자를 통해 지불을 라우팅합니다.

**제약조건**: ~400K | **복잡도**: 높음

---

## 배경

프라이빗 지불 네트워크는 트레이드오프에 직면합니다:
- Lightning Network는 전체 경로를 송신자에게 공개
- Onion 라우팅은 여전히 온라인 중개자가 필요
- 프라이버시는 종종 신뢰할 수 있는 중계자가 필요
- 경로 수수료는 예측할 수 없음

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| Lightning Network | 송신자가 전체 경로를 알고 있음; 중개자가 금액을 볼 수 있음 |
| Tornado Cash | 단일 홉만; 라우팅 기능 없음 |
| zkSync 전송 | 직접만; 다중 홉 프라이버시 없음 |
| 전통적인 onion 라우팅 | 온라인 노드가 필요; 타이밍 공격 가능 |

다중 홉 프라이빗 전송은 암호화 경로 프라이버시로 신뢰 없는 지불 라우팅을 가능하게 합니다. ZK 증명은 경로 세부 정보를 공개하지 않고 올바른 라우팅을 보장합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sourceNoteHash` | field | 소스 지불 노트에 대한 commitment |
| `destNoteHash` | field | 목적지 수신 노트에 대한 commitment |
| `routeCommitment` | field | 전체 경로의 해시 (감사용) |
| `totalFees` | uint | 중개자에게 지불된 총 수수료 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sourcePkX/Y, sourceSk` | field | 송신자 자격 증명 |
| `sourceValue, sourceToken, sourceSalt` | field | 소스 노트 세부 정보 |
| `hopPkX/Y, hopValue, hopSalt, hopFee` | 배열 | 중간 홉 세부 정보 |
| `destPkX/Y, destValue, destSalt` | field | 수신자 세부 정보 |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **경로 프라이버시** | 단일 엔티티가 전체 경로를 알지 못함 |
| **신뢰 불필요** | 신뢰할 수 있는 중계자가 필요 없음 |
| **원자성** | 모든 홉이 성공하거나 모두 실패 |
| **수수료 투명성** | 경로 생성 시 수수료 고정됨 |
| **오프라인 지원** | 증명 중에 중개자가 오프라인일 수 있음 |
| **MEV 저항** | 경로가 관찰자로부터 숨겨짐 |

## 파생물

1. **다중 경로 라우팅** - 더 나은 프라이버시와 유동성을 위해 여러 경로에 걸쳐 지불을 분할합니다. 각 경로가 총액의 일부를 전달합니다. 수신자가 집계합니다. 한 경로가 실패하면 중복성을 추가합니다.

2. **확률적 라우팅** - 최대 프라이버시를 위한 무작위 경로 선택. 여러 유효한 경로; 증명자가 무작위로 선택합니다. 지불 전반에 걸친 패턴 분석을 방지합니다.

3. **Onion 라우팅 홉** - 레이어드 암호화를 사용하여 각 홉이 이전/다음만 알고 있습니다. 중첩 암호화 스킴이 필요합니다. 진정한 소스와 목적지가 중개자로부터 숨겨집니다.

4. **리밸런싱 홉** - 지불 경로가 채널 리밸런싱을 겸합니다. 중개자가 전략적으로 잔액을 얻거나 잃습니다. 최적 경로 선택을 인센티브화합니다.

5. **조건부 홉** - 조건이 충족되는 경우에만 홉이 실행됩니다 (예: 가격 오라클). 복잡한 지불 조건을 가능하게 합니다. 크로스체인 원자적 스왑이 가능합니다.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template MultiHopTransfer(N_HOPS) {
    // ===== Public Inputs =====
    signal input sourceNoteHash;
    signal input destNoteHash;
    signal input routeCommitment;
    signal input totalFees;

    // ===== Private Inputs =====
    signal input sourcePkX, sourcePkY, sourceSk;
    signal input sourceValue, sourceToken, sourceSalt;

    signal input hopPkX[N_HOPS], hopPkY[N_HOPS];
    signal input hopInValue[N_HOPS];   // Value received at each hop
    signal input hopOutValue[N_HOPS];  // Value forwarded (after fee)
    signal input hopSalt[N_HOPS];
    signal input hopFee[N_HOPS];
    signal input hopIsActive[N_HOPS];  // Support variable hop count

    signal input destPkX, destPkY;
    signal input destValue, destSalt;

    // ===== Component Declarations =====
    component sourceNote;
    component sourceOwnership;
    component hopInNote[N_HOPS];
    component hopOutNote[N_HOPS];
    component feeCheck[N_HOPS];
    component destNote;
    component routeHash;

    // ===== Verify Source Note =====
    sourceNote = PoseidonRegularNote();
    sourceNote.pkX <== sourcePkX;
    sourceNote.pkY <== sourcePkY;
    sourceNote.value <== sourceValue;
    sourceNote.tokenType <== sourceToken;
    sourceNote.salt <== sourceSalt;
    sourceNote.out === sourceNoteHash;

    // Source ownership proof
    sourceOwnership = ProofOfOwnershipStrict();
    sourceOwnership.sk <== sourceSk;
    sourceOwnership.pkX <== sourcePkX;
    sourceOwnership.pkY <== sourcePkY;

    // ===== Verify Hop Chain =====
    // First hop receives from source
    signal prevOutValue[N_HOPS + 1];
    prevOutValue[0] <== sourceValue;

    for (var i = 0; i < N_HOPS; i++) {
        // Hop receives value from previous
        hopInValue[i] * hopIsActive[i] === prevOutValue[i] * hopIsActive[i];

        // Fee deduction: outValue = inValue - fee
        feeCheck[i] = LessThan(64);
        feeCheck[i].in[0] <== hopFee[i];
        feeCheck[i].in[1] <== hopInValue[i] + 1;  // Fee cannot exceed input
        feeCheck[i].out * hopIsActive[i] === hopIsActive[i];

        hopOutValue[i] === hopInValue[i] - hopFee[i];

        // Create intermediate notes (for each hop's ownership)
        hopInNote[i] = PoseidonRegularNote();
        hopInNote[i].pkX <== hopPkX[i];
        hopInNote[i].pkY <== hopPkY[i];
        hopInNote[i].value <== hopInValue[i];
        hopInNote[i].tokenType <== sourceToken;
        hopInNote[i].salt <== hopSalt[i];

        // Pass value to next hop
        prevOutValue[i + 1] <== hopOutValue[i];
    }

    // ===== Verify Value Conservation =====
    var computedTotalFees = 0;
    for (var i = 0; i < N_HOPS; i++) {
        computedTotalFees += hopFee[i] * hopIsActive[i];
    }
    computedTotalFees === totalFees;
    destValue === sourceValue - totalFees;

    // ===== Verify Destination Note =====
    destNote = PoseidonRegularNote();
    destNote.pkX <== destPkX;
    destNote.pkY <== destPkY;
    destNote.value <== destValue;
    destNote.tokenType <== sourceToken;
    destNote.salt <== destSalt;
    destNote.out === destNoteHash;

    // ===== Route Commitment =====
    routeHash = Poseidon(N_HOPS * 2 + 4);
    routeHash.inputs[0] <== sourcePkX;
    routeHash.inputs[1] <== sourcePkY;
    for (var i = 0; i < N_HOPS; i++) {
        routeHash.inputs[2 + i * 2] <== hopPkX[i];
        routeHash.inputs[2 + i * 2 + 1] <== hopPkY[i];
    }
    routeHash.inputs[N_HOPS * 2 + 2] <== destPkX;
    routeHash.inputs[N_HOPS * 2 + 3] <== destPkY;
    routeHash.out === routeCommitment;
}

component main {public [sourceNoteHash, destNoteHash, routeCommitment, totalFees]} =
    MultiHopTransfer(5);
```

### 주요 제약조건

1. **소스 소유권**: 송신자가 소스 노트를 소유함을 증명
2. **홉 체인 유효성**: 각 홉이 이전에서 보낸 것을 정확히 받음
3. **수수료 공제**: 각 홉이 전달된 금액에서 수수료를 공제
4. **가치 보존**: 소스 가치 = 목적지 가치 + 총 수수료
5. **경로 무결성**: 경로 commitment가 정확한 경로를 바인딩

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **경로 발견** | 경로 commitment가 해시됨; 개별 홉이 공개되지 않음 |
| **중개자 담합** | 각 홉이 이웃만 알고 있음; 전체 경로는 모든 홉이 필요 |
| **수수료 추출** | 경로 생성 시 수수료가 커밋됨; 중간에 증가할 수 없음 |
| **재생 공격** | 소스 노트가 nullify됨; 동일한 경로를 재사용할 수 없음 |
| **타이밍 분석** | 모든 홉이 원자적으로 결제됨; 타이밍 상관관계 없음 |
| **가치 상관관계** | 표준 금액으로 패딩 고려 |
| **홉 보류** | 원자적 결제; 모두 성공하거나 모두 실패 |

## 구현 과제

1. **경로 발견**
   - 송신자가 수신자까지의 경로를 어떻게 찾는가?
   - 라우팅 테이블 또는 경로 찾기 서비스 필요
   - 경로 발견을 위한 가십 프로토콜 고려
   - 프라이버시와 효율성 간의 균형

2. **중개자 인센티브**
   - 중개자가 왜 참여하는가?
   - 수수료 보상이 기회 비용을 초과해야 함
   - 유동성 제공자 보상 고려
   - 시장 기반 수수료 발견

3. **오프라인 중개자**
   - 전통적인 라우팅은 온라인 노드가 필요
   - ZK 접근 방식: 사전 커밋된 경로
   - 주 경로가 실패하면 대체 경로
   - 오래된 경로에 대한 만료

4. **유동성 요구사항**
   - 각 홉이 충분한 잔액이 필요
   - 경로 간 유동성 단편화
   - 리밸런싱 회로가 도움이 될 수 있음
   - 유동성 풀 고려

5. **가변 홉 수**
   - 회로가 고정된 N_HOPS로 컴파일됨
   - 짧은 경로는 비활성 홉 패딩 사용
   - 긴 경로는 더 큰 회로가 필요
   - 동적 길이를 위한 재귀 증명 고려

## 사용 사례

1. **프라이버시 보존 지불**
   - 5명의 중개자를 통해 지불 전송
   - Lightning Network와 같지만 전체 경로 프라이버시 있음
   - 중개자가 소스나 목적지를 모름

2. **익명 기부**
   - 신원을 공개하지 않고 대의에 기부
   - 여러 홉이 출처를 모호하게 함
   - 수신자가 역추적할 수 없음

3. **기업 재무부 전송**
   - 자회사 간 자금 이동
   - 경로 프라이버시가 경쟁 정보를 방지
   - 경로 commitment를 통한 감사 추적

4. **국경 간 송금**
   - 여러 관할권을 통해 라우팅
   - 경로 선택을 통해 현지 규정 준수
   - 전통적인 통로보다 낮은 수수료

5. **DEX 차익거래 은폐**
   - 경쟁자로부터 차익거래 경로 숨김
   - 전략의 복사 거래 방지
   - 거래 우위 유지

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../product/high-complexity/hc7-multi-hop-transfer-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
