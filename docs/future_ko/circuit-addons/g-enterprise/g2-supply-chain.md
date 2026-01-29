# G2. Supply Chain Transfer

공급망 참여자 간 물품 이전의 비공개 검증으로 거래량, 가격 및 비즈니스 관계를 숨깁니다.

**Constraints**: ~180K | **Complexity**: Medium

---

## 배경

공급망 데이터는 중요한 경쟁 정보를 나타냅니다:

- **거래량 기밀 유지**: 생산 수량은 시장 수요와 비즈니스 규모를 드러냅니다
- **가격 비밀 유지**: 이전 가격은 마진과 협상 위치를 노출합니다
- **관계 프라이버시**: 공급업체-구매자 연결은 전략적 자산입니다; 노출은 경쟁업체의 인력 빼가기를 가능하게 합니다
- **출처 무결성**: 진품 제품은 전체 체인 세부 정보를 공개하지 않고도 검증 가능해야 합니다

기존 공급망 시스템은 검증이 부족하거나 (신뢰 기반) 민감한 데이터를 노출합니다 (블록체인 기반). ZK 공급망 이전은 상업적으로 민감한 세부 정보를 공개하지 않고 이전, 품질 인증 및 출처의 암호화 검증을 가능하게 합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `transferId` | field | 이 이전에 대한 고유 식별자 |
| `senderCommit` | field | 발신자 신원에 대한 commitment |
| `receiverCommit` | field | 수신자 신원에 대한 commitment |
| `goodsHash` | field | 물품 설명/SKU의 해시 |
| `qualityCertRoot` | field | 품질 인증의 Merkle root |
| `timestamp` | uint | 이전 타임스탬프 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `senderPkX, senderPkY` | field | 발신자의 public key |
| `senderSk` | field | 발신자의 secret key |
| `receiverPkX, receiverPkY` | field | 수신자의 public key |
| `quantity` | uint | 이전 수량 |
| `unitPrice` | uint | 단가 |
| `goodsDescription` | field[] | 물품 식별자/SKU 데이터 |
| `certifications` | field[] | 품질 인증 해시 |
| `certProofs` | field[][] | 인증에 대한 Merkle proof |
| `senderSalt, receiverSalt` | field | 신원 commitment 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_hash.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template SupplyChainTransfer(NUM_CERTS, TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input transferId;
    signal input senderCommit;
    signal input receiverCommit;
    signal input goodsHash;
    signal input qualityCertRoot;
    signal input timestamp;

    // ===== Private Inputs =====
    signal input senderPkX, senderPkY;
    signal input senderSk;
    signal input receiverPkX, receiverPkY;
    signal input quantity;
    signal input unitPrice;
    signal input goodsDescription[4];
    signal input certifications[NUM_CERTS];
    signal input certProofs[NUM_CERTS][TREE_DEPTH];
    signal input certProofIndices[NUM_CERTS][TREE_DEPTH];
    signal input senderSalt;
    signal input receiverSalt;

    // ===== 1. Verify Sender Identity Commitment =====
    component senderCommitHash = Poseidon(3);
    senderCommitHash.inputs[0] <== senderPkX;
    senderCommitHash.inputs[1] <== senderPkY;
    senderCommitHash.inputs[2] <== senderSalt;
    senderCommitHash.out === senderCommit;

    // ===== 2. Verify Sender Ownership =====
    component senderOwnership = ProofOfOwnershipStrict();
    senderOwnership.sk <== senderSk;
    senderOwnership.pkX <== senderPkX;
    senderOwnership.pkY <== senderPkY;

    // ===== 3. Verify Receiver Identity Commitment =====
    component receiverCommitHash = Poseidon(3);
    receiverCommitHash.inputs[0] <== receiverPkX;
    receiverCommitHash.inputs[1] <== receiverPkY;
    receiverCommitHash.inputs[2] <== receiverSalt;
    receiverCommitHash.out === receiverCommit;

    // ===== 4. Verify Goods Description Hash =====
    component goodsHasher = Poseidon(4);
    for (var i = 0; i < 4; i++) {
        goodsHasher.inputs[i] <== goodsDescription[i];
    }
    goodsHasher.out === goodsHash;

    // ===== 5. Verify Quantity and Price Are Valid =====
    component quantityCheck = GreaterThan(64);
    quantityCheck.in[0] <== quantity;
    quantityCheck.in[1] <== 0;
    quantityCheck.out === 1;

    component priceCheck = GreaterThan(64);
    priceCheck.in[0] <== unitPrice;
    priceCheck.in[1] <== 0;
    priceCheck.out === 1;

    // ===== 6. Verify Quality Certifications =====
    component certMerkle[NUM_CERTS];
    for (var i = 0; i < NUM_CERTS; i++) {
        certMerkle[i] = MerkleProof(TREE_DEPTH);
        certMerkle[i].leaf <== certifications[i];
        certMerkle[i].root <== qualityCertRoot;
        for (var j = 0; j < TREE_DEPTH; j++) {
            certMerkle[i].siblings[j] <== certProofs[i][j];
            certMerkle[i].pathIndices[j] <== certProofIndices[i][j];
        }
    }

    // ===== 7. Create Transfer Record Commitment =====
    signal output transferRecord;
    component transferHash = Poseidon(6);
    transferHash.inputs[0] <== transferId;
    transferHash.inputs[1] <== senderCommit;
    transferHash.inputs[2] <== receiverCommit;
    transferHash.inputs[3] <== goodsHash;
    transferHash.inputs[4] <== quantity;
    transferHash.inputs[5] <== timestamp;
    transferRecord <== transferHash.out;
}

component main {public [transferId, senderCommit, receiverCommit, goodsHash, qualityCertRoot, timestamp]} =
    SupplyChainTransfer(5, 8);
```

### 주요 제약 조건

1. **발신자 권한 부여**: 유효한 secret key를 가진 발신자만 이전을 시작할 수 있습니다
2. **신원 바인딩**: Public commitment가 실제 신원을 공개하지 않고 바인딩합니다
3. **물품 무결성**: 물품 해시가 비공개 설명 데이터와 일치합니다
4. **인증 유효성**: 참조된 모든 인증이 유효한 인증 트리에 존재합니다
5. **양수 값**: 수량과 가격은 0보다 커야 합니다

## 효과

| Aspect | Impact |
|--------|--------|
| **경쟁 보호** | 거래량과 가격이 경쟁업체로부터 숨겨짐 |
| **관계 프라이버시** | 공급업체-구매자 연결이 시장으로부터 은폐됨 |
| **출처 검증** | 물품 진위를 전체 체인 노출 없이 검증 가능 |
| **규제 준수** | 감사자를 위한 선택적 공개 가능 |
| **위조품 방지** | 승인된 이전의 암호화 증명 |

## 보안 고려사항

| Risk | Mitigation |
|------|------------|
| **가짜 인증** | 인증은 오라클 관리 Merkle 트리에 존재해야 함 |
| **이전 재생** | 고유한 transferId가 중복 이전 주장을 방지 |
| **발신자 사칭** | 소유권 증명이 발신자 권한 부여를 검증 |
| **공모** | 고가치 이전에 대한 다자간 검증 |
| **데이터 상관관계** | 이전당 다른 salt가 연결 가능성을 방지 |
| **타임스탬프 조작** | 블록 타임스탬프 또는 신뢰할 수 있는 타임스탬프 서비스 사용 |

## 구현 과제

1. **인증 오라클 관리**
   - 누가 인증 Merkle 트리를 유지하는가?
   - 새 인증은 어떻게 추가되고 오래된 것은 어떻게 취소되는가?
   - 국경 간 인증 인정

2. **신원 시스템 통합**
   - 실제 비즈니스 신원을 ZK commitment에 매핑
   - 장기 비즈니스 관계를 위한 키 복구 및 순환
   - 새로운 공급망 참여자를 위한 온보딩 프로세스

3. **물품 추적 연속성**
   - 체인을 통해 물품을 추적하기 위한 여러 이전 연결
   - 물품 변환 처리 (원자재에서 제품으로)
   - 배치 분할 및 결합

4. **분쟁 해결**
   - 수신자가 이의를 제기하는 경우 이전 발생을 증명하는 방법
   - 중재를 위한 선택적 공개
   - 증거 보존 요구사항

## 파생 상품

1. **Multi-Party Supply Chain** - 중개자를 통한 다중 홉 이전을 처리하도록 확장됩니다. 단일 증명이 원산지에서 목적지까지의 전체 체인을 검증하여 중간 당사자를 공개하지 않고 각 핸드오프가 승인되었음을 증명합니다.

2. **Quality Verification** - 실시간 품질 입증을 위해 IoT 센서 데이터를 통합합니다. Circuit은 센서 판독값이 허용 범위 내에 있고 센서 신원이 승인되었는지 검증하여 자동화된 품질 게이트를 가능하게 합니다.

3. **Origin Tracking** - 물품이 인증된 출처에서 유래함을 증명합니다 (예: 분쟁 없는 광물, 지속 가능한 농장). 재귀적 증명이 전체 출처 이력을 단일 검증으로 압축합니다.

4. **Customs Integration** - 관세 계산을 위해 물품 분류 및 원산지를 보여주는 세관 호환 증명을 생성합니다. 상업 조건을 숨기면서 세관 당국이 요구하는 정보만 공개합니다.

5. **IoT Attestation** - IoT 장치 서명을 통해 물리적 물품을 디지털 기록에 연결합니다. Circuit은 장치 입증, 변조 방지 씰 상태 및 GPS 좌표가 예상 경로와 일치하는지 검증합니다.

## 사용 사례

1. **제약 공급망**
   - 약품 제조업체가 유통업체에 배송
   - 증명 검증: 승인된 제조업체, 유효한 배치, 온도 준수
   - 숨겨짐: 정확한 수량, 가격, 특정 시설 신원
   - 정상 운영을 노출하지 않고 리콜 기능 활성화

2. **명품 인증**
   - 고급 브랜드가 승인된 소매업체에 물품 이전
   - 증명 검증: 정품 제품, 승인된 채널, 인증 유효성
   - 소비자는 판매자가 공급업체를 공개하지 않고 진위를 검증 가능
   - 회색 시장 전용 감지 방지

3. **농산물**
   - 농장이 가공업체에 곡물 판매
   - 증명 검증: 유기농 인증, 원산지 지역, 등급
   - 숨겨짐: 정확한 농장, 거래량, 부셸당 가격
   - 경쟁 정보 누출 없이 프리미엄 검증 가능

4. **전자 부품 공급**
   - 반도체 공급업체가 제조업체에 칩 배송
   - 증명 검증: 승인된 출처, 위조품 아님, 사양 충족
   - 숨겨짐: 거래량 (생산 계획 공개), 가격 (마진 공개)
   - 방위 및 항공우주 공급망에 중요

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 시나리오는 [실제 제품 및 사용자 경험](../../product/g-enterprise/g2-supply-chain-products.md)을 참조하십시오.

---

[목차로 돌아가기](../../README.md)
