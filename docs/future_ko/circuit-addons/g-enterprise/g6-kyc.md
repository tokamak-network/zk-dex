# G6. KYC Verify

기본 신원 문서를 공개하지 않고 특정 속성(연령, 거주지, 인증)을 증명하는 프라이버시 보존 신원 검증.

**Constraints**: ~150K | **Complexity**: Medium

---

## 배경

KYC (Know Your Customer)는 근본적인 프라이버시 긴장을 만듭니다:

- **데이터 최소화**: GDPR과 같은 규정은 필요한 데이터만 수집하도록 요구하지만, KYC는 종종 과도한 정보를 요구합니다
- **신원 도용 위험**: 중앙화된 KYC 데이터 저장소는 주요 표적입니다; 유출은 민감한 개인 정보를 노출합니다
- **반복적 검증**: 사용자는 각 서비스에 문서를 다시 제출하여 노출 위험을 배가시킵니다
- **속성 대 신원**: 서비스는 전체 신원이 아닌 속성(18세 이상, 인증된 투자자)을 검증해야 합니다

현재 KYC 시스템은 특정 속성만 중요할 때도 전체 신원 공개를 요구합니다. ZK KYC는 문서 자체나 불필요한 개인 정보를 공개하지 않고 검증된 신원 문서에서 파생된 속성을 증명할 수 있게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `attributeCommitment` | field | 주장된 속성에 대한 commitment |
| `verifierCommit` | field | KYC 검증자 신원에 대한 commitment |
| `documentRoot` | field | 검증된 신원 문서의 Merkle root |
| `verificationTimestamp` | uint | 검증이 수행된 시간 |
| `expiryTimestamp` | uint | 검증이 만료되는 시간 |
| `jurisdictionCode` | uint | 적용 가능한 관할권 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `userPkX, userPkY` | field | 사용자의 public key |
| `userSk` | field | 사용자의 secret key |
| `dateOfBirth` | uint | 사용자의 생년월일 (타임스탬프) |
| `countryCode` | uint | 사용자의 거주/시민권 국가 |
| `documentType` | uint | 신원 문서 유형 |
| `documentId` | field | 문서 식별자 해시 |
| `documentExpiry` | uint | 문서 만료 날짜 |
| `issuerSignature` | field[] | 문서에 대한 발급자의 서명 |
| `documentProof` | field[] | 문서 유효성에 대한 Merkle proof |
| `userSalt` | field | 신원 commitment 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/babyjubjub/signature_verify.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template KYCVerify(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input attributeCommitment;
    signal input verifierCommit;
    signal input documentRoot;
    signal input verificationTimestamp;
    signal input expiryTimestamp;
    signal input jurisdictionCode;

    // ===== Attribute Requirements (Public) =====
    signal input minAge;                    // Minimum age in years (0 if not checked)
    signal input allowedCountries[10];      // Allowed country codes (0 = any)
    signal input requiredDocTypes[5];       // Required document types (0 = any)
    signal input accreditationRequired;     // 1 if accredited investor status required

    // ===== Private Inputs =====
    signal input userPkX, userPkY;
    signal input userSk;
    signal input userSalt;

    signal input dateOfBirth;
    signal input countryCode;
    signal input documentType;
    signal input documentId;
    signal input documentExpiry;

    signal input issuerPkX, issuerPkY;
    signal input issuerSigR8x, issuerSigR8y, issuerSigS;

    signal input documentProof[TREE_DEPTH];
    signal input documentProofIndices[TREE_DEPTH];

    signal input verifierPkX, verifierPkY;
    signal input verifierSalt;

    signal input accreditationStatus;
    signal input accreditationExpiry;
    signal input netWorthBracket;           // 0: <1M, 1: 1-5M, 2: >5M

    // ===== 1. Verify User Ownership =====
    component userOwnership = ProofOfOwnershipStrict();
    userOwnership.sk <== userSk;
    userOwnership.pkX <== userPkX;
    userOwnership.pkY <== userPkY;

    // ===== 2. Verify Verifier Identity =====
    component verifierCommitHash = Poseidon(3);
    verifierCommitHash.inputs[0] <== verifierPkX;
    verifierCommitHash.inputs[1] <== verifierPkY;
    verifierCommitHash.inputs[2] <== verifierSalt;
    verifierCommitHash.out === verifierCommit;

    // ===== 3. Create Document Hash =====
    component documentHash = Poseidon(6);
    documentHash.inputs[0] <== userPkX;
    documentHash.inputs[1] <== dateOfBirth;
    documentHash.inputs[2] <== countryCode;
    documentHash.inputs[3] <== documentType;
    documentHash.inputs[4] <== documentId;
    documentHash.inputs[5] <== documentExpiry;

    // ===== 4. Verify Issuer Signature on Document =====
    component sigVerify = EdDSAVerify();
    sigVerify.msg <== documentHash.out;
    sigVerify.pubKeyX <== issuerPkX;
    sigVerify.pubKeyY <== issuerPkY;
    sigVerify.R8x <== issuerSigR8x;
    sigVerify.R8y <== issuerSigR8y;
    sigVerify.S <== issuerSigS;

    // ===== 5. Verify Document in Trusted Issuer Tree =====
    component issuerLeaf = Poseidon(2);
    issuerLeaf.inputs[0] <== issuerPkX;
    issuerLeaf.inputs[1] <== issuerPkY;

    component documentMerkle = MerkleProof(TREE_DEPTH);
    documentMerkle.leaf <== issuerLeaf.out;
    documentMerkle.root <== documentRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        documentMerkle.siblings[i] <== documentProof[i];
        documentMerkle.pathIndices[i] <== documentProofIndices[i];
    }

    // ===== 6. Verify Document Not Expired =====
    component docExpiryCheck = GreaterThan(64);
    docExpiryCheck.in[0] <== documentExpiry;
    docExpiryCheck.in[1] <== verificationTimestamp;
    docExpiryCheck.out === 1;

    // ===== 7. Age Verification =====
    signal userAge;
    // Convert timestamps to approximate years (seconds / 31536000)
    userAge <-- (verificationTimestamp - dateOfBirth) / 31536000;

    // Verify age calculation is approximately correct
    signal ageInSeconds;
    ageInSeconds <== userAge * 31536000;
    component ageCalcCheck = LessEqThan(64);
    ageCalcCheck.in[0] <== ageInSeconds;
    ageCalcCheck.in[1] <== verificationTimestamp - dateOfBirth;
    ageCalcCheck.out === 1;

    // Check minimum age requirement
    component ageCheck = GreaterEqThan(32);
    ageCheck.in[0] <== userAge;
    ageCheck.in[1] <== minAge;
    ageCheck.out === 1;

    // ===== 8. Country Verification =====
    // Check if country is in allowed list (at least one match, or first is 0 meaning any)
    signal countryMatches[10];
    signal countryMatchSum[11];
    countryMatchSum[0] <== 0;

    component countryEq[10];
    component anyCountryCheck;

    for (var i = 0; i < 10; i++) {
        countryEq[i] = IsEqual();
        countryEq[i].in[0] <== countryCode;
        countryEq[i].in[1] <== allowedCountries[i];
        countryMatches[i] <== countryEq[i].out;
        countryMatchSum[i + 1] <== countryMatchSum[i] + countryMatches[i];
    }

    // Either country matches one in list, or first allowed country is 0 (any)
    component firstIsZero = IsZero();
    firstIsZero.in <== allowedCountries[0];

    signal countryValid;
    countryValid <== firstIsZero.out + (1 - firstIsZero.out) * (countryMatchSum[10] > 0 ? 1 : 0);

    // ===== 9. Accreditation Check (if required) =====
    component accredRequired = IsEqual();
    accredRequired.in[0] <== accreditationRequired;
    accredRequired.in[1] <== 1;

    // If accreditation required, status must be valid and not expired
    component accredStatusCheck = GreaterEqThan(8);
    accredStatusCheck.in[0] <== accreditationStatus;
    accredStatusCheck.in[1] <== accredRequired.out;

    component accredExpiryCheck = GreaterThan(64);
    accredExpiryCheck.in[0] <== accreditationExpiry;
    accredExpiryCheck.in[1] <== verificationTimestamp;

    // Accreditation valid if not required OR (status valid AND not expired)
    signal accredValid;
    accredValid <== (1 - accredRequired.out) + accredRequired.out * accredStatusCheck.out * accredExpiryCheck.out;

    // ===== 10. Create Attribute Commitment =====
    component attrCommit = Poseidon(6);
    attrCommit.inputs[0] <== userPkX;
    attrCommit.inputs[1] <== userAge >= minAge ? 1 : 0;
    attrCommit.inputs[2] <== countryCode;
    attrCommit.inputs[3] <== accreditationStatus;
    attrCommit.inputs[4] <== verificationTimestamp;
    attrCommit.inputs[5] <== userSalt;
    attrCommit.out === attributeCommitment;

    // ===== 11. Verify Expiry Is Valid =====
    component expiryValid = GreaterThan(64);
    expiryValid.in[0] <== expiryTimestamp;
    expiryValid.in[1] <== verificationTimestamp;
    expiryValid.out === 1;
}

component main {public [attributeCommitment, verifierCommit, documentRoot, verificationTimestamp, expiryTimestamp, jurisdictionCode, minAge, allowedCountries, requiredDocTypes, accreditationRequired]} =
    KYCVerify(10);
```

### 주요 제약 조건

1. **사용자 소유권**: 사용자가 자신의 신원 키에 대한 제어를 증명합니다
2. **문서 진위성**: 문서가 검증된 발급자 트리의 신뢰할 수 있는 발급자에 의해 서명됨
3. **문서 유효성**: 문서가 검증 시점에 만료되지 않음
4. **연령 요구사항**: 사용자 연령이 최소 임계값을 충족함
5. **지리적 준수**: 사용자 국가가 허용된 관할권 목록에 있음
6. **인증 상태**: 필요한 경우 유효하고 만료되지 않음

## 효과

| Aspect | Impact |
|--------|--------|
| **데이터 최소화** | 전체 신원이 아닌 필요한 속성만 공개됨 |
| **유출 보호** | 유출할 중앙 신원 데이터베이스 없음 |
| **재사용성** | 단일 증명이 여러 서비스에서 작동함 |
| **규제 준수** | GDPR 데이터 최소화 원칙이 충족됨 |
| **사용자 제어** | 사용자가 언제 무엇을 공개할지 결정 |

## 보안 고려사항

| Risk | Mitigation |
|------|------------|
| **가짜 문서** | 문서는 신뢰할 수 있는 트리의 발급자가 서명해야 함 |
| **문서 공유** | 소유권 증명이 타인의 문서 사용을 방지 |
| **만료된 검증** | 만료 타임스탬프가 재검증을 강제 |
| **관할권 쇼핑** | 국가 코드가 허용 목록에 대해 검증됨 |
| **인증 사기** | 인증 상태가 승인된 검증자에 의해 서명됨 |
| **재생 공격** | 타임스탬프와 검증자 commitment가 재생을 방지 |

## 구현 과제

1. **발급자 온보딩**
   - 어떤 정부 기관과 기관이 신뢰할 수 있는 발급자인가?
   - 신뢰할 수 있는 트리에서 발급자를 추가/제거하는 방법?
   - 국제 발급자 인정

2. **문서 디지털화**
   - 물리적 문서를 서명된 디지털 형식으로 변환하는 방법?
   - 디지털화 중 문서 변조 방지
   - 문서 도용 방지를 위한 생체 인식 바인딩

3. **속성 표준화**
   - 다른 관할권은 속성을 다르게 정의함
   - 성년 연령이 국가마다 다름
   - 인증된 투자자 정의가 다름

4. **취소 처리**
   - 손상된 문서를 취소하는 방법?
   - 실시간 취소 확인
   - 프라이버시와 취소 기능의 균형

## 파생 상품

1. **Age Verification** - 다른 속성 없이 연령 임계값만 증명하는 단순화된 circuit. 연령 제한 구매를 위한 최소 공개; 정확한 생년월일이나 신원 세부 정보를 공개하지 않고 18/21세 이상임을 증명합니다.

2. **Residency Proofs** - 세금 또는 규제 목적으로 특정 관할권의 거주를 증명합니다. 정확한 주소나 기타 개인 세부 정보를 공개하지 않고 현지 규정 준수를 가능하게 합니다.

3. **Identity Reuse** - 여러 플랫폼에서 이식 가능한 단일 KYC 검증. 사용자가 문서를 다시 공개하지 않고 다른 곳에서 KYC를 통과했음을 증명하며, 서비스별 속성 필터링이 가능합니다.

4. **KYC Portability** - 선택적 속성 공유가 있는 교차 플랫폼 신원 연합. 다른 서비스가 동일한 기본 신원에서 다른 속성을 볼 수 있으며; 사용자가 각각이 보는 것을 제어합니다.

5. **Tiered KYC Levels** - 거래 가치 또는 위험 수준에 따른 점진적 공개. 기본 계층은 연령만 요구하고; 상위 계층은 인증 또는 강화된 검증을 추가하며, 각각 자체 증명이 있습니다.

## 사용 사례

1. **거래소 온보딩**
   - 사용자가 암호화폐 거래소에서 거래를 원함
   - 18세 이상이고 허용된 관할권에 거주함을 증명
   - 거래소는 여권을 보지 않고 속성 증명만 봄
   - 동일한 증명이 여러 거래소에서 작동함

2. **인증된 투자자 검증**
   - 투자 플랫폼이 인증된 투자자 상태를 요구
   - 사용자가 정확한 금액을 공개하지 않고 순자산 구간을 증명
   - 플랫폼이 세금 신고서를 보지 않고 인증을 검증
   - 준수하는 사모 증권 거래 가능

3. **연령 제한 전자상거래**
   - 온라인 소매업체가 주류 판매를 위해 연령 검증을 요구
   - 고객이 생년월일을 공개하지 않고 21세 이상임을 증명
   - 소매업체가 신원 데이터를 저장하지 않음
   - 정의된 기간 동안 증명이 유효하다가 만료됨

4. **국경 간 금융 서비스**
   - 사용자가 외국 금융 기관에서 계좌 개설
   - 시민권, 거주지 및 제재 대상이 아닌 상태를 증명
   - 기관이 전체 여권 사본 없이 준수를 검증
   - 최소 데이터 노출로 규제 요구사항을 충족

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 시나리오는 [실제 제품 및 사용자 경험](../../../product/g-enterprise/g6-kyc-products.md)을 참조하십시오.

---

[목차로 돌아가기](../../README.md)
