# HC4. 프라이빗 포트폴리오 리밸런싱

하나의 증명으로 N개 자산의 포트폴리오를 목표 할당으로 리밸런싱합니다.

**제약조건**: ~500K | **복잡도**: 높음

---

## 배경

포트폴리오 관리는 투명성 vs. 프라이버시 트레이드오프에 직면합니다:
- 공개 리밸런싱은 선행 거래를 가능하게 함
- 대규모 주문은 거래자에게 불리하게 시장을 움직임
- 기관 투자자는 기밀 전략이 필요
- 준수를 위해 적절한 펀드 관리 증명 필요

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 온체인 포트폴리오 매니저 | 모든 보유량 가시적; 복사 거래 및 선행 거래 가능 |
| 전통적인 펀드 보관 | 신뢰할 수 있는 보관인; 실시간 검증 없음 |
| 다중 서명 재무부 | 트랜잭션 가시성으로 전략 공개 |
| 정기 감사 | 시점 스냅샷; 감사 간 조작 |

프라이빗 포트폴리오 리밸런싱은 포지션이나 전략을 노출하지 않고 검증 가능한 펀드 관리를 가능하게 합니다. 투자자는 실제 보유량을 보지 않고도 준수를 확인할 수 있습니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `portfolioCommitment` | field | 현재 포트폴리오 상태의 해시 |
| `newPortfolioCommitment` | field | 리밸런스 후 포트폴리오의 해시 |
| `oraclePrices` | uint[N_ASSETS] | 오라클의 현재 가격 |
| `targetAllocations` | uint[N_ASSETS] | 목표 가중치 (기준점, 합계=10000) |
| `tolerance` | uint | 목표로부터의 최대 편차 (기준점) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX/Y, ownerSk` | field | 포트폴리오 소유자 자격 증명 |
| `currentNoteHashes, currentValues, currentTokenTypes, currentSalts` | 배열 | 현재 보유량 |
| `newNoteHashes, newValues, newSalts` | 배열 | 리밸런스 후 보유량 |
| `tradeAmounts` | int[N_ASSETS] | 거래 델타 (양수=매수, 음수=매도) |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **정보 유출** | 제로 - 보유량 및 거래가 비공개로 유지됨 |
| **슬리피지** | 감소 - 리밸런스 주문의 선행 거래 없음 |
| **준수** | 투자 위임 준수 증명 가능 |
| **감사** | 적절한 관리의 암호화 증명 |
| **확장성** | 거래 복잡성에 관계없이 단일 증명 |
| **신뢰** | 투자자가 포지션을 보지 않고 검증 |

## 파생물

1. **세금 손실 수확** - 노트 메타데이터에 비용 기준을 포함하여 세금 효율적인 리밸런싱을 증명합니다. 회로는 할당 목표를 유지하면서 손실이 최적으로 수확되는지 검증합니다. 워시 세일 규칙이 있는 관할권에 유용합니다.

2. **ESG 준수** - 포지션을 공개하지 않고 포트폴리오가 ESG 기준을 충족함을 증명합니다. 오라클 데이터에 자산당 ESG 점수를 포함합니다. 회로는 가중 포트폴리오 ESG 점수가 임계값을 초과하는지 검증합니다.

3. **리스크 패리티 리밸런스** - 달러 가중치가 아닌 변동성 목표에 기반한 리밸런싱입니다. 오라클의 변동성 추정치를 포함합니다. 각 자산이 포트폴리오에 동등한 리스크를 기여합니다.

4. **모멘텀 리밸런스** - 자동화된 추세 추종 리밸런싱입니다. 오라클의 가격 이동 평균을 포함합니다. MA 위의 자산은 과중, 아래는 과소 가중합니다.

5. **다중 매니저 리밸런스** - 집계 제약조건으로 하위 매니저 간 리밸런싱을 조정합니다. 각 매니저는 하위 포트폴리오 준수를 증명; 마스터 증명은 집계합니다.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template PrivatePortfolioRebalance(N_ASSETS) {
    // ===== Public Inputs =====
    signal input portfolioCommitment;
    signal input newPortfolioCommitment;
    signal input oraclePrices[N_ASSETS];
    signal input targetAllocations[N_ASSETS];  // Basis points (sum = 10000)
    signal input tolerance;                     // Max deviation in basis points

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, ownerSk;

    signal input currentNoteHashes[N_ASSETS];
    signal input currentValues[N_ASSETS];
    signal input currentTokenTypes[N_ASSETS];
    signal input currentSalts[N_ASSETS];

    signal input newNoteHashes[N_ASSETS];
    signal input newValues[N_ASSETS];
    signal input newSalts[N_ASSETS];

    signal input tradeAmounts[N_ASSETS];  // Can be negative (sells)

    // ===== Component Declarations =====
    component ownership;
    component currentNote[N_ASSETS];
    component newNote[N_ASSETS];
    component currentHash;
    component newHash;
    component valueCheck;
    component deviationCheck[N_ASSETS];

    // Intermediate signals
    signal actualAllocation[N_ASSETS];
    signal deviation[N_ASSETS];
    signal deviationSq[N_ASSETS];

    // ===== Verify Ownership =====
    ownership = ProofOfOwnershipStrict();
    ownership.sk <== ownerSk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== Verify Current Portfolio =====
    currentHash = Poseidon(N_ASSETS * 3 + 2);
    currentHash.inputs[0] <== ownerPkX;
    currentHash.inputs[1] <== ownerPkY;

    var totalCurrentValue = 0;

    for (var i = 0; i < N_ASSETS; i++) {
        currentNote[i] = PoseidonRegularNote();
        currentNote[i].pkX <== ownerPkX;
        currentNote[i].pkY <== ownerPkY;
        currentNote[i].value <== currentValues[i];
        currentNote[i].tokenType <== currentTokenTypes[i];
        currentNote[i].salt <== currentSalts[i];
        currentNote[i].out === currentNoteHashes[i];

        currentHash.inputs[2 + i * 3] <== currentNoteHashes[i];
        currentHash.inputs[2 + i * 3 + 1] <== currentValues[i];
        currentHash.inputs[2 + i * 3 + 2] <== currentTokenTypes[i];

        totalCurrentValue += currentValues[i] * oraclePrices[i];
    }
    currentHash.out === portfolioCommitment;

    // ===== Verify New Portfolio =====
    newHash = Poseidon(N_ASSETS * 3 + 2);
    newHash.inputs[0] <== ownerPkX;
    newHash.inputs[1] <== ownerPkY;

    var totalNewValue = 0;

    for (var i = 0; i < N_ASSETS; i++) {
        // Trade amount constraint (handled via signed arithmetic)
        newValues[i] === currentValues[i] + tradeAmounts[i];

        newNote[i] = PoseidonRegularNote();
        newNote[i].pkX <== ownerPkX;
        newNote[i].pkY <== ownerPkY;
        newNote[i].value <== newValues[i];
        newNote[i].tokenType <== currentTokenTypes[i];
        newNote[i].salt <== newSalts[i];
        newNote[i].out === newNoteHashes[i];

        newHash.inputs[2 + i * 3] <== newNoteHashes[i];
        newHash.inputs[2 + i * 3 + 1] <== newValues[i];
        newHash.inputs[2 + i * 3 + 2] <== currentTokenTypes[i];

        totalNewValue += newValues[i] * oraclePrices[i];
    }
    newHash.out === newPortfolioCommitment;

    // ===== Verify Value Conservation =====
    // Allow up to 1% slippage for trading costs
    valueCheck = LessThan(128);
    valueCheck.in[0] <== totalCurrentValue * 99 / 100;
    valueCheck.in[1] <== totalNewValue + 1;
    valueCheck.out === 1;

    // ===== Verify Target Allocations =====
    for (var i = 0; i < N_ASSETS; i++) {
        // Calculate actual allocation in basis points
        actualAllocation[i] <== newValues[i] * oraclePrices[i] * 10000 / totalNewValue;

        // Calculate deviation
        deviation[i] <== actualAllocation[i] - targetAllocations[i];

        // Square deviation for absolute comparison
        deviationSq[i] <== deviation[i] * deviation[i];

        // Verify |deviation| <= tolerance
        deviationCheck[i] = LessThan(64);
        deviationCheck[i].in[0] <== deviationSq[i];
        deviationCheck[i].in[1] <== tolerance * tolerance + 1;
        deviationCheck[i].out === 1;
    }
}

component main {public [portfolioCommitment, newPortfolioCommitment, oraclePrices,
    targetAllocations, tolerance]} = PrivatePortfolioRebalance(10);
```

### 주요 제약조건

1. **소유권**: 포트폴리오 소유자만 리밸런스를 시작할 수 있음
2. **포트폴리오 무결성**: 현재 및 새로운 상태가 commitment와 일치
3. **가치 보존**: 총 가치 보존됨 (슬리피지 허용 범위 내)
4. **할당 준수**: 각 자산이 목표 가중치의 허용 범위 내

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **오라클 조작** | TWAP 가격 사용; 여러 오라클 소스; 가격 한계 |
| **매니저 위법 행위** | 회로가 할당 제한 강제; 허용 범위를 벗어날 수 없음 |
| **리밸런스 선행 거래** | 거래 금액 비공개; commitment만 게시됨 |
| **슬리피지 악용** | 1% 슬리피지 상한; 안정 자산에 대해 더 엄격 |
| **NAV 조작** | Commitment에 모든 보유량 포함; 자산을 숨길 수 없음 |
| **무단 접근** | 리밸런스에 소유권 증명 필요 |
| **오래된 가격** | 오라클 데이터에 타임스탬프 포함; 너무 오래되면 거부 |

## 구현 과제

1. **거래를 위한 부호 있는 산술**
   - `tradeAmounts`는 음수일 수 있음 (매도)
   - Circom 필드 산술은 래핑됨; 신중한 처리 필요
   - 2의 보수 또는 별도의 매수/매도 배열 사용

2. **ZK에서의 나눗셈**
   - `actualAllocation = value * price * 10000 / totalValue`
   - 회로에서 나눗셈은 비용이 많이 듦 (~1000 제약조건)
   - 오프체인에서 몫을 미리 계산; 회로에서 곱셈 검증

3. **오라클 통합**
   - 신뢰할 수 있고 조작에 강한 가격 피드 필요
   - Chainlink, TWAP 또는 다중 소스 집계 고려
   - 자산 간 가격 정밀도 표준화

4. **거래 실행**
   - 회로는 리밸런스 유효성만 검증
   - 실제 거래는 별도로 실행되어야 함
   - 원자적 실행 또는 에스크로 메커니즘 필요

5. **많은 자산의 Gas 비용**
   - 10개 자산은 ~500K 제약조건 필요
   - Public input: 10개 가격 + 10개 할당 = 20개 필드 요소
   - 여러 리밸런스 배치 또는 계층적 증명 고려

## 사용 사례

1. **프라이빗 인덱스 펀드**
   - S&P 500 상위 보유량을 추적하기 위해 10개 자산 포트폴리오 리밸런스
   - 투자자는 포지션을 보지 않고 펀드가 인덱스를 따르는지 확인
   - 가격 변동 시 자동 리밸런싱

2. **로보 어드바이저**
   - 소매 투자자를 위한 자동화된 포트폴리오 관리
   - 크기를 공개하지 않고 리스크에 적합한 할당 증명
   - 손실 수확이 있는 세금 인식 리밸런싱

3. **DAO 재무부 관리**
   - 거버넌스 투표에 따라 DAO 재무부 리밸런스
   - 조작을 방지하기 위해 보유량 비공개
   - 투자 정책 준수 증명 가능

4. **연금 펀드 준수**
   - 규제 할당 요구사항 충족 증명
   - 주식 60% 이하, 채권 40% 이하 등
   - 감사자가 포지션을 보지 않고 검증

5. **패밀리 오피스**
   - 다세대 자산 관리
   - 수탁 의무 이행 증명
   - 공정성을 보장하면서 가족 구성원으로부터 프라이버시

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../../future/product/high-complexity/hc4-portfolio-rebalancing-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
