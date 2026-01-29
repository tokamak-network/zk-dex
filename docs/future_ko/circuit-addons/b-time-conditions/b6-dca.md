# B6. DCA (적립식 평균 투자)

정기적인 간격으로 자동 구매를 수행하여, 숨겨진 투자 일정 및 금액으로 설정 후 잊어버리는 투자를 가능하게 합니다.

**제약 조건**: ~200K | **복잡도**: 중간

---

## 배경

적립식 평균 투자는 검증된 투자 전략입니다:

- **타이밍 위험 감소**: 시간에 걸쳐 구매를 분산하면 시장 정점에서 구매하는 영향 감소
- **감정적 규율**: 자동화된 실행은 변동성 동안 투자에 대한 심리적 장벽 제거
- **프라이버시 문제**: 온체인 DCA 주문은 투자 일정, 예산, 목표 자산을 드러냄
- **실행 과제**: 수동 DCA는 지속적인 주의가 필요하고, 자동화된 버전은 전략을 노출

전통 금융에서 DCA는 중개업체에서 자동화된 서비스로 제공되지만 관리인을 신뢰해야 합니다. DeFi에서 DCA.xyz와 같은 DCA 서비스가 존재하지만 모든 매개변수를 공개적으로 노출합니다. ZK DCA는 무신뢰 실행을 가능하게 하면서 투자 일정, 금액, 총 예산을 숨깁니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `dcaHash` | field | 현재 DCA 주문 상태의 해시 |
| `newDcaHash` | field | 업데이트된 DCA 주문의 해시 (완료되면 0) |
| `outputHash` | field | 구매한 자산 노트의 해시 |
| `currentTime` | uint | 현재 block.timestamp |
| `currentPrice` | uint | 오라클 제공 현재 가격 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | 소유자의 공개 키 |
| `sk` | field | 승인을 위한 소유자의 비밀 키 |
| `totalBudget` | uint | 투자할 총 금액 |
| `spentAmount` | uint | 이미 지출한 금액 |
| `sourceTokenType` | uint | 지출되는 토큰 (예: USDC) |
| `targetTokenType` | uint | 구매되는 토큰 (예: ETH) |
| `interval` | uint | 구매 간 시간 (초) |
| `amountPerInterval` | uint | 간격당 지출할 금액 |
| `lastExecutionTime` | uint | 마지막 실행의 타임스탬프 |
| `salt` | field | DCA 노트 무작위성 |
| `purchaseAmount` | uint | 수령한 목표 토큰의 양 |
| `newSpentAmount` | uint | 업데이트된 지출 금액 |
| `newSalt` | field | 새로운 DCA 노트 무작위성 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template DCAExecution() {
    // ===== Public Inputs =====
    signal input dcaHash;
    signal input newDcaHash;         // Updated DCA order (or 0 if complete)
    signal input outputHash;          // Purchased asset note
    signal input currentTime;
    signal input currentPrice;        // From price oracle

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, sk;
    signal input totalBudget, spentAmount;
    signal input sourceTokenType, targetTokenType;
    signal input interval, amountPerInterval;
    signal input lastExecutionTime, salt;
    signal input purchaseAmount, newSpentAmount, newSalt, outSalt;

    // ===== 1. Verify DCA Note =====
    component dca = Poseidon(11);
    dca.inputs[0] <== ownerPkX;
    dca.inputs[1] <== ownerPkY;
    dca.inputs[2] <== totalBudget;
    dca.inputs[3] <== spentAmount;
    dca.inputs[4] <== sourceTokenType;
    dca.inputs[5] <== targetTokenType;
    dca.inputs[6] <== interval;
    dca.inputs[7] <== amountPerInterval;
    dca.inputs[8] <== lastExecutionTime;
    dca.inputs[9] <== salt;
    dca.inputs[10] <== 0;  // dcaType: 0 = standard DCA
    dca.out === dcaHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== sk;
    own.pkX <== ownerPkX;
    own.pkY <== ownerPkY;

    // ===== 3. Check Interval Has Passed =====
    signal nextExecutionTime;
    nextExecutionTime <== lastExecutionTime + interval;

    component intervalCheck = GreaterEqThan(64);
    intervalCheck.in[0] <== currentTime;
    intervalCheck.in[1] <== nextExecutionTime;
    intervalCheck.out === 1;

    // ===== 4. Check Budget Remaining =====
    signal remainingBudget;
    remainingBudget <== totalBudget - spentAmount;

    component budgetCheck = GreaterEqThan(252);
    budgetCheck.in[0] <== remainingBudget;
    budgetCheck.in[1] <== amountPerInterval;
    budgetCheck.out === 1;

    // ===== 5. Calculate Purchase Amount =====
    // purchaseAmount = amountPerInterval / currentPrice (with precision)
    // Price is in format: 1 target token = currentPrice source tokens
    // purchaseAmount * currentPrice should approximate amountPerInterval

    signal expectedPurchase;
    expectedPurchase <-- amountPerInterval * 1000000 \ currentPrice;  // With 6 decimal precision

    // Verify purchase amount is within acceptable slippage (5%)
    signal minPurchase;
    minPurchase <== expectedPurchase * 95 / 100;

    signal maxPurchase;
    maxPurchase <== expectedPurchase * 105 / 100;

    component purchaseLower = GreaterEqThan(252);
    purchaseLower.in[0] <== purchaseAmount;
    purchaseLower.in[1] <== minPurchase;
    purchaseLower.out === 1;

    component purchaseUpper = LessEqThan(252);
    purchaseUpper.in[0] <== purchaseAmount;
    purchaseUpper.in[1] <== maxPurchase;
    purchaseUpper.out === 1;

    // ===== 6. Update Spent Amount =====
    newSpentAmount === spentAmount + amountPerInterval;

    // ===== 7. Create New DCA Note (if not complete) =====
    component newDca = Poseidon(11);
    newDca.inputs[0] <== ownerPkX;
    newDca.inputs[1] <== ownerPkY;
    newDca.inputs[2] <== totalBudget;
    newDca.inputs[3] <== newSpentAmount;
    newDca.inputs[4] <== sourceTokenType;
    newDca.inputs[5] <== targetTokenType;
    newDca.inputs[6] <== interval;
    newDca.inputs[7] <== amountPerInterval;
    newDca.inputs[8] <== currentTime;  // Update last execution time
    newDca.inputs[9] <== newSalt;
    newDca.inputs[10] <== 0;

    // If fully spent, newDcaHash should be 0
    component fullySpentCheck = IsEqual();
    fullySpentCheck.in[0] <== newSpentAmount;
    fullySpentCheck.in[1] <== totalBudget;

    signal expectedNewDcaHash;
    expectedNewDcaHash <== (1 - fullySpentCheck.out) * newDca.out;
    newDcaHash === expectedNewDcaHash;

    // ===== 8. Create Output Note (Purchased Asset) =====
    component outputNote = PoseidonRegularNote();
    outputNote.pkX <== ownerPkX;
    outputNote.pkY <== ownerPkY;
    outputNote.value <== purchaseAmount;
    outputNote.tokenType <== targetTokenType;
    outputNote.salt <== outSalt;
    outputNote.out === outputHash;
}

component main {public [dcaHash, newDcaHash, outputHash, currentTime, currentPrice]} =
    DCAExecution();
```

### 핵심 제약 조건

1. **DCA 노트 검증**: 모든 매개변수(예산, 간격, 토큰)가 해시에 커밋됨
2. **소유권 승인**: 소유자만 DCA 주문을 실행할 수 있음
3. **간격 강제**: 실행 간 전체 간격을 기다려야 함
4. **예산 확인**: 남은 예산이 현재 간격 금액을 커버해야 함
5. **구매 계산**: 출력 금액은 슬리피지 내에서 예상 구매와 일치해야 함
6. **상태 업데이트**: 새로운 DCA 노트는 업데이트된 지출 금액과 실행 시간을 반영

## 효과

| 측면 | 영향 |
|--------|--------|
| **위험 감소** | 체계적인 투자가 변동성을 완화 |
| **자동화** | 모니터링 없이 설정 후 잊어버리는 실행 |
| **프라이버시** | 투자 일정과 금액이 숨겨짐 |
| **규율** | 감정적 의사 결정 제거 |
| **가스 효율성** | 여러 DCA 주문에 대해 일괄 처리 가능한 실행 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **오라클 조작** | TWAP 가격 사용; 여러 오라클 소스 요구 |
| **실행 선행 거래** | 실행 타이밍은 예측 가능하지만 금액은 숨겨짐 |
| **슬리피지 공격** | 5% 슬리피지 허용 오차; 더 엄격한 범위 고려 |
| **간격 게이밍** | 간격이 숨겨짐; 정확한 실행 시간 예측 불가능 |
| **예산 소진** | 최종 실행이 부분 예산을 자동으로 처리 |
| **가격 피드 오래됨** | 오라클 데이터에 타임스탬프 확인 포함 |

## 구현 과제

1. **실행 인센티브**
   - 누가 DCA 실행을 트리거하는가?
   - 키퍼 네트워크 또는 실행자 보상 필요
   - 구매한 금액에서 소액 수수료 고려

2. **가격 정밀도**
   - 다양한 토큰은 다른 소수점을 가짐
   - 표준화된 가격 표현 필요
   - 고정 소수점 연산 고려

3. **부분 최종 실행**
   - 최종 간격은 amountPerInterval보다 적게 남아 있을 수 있음
   - 회로는 부분 구매를 처리해야 함
   - 최종 실행을 위한 별도 회로 고려

4. **유동성 가용성**
   - DCA는 실행 시점에 유동성이 존재한다고 가정
   - 유동성이 부족한 시장을 위한 대체 메커니즘 필요할 수 있음
   - 슬리피지 보호가 있는 DEX에서 실행 고려

## 파생 형태

1. **가변 금액 DCA** - 시장 조건에 따라 투자 금액이 변동합니다. 가격이 하락할 때 더 많이 구매하고(가치 평균화), 가격이 상승할 때 적게 구매합니다. 회로는 목표 가치 성장률에 기반한 가격 반응형 금액 계산을 포함합니다.

2. **가격 반응형 DCA** - 가격 움직임에 기반하여 일정을 조정하는 DCA. 가격이 크게 하락하면 더 일찍 실행하고(기회), 가격이 급등하면 건너뜁니다(정점 구매 회피). 간격 기반과 가격 트리거를 결합합니다.

3. **다중 자산 DCA 바스켓** - 구성 가능한 할당으로 여러 자산을 구매하는 단일 DCA 주문 (예: ETH 60%, BTC 30%, LINK 10%). 숨겨진 할당 비율로 실행당 여러 출력 노트를 생성합니다.

4. **이익 실현 종료가 있는 DCA** - 목표 가격에 도달하면 축적된 자산을 자동으로 판매합니다. 축적과 종료 전략을 결합합니다. 회로는 단일 노트에서 DCA 상태와 이익 실현 트리거를 모두 추적합니다.

5. **역 DCA (체계적 판매)** - 역 DCA: 정기적인 간격으로 고정 금액을 자동으로 판매합니다. 토큰을 베스팅하는 프로젝트 또는 이익을 실현하는 투자자에게 유용합니다. DCA와 동일한 구조이지만 소스/타겟이 역전됩니다.

## 사용 사례

1. **은퇴 축적**
   - 투자자가 5년 동안 주당 $500를 ETH에 커밋
   - DCA 주문: 주당 $500, 260회 실행
   - 가격에 관계없이 매주 자동 구매
   - 프라이버시: 은퇴 저축 전략이 관찰자에게 숨겨짐

2. **토큰 재무 다각화**
   - DAO가 네이티브 토큰에서 스테이블코인으로 재무를 다각화하고자 함
   - 월간 10,000개 토큰을 판매하는 역 DCA 설정
   - 점진적인 판매가 시장 영향 감소
   - 프라이버시: 판매 일정이 시장 선행 거래자에게 숨겨짐

3. **급여 투자**
   - 직원이 급여에서 월 $1,000를 암호화폐에 할당
   - 급여 일정과 동기화된 DCA
   - 수동 실행 없이 일관된 투자
   - 프라이버시: 투자 금액이 동료에게 숨겨짐

4. **시장 회복 전략**
   - 투자자가 약세장 중 공격적인 DCA 설정
   - $50,000가 배치될 때까지 우량주에 매일 $200
   - 체계적으로 낮은 가격 활용
   - 프라이버시: 축적 전략이 시장에서 숨겨짐

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용자 스토리는 [DCA (적립식 평균 투자) - 제품 및 사용자 경험](../../../future/product/b-time-conditions/b6-dca-products.md)을 참조하세요.

---

[색인으로 돌아가기](../../README.md)
