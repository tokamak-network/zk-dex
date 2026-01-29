# B1. 시간 잠금 노트 (Time-Locked Notes)

잠금 해제 시간 이후에만 사용 가능한 노트로, 숨겨진 잠금 매개변수를 통해 베스팅 일정 및 예약 지급을 가능하게 합니다.

**제약 조건**: ~150K | **복잡도**: 낮음

---

## 배경

시간 잠금 노트는 프로그래밍 가능한 화폐의 기본 요소입니다:

- **베스팅 요구사항**: 직원 토큰 부여, 창업자 할당, 투자자 락업은 시간 기반 제한이 필요합니다
- **예약 지급**: 임대료, 구독, 할부 지급과 같은 미래 날짜 거래는 신뢰할 수 있는 무신뢰 집행이 필요합니다
- **프라이버시 격차**: 온체인 시간 잠금은 베스팅 일정을 노출하여 직원 보상과 투자 조건을 드러냅니다
- **무신뢰 집행**: 전통적인 에스크로는 신뢰할 수 있는 제3자가 필요하지만, ZK 시간 잠금은 자동 집행됩니다

전통 금융에서 시간 잠금 자금은 관리인이나 법적 계약이 필요합니다. DeFi에서 시간 잠금은 일반적으로 투명합니다(TokenVesting 컨트랙트는 모든 조건을 노출). ZK 시간 잠금 노트는 자금이 청구될 때까지 잠금 해제 시간, 금액, 수취인을 숨깁니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 시간 잠금 노트의 해시 |
| `outputHash` | field | 잠금 해제된 출력 노트의 해시 |
| `currentTime` | uint | 컨트랙트의 현재 block.timestamp |
| `tokenType` | uint | 토큰 타입 식별자 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX, pkY` | field | 소유자의 공개 키 좌표 |
| `value` | uint | 노트 가치 (숨겨짐) |
| `salt` | field | 노트 무작위성 |
| `sk` | field | 소유권 증명을 위한 비밀 키 |
| `unlockTime` | uint | 노트가 사용 가능해지는 타임스탬프 |
| `outPkX, outPkY` | field | 출력 노트 소유자 공개 키 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template SpendTimeLocked() {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input currentTime;        // block.timestamp from contract
    signal input tokenType;

    // ===== Private Inputs =====
    signal input pkX, pkY, value, salt, sk;
    signal input unlockTime;
    signal input outPkX, outPkY, outSalt;

    // ===== 1. Verify Time-Locked Note =====
    // Note format: hash(pkX, pkY, value, tokenType, salt, unlockTime, lockType)
    // lockType = 0 indicates time-lock
    component note = Poseidon(7);
    note.inputs[0] <== pkX;
    note.inputs[1] <== pkY;
    note.inputs[2] <== value;
    note.inputs[3] <== tokenType;
    note.inputs[4] <== salt;
    note.inputs[5] <== unlockTime;
    note.inputs[6] <== 0;  // lockType: 0 = time-lock
    note.out === noteHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== pkX;
    own.pkY <== pkY;

    // ===== 3. Time Check: currentTime >= unlockTime =====
    // Using LessThan to check unlockTime < currentTime + 1
    // This is equivalent to unlockTime <= currentTime
    component timeCheck = LessThan(64);
    timeCheck.in[0] <== unlockTime;
    timeCheck.in[1] <== currentTime + 1;
    timeCheck.out === 1;

    // ===== 4. Create Output Note (Regular, No Time Lock) =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [noteHash, outputHash, currentTime, tokenType]} =
    SpendTimeLocked();
```

### 핵심 제약 조건

1. **노트 형식 검증**: 시간 잠금 노트는 해시에 unlockTime을 포함하여 일반 노트와 구별됩니다
2. **소유권 검증**: 노트 소유자만 시간 잠금된 자금을 사용할 수 있습니다
3. **시간 조건**: 사용이 성공하려면 `currentTime >= unlockTime`이 유지되어야 합니다
4. **가치 보존**: 출력 노트 가치는 입력 노트 가치와 동일합니다 (자금 생성 또는 파괴 없음)

## 효과

| 측면 | 영향 |
|--------|--------|
| **프로그래밍 가능성** | 스마트 컨트랙트 복잡성 없이 시간 기반 자금 제어 |
| **신뢰 최소화** | 제3자 관리인 없이 자동 집행되는 잠금 |
| **프라이버시** | 청구될 때까지 잠금 해제 시간, 금액, 당사자 모두 숨겨짐 |
| **조합 가능성** | 시간 잠금 노트는 다른 회로 타입과 중첩 가능 |
| **가스 효율성** | 복잡한 컨트랙트 상태 대비 단일 증명 검증 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **타임스탬프 조작** | 합리적인 허용 오차로 block.timestamp 사용; 채굴자는 ~15초까지 조작 가능 |
| **시간 편차** | 잠금 해제 조건에 버퍼 시간 포함; 정확한 타이밍에 의존하지 않음 |
| **청구 선행 거래** | 첫 번째 유효한 청구가 승리; nullifier로 인해 이중 지출 불가능 |
| **키 분실** | 긴급 복구 메커니즘 또는 백업 서명자 추가 고려 |
| **컨트랙트 일시 중지** | 일시 중지 중에도 시간은 계속 지나감; 일시 중지 인식 잠금 해제 로직 고려 |

## 구현 과제

1. **타임스탬프 소스**
   - `block.timestamp`는 채굴자가 범위 내에서 제어 가능
   - 더 예측 가능한 타이밍을 위해 블록 번호 사용 고려
   - 크로스체인 시간 잠금은 동기화된 시간 소스 필요

2. **잠금 해제 세분성**
   - 초 단위 정밀도는 불필요할 수 있으며 복잡성을 추가함
   - 대부분의 사용 사례에서 일 또는 시간 단위 세분성 고려
   - 정밀도와 실용적 필요성 간 균형

3. **노트 형식 호환성**
   - 시간 잠금 노트는 일반 노트와 다른 해시 구조 사용
   - 지갑 호환성을 위한 명확한 타입 표시자(lockType 필드) 필요
   - 노트 형식 업그레이드를 위한 마이그레이션 경로

4. **UI/UX 고려사항**
   - 사용자는 자금이 언제 사용 가능해지는지 이해해야 함
   - 지갑은 시간 잠금된 잔액을 별도로 추적하고 표시해야 함
   - 잠금 해제에 가까워질 때 카운트다운 알림 고려

## 파생 형태

1. **클리프 베스팅 노트** - 토큰이 베스팅되지 않는 클리프 기간이 있는 시간 잠금 노트로, 그 후 전체 잠금 해제됩니다. 1년 클리프 후 토큰이 베스팅되는 직원 부여에 유용합니다. 회로는 선형 베스팅 계산 전에 클리프 시간 확인을 추가합니다.

2. **자동 환불 에스크로** - 시간 제한 전에 수취인이 청구하지 않으면 발신자에게 반환되는 시간 잠금 노트입니다. 시간 잠금과 조건부 수취인을 결합하여 만료 시 자동 환불이 있는 무신뢰 예치를 가능하게 합니다.

3. **데드맨 스위치** - 주 소유자가 주기적으로 "체크인"하지 않으면 백업 키로 사용 가능해지는 노트입니다. 각 체크인은 잠금 해제 시간을 연장합니다. 상속 및 긴급 복구 시나리오에 유용합니다.

4. **속도 제한 지출** - 최대 지출 속도를 강제하는 시간 잠금 노트입니다. 각 지출은 타이머를 재설정하여 자금이 유출될 수 있는 속도를 제한합니다. 시간 기반 속도 제한으로 키 침해를 방지합니다.

5. **미래 날짜 수표** - 전통적인 후날짜 수표처럼 특정 날짜 이후에만 수취인에게 지급 가능한 노트입니다. 발신자는 수취인의 키와 미래 잠금 해제 시간으로 노트를 생성하고, 수취인은 그 날짜 이후에만 청구할 수 있습니다.

## 사용 사례

1. **직원 토큰 베스팅**
   - 회사가 직원에게 4년에 걸쳐 베스팅되는 10,000개의 토큰 부여
   - 분기별로 잠금 해제되는 시간 잠금 노트 생성 (각 1/16)
   - 직원은 베스팅되는 각 트랜치를 청구
   - 프라이버시: 다른 직원이 서로의 부여를 볼 수 없음

2. **구독 선불**
   - 사용자가 12개월 서비스 구독을 선불
   - 매월 하나씩 잠금 해제되는 12개의 시간 잠금 노트 생성
   - 서비스 제공자가 베스팅되는 매월 지급을 청구
   - 보호: 다음 지급을 청구하려면 서비스를 제공해야 함

3. **투자 락업**
   - VC가 2년 락업 요구사항이 있는 토큰 수령
   - 토큰이 미래 잠금 해제 날짜가 있는 시간 잠금 노트에 배치됨
   - 락업이 만료될 때까지 양도하거나 판매할 수 없음
   - 컴플라이언스: 보유량을 드러내지 않고 감사인에게 락업 증명

4. **예정된 상속**
   - 부모가 자녀가 25세가 될 때 잠금 해제되는 상속 설정
   - 잠금 해제 시간 = 자녀의 25번째 생일인 시간 잠금 노트
   - 자금은 누구도 조기에 접근할 수 없음
   - 프라이버시: 유산 세부사항이 기밀로 유지됨

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용자 스토리는 [시간 잠금 노트 - 제품 및 사용자 경험](../../../future/product/b-time-conditions/b1-time-lock-products.md)을 참조하세요.

---

[색인으로 돌아가기](../../README.md)
