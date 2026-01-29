# E1. Private AMM Swap

자동화된 시장 메이커를 통해 토큰 스왑을 실행하며 거래 크기를 숨기고, ZK 증명을 통해 x*y=k 불변식 검증을 유지합니다.

**제약조건**: ~300K | **복잡도**: Medium

---

## 배경

Private AMM 스왑은 투명한 DEX 거래의 중요한 취약점을 해결합니다:

- **거래 프라이버시**: 투명한 DEX의 스왑 금액은 포트폴리오 크기와 거래 전략을 노출합니다
- **MEV 착취**: 가시적인 대기 중인 스왑은 거래자로부터 가치를 추출하는 샌드위치 공격을 가능하게 합니다
- **전략 유출**: 대규모 거래는 시장 방향을 신호하여 선행 거래를 허용합니다
- **경쟁 불이익**: 시장 조성자와 차익 거래자가 성공적인 전략을 복사할 수 있습니다

Uniswap과 같은 전통적인 AMM에서는 모든 거래가 온체인에서 완전히 가시적입니다. Private AMM 스왑은 x*y=k 불변식이 유지됨을 증명하면서 거래 금액을 숨겨 정보 추출을 방지하고 수학적 정확성을 보장합니다.

## Technical Specification

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inputNoteHash` | field | 스왑되는 노트의 해시 |
| `outputNoteHash` | field | 스왑으로부터 받은 노트의 해시 |
| `poolStateCommitment` | field | 현재 풀 상태 커밋먼트 |
| `newPoolStateCommitment` | field | 스왑 후 풀 상태 |
| `nullifier` | field | 입력 노트의 이중 지불 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `inPkX, inPkY` | field | 입력 노트 소유자의 공개 키 |
| `inValue` | uint | 입력 토큰 금액 |
| `inToken` | uint | 입력 토큰 타입 식별자 |
| `inSalt` | field | 입력 노트 무작위성 |
| `inSk` | field | 소유권 증명을 위한 비밀 키 |
| `outPkX, outPkY` | field | 출력 노트 소유자의 공개 키 |
| `outValue` | uint | 받은 출력 토큰 금액 |
| `outToken` | uint | 출력 토큰 타입 식별자 |
| `outSalt` | field | 출력 노트 무작위성 |
| `reserve0` | uint | token0의 풀 예비금 |
| `reserve1` | uint | token1의 풀 예비금 |
| `poolSalt` | field | 풀 상태 무작위성 |
| `newReserve0` | uint | token0의 새로운 풀 예비금 |
| `newReserve1` | uint | token1의 새로운 풀 예비금 |
| `newPoolSalt` | field | 새로운 풀 상태 무작위성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

template PrivateSwap() {
    // ===== Public Inputs =====
    signal input inputNoteHash;
    signal input outputNoteHash;
    signal input poolStateCommitment;
    signal input newPoolStateCommitment;
    signal input nullifier;

    // ===== Private Inputs =====
    // Input note
    signal input inPkX, inPkY, inValue, inToken, inSalt, inSk;
    // Output note
    signal input outPkX, outPkY, outValue, outToken, outSalt;
    // Pool state
    signal input reserve0, reserve1, poolSalt;
    signal input newReserve0, newReserve1, newPoolSalt;

    // ===== 1. Verify Input Note =====
    component inNote = PoseidonRegularNote();
    inNote.pkX <== inPkX;
    inNote.pkY <== inPkY;
    inNote.value <== inValue;
    inNote.tokenType <== inToken;
    inNote.salt <== inSalt;
    inNote.out === inputNoteHash;

    // ===== 2. Verify Ownership =====
    component own = ProofOfOwnershipStrict();
    own.sk <== inSk;
    own.pkX <== inPkX;
    own.pkY <== inPkY;

    // ===== 3. Verify Nullifier =====
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== inputNoteHash;
    nullifierHash.inputs[1] <== inSk;
    nullifierHash.out === nullifier;

    // ===== 4. Verify Current Pool State =====
    component pool = Poseidon(3);
    pool.inputs[0] <== reserve0;
    pool.inputs[1] <== reserve1;
    pool.inputs[2] <== poolSalt;
    pool.out === poolStateCommitment;

    // ===== 5. Verify x * y = k Invariant =====
    signal k;
    k <== reserve0 * reserve1;

    signal newK;
    newK <== newReserve0 * newReserve1;

    // k should remain constant (accounting for 0.3% fee)
    // newK >= k * 997 / 1000 ensures fee is properly taken
    signal kWithFee;
    kWithFee <== k * 997;

    component kCheck = GreaterEqThan(252);
    kCheck.in[0] <== newK * 1000;
    kCheck.in[1] <== kWithFee;
    kCheck.out === 1;

    // ===== 6. Verify Reserve Changes Match Trade =====
    // For token0 -> token1 swap: newReserve0 = reserve0 + inValue
    // For token1 -> token0 swap: newReserve1 = reserve1 + inValue
    signal isToken0Input;
    component tokenCheck = IsEqual();
    tokenCheck.in[0] <== inToken;
    tokenCheck.in[1] <== 0;
    isToken0Input <== tokenCheck.out;

    // Verify correct reserve changes based on swap direction
    signal expectedNewReserve0;
    signal expectedNewReserve1;
    expectedNewReserve0 <== reserve0 + isToken0Input * inValue;
    expectedNewReserve1 <== reserve1 + (1 - isToken0Input) * inValue;

    newReserve0 === expectedNewReserve0;
    newReserve1 === expectedNewReserve1;

    // ===== 7. Verify Output Amount =====
    signal expectedOutput;
    expectedOutput <== isToken0Input * (reserve1 - newReserve1) +
                       (1 - isToken0Input) * (reserve0 - newReserve0);

    component outputAmountCheck = GreaterEqThan(128);
    outputAmountCheck.in[0] <== outValue;
    outputAmountCheck.in[1] <== expectedOutput;
    outputAmountCheck.out === 1;

    // ===== 8. Verify Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== outValue;
    outNote.tokenType <== outToken;
    outNote.salt <== outSalt;
    outNote.out === outputNoteHash;

    // ===== 9. Verify Output Token Type =====
    signal expectedOutToken;
    expectedOutToken <== isToken0Input * 1 + (1 - isToken0Input) * 0;
    outToken === expectedOutToken;

    // ===== 10. Verify New Pool State =====
    component newPool = Poseidon(3);
    newPool.inputs[0] <== newReserve0;
    newPool.inputs[1] <== newReserve1;
    newPool.inputs[2] <== newPoolSalt;
    newPool.out === newPoolStateCommitment;
}

component main {public [inputNoteHash, outputNoteHash, poolStateCommitment,
    newPoolStateCommitment, nullifier]} = PrivateSwap();
```

### Key Constraints

1. **입력 노트 유효성**: 입력 노트 해시가 제공된 preimage와 일치
2. **소유권 검증**: 비밀 키가 입력 노트 공개 키에 대응
3. **Nullifier 정확성**: Nullifier가 노트 해시와 비밀 키로부터 파생됨
4. **풀 상태 무결성**: 현재 풀 상태가 커밋먼트와 일치
5. **상수 곱**: x*y=k 불변식 유지 (수수료 제외)
6. **예비금 회계**: 예비금 변경이 입력 및 출력 금액과 일치
7. **출력 토큰 정확성**: 출력 토큰이 입력 토큰의 반대

## 효과

| 측면 | 영향 |
|--------|--------|
| **거래 프라이버시** | 스왑 금액이 관찰자로부터 완전히 숨겨짐 |
| **MEV 보호** | 거래 크기를 알 수 없어 샌드위치 공격 불가능 |
| **전략 기밀성** | 거래 패턴이 온체인에서 감지되지 않음 |
| **가격 영향** | 풀 상태 커밋먼트가 업데이트될 때까지 숨겨짐 |
| **가스 효율성** | 단일 증명으로 전체 스왑 검증 (~300K gas) |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **풀 상태 비동기화** | 시퀀서가 권위 있는 풀 상태를 유지; 증명은 최신 커밋먼트에 대해 검증 |
| **커밋먼트 선행 거래** | 풀 상태 업데이트를 위한 commit-reveal 방식 |
| **가짜 풀 생성** | 풀 초기화에 거버넌스 승인 필요 |
| **유동성 부족** | 회로가 출력 금액이 최소 예상치를 충족하는지 검증 |
| **플래시 론 공격** | 스왑 검증 중 풀 상태 잠금 |
| **반올림 오류** | 충분한 정밀도의 고정 소수점 산술 사용 |

## 구현 과제

1. **풀 상태 동기화**
   - 여러 동시 스왑이 경쟁 조건 생성
   - 원자적 상태 전환 또는 일괄 스왑 처리 필요
   - 순서 지정을 위한 시퀀서 고려

2. **유동성 분산**
   - 프라이빗 풀은 퍼블릭 풀과 유동성을 공유할 수 없음
   - 투명한 대안보다 나쁜 가격 책정을 초래할 수 있음
   - 해결책: 프라이빗 풀 간 유동성 집계

3. **가격 발견**
   - 숨겨진 거래 크기로 가격 발견이 느려짐
   - 주기적인 가격 게시 고려 (TWAP)
   - 프라이버시와 시장 효율성의 균형

4. **슬리피지 보호**
   - 사용자가 현재 풀 상태를 볼 수 없음
   - 회로에 최대 슬리피지 매개변수 필요
   - 거래 전 오프체인 시뮬레이션 필요

## 파생상품

1. **Private Concentrated Liquidity** - 범위 경계를 공개하지 않고 특정 가격 범위에 유동성 제공. 정확한 틱 위치를 숨기면서 유동성이 커밋된 범위 내에 있음을 검증하기 위해 범위 증명 사용.

2. **Privacy-Preserving LP Tokens** - 노트 기반 표현을 통해 LP 지분 소유권 숨김. LP 포지션을 노출하지 않고 프라이빗 수익 농사와 유동성 마이닝 가능.

3. **Batch Private Swaps** - 여러 프라이빗 스왑을 단일 증명으로 집계하여 검증 비용 분산. 소규모 거래의 효율적인 실행 가능.

4. **Cross-Pool Private Routing** - 경로를 숨기면서 여러 풀을 통해 거래 라우팅. 사용된 풀을 공개하지 않고 최적 실행 증명.

5. **Private Arbitrage Execution** - 전략을 공개하지 않고 차익 거래 기회 실행. 스프레드 캡처 메커니즘을 숨기면서 수익성 있는 실행 증명.

## 사용 사례

1. **고래 거래**
   - 대규모 보유자가 시장을 움직이지 않고 100 ETH를 팔고 싶음
   - 스왑 크기 숨김, 선행 거래 방지
   - 정보 유출 없이 공정한 가격에 거래 실행

2. **시장 조성자 운영**
   - 전문 시장 조성자가 재고 유지
   - 리밸런싱 스왑이 경쟁자로부터 숨겨짐
   - 독점 거래 전략 보존

3. **DeFi 프로토콜 재무**
   - DAO 재무가 보유 자산 다각화
   - 거버넌스 공격을 방지하기 위해 스왑 금액 숨김
   - 전략적 유연성 유지

4. **크로스체인 차익 거래**
   - 차익 거래자가 가격 불일치 식별
   - 스프레드를 캡처하기 위해 비공개로 스왑 실행
   - 경쟁자가 실시간으로 전략을 복사할 수 없음

## 실제 제품 및 사용자 경험

참조: [Private AMM Swap - Real-World Products](../../../product/e-defi/e1-private-amm-products.md)

---

[목차로 돌아가기](../../README.md)
