# G8. Trade Compliance

수출 통제, 제재 및 이중 용도 물품 제한을 포함한 국제 무역 규제 준수의 프라이버시 보존 검증.

**Constraints**: ~300K | **Complexity**: High

---

## 배경

국제 무역 준수는 복잡하고 민감한 요구사항을 포함합니다:

- **수출 통제 민감성**: 수출 허가 신청은 제품 기능과 고객 관계를 드러냅니다
- **제재 복잡성**: 제재 목록에 대한 심사는 여러 관할권과 소유권 체인을 확인해야 합니다
- **경쟁 정보**: 무역 패턴은 시장 전략, 고객 기반 및 공급망 구조를 드러냅니다
- **이중 용도 우려**: 기술 사양을 공개하지 않고 물품이 민간 용도임을 증명합니다

기존 준수는 규제 기관 및 종종 제3자 준수 제공자에게 전체 공개를 요구합니다. ZK 무역 준수는 상업적으로 민감한 무역 세부 정보를 공개하지 않고 수출 통제, 제재 요구사항 및 최종 용도 제한에 대한 준수를 증명할 수 있게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `tradeCommitment` | field | 무역 거래 세부 정보에 대한 commitment |
| `exporterCommit` | field | 수출업체 신원에 대한 commitment |
| `complianceRoot` | field | 준수 규칙 및 목록의 Merkle root |
| `jurisdictionCode` | uint | 규제 관할권 |
| `transactionTimestamp` | uint | 거래 날짜 |
| `complianceCertHash` | field | 준수 인증의 해시 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `exporterPkX, exporterPkY` | field | 수출업체의 public key |
| `exporterSk` | field | 수출업체의 secret key |
| `importerPkX, importerPkY` | field | 수입업체의 public key |
| `importerCountry` | uint | 수입업체의 국가 코드 |
| `endUserPkX, endUserPkY` | field | 최종 사용자의 public key (다른 경우) |
| `productCode` | field[] | 제품 분류 코드 (HS, ECCN) |
| `productValue` | uint | 거래 가치 |
| `endUseCode` | uint | 선언된 최종 용도 카테고리 |
| `sanctionsProofs` | field[][] | 제재 승인에 대한 Merkle proof |
| `exporterSalt` | field | 신원 commitment 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/merkle/non_membership_proof.circom";
include "../utils/comparators.circom";

template TradeCompliance(NUM_PRODUCT_CODES, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input tradeCommitment;
    signal input exporterCommit;
    signal input complianceRoot;
    signal input jurisdictionCode;
    signal input transactionTimestamp;
    signal input complianceCertHash;

    // ===== Compliance Requirements (Public) =====
    signal input sanctionsListRoot;
    signal input controlledGoodsRoot;
    signal input embargoedCountriesRoot;
    signal input licenseExemptionThreshold;

    // ===== Private Inputs =====
    signal input exporterPkX, exporterPkY;
    signal input exporterSk;
    signal input exporterSalt;
    signal input exporterCountry;

    signal input importerPkX, importerPkY;
    signal input importerCountry;
    signal input importerSalt;

    signal input endUserPkX, endUserPkY;
    signal input endUserCountry;
    signal input endUserSalt;

    signal input productCodes[NUM_PRODUCT_CODES];
    signal input productValue;
    signal input endUseCode;

    // Sanctions check proofs (non-membership in sanctions list)
    signal input importerSanctionsProof[TREE_DEPTH];
    signal input importerSanctionsIndices[TREE_DEPTH];
    signal input endUserSanctionsProof[TREE_DEPTH];
    signal input endUserSanctionsIndices[TREE_DEPTH];

    // Embargo check proofs
    signal input embargoProof[TREE_DEPTH];
    signal input embargoIndices[TREE_DEPTH];

    // Controlled goods proofs
    signal input controlledGoodsProofs[NUM_PRODUCT_CODES][TREE_DEPTH];
    signal input controlledGoodsIndices[NUM_PRODUCT_CODES][TREE_DEPTH];
    signal input isControlled[NUM_PRODUCT_CODES];

    // License information (if required)
    signal input licenseNumber;
    signal input licenseExpiry;
    signal input licensedValue;

    // ===== 1. Verify Exporter Identity =====
    component exporterCommitHash = Poseidon(3);
    exporterCommitHash.inputs[0] <== exporterPkX;
    exporterCommitHash.inputs[1] <== exporterPkY;
    exporterCommitHash.inputs[2] <== exporterSalt;
    exporterCommitHash.out === exporterCommit;

    // ===== 2. Verify Exporter Ownership =====
    component exporterOwnership = ProofOfOwnershipStrict();
    exporterOwnership.sk <== exporterSk;
    exporterOwnership.pkX <== exporterPkX;
    exporterOwnership.pkY <== exporterPkY;

    // ===== 3. Create Party Identifiers =====
    component importerHash = Poseidon(3);
    importerHash.inputs[0] <== importerPkX;
    importerHash.inputs[1] <== importerPkY;
    importerHash.inputs[2] <== importerSalt;

    component endUserHash = Poseidon(3);
    endUserHash.inputs[0] <== endUserPkX;
    endUserHash.inputs[1] <== endUserPkY;
    endUserHash.inputs[2] <== endUserSalt;

    // ===== 4. Sanctions Screening - Importer =====
    // Prove importer is NOT in sanctions list (non-membership proof)
    component importerSanctionsCheck = MerkleNonMembershipProof(TREE_DEPTH);
    importerSanctionsCheck.leaf <== importerHash.out;
    importerSanctionsCheck.root <== sanctionsListRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        importerSanctionsCheck.siblings[i] <== importerSanctionsProof[i];
        importerSanctionsCheck.pathIndices[i] <== importerSanctionsIndices[i];
    }

    // ===== 5. Sanctions Screening - End User =====
    component endUserSanctionsCheck = MerkleNonMembershipProof(TREE_DEPTH);
    endUserSanctionsCheck.leaf <== endUserHash.out;
    endUserSanctionsCheck.root <== sanctionsListRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        endUserSanctionsCheck.siblings[i] <== endUserSanctionsProof[i];
        endUserSanctionsCheck.pathIndices[i] <== endUserSanctionsIndices[i];
    }

    // ===== 6. Embargo Check - Destination Country =====
    // Prove destination country is NOT embargoed
    component embargoLeaf = Poseidon(1);
    embargoLeaf.inputs[0] <== importerCountry;

    component embargoCheck = MerkleNonMembershipProof(TREE_DEPTH);
    embargoCheck.leaf <== embargoLeaf.out;
    embargoCheck.root <== embargoedCountriesRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        embargoCheck.siblings[i] <== embargoProof[i];
        embargoCheck.pathIndices[i] <== embargoIndices[i];
    }

    // ===== 7. Controlled Goods Check =====
    signal controlledSum[NUM_PRODUCT_CODES + 1];
    controlledSum[0] <== 0;

    component productLeaves[NUM_PRODUCT_CODES];
    component controlledChecks[NUM_PRODUCT_CODES];

    for (var i = 0; i < NUM_PRODUCT_CODES; i++) {
        productLeaves[i] = Poseidon(2);
        productLeaves[i].inputs[0] <== productCodes[i];
        productLeaves[i].inputs[1] <== jurisdictionCode;

        // Check if product is in controlled goods list
        controlledChecks[i] = MerkleProof(TREE_DEPTH);
        controlledChecks[i].leaf <== productLeaves[i].out;
        controlledChecks[i].root <== controlledGoodsRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            controlledChecks[i].siblings[j] <== controlledGoodsProofs[i][j];
            controlledChecks[i].pathIndices[j] <== controlledGoodsIndices[i][j];
        }

        // isControlled[i] must match Merkle proof result
        controlledSum[i + 1] <== controlledSum[i] + isControlled[i];
    }

    // ===== 8. License Requirement Check =====
    signal needsLicense;
    // License needed if any controlled goods OR value exceeds threshold
    component thresholdCheck = GreaterThan(64);
    thresholdCheck.in[0] <== productValue;
    thresholdCheck.in[1] <== licenseExemptionThreshold;

    needsLicense <== (controlledSum[NUM_PRODUCT_CODES] > 0 ? 1 : 0) + thresholdCheck.out -
                     ((controlledSum[NUM_PRODUCT_CODES] > 0 ? 1 : 0) * thresholdCheck.out);

    // ===== 9. License Validation (if required) =====
    // If license needed, verify license is valid
    component licenseValid = GreaterThan(64);
    licenseValid.in[0] <== licenseExpiry;
    licenseValid.in[1] <== transactionTimestamp;

    component licenseCoverage = GreaterEqThan(64);
    licenseCoverage.in[0] <== licensedValue;
    licenseCoverage.in[1] <== productValue;

    // License check passes if not needed OR (valid AND covers value)
    signal licenseCheckPassed;
    licenseCheckPassed <== (1 - needsLicense) + needsLicense * licenseValid.out * licenseCoverage.out;
    licenseCheckPassed === 1;

    // ===== 10. End Use Verification =====
    // End use must not be prohibited (code > 0 indicates valid civilian use)
    component endUseValid = GreaterThan(16);
    endUseValid.in[0] <== endUseCode;
    endUseValid.in[1] <== 0;
    endUseValid.out === 1;

    // ===== 11. Create Trade Commitment =====
    component tradeHash = Poseidon(6);
    tradeHash.inputs[0] <== exporterCommit;
    tradeHash.inputs[1] <== importerHash.out;
    tradeHash.inputs[2] <== productCodes[0];  // Primary product code
    tradeHash.inputs[3] <== productValue;
    tradeHash.inputs[4] <== importerCountry;
    tradeHash.inputs[5] <== transactionTimestamp;
    tradeHash.out === tradeCommitment;

    // ===== 12. Generate Compliance Certificate Hash =====
    component certHash = Poseidon(5);
    certHash.inputs[0] <== tradeCommitment;
    certHash.inputs[1] <== jurisdictionCode;
    certHash.inputs[2] <== transactionTimestamp;
    certHash.inputs[3] <== needsLicense;
    certHash.inputs[4] <== licenseCheckPassed;
    certHash.out === complianceCertHash;
}

component main {public [tradeCommitment, exporterCommit, complianceRoot, jurisdictionCode, transactionTimestamp, complianceCertHash, sanctionsListRoot, controlledGoodsRoot, embargoedCountriesRoot, licenseExemptionThreshold]} =
    TradeCompliance(5, 12);
```

### 주요 제약 조건

1. **수출업체 권한 부여**: 수출업체가 신원과 거래 권한을 증명합니다
2. **제재 승인**: 수입업체와 최종 사용자가 제재 목록에 없음
3. **금수 조치 준수**: 목적지 국가가 금수 조치 대상이 아님
4. **통제 물품**: 제품이 통제 목록에 대해 확인됨
5. **허가 유효성**: 필요한 경우 허가가 유효하고 거래를 커버함
6. **최종 용도 검증**: 선언된 최종 용도가 허용된 카테고리임

## 효과

| Aspect | Impact |
|--------|--------|
| **무역 프라이버시** | 고객 신원과 거래량이 숨겨짐 |
| **준수 증명** | 규제 기관이 무역 세부 정보 없이 준수를 검증할 수 있음 |
| **경쟁 보호** | 무역 패턴과 관계가 은폐됨 |
| **효율적인 심사** | 수동 검토 없이 자동화된 준수 |
| **다중 관할권** | 단일 증명이 여러 규제 체제를 충족할 수 있음 |

## 보안 고려사항

| Risk | Mitigation |
|------|------------|
| **제재 회피** | 현재 제재 목록에 대한 비포함 증명 |
| **페이퍼 컴퍼니 사용** | 최종 사용자 심사가 수입업체와 별도로 수행됨 |
| **통제 물품 오분류** | 제품 코드가 권위 있는 목록에 대해 검증됨 |
| **허가 사기** | 허가 유효성과 커버리지가 circuit에서 검증됨 |
| **환적** | 최종 사용자 국가가 별도로 검증됨 |
| **목록 오래됨** | 타임스탬프가 목록이 거래 시점에 최신임을 보장 |

## 구현 과제

1. **목록 유지 관리**
   - 제재 목록이 자주 업데이트됨 (때로는 매일)
   - 여러 중복 목록 (OFAC, EU, UN)
   - 실소유자 심사를 위한 소유권 체인 복잡성
   - 퍼지 이름 매칭 요구사항

2. **제품 분류**
   - HS 코드, ECCN 코드, 이중 용도 분류가 관할권에 따라 다름
   - 기술 사양이 통제 상태를 결정
   - 분류 분쟁이 일반적

3. **허가 추적**
   - 허가는 가치 제한, 만료 날짜, 조건을 가짐
   - 허가 제한에 대한 부분 배송
   - 허가 수정 및 이전

4. **국경 간 조정**
   - 국가 A에서 수출, 국가 B로 수입, 국가 C에서 최종 사용
   - 각 관할권에서 다른 규칙 적용
   - 상충하는 요구사항 해결

## 파생 상품

1. **Export Control Verification** - 수출 통제 준수를 위한 특수 circuit. 제품 사양을 공개하지 않고 제품 분류가 특정 목적지에 대한 허가를 요구하지 않거나 유효한 허가가 존재함을 증명합니다.

2. **Embargo Compliance** - 거래가 금수 조치 국가를 포함하지 않음을 증명합니다. 자회사 또는 계열사를 통한 금수 조치 기업과의 간접적 관련을 감지하기 위한 소유권 체인 분석을 포함합니다.

3. **Dual-Use Goods Check** - 물품이 금지된 목적으로 사용되지 않을 것임을 검증합니다. 특정 응용 프로그램 세부 정보를 공개하지 않고 최종 용도 인증이 유효하고 허용된 카테고리와 일치함을 증명합니다.

4. **End-User Certification** - 최종 사용자 신원과 의도된 용도를 검증합니다. 거부 당사자 목록에 대해 검증된 적절한 사용 사례를 가진 합법적인 상업 기업임을 증명합니다.

5. **Trade Finance Compliance** - 무역 준수를 금융 제재 심사와 결합합니다. 지급 경로가 제재 대상 은행을 포함하지 않고 거래 구조가 준수함을 증명합니다.

## 사용 사례

1. **기술 수출**
   - 소프트웨어 회사가 암호화 제품을 수출
   - 증명: 제품이 이 수준에서 통제되지 않음, 고객이 제재 대상이 아님
   - 숨겨짐: 고객 신원, 정확한 제품 사양
   - 경쟁 정보 누출 없이 준수하는 수출 가능

2. **방위 산업체 공급망**
   - 계약자가 글로벌 공급업체로부터 부품을 조달
   - 증명: 공급업체가 거부 당사자 목록에 없음, 금수 조치 국가 관련 없음
   - 숨겨짐: 공급업체 신원, 부품 사양, 거래량
   - ITAR/EAR 요구사항을 비공개로 충족

3. **제약 유통**
   - 제약 회사가 외국 유통업체에 배송
   - 증명: 유통업체가 허가됨, 제재 목록에 없음, 국가가 금수 조치 대상이 아님
   - 숨겨짐: 유통업체 신원, 거래량, 가격
   - 시장 정보 노출 없이 준수하는 유통 가능

4. **산업 장비 판매**
   - 기계 제조업체가 외국 공장에 판매
   - 증명: 장비가 이중 용도 통제 대상이 아님, 최종 용도가 민간 제조업임
   - 숨겨짐: 구매자 신원, 특정 장비 모델, 가격
   - 고객 관계를 공개하지 않고 준수하는 수출

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 시나리오는 [실제 제품 및 사용자 경험](../../product/g-enterprise/g8-trade-compliance-products.md)을 참조하십시오.

---

[목차로 돌아가기](../../README.md)
