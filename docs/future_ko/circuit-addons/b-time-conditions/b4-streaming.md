# B4. 스트리밍 지급 (Streaming Payment)

시간 기간 동안 연속 지급으로, 숨겨진 스트림 매개변수로 실시간 급여 분배 및 구독 지급을 가능하게 합니다.

**제약 조건**: ~200K | **복잡도**: 중간

---

## 배경

스트리밍 지급은 당사자 간 가치 흐름 방식을 변화시킵니다:

- **현금 흐름 불일치**: 전통적인 지급은 이산적(월간, 연간)이지만 가치는 지속적으로 발생
- **자본 비효율성**: 선불 구독은 자금을 잠그고, 후불은 상대방 위험을 생성
- **투명성 문제**: 온체인 스트림(Sablier, Superfluid)은 급여 금액과 고용주-직원 관계를 노출
- **실시간 금융**: 현대 DeFi는 초당 가치 전송을 가능하게 하여 지급 패러다임을 변화시킴

전통 금융에서 급여는 일일로 수행되는 작업임에도 불구하고 월간으로 지급됩니다. DeFi에서 스트리밍은 연속 지급을 가능하게 하지만 현재 구현은 모든 조건을 노출합니다. ZK 스트리밍 지급은 비율, 총액, 당사자를 숨기면서 수취인이 언제든지 적립된 자금을 청구할 수 있게 합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `streamHash` | field | 현재 스트림 상태의 해시 |
| `newStreamHash` | field | 청구 후 업데이트된 스트림의 해시 (완료되면 0) |
| `claimHash` | field | 청구된 금액의 노트로서의 해시 |
| `currentTime` | uint | 현재 block.timestamp |
| `tokenType` | uint | 스트리밍되는 토큰 타입 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `senderPkX, senderPkY` | field | 발신자의 공개 키 |
| `recipientPkX, recipientPkY` | field | 수취인의 공개 키 |
| `recipientSk` | field | 청구 승인을 위한 수취인의 비밀 키 |
| `totalAmount` | uint | 총 스트림 가치 |
| `startTime` | uint | 스트림 시작 타임스탬프 |
| `endTime` | uint | 스트림 종료 타임스탬프 |
| `claimedAmount` | uint | 이미 청구된 금액 |
| `salt` | field | 스트림 노트 무작위성 |
| `claimAmount` | uint | 현재 청구되는 금액 |
| `newClaimedAmount` | uint | 업데이트된 청구 금액 |
| `newSalt` | field | 새로운 스트림 노트 무작위성 |
| `claimSalt` | field | 청구 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/safe_math.circom";

template ClaimStream() {
    // ===== Public Inputs =====
    signal input streamHash;
    signal input newStreamHash;      // Updated stream (or 0 if complete)
    signal input claimHash;          // Claimed amount as note
    signal input currentTime;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input senderPkX, senderPkY;
    signal input recipientPkX, recipientPkY, recipientSk;
    signal input totalAmount, startTime, endTime;
    signal input claimedAmount, salt;
    signal input claimAmount, newClaimedAmount, newSalt, claimSalt;

    // ===== 1. Verify Stream Note =====
    component stream = Poseidon(10);
    stream.inputs[0] <== senderPkX;
    stream.inputs[1] <== senderPkY;
    stream.inputs[2] <== recipientPkX;
    stream.inputs[3] <== recipientPkY;
    stream.inputs[4] <== totalAmount;
    stream.inputs[5] <== tokenType;
    stream.inputs[6] <== startTime;
    stream.inputs[7] <== endTime;
    stream.inputs[8] <== claimedAmount;
    stream.inputs[9] <== salt;
    stream.out === streamHash;

    // ===== 2. Verify Recipient Authorization =====
    component own = ProofOfOwnershipStrict();
    own.sk <== recipientSk;
    own.pkX <== recipientPkX;
    own.pkY <== recipientPkY;

    // ===== 3. Calculate Vested Amount =====
    signal duration;
    duration <== endTime - startTime;

    // effectiveTime = min(currentTime, endTime)
    component timeCompare = LessThan(64);
    timeCompare.in[0] <== currentTime;
    timeCompare.in[1] <== endTime;
    signal effectiveTime;
    effectiveTime <== timeCompare.out * currentTime + (1 - timeCompare.out) * endTime;

    // Ensure stream has started
    component startedCheck = GreaterEqThan(64);
    startedCheck.in[0] <== currentTime;
    startedCheck.in[1] <== startTime;
    startedCheck.out === 1;

    signal elapsed;
    elapsed <== effectiveTime - startTime;

    // vestedAmount = totalAmount * elapsed / duration
    // Use integer division (truncates down, favoring sender)
    signal vestedNumerator;
    vestedNumerator <== totalAmount * elapsed;

    // Safe division with non-zero check
    component divCheck = IsZero();
    divCheck.in <== duration;
    divCheck.out === 0;  // duration must not be zero

    signal vestedAmount;
    vestedAmount <-- vestedNumerator \ duration;  // Integer division

    // Verify division: vestedAmount * duration <= vestedNumerator < (vestedAmount + 1) * duration
    component divLower = LessEqThan(128);
    divLower.in[0] <== vestedAmount * duration;
    divLower.in[1] <== vestedNumerator;
    divLower.out === 1;

    component divUpper = LessThan(128);
    divUpper.in[0] <== vestedNumerator;
    divUpper.in[1] <== (vestedAmount + 1) * duration;
    divUpper.out === 1;

    // ===== 4. Calculate Claimable Amount =====
    signal claimable;
    claimable <== vestedAmount - claimedAmount;

    // claimAmount <= claimable
    component claimCheck = LessEqThan(252);
    claimCheck.in[0] <== claimAmount;
    claimCheck.in[1] <== claimable;
    claimCheck.out === 1;

    // claimAmount > 0 (cannot claim zero)
    component nonZeroClaim = GreaterThan(252);
    nonZeroClaim.in[0] <== claimAmount;
    nonZeroClaim.in[1] <== 0;
    nonZeroClaim.out === 1;

    // ===== 5. Update Claimed Amount =====
    newClaimedAmount === claimedAmount + claimAmount;

    // ===== 6. Create New Stream Note (if not complete) =====
    component newStream = Poseidon(10);
    newStream.inputs[0] <== senderPkX;
    newStream.inputs[1] <== senderPkY;
    newStream.inputs[2] <== recipientPkX;
    newStream.inputs[3] <== recipientPkY;
    newStream.inputs[4] <== totalAmount;
    newStream.inputs[5] <== tokenType;
    newStream.inputs[6] <== startTime;
    newStream.inputs[7] <== endTime;
    newStream.inputs[8] <== newClaimedAmount;
    newStream.inputs[9] <== newSalt;

    // If fully claimed, newStreamHash should be 0
    // Otherwise, it should be the new stream hash
    component fullyClaimedCheck = IsEqual();
    fullyClaimedCheck.in[0] <== newClaimedAmount;
    fullyClaimedCheck.in[1] <== totalAmount;

    signal expectedNewStreamHash;
    expectedNewStreamHash <== (1 - fullyClaimedCheck.out) * newStream.out;
    newStreamHash === expectedNewStreamHash;

    // ===== 7. Output Claim Note =====
    component claimNote = PoseidonRegularNote();
    claimNote.pkX <== recipientPkX;
    claimNote.pkY <== recipientPkY;
    claimNote.value <== claimAmount;
    claimNote.tokenType <== tokenType;
    claimNote.salt <== claimSalt;
    claimNote.out === claimHash;
}

component main {public [streamHash, newStreamHash, claimHash, currentTime, tokenType]} =
    ClaimStream();
```

### 핵심 제약 조건

1. **스트림 노트 검증**: 스트림 매개변수가 해시에 커밋됨 (당사자, 금액, 기간, 청구됨)
2. **수취인 승인**: 수취인만 스트리밍된 자금을 청구할 수 있음
3. **베스팅 계산**: 경과 시간에 기반하여 베스팅된 금액이 비례적으로 계산됨
4. **청구 범위**: 청구 금액은 양수이고 청구 가능한 금액을 초과할 수 없음
5. **상태 업데이트**: 새로운 스트림 노트는 업데이트된 청구 금액을 반영
6. **완료 처리**: 완전히 청구되면 스트림 해시가 0이 됨

## 효과

| 측면 | 영향 |
|--------|--------|
| **현금 흐름** | 적립된 대로 연속 자금 접근 |
| **자본 효율성** | 베스팅되지 않은 자금은 적립될 때까지 발신자에게 남아 있음 |
| **프라이버시** | 비율, 총액, 당사자가 숨겨짐 |
| **유연성** | 수취인이 원하는 빈도로 청구 |
| **회계** | 양 당사자에게 명확한 베스팅 계산 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **정수 나눗셈 반올림** | 발신자에게 유리하게 절삭; 수취인은 마지막에 나머지 청구 가능 |
| **타임스탬프 조작** | block.timestamp 사용; 조작이 ~15초로 제한됨 |
| **이중 청구** | 스트림 상태가 원자적으로 업데이트됨; 이전 상태는 무효화됨 |
| **조기 취소** | 베스팅되지 않은 환불을 발신자에게 제공하는 취소 회로 고려 |
| **청구 선행 거래** | 청구는 수취인에게 허가 없음; 선행 거래의 이점 없음 |
| **오버플로우** | 중간 계산에 128비트 비교기 사용 |

## 구현 과제

1. **회로에서의 나눗셈**
   - Circom은 기본 나눗셈이 없음; 검증이 있는 위트니스 필요
   - 과다 청구 방지를 위해 내림
   - 정밀도를 위해 고정 소수점 표현 고려

2. **스트림 취소**
   - 현재 설계는 조기 종료를 지원하지 않음
   - 발신자 주도 취소를 위한 별도 회로 필요
   - 베스팅되지 않은 자금은 발신자에게 반환되어야 함

3. **부분 청구 대 전체 청구**
   - 수취인은 청구 가능한 금액까지 어떤 금액이든 청구 가능
   - 빈번한 소액 청구는 가스 비용 증가
   - 일괄 처리 또는 최소 청구 금액 고려

4. **실시간 표시를 위한 UI/UX**
   - 지갑은 지속적으로 증가하는 잔액을 표시해야 함
   - 클라이언트 측에서 적립된 금액 계산
   - 실제 청구 시 체인 상태와 동기화

## 파생 형태

1. **마일스톤 게이트 스트림** - 마일스톤 달성에 기반하여 스트림 비율이 변경됩니다. 초기 느린 비율은 각 마일스톤 검증 후 증가합니다. 조건을 드러내지 않고 성과 기반 보상을 위해 스트리밍과 조건부 로직을 결합합니다.

2. **다중 수취인 분할** - 여러 수취인에게 자동으로 분할되는 단일 스트림 (예: 단일 자금 소스에서 팀 급여). 회로는 관찰자에게 숨겨진 구성 가능한 분할 비율로 비례 분배를 관리합니다.

3. **인플레이션 조정 스트림** - 구매력을 유지하기 위해 인플레이션 오라클에 기반하여 스트림 비율이 조정됩니다. 명목상이 아닌 실질 측면에서 연간 급여입니다. 프라이버시가 보존된 계산으로 인플레이션 지수를 위한 오라클 통합이 필요합니다.

4. **조합 가능한 스트림 NFT** - 거래 가능한 NFT로 표현되는 스트림 소유권. 수취인은 할인된 가격으로 미래 스트림 지급을 판매할 수 있습니다. 지급 프라이버시를 유지하면서 잠긴 소득 스트림에 대한 급여 팩토링 및 유동성을 가능하게 합니다.

5. **조건부 스트림 일시 중지** - 조건이 충족되지 않을 때 발신자가 스트림을 일시 중지할 수 있습니다 (예: 계약자가 일하지 않음). 작업 검증을 위한 증명 또는 오라클이 필요합니다. 일시 중지된 시간은 발생하지 않고 스트림 기간이 연장됩니다.

## 사용 사례

1. **비공개 급여 스트리밍**
   - 고용주가 직원에게 연간 120,000 USDC 지급
   - 스트림은 지속적으로 초당 ~$0.0038을 전달
   - 직원은 매주 청구하여 적립된 임금에 즉시 접근
   - 프라이버시: 동료가 서로의 급여를 볼 수 없음

2. **구독 서비스**
   - SaaS가 프리미엄 액세스에 대해 월 $100 청구
   - 사용자가 스트림 시작; 서비스가 액세스를 위해 활성 스트림 검증
   - 취소는 스트림을 즉시 중단; 과다 지급 없음
   - 프라이버시: 구독 비용이 경쟁자에게 숨겨짐

3. **투자 베스팅**
   - VC가 창업자에게 3년 베스팅으로 100만 달러 투자
   - 스트림은 시간에 걸쳐 비례적으로 출시
   - 창업자는 비용에 필요에 따라 청구
   - 프라이버시: 투자 조건이 당사자 간에 기밀로 유지됨

4. **임대료 지급**
   - 세입자가 집주인에게 지속적으로 임대료 스트리밍
   - 집주인이 실시간 지급 가시성 수령
   - 세입자가 임대료를 "연체"하지 않음; 부분 월 = 부분 지급
   - 프라이버시: 임대 금액이 이웃에게 숨겨짐

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용자 스토리는 [스트리밍 지급 - 제품 및 사용자 경험](../../../future/product/b-time-conditions/b4-streaming-products.md)을 참조하세요.

---

[색인으로 돌아가기](../../README.md)
