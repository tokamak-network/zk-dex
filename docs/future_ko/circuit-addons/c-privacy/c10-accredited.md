# C10. Accredited Investor Proof

정확한 보유 자산을 드러내지 않으면서 순자산이 공인 투자자 자격의 규제 임계값을 초과함을 증명합니다.

**제약 조건**: ~350K (20 자산) | **복잡도**: 중간

---

## 배경

공인 투자자 검증은 특정 투자 기회에 대한 액세스에 필요합니다:

- **SEC Regulation D**: 미국 증권법은 일부 제안을 공인 투자자로 제한합니다
- **순자산 임계값**: $100만 순자산(주 거주지 제외) 또는 $20만 소득
- **프라이버시 민감성**: 순자산은 매우 민감한 개인 재무 정보입니다
- **전통적인 프로세스**: 세금 신고서, 은행 명세서, 중개 계좌 명세서 제출이 필요합니다
- **반복 검증**: 각 투자 기회마다 자격을 재검증해야 합니다

전통적인 인증 검증은 각 펀드나 제안에 광범위한 문서 공개가 필요합니다. ZK 증명은 기본 재무 세부 정보를 여러 당사자에게 드러내지 않고 자격을 증명할 수 있게 합니다. 사용자는 한 번 증명하고 여러 번 검증합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `threshold` | uint | 인증 임계값 (예: $1,000,000) |
| `isAccredited` | uint | 순자산이 임계값을 초과하면 1 |
| `merkleRoot` | field | 노트 커밋먼트 트리의 루트 |
| `priceOracleRoot` | field | 검증된 가격 증명의 루트 |
| `verificationDate` | uint | 검증 타임스탬프 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개키 |
| `sk` | field | 소유권 증명을 위한 비밀키 |
| `noteHashes[NUM_ASSETS]` | field[] | 자산 노트의 해시 |
| `values[NUM_ASSETS]` | uint[] | 네이티브 단위의 자산 값 |
| `tokenTypes[NUM_ASSETS]` | uint[] | 토큰 타입 식별자 |
| `salts[NUM_ASSETS]` | field[] | 노트 무작위성 |
| `prices[NUM_ASSETS]` | uint[] | 토큰당 USD 가격 |
| `priceProofs[NUM_ASSETS]` | PriceAttestation[] | 가격에 대한 오라클 증명 |
| `merklePaths[NUM_ASSETS][TREE_DEPTH]` | field[][] | Merkle 증명 |
| `merkleIndexes[NUM_ASSETS]` | uint[] | Merkle 트리 위치 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template PriceAttestation(DEPTH) {
    signal input tokenType;
    signal input price;
    signal input timestamp;
    signal input oracleRoot;
    signal input path[DEPTH];
    signal input index;
    signal output valid;

    // Compute price attestation leaf
    component priceLeaf = Poseidon(3);
    priceLeaf.inputs[0] <== tokenType;
    priceLeaf.inputs[1] <== price;
    priceLeaf.inputs[2] <== timestamp;

    // Verify price is in oracle tree
    component priceProof = MerkleProof(DEPTH);
    priceProof.leaf <== priceLeaf.out;
    priceProof.root <== oracleRoot;
    for (var i = 0; i < DEPTH; i++) {
        priceProof.path[i] <== path[i];
    }
    priceProof.index <== index;

    valid <== 1; // MerkleProof will fail if invalid
}

template AccreditedInvestorProof(NUM_ASSETS, TREE_DEPTH, ORACLE_DEPTH) {
    // ===== Public Inputs =====
    signal input threshold;          // e.g., 1000000 * 10^6 (USDC units)
    signal input isAccredited;
    signal input merkleRoot;
    signal input priceOracleRoot;
    signal input verificationDate;

    // ===== Private Inputs =====
    signal input pkX, pkY;
    signal input sk;
    signal input noteHashes[NUM_ASSETS];
    signal input values[NUM_ASSETS];
    signal input tokenTypes[NUM_ASSETS];
    signal input salts[NUM_ASSETS];
    signal input prices[NUM_ASSETS];
    signal input pricePaths[NUM_ASSETS][ORACLE_DEPTH];
    signal input priceIndexes[NUM_ASSETS];
    signal input priceTimestamps[NUM_ASSETS];
    signal input merklePaths[NUM_ASSETS][TREE_DEPTH];
    signal input merkleIndexes[NUM_ASSETS];

    // ===== 1. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 2. Process Each Asset =====
    component note[NUM_ASSETS];
    component merkle[NUM_ASSETS];
    component priceAttest[NUM_ASSETS];
    component timestampCheck[NUM_ASSETS];
    signal usdValues[NUM_ASSETS];

    for (var i = 0; i < NUM_ASSETS; i++) {
        // Verify note format and ownership
        note[i] = PoseidonRegularNote();
        note[i].pkX <== pkX;
        note[i].pkY <== pkY;
        note[i].value <== values[i];
        note[i].tokenType <== tokenTypes[i];
        note[i].salt <== salts[i];
        note[i].out === noteHashes[i];

        // Verify Merkle inclusion
        merkle[i] = MerkleProof(TREE_DEPTH);
        merkle[i].leaf <== noteHashes[i];
        merkle[i].root <== merkleRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            merkle[i].path[j] <== merklePaths[i][j];
        }
        merkle[i].index <== merkleIndexes[i];

        // Verify price attestation
        priceAttest[i] = PriceAttestation(ORACLE_DEPTH);
        priceAttest[i].tokenType <== tokenTypes[i];
        priceAttest[i].price <== prices[i];
        priceAttest[i].timestamp <== priceTimestamps[i];
        priceAttest[i].oracleRoot <== priceOracleRoot;
        for (var j = 0; j < ORACLE_DEPTH; j++) {
            priceAttest[i].path[j] <== pricePaths[i][j];
        }
        priceAttest[i].index <== priceIndexes[i];

        // Verify price is recent (within 24 hours of verification)
        timestampCheck[i] = GreaterEqThan(64);
        timestampCheck[i].in[0] <== priceTimestamps[i];
        timestampCheck[i].in[1] <== verificationDate - 86400; // 24 hours
        timestampCheck[i].out === 1;

        // Calculate USD value
        usdValues[i] <== values[i] * prices[i];
    }

    // ===== 3. Sum Total Net Worth =====
    signal partialSums[NUM_ASSETS + 1];
    partialSums[0] <== 0;
    for (var i = 0; i < NUM_ASSETS; i++) {
        partialSums[i + 1] <== partialSums[i] + usdValues[i];
    }
    signal totalNetWorth <== partialSums[NUM_ASSETS];

    // ===== 4. Threshold Check =====
    component check = GreaterEqThan(128);
    check.in[0] <== totalNetWorth;
    check.in[1] <== threshold;

    // ===== 5. Verify Result =====
    isAccredited === check.out;
}

component main {public [threshold, isAccredited, merkleRoot, priceOracleRoot, verificationDate]} =
    AccreditedInvestorProof(20, 20, 10);
```

### 주요 제약 조건

1. **소유권 검증**: 모든 자산이 증명자에게 속해야 합니다
2. **자산 진정성**: 각 노트가 커밋먼트 트리에 존재합니다
3. **가격 검증**: 신뢰할 수 있는 오라클이 가격을 증명합니다
4. **가격 신선도**: 가격이 최근(24시간 이내)이어야 합니다
5. **임계값 비교**: 총 USD 값이 인증 임계값을 초과합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **프라이버시** | 정확한 보유 자산이 절대 드러나지 않습니다 |
| **재사용 가능성** | 여러 검증을 위한 단일 증명 |
| **무신뢰** | 순자산의 제3자 증명이 필요하지 않습니다 |
| **규제 준수** | SEC 인증 요구 사항을 충족합니다 |
| **마찰 감소** | 더 빠른 투자 온보딩 |
| **자산 유연성** | 여러 토큰 타입이 계산됩니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **가격 조작** | 증명이 있는 평판이 좋은 오라클 사용 |
| **구식 가격** | 24시간 신선도 요구 사항 |
| **중복 계산** | 고유한 노트 해시로 중복 방지 |
| **차용 자산** | 소유권 증명으로 다른 사람의 자산 사용 방지 |
| **플래시 론 공격** | 최소 보유 기간 또는 다일 평균 요구 |
| **오라클 침해** | 여러 오라클 출처; 임계값 합의 |
| **담합** | 분산형 가격 피드 |

## 구현 과제

1. **다중 자산 가격 피드**
   - 지원되는 모든 토큰 타입의 가격 필요
   - 각 자산 클래스에 대한 오라클 통합
   - 가격 정밀도 및 스케일링 표준화

2. **오프체인 자산**
   - 온체인에 없는 부동산, 주식 등
   - 오라클 증명 브리지가 필요할 수 있습니다
   - 온체인/오프체인 하이브리드 증명 고려

3. **부채 처리**
   - 순자산은 부채를 빼야 합니다
   - 음수 노트로 부채 표현
   - 부채 공개를 위한 프라이버시

4. **소득 기반 인증**
   - 대안: 2년 동안 $20만 소득
   - 시간에 걸친 소득 범위 증명 필요
   - 별도 회로가 필요할 수 있습니다

5. **검증 신선도**
   - 증명이 얼마나 오래 유효합니까?
   - 자산 가치가 변경됩니다; 재검증 필요
   - 증명 만료 타임스탬프 고려

## 파생물

1. **계층화된 인증** - 다른 투자 등급을 위한 다른 임계값. 적격 구매자($500만), 적격 기관 구매자($1억). 단일 증명으로 여러 자격 수준을 나타낼 수 있습니다.

2. **다중 관할권 자격** - 여러 규제 체제 하에서 동시에 인증을 증명합니다. 미국 SEC, EU AIFMD, 영국 FCA 요구 사항. 글로벌 투자 액세스를 위한 단일 증명입니다.

3. **인증 만료/갱신** - 갱신 메커니즘이 있는 시간 제한 인증 증명. 규제에서 요구하는 연간 재검증. 만료되는 증명에 대한 자동 알림 시스템입니다.

4. **기관 인증** - 기관 수준 자격을 증명합니다(QIB 자격, 기관 투자자). 기관 계정에 걸친 보유 자산을 집계합니다. 기업 거버넌스 통합입니다.

5. **부분 인증(특정 한도)** - 특정 투자 금액에 대한 자격을 증명합니다. "$50만까지 투자에 인증됨". 순자산 밴드를 기반으로 한 계층화된 액세스입니다.

## 사용 사례

1. **사모펀드 투자**
   - PE 펀드가 공인 투자자 검증을 요구합니다
   - 투자자가 순자산이 $100만을 초과함을 증명합니다
   - 펀드가 증명을 수락하고 투자가 진행됩니다
   - 정확한 포트폴리오가 펀드에 공개되지 않습니다

2. **부동산 신디케이션**
   - 부동산 제안이 공인 투자자로 제한됩니다
   - 여러 투자자가 인증을 증명합니다
   - 신디케이터가 모든 참가자가 자격이 있는지 확인합니다
   - 개별 자산 세부 정보가 비공개로 유지됩니다

3. **헤지 펀드 온보딩**
   - 헤지 펀드에 최소 투자 + 인증 요구 사항이 있습니다
   - 투자자가 충분한 잔액과 인증을 모두 증명합니다
   - 문서 검토 없이 간소화된 온보딩
   - 펀드 관리자로부터 프라이버시가 보존됩니다

4. **증권 토큰 오퍼링**
   - STO에 공인 투자자 화이트리스트가 필요합니다
   - 투자자가 ZK 인증 증명을 제출합니다
   - 스마트 컨트랙트가 자동으로 증명을 검증합니다
   - 중앙화된 KYC 없이 규정 준수 토큰 배포

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Accredited Investor Proof - Products & UX](../../../product/c-privacy/c10-accredited-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
