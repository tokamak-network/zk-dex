# B5. 타임아웃이 있는 에스크로 (Escrow with Timeout)

자동 타임아웃 출시가 있는 다자간 에스크로로, 숨겨진 거래 조건과 중재자 매개 분쟁으로 무신뢰 거래 정산을 가능하게 합니다.

**제약 조건**: ~220K | **복잡도**: 중간

---

## 배경

에스크로는 무신뢰 상거래의 기본입니다:

- **상대방 위험**: 온라인 거래는 지급 후 상품/서비스가 제공될 것이라는 신뢰가 필요
- **분쟁 해결**: 전통적인 에스크로는 거래에 대한 완전한 가시성을 가진 중앙화된 중재자에 의존
- **타임아웃 문제**: 당사자가 협력하지 않으면 자금이 무기한 잠길 수 있음
- **프라이버시 노출**: 현재 온체인 에스크로는 거래 금액, 당사자, 중재자 신원을 드러냄

전통적인 에스크로 서비스는 중앙화되어 있으며 완전한 거래 투명성이 필요합니다. 온체인 에스크로 컨트랙트(OpenZeppelin의 Escrow 같은)는 모든 세부사항을 노출합니다. ZK 에스크로는 거래 조건, 당사자, 중재자를 숨기면서 승인 또는 타임아웃에 기반한 무신뢰 출시를 가능하게 합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `escrowHash` | field | 에스크로 노트의 해시 |
| `outputHash` | field | 출시된 자금의 해시 |
| `currentTime` | uint | 현재 block.timestamp |
| `releaseType` | uint | 0=구매자, 1=판매자, 2=중재자, 3=타임아웃 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `buyerPkX, buyerPkY` | field | 구매자의 공개 키 |
| `sellerPkX, sellerPkY` | field | 판매자의 공개 키 |
| `arbiterPkX, arbiterPkY` | field | 중재자의 공개 키 |
| `value` | uint | 에스크로된 금액 |
| `tokenType` | uint | 토큰 타입 식별자 |
| `timeoutTime` | uint | 자동 출시를 위한 타임아웃 타임스탬프 |
| `salt` | field | 에스크로 노트 무작위성 |
| `releaserSk` | field | 승인 당사자의 비밀 키 |
| `recipientPkX, recipientPkY` | field | 수취인의 공개 키 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/scalar_mul_base.circom";
include "../utils/comparators.circom";

template EscrowRelease() {
    // ===== Public Inputs =====
    signal input escrowHash;
    signal input outputHash;
    signal input currentTime;
    signal input releaseType;        // 0=buyer, 1=seller, 2=arbiter, 3=timeout

    // ===== Private Inputs =====
    signal input buyerPkX, buyerPkY;
    signal input sellerPkX, sellerPkY;
    signal input arbiterPkX, arbiterPkY;
    signal input value, tokenType, timeoutTime, salt;
    signal input releaserSk;
    signal input recipientPkX, recipientPkY, outSalt;

    // ===== 1. Verify Escrow Note =====
    component escrow = Poseidon(11);
    escrow.inputs[0] <== buyerPkX;
    escrow.inputs[1] <== buyerPkY;
    escrow.inputs[2] <== sellerPkX;
    escrow.inputs[3] <== sellerPkY;
    escrow.inputs[4] <== arbiterPkX;
    escrow.inputs[5] <== arbiterPkY;
    escrow.inputs[6] <== value;
    escrow.inputs[7] <== tokenType;
    escrow.inputs[8] <== timeoutTime;
    escrow.inputs[9] <== salt;
    escrow.inputs[10] <== 0;  // escrowType: 0 = standard escrow
    escrow.out === escrowHash;

    // ===== 2. Validate releaseType =====
    // releaseType must be 0, 1, 2, or 3
    component isType0 = IsEqual();
    isType0.in[0] <== releaseType;
    isType0.in[1] <== 0;

    component isType1 = IsEqual();
    isType1.in[0] <== releaseType;
    isType1.in[1] <== 1;

    component isType2 = IsEqual();
    isType2.in[0] <== releaseType;
    isType2.in[1] <== 2;

    component isType3 = IsEqual();
    isType3.in[0] <== releaseType;
    isType3.in[1] <== 3;

    signal validType;
    validType <== isType0.out + isType1.out + isType2.out + isType3.out;
    validType === 1;

    // ===== 3. Derive Releaser Public Key from Secret Key =====
    component releaserPk = BabyJubJubScalarMulBase();
    releaserPk.scalar <== releaserSk;

    // ===== 4. Verify Authorization Based on Release Type =====

    // Type 0 (Buyer Release): Buyer authorizes release to seller
    // Buyer signs, recipient must be seller
    signal buyerAuth;
    buyerAuth <== isType0.out * (
        (1 - (releaserPk.outX - buyerPkX)) * (1 - (releaserPk.outY - buyerPkY)) *
        (1 - (recipientPkX - sellerPkX)) * (1 - (recipientPkY - sellerPkY))
    );

    // Simplified authorization checks
    // For buyer release: verify releaser is buyer, recipient is seller
    component buyerMatch = IsEqual();
    buyerMatch.in[0] <== releaserPk.outX;
    buyerMatch.in[1] <== buyerPkX;

    component buyerMatchY = IsEqual();
    buyerMatchY.in[0] <== releaserPk.outY;
    buyerMatchY.in[1] <== buyerPkY;

    component sellerRecipientX = IsEqual();
    sellerRecipientX.in[0] <== recipientPkX;
    sellerRecipientX.in[1] <== sellerPkX;

    component sellerRecipientY = IsEqual();
    sellerRecipientY.in[0] <== recipientPkY;
    sellerRecipientY.in[1] <== sellerPkY;

    // For seller release: verify releaser is seller, recipient is buyer
    component sellerMatch = IsEqual();
    sellerMatch.in[0] <== releaserPk.outX;
    sellerMatch.in[1] <== sellerPkX;

    component sellerMatchY = IsEqual();
    sellerMatchY.in[0] <== releaserPk.outY;
    sellerMatchY.in[1] <== sellerPkY;

    component buyerRecipientX = IsEqual();
    buyerRecipientX.in[0] <== recipientPkX;
    buyerRecipientX.in[1] <== buyerPkX;

    component buyerRecipientY = IsEqual();
    buyerRecipientY.in[0] <== recipientPkY;
    buyerRecipientY.in[1] <== buyerPkY;

    // For arbiter release: verify releaser is arbiter (recipient can be anyone)
    component arbiterMatch = IsEqual();
    arbiterMatch.in[0] <== releaserPk.outX;
    arbiterMatch.in[1] <== arbiterPkX;

    component arbiterMatchY = IsEqual();
    arbiterMatchY.in[0] <== releaserPk.outY;
    arbiterMatchY.in[1] <== arbiterPkY;

    // Timeout check: currentTime >= timeoutTime
    component timeoutCheck = GreaterEqThan(64);
    timeoutCheck.in[0] <== currentTime;
    timeoutCheck.in[1] <== timeoutTime;

    // ===== 5. Combine Authorization Logic =====
    signal type0Valid;
    type0Valid <== isType0.out * buyerMatch.out * buyerMatchY.out *
                   sellerRecipientX.out * sellerRecipientY.out;

    signal type1Valid;
    type1Valid <== isType1.out * sellerMatch.out * sellerMatchY.out *
                   buyerRecipientX.out * buyerRecipientY.out;

    signal type2Valid;
    type2Valid <== isType2.out * arbiterMatch.out * arbiterMatchY.out;

    signal type3Valid;
    type3Valid <== isType3.out * timeoutCheck.out;  // Timeout: no signature needed

    signal authValid;
    authValid <== type0Valid + type1Valid + type2Valid + type3Valid;
    authValid === 1;

    // ===== 6. Create Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== recipientPkX;
    outNote.pkY <== recipientPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [escrowHash, outputHash, currentTime, releaseType]} =
    EscrowRelease();
```

### 핵심 제약 조건

1. **에스크로 노트 검증**: 모든 당사자(구매자, 판매자, 중재자)가 해시에 커밋됨
2. **출시 유형 검증**: 유형은 정확히 0, 1, 2 또는 3이어야 함
3. **구매자 출시 (유형 0)**: 구매자가 서명하고, 자금이 판매자에게 감 (상품 수령)
4. **판매자 출시 (유형 1)**: 판매자가 서명하고, 자금이 구매자에게 반환됨 (환불/취소)
5. **중재자 출시 (유형 2)**: 중재자가 서명하고, 어느 당사자에게든 보낼 수 있음 (분쟁 해결)
6. **타임아웃 출시 (유형 3)**: 타임아웃이 지나면 서명 필요 없음

## 효과

| 측면 | 영향 |
|--------|--------|
| **신뢰** | 거래 조건을 드러내지 않고 무신뢰 3자 정산 |
| **분쟁 해결** | 중재자가 필요한 세부사항만 알면서 분쟁 해결 가능 |
| **안전성** | 자동 타임아웃이 영구적인 자금 잠금 방지 |
| **프라이버시** | 거래 금액, 당사자, 중재자 모두 숨겨짐 |
| **유연성** | 다양한 시나리오를 위한 여러 출시 경로 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **중재자 공모** | 평판이 좋은 중재자 사용; 분산 중재자 네트워크 고려 |
| **타임아웃 게이밍** | 구매자가 타임아웃 수취인 이점을 가져서는 안 됨; 공정한 기본값 사용 |
| **키 분실** | 타임아웃은 키가 분실되어도 최종 출시 제공 |
| **재생 공격** | 출시 시 에스크로 해시가 무효화됨; 재지출 불가능 |
| **악의적인 중재자** | 중재자 스테이크 또는 평판 시스템; 에스크로된 금액으로 제한됨 |
| **타이밍 공격** | 타임아웃 전 버퍼 시간; 당사자가 행동할 시간이 있음 |

## 구현 과제

1. **타임아웃 수취인 선택**
   - 타임아웃 시 누가 자금을 받는가? 구매자? 판매자? 분할?
   - 다양한 기본값을 위한 에스크로 유형 매개변수 고려
   - 다양한 타임아웃 동작을 위한 추가 회로 필요할 수 있음

2. **중재자 선택**
   - 중재자는 어떻게 발견되고 선택되는가?
   - 중재자 마켓플레이스 또는 분산 선택 고려
   - 중재자 수수료 및 지급 메커니즘

3. **부분 출시**
   - 현재 설계는 전부 아니면 전무
   - 부분 환불을 위한 확장 고려 (예: 판매자에게 70%, 30% 환불)
   - 추가 출력 노트 및 분할 로직 필요

4. **증거 제출**
   - 중재자는 결정을 내리기 위해 증거 필요
   - 오프체인 통신 채널 필요
   - 중재자의 공개 키로 암호화된 증거 고려

## 파생 형태

1. **다단계 에스크로** - 여러 출시 단계가 있는 에스크로 (예: 계약 시작 시 30%, 인도 시 40%, 수락 시 30%). 각 단계는 자체 타임아웃 및 출시 조건이 있습니다. 복잡한 프로젝트를 위한 마일스톤 기반 지급을 가능하게 합니다.

2. **마일스톤 기반 출시** - 마일스톤이 검증됨에 따라 자금이 점진적으로 출시되는 에스크로. 오라클 또는 중재자가 마일스톤 완료를 확인합니다. 에스크로 보안과 스트리밍과 유사한 점진적 지급을 결합합니다.

3. **부분 환불이 있는 에스크로** - 중재자가 당사자 간에 자금을 분할할 수 있음 (예: 판매자에게 60%, 구매자에게 40%). 양 당사자가 유효한 주장을 가질 때 유용합니다. 구성 가능한 분할 비율로 두 개의 출력 노트를 생성합니다.

4. **크로스체인 에스크로** - 크로스체인 원자적 스왑을 위한 에스크로. ZK 증명과 함께 해시 시간 잠금 컨트랙트(HTLC) 패턴을 사용합니다. 숨겨진 금액으로 다양한 블록체인 간 무신뢰 교환을 가능하게 합니다.

5. **보험이 있는 에스크로** - 보험 풀과 결합된 에스크로. 거래가 실패하면 보험이 구매자의 손실을 보상합니다. 보험료가 에스크로 금액에서 공제됩니다. 고가치 거래를 위한 추가 안전망을 생성합니다.

## 사용 사례

1. **비공개 P2P 거래**
   - Alice가 Bob에게 NFT를 10 ETH에 판매
   - 양측이 중재자 합의 (Kleros 배심원)
   - Bob이 에스크로에 10 ETH 예치
   - Alice가 오프체인에서 NFT 전송, Bob이 에스크로 출시
   - 프라이버시: 거래 금액과 당사자가 관찰자에게 숨겨짐

2. **프리랜스 계약**
   - 클라이언트가 $5,000 프로젝트를 위해 개발자 고용
   - 프로젝트 시작 시 지급이 에스크로됨
   - 인도 시 클라이언트가 개발자에게 출시
   - 분쟁: 중재자가 작업을 검토하고 출시 결정
   - 프라이버시: 계약 가치가 당사자 간에 기밀로 유지됨

3. **부동산 예치금**
   - 구매자가 $50,000 계약금 예치
   - 판매자가 30일 내 종료를 약속
   - 종료 시 에스크로가 판매자에게 출시
   - 거래 실패: 판매자가 구매자에게 환불
   - 타임아웃: 종료가 발생하지 않으면 자동 환불

4. **국제 무역**
   - 수입업자가 에스크로를 통해 상품 대금 지급
   - 수출업자가 상품을 배송하고 추적 정보 제공
   - 수령 확인 시 자금이 수출업자에게 출시
   - 분쟁: 무역 중재자가 배송 문서 검토
   - 프라이버시: 거래 가치가 경쟁자에게 숨겨짐

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용자 스토리는 [타임아웃이 있는 에스크로 - 제품 및 사용자 경험](../../../future/product/b-time-conditions/b5-escrow-products.md)을 참조하세요.

---

[색인으로 돌아가기](../../README.md)
