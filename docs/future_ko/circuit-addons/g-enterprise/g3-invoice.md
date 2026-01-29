# G3. Invoice Factoring

고객 신원이나 정확한 금액을 노출하지 않고 매출채권 가치와 진위를 증명할 수 있는 비공개 송장 팩토링.

**Constraints**: ~200K | **Complexity**: Medium

---

## 배경

송장 팩토링은 비즈니스 현금 흐름에 필수적이지만 민감한 정보를 노출합니다:

- **고객 기밀 유지**: 고객 이름을 공개하면 비즈니스 관계가 노출되고 인력 빼가기로 이어질 수 있습니다
- **금액 프라이버시**: 송장 가치는 가격 전략과 고객 중요성을 드러냅니다
- **재무 상태**: 팩토링 패턴은 경쟁업체에게 현금 흐름 상태를 나타냅니다
- **사기 방지**: 팩터는 전체 기록에 접근하지 않고도 송장이 진짜임을 보장받아야 합니다

기존 팩토링은 송장의 전체 공개를 요구합니다. 블록체인 기반 팩토링은 모든 것을 공개적으로 노출합니다. ZK 송장 팩토링은 기업이 고객 세부 정보나 정확한 금액을 공개하지 않고 특정 기준을 충족하는 합법적인 매출채권을 가지고 있음을 증명할 수 있게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `invoiceCommitment` | field | 송장 세부 정보에 대한 commitment |
| `minValue` | uint | 주장되는 최소 송장 가치 |
| `maxAge` | uint | 송장 날짜 이후 최대 일수 |
| `sellerCommit` | field | 판매자 신원에 대한 commitment |
| `factorCommit` | field | 팩터 신원에 대한 commitment |
| `discountRate` | uint | 합의된 할인율 (베이시스 포인트) |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX, sellerPkY` | field | 판매자의 public key |
| `sellerSk` | field | 판매자의 secret key |
| `customerPkX, customerPkY` | field | 고객의 public key (송장 채무자) |
| `invoiceAmount` | uint | 실제 송장 금액 |
| `invoiceDate` | uint | 송장 발행 타임스탬프 |
| `dueDate` | uint | 지급 기한 |
| `invoiceId` | field | 고유 송장 식별자 |
| `customerSignature` | field[] | 송장에 대한 고객의 서명 |
| `sellerSalt, factorSalt` | field | 신원 commitment 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/babyjubjub/signature_verify.circom";
include "../utils/comparators.circom";

template InvoiceFactoring() {
    // ===== Public Inputs =====
    signal input invoiceCommitment;
    signal input minValue;
    signal input maxAge;
    signal input sellerCommit;
    signal input factorCommit;
    signal input discountRate;
    signal input currentTimestamp;

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY;
    signal input sellerSk;
    signal input customerPkX, customerPkY;
    signal input invoiceAmount;
    signal input invoiceDate;
    signal input dueDate;
    signal input invoiceId;
    signal input customerSigR8x, customerSigR8y, customerSigS;
    signal input sellerSalt;
    signal input factorPkX, factorPkY;
    signal input factorSalt;

    // ===== 1. Verify Seller Identity =====
    component sellerCommitHash = Poseidon(3);
    sellerCommitHash.inputs[0] <== sellerPkX;
    sellerCommitHash.inputs[1] <== sellerPkY;
    sellerCommitHash.inputs[2] <== sellerSalt;
    sellerCommitHash.out === sellerCommit;

    // ===== 2. Verify Seller Ownership =====
    component sellerOwnership = ProofOfOwnershipStrict();
    sellerOwnership.sk <== sellerSk;
    sellerOwnership.pkX <== sellerPkX;
    sellerOwnership.pkY <== sellerPkY;

    // ===== 3. Verify Factor Identity =====
    component factorCommitHash = Poseidon(3);
    factorCommitHash.inputs[0] <== factorPkX;
    factorCommitHash.inputs[1] <== factorPkY;
    factorCommitHash.inputs[2] <== factorSalt;
    factorCommitHash.out === factorCommit;

    // ===== 4. Create Invoice Commitment =====
    component invoiceHash = Poseidon(6);
    invoiceHash.inputs[0] <== sellerPkX;
    invoiceHash.inputs[1] <== customerPkX;
    invoiceHash.inputs[2] <== invoiceAmount;
    invoiceHash.inputs[3] <== invoiceDate;
    invoiceHash.inputs[4] <== dueDate;
    invoiceHash.inputs[5] <== invoiceId;
    invoiceHash.out === invoiceCommitment;

    // ===== 5. Verify Invoice Amount >= minValue =====
    component valueCheck = GreaterEqThan(64);
    valueCheck.in[0] <== invoiceAmount;
    valueCheck.in[1] <== minValue;
    valueCheck.out === 1;

    // ===== 6. Verify Invoice Age =====
    signal invoiceAge;
    invoiceAge <== currentTimestamp - invoiceDate;

    // Convert maxAge from days to seconds (86400 seconds per day)
    signal maxAgeSeconds;
    maxAgeSeconds <== maxAge * 86400;

    component ageCheck = LessEqThan(64);
    ageCheck.in[0] <== invoiceAge;
    ageCheck.in[1] <== maxAgeSeconds;
    ageCheck.out === 1;

    // ===== 7. Verify Invoice Not Past Due =====
    component dueDateCheck = GreaterThan(64);
    dueDateCheck.in[0] <== dueDate;
    dueDateCheck.in[1] <== currentTimestamp;
    dueDateCheck.out === 1;

    // ===== 8. Verify Customer Signature on Invoice =====
    component invoiceDataHash = Poseidon(5);
    invoiceDataHash.inputs[0] <== sellerPkX;
    invoiceDataHash.inputs[1] <== invoiceAmount;
    invoiceDataHash.inputs[2] <== invoiceDate;
    invoiceDataHash.inputs[3] <== dueDate;
    invoiceDataHash.inputs[4] <== invoiceId;

    component sigVerify = EdDSAVerify();
    sigVerify.msg <== invoiceDataHash.out;
    sigVerify.pubKeyX <== customerPkX;
    sigVerify.pubKeyY <== customerPkY;
    sigVerify.R8x <== customerSigR8x;
    sigVerify.R8y <== customerSigR8y;
    sigVerify.S <== customerSigS;

    // ===== 9. Calculate Factoring Proceeds =====
    signal output factoringProceeds;
    // proceeds = invoiceAmount * (10000 - discountRate) / 10000
    signal discountedAmount;
    discountedAmount <== invoiceAmount * (10000 - discountRate);
    factoringProceeds <-- discountedAmount / 10000;

    // Verify division is correct
    signal verifyProceeds;
    verifyProceeds <== factoringProceeds * 10000;
    component proceedsCheck = LessEqThan(128);
    proceedsCheck.in[0] <== verifyProceeds;
    proceedsCheck.in[1] <== discountedAmount;
    proceedsCheck.out === 1;
}

component main {public [invoiceCommitment, minValue, maxAge, sellerCommit, factorCommit, discountRate, currentTimestamp]} =
    InvoiceFactoring();
```

### 주요 제약 조건

1. **판매자 권한 부여**: 송장 소유자만 팩토링을 시작할 수 있습니다
2. **고객 서명**: 송장은 고객(채무자)이 서명해야 합니다
3. **가치 임계값**: 송장 금액이 최소 요구사항을 충족합니다
4. **신선도**: 송장이 너무 오래되지 않았고 기한이 지나지 않았습니다
5. **신원 바인딩**: 모든 당사자가 신원을 공개하지 않고 커밋됨

## 효과

| Aspect | Impact |
|--------|--------|
| **고객 프라이버시** | 채무자 신원이 공개적으로 완전히 숨겨짐 |
| **금액 기밀 유지** | 최소 가치 임계값만 공개됨 |
| **비즈니스 관계** | 고객 목록이 비공개로 유지됨 |
| **사기 방지** | 고객 서명이 송장 진위를 증명 |
| **유동성 접근** | 소규모 기업이 평판 위험 없이 팩토링 가능 |

## 보안 고려사항

| Risk | Mitigation |
|------|------------|
| **가짜 송장** | 고객 서명 필요; 위조는 고객의 secret key 필요 |
| **이중 팩토링** | 송장 commitment를 nullifier로 사용; 각 송장은 한 번만 팩토링됨 |
| **오래된 송장** | 연령 확인으로 최근 송장만 보장 |
| **기한 경과 송장** | 기한 검증으로 채무 불이행 송장 팩토링 방지 |
| **고객 공모** | 팩터는 대규모 송장에 대한 추가 검증 요구 가능 |
| **금액 인플레이션** | 서명된 송장이 금액을 고정; 수정 불가 |

## 구현 과제

1. **고객 서명 수집**
   - 송장은 고객이 디지털 서명해야 함
   - 고객을 ZK 시스템에 온보딩 필요
   - 디지털 서명을 사용하지 않는 고객을 위한 대체 방법

2. **송장 고유성**
   - 동일한 송장이 여러 번 팩토링되는 것을 방지
   - 팩토링된 송장 commitment의 전역 레지스트리
   - 사기 방지를 위한 팩터 간 조정

3. **분쟁 처리**
   - 고객이 송장 유효성을 이의 제기하는 경우 어떻게 되는가?
   - 중재를 위한 선택적 공개
   - 분쟁 중인 송장을 위한 에스크로 메커니즘

4. **회계와의 통합**
   - 기존 회계 시스템과의 동기화
   - 감사 추적 유지
   - 세금 보고 요구사항

## 파생 상품

1. **Batch Factoring** - 단일 트랜잭션에서 여러 송장을 팩토링합니다. Circuit이 N개 송장에 대한 증명을 집계하여 포트폴리오 구성을 숨기면서 많은 소규모 송장을 가진 기업의 가스 비용을 극적으로 절감합니다.

2. **Recourse Factoring** - 팩터가 고객이 채무 불이행하는 경우 판매자에게 소구권을 가집니다. 추가 circuit 구성 요소가 신용 이벤트 검증 및 시간 잠금 담보를 통한 판매자 상환 의무를 처리합니다.

3. **Reverse Factoring** - 대규모 구매자가 공급업체 송장에 대한 팩토링을 시작합니다. 구매자의 신용도가 할인율을 낮춤; circuit은 구매자 신원이나 전체 공급망을 공개하지 않고 구매자 승인을 증명합니다.

4. **Dynamic Discounting** - 할인율이 지급 타이밍에 따라 변동합니다. Circuit은 사전에 커밋된 요율 일정과 지급 날짜 검증을 통해 더 높은 할인율로 조기 지급을 가능하게 합니다.

5. **Cross-Border Factoring** - 환율 검증을 통해 다중 통화 송장을 처리합니다. 오라클 검증 요율에서 국제 팩토링 규칙 준수 증명 및 통화 변환을 포함합니다.

## 사용 사례

1. **SMB 현금 흐름 관리**
   - 소규모 제조업체가 $500K의 미수금 송장 보유
   - 고객 이름을 공개하지 않고 급여 충당을 위해 송장 팩토링
   - 경쟁업체는 제조업체의 고객이 누구인지 볼 수 없음
   - 팩터가 고객 서명을 통해 송장 합법성을 검증

2. **공급망 금융**
   - 대규모 소매업체가 조기 지급을 위해 공급업체 송장 승인
   - 공급업체가 유동성 확보; 소매업체의 승인으로 할인율 감소
   - 숨겨짐: 특정 공급업체 신원, 개별 송장 금액
   - 공개됨: 승인된 총 거래량, 소매업체 약속

3. **의료 매출채권**
   - 의료 기관이 보험 매출채권 팩토링
   - 환자 프라이버시가 팩터로부터도 유지됨
   - 환자 세부 정보 없이 보험 회사 확인 증명
   - 의료 제공자가 운전 자본에 접근 가능

4. **건설 진행 청구**
   - 계약자가 프로젝트 소유자로부터 진행 청구 팩토링
   - 소유자의 서명이 작업 승인 증명
   - 프로젝트 세부 정보 및 특정 금액이 기밀로 유지됨
   - 계약자가 프로젝트 전체에서 현금 흐름 관리 가능

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 시나리오는 [실제 제품 및 사용자 경험](../../product/g-enterprise/g3-invoice-products.md)을 참조하십시오.

---

[목차로 돌아가기](../../README.md)
