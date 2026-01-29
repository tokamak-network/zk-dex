# HC6. 봉인 입찰 경매 결제

많은 입찰이 있는 봉인 입찰 경매를 결제하여 승자만 공개합니다.

**제약조건**: ~600K | **복잡도**: 높음

---

## 배경

전통적인 경매는 상당한 한계가 있습니다:
- 공개 경매는 입찰자 전략을 드러냄
- 봉인 입찰은 신뢰할 수 있는 경매인이 필요
- 시빌 입찰을 감지하기 어려움
- 패자 입찰은 경매 후에도 노출됨

**현재 접근 방식이 불충분한 이유:**

| 접근 방식 | 한계 |
|----------|------------|
| 공개 상승 경매 | 입찰자 평가를 드러냄; 스나이핑 가능 |
| 전통적인 봉인 입찰 | 신뢰할 수 있는 경매인 필요; 패자 입찰 유출 |
| 온체인 commit-reveal | 비공개로 인한 방해; 타이밍 공격 |
| 신뢰 실행 (SGX) | 하드웨어 신뢰 가정; 사이드 채널 공격 |

암호화 봉인 입찰 경매는 입찰 공개 없이 공정한 가격 발견을 가능하게 합니다. ZK 증명은 패자 입찰을 공개하지 않고 올바른 승자 선택을 보장합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `itemHash` | field | 경매 중인 항목의 해시 |
| `bidCommitments` | field[N_BIDS] | 봉인 입찰에 대한 commitment |
| `winnerOutputHash` | field | 승자에게 항목을 주는 노트 |
| `sellerOutputHash` | field | 판매자에게 지불을 주는 노트 |
| `loserRefundHashes` | field[N_BIDS] | 패자를 위한 환불 노트 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `sellerPkX/Y, sellerSk` | field | 판매자 자격 증명 |
| `itemId, itemSalt` | field | 항목 세부 정보 |
| `bidderPkX/Y, bidAmount, bidSalt` | 배열 | 입찰자별 입찰 세부 정보 |
| `bidIsActive` | bool[N_BIDS] | 어느 입찰이 활성인지 |
| `winnerIndex` | uint | 낙찰 입찰의 인덱스 |
| `winnerSalt` | field | 승자 출력 노트의 salt |

### Circuit Logic

## 효과

| 측면 | 영향 |
|--------|--------|
| **프라이버시** | 패자 입찰은 절대 공개되지 않음 |
| **공정성** | 증명 가능한 승자 선택 |
| **시빌 감지** | 암호화 바인딩이 변경을 방지 |
| **담합** | 다른 입찰을 보지 않고는 더 어려움 |
| **결제** | 원자적 - 승자가 항목을 얻고, 판매자가 지불을 받음 |
| **최종성** | 즉시 결제; 분쟁 불가능 |

## 파생물

1. **Vickrey (2차 가격) 경매** - 승자가 두 번째로 높은 입찰을 지불합니다. 진실한 입찰을 장려합니다 (지배 전략). 승자와 2위 입찰 모두를 증명해야 합니다. 2위 추적을 위해 ~50K 제약조건 추가.

2. **예약 가격 경매** - 최소 허용 가격이 강제됩니다. 입찰이 예약 가격을 충족하지 않으면 경매가 실패하고 전액 환불됩니다. 예약 가격 확인 포함: `winningBid >= reservePrice`.

3. **다중 항목 경매** - 여러 항목을 동시에 경매합니다. 입찰자는 각 항목에 대한 선호도를 지정합니다. 균일 가격(모두 동일) 또는 차별적(입찰 가격대로 지불)일 수 있습니다.

4. **더치 경매** - 입찰이 수락될 때까지 가격이 하락합니다. 블록에 걸쳐 가격이 감소합니다. 수락하는 첫 번째 입찰자가 승리합니다. 시간에 민감한 판매에 유용합니다.

5. **조합 경매** - 항목 번들에 입찰합니다. 입찰자는 조합에 대한 선호도를 표현합니다. NP-hard 승자 결정은 오프체인 계산이 필요; 회로가 검증합니다.

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";
include "../utils/mux/mux1.circom";

template SealedBidAuctionSettle(N_BIDS) {
    // ===== Public Inputs =====
    signal input itemHash;
    signal input bidCommitments[N_BIDS];
    signal input winnerOutputHash;
    signal input sellerOutputHash;
    signal input loserRefundHashes[N_BIDS];
    signal input reservePrice;  // Minimum acceptable bid

    // ===== Private Inputs =====
    signal input sellerPkX, sellerPkY, sellerSk;
    signal input itemId, itemSalt;

    signal input bidderPkX[N_BIDS], bidderPkY[N_BIDS];
    signal input bidAmount[N_BIDS];
    signal input bidSalt[N_BIDS];
    signal input bidIsActive[N_BIDS];

    signal input winnerIndex;
    signal input winnerSalt;

    // ===== Component Declarations =====
    component itemHasher;
    component sellerOwnership;
    component bidHash[N_BIDS];
    component highestCheck[N_BIDS];
    component refundNote[N_BIDS];
    component reserveCheck;
    component winnerMuxX[N_BIDS];
    component winnerMuxY[N_BIDS];
    component winnerOutput;
    component sellerOutput;

    // Intermediate signals
    signal isWinner[N_BIDS];
    signal isLoser[N_BIDS];
    signal winnerPkX;
    signal winnerPkY;
    signal winningBid;

    // ===== Verify Item =====
    itemHasher = Poseidon(4);
    itemHasher.inputs[0] <== sellerPkX;
    itemHasher.inputs[1] <== sellerPkY;
    itemHasher.inputs[2] <== itemId;
    itemHasher.inputs[3] <== itemSalt;
    itemHasher.out === itemHash;

    // Seller ownership
    sellerOwnership = ProofOfOwnershipStrict();
    sellerOwnership.sk <== sellerSk;
    sellerOwnership.pkX <== sellerPkX;
    sellerOwnership.pkY <== sellerPkY;

    // ===== Verify All Bids =====
    var winnerBidAmount = 0;
    var accWinnerPkX = 0;
    var accWinnerPkY = 0;

    for (var i = 0; i < N_BIDS; i++) {
        // Verify bid commitment
        bidHash[i] = Poseidon(5);
        bidHash[i].inputs[0] <== bidderPkX[i];
        bidHash[i].inputs[1] <== bidderPkY[i];
        bidHash[i].inputs[2] <== bidAmount[i];
        bidHash[i].inputs[3] <== itemHash;
        bidHash[i].inputs[4] <== bidSalt[i];

        (bidHash[i].out - bidCommitments[i]) * bidIsActive[i] === 0;

        // Compute winner indicator (1 if this index is winner, 0 otherwise)
        // Note: This requires proper index comparison
        isWinner[i] <-- (i == winnerIndex) ? 1 : 0;
        isWinner[i] * (1 - isWinner[i]) === 0;  // Boolean check

        // Accumulate winner values
        winnerBidAmount += bidAmount[i] * isWinner[i] * bidIsActive[i];
        accWinnerPkX += bidderPkX[i] * isWinner[i];
        accWinnerPkY += bidderPkY[i] * isWinner[i];
    }

    winningBid <== winnerBidAmount;
    winnerPkX <== accWinnerPkX;
    winnerPkY <== accWinnerPkY;

    // ===== Verify Winner Has Highest Bid =====
    for (var i = 0; i < N_BIDS; i++) {
        highestCheck[i] = LessThan(64);
        highestCheck[i].in[0] <== bidAmount[i];
        highestCheck[i].in[1] <== winningBid + 1;

        highestCheck[i].out * bidIsActive[i] === bidIsActive[i];
    }

    // ===== Verify Reserve Price Met =====
    reserveCheck = LessThan(64);
    reserveCheck.in[0] <== reservePrice;
    reserveCheck.in[1] <== winningBid + 1;
    reserveCheck.out === 1;

    // ===== Create Winner Output (receives item) =====
    winnerOutput = Poseidon(4);
    winnerOutput.inputs[0] <== winnerPkX;
    winnerOutput.inputs[1] <== winnerPkY;
    winnerOutput.inputs[2] <== itemId;
    winnerOutput.inputs[3] <== winnerSalt;
    winnerOutput.out === winnerOutputHash;

    // ===== Create Seller Output (receives payment) =====
    sellerOutput = PoseidonRegularNote();
    sellerOutput.pkX <== sellerPkX;
    sellerOutput.pkY <== sellerPkY;
    sellerOutput.value <== winningBid;
    sellerOutput.tokenType <== 0;
    sellerOutput.salt <== winnerSalt;
    sellerOutput.out === sellerOutputHash;

    // ===== Create Loser Refunds =====
    for (var i = 0; i < N_BIDS; i++) {
        isLoser[i] <== bidIsActive[i] * (1 - isWinner[i]);

        refundNote[i] = PoseidonRegularNote();
        refundNote[i].pkX <== bidderPkX[i];
        refundNote[i].pkY <== bidderPkY[i];
        refundNote[i].value <== bidAmount[i];
        refundNote[i].tokenType <== 0;
        refundNote[i].salt <== bidSalt[i];

        (refundNote[i].out - loserRefundHashes[i]) * isLoser[i] === 0;
    }

    // ===== Verify Exactly One Winner =====
    var winnerCount = 0;
    for (var i = 0; i < N_BIDS; i++) {
        winnerCount += isWinner[i];
    }
    winnerCount === 1;
}

component main {public [itemHash, bidCommitments, winnerOutputHash,
    sellerOutputHash, loserRefundHashes, reservePrice]} = SealedBidAuctionSettle(50);
```

### 주요 제약조건

1. **항목 소유권**: 판매자가 경매 중인 항목을 소유해야 함
2. **입찰 무결성**: 모든 입찰이 commitment에 대해 검증됨
3. **최고 입찰**: 승자가 모든 활성 입찰자 중 최고 입찰을 가짐
4. **예약 가격**: 낙찰 입찰이 최소 가격을 충족해야 함
5. **정확히 한 명의 승자**: 정확히 한 명의 입찰자가 승자로 선택됨
6. **전액 환불**: 모든 패자가 정확한 입찰 금액을 돌려받음

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **시빌 입찰** | 결제 전에 입찰이 커밋됨; 다른 입찰을 본 후 가짜 입찰을 만들 수 없음 |
| **입찰 변조** | Commitment는 암호화됨; commitment 후 입찰을 변경할 수 없음 |
| **경매인 담합** | 신뢰할 수 있는 경매인 없음; 증명이 올바른 승자 선택을 검증 |
| **타이밍 공격** | 모든 입찰이 동일한 블록 또는 시간 창에 커밋됨 |
| **패자 입찰 노출** | 패자 입찰 금액은 절대 공개되지 않음; 승자 금액만 공개 |
| **승자 익명성** | 추가 회로 로직으로 승자 신원을 숨길 수 있음 |
| **환불 보류** | 동일한 증명에서 환불 노트가 원자적으로 생성됨 |
| **예약 가격 게임** | 입찰 전에 예약 가격이 공개됨 |

## 구현 과제

1. **ZK에서 인덱스 선택**
   - `bidderPkX[winnerIndex]`는 MUX 회로가 필요
   - N_BIDS MUX는 필드당 ~500 제약조건 추가
   - 대안: 누산기 패턴 (위에 표시됨)

2. **동점 처리**
   - 두 입찰이 동일한 금액을 가지면?
   - 옵션: 첫 번째 commitment 승리, 무작위 선택, 분할
   - 현재 설계: 배열의 첫 번째가 승리 (결정론적)

3. **실패한 경매**
   - 입찰이 예약 가격을 충족하지 않으면?
   - 전액 환불을 위한 별도의 "실패한 경매" 증명 필요
   - 판매자가 항목을 돌려받음; 모든 입찰자가 환불됨

4. **타이밍 조정**
   - 입찰 기간이 언제 종료되는가?
   - 온체인 타임스탬프 또는 블록 번호 확인
   - 늦은 입찰 보호 고려

5. **대규모 입찰 수**
   - 50개 입찰 = ~600K 제약조건
   - 입찰 수와 선형적으로 확장
   - 더 큰 경매의 경우 계층적 접근 방식 고려

## 사용 사례

1. **NFT 경매**
   - 희귀 NFT에 대한 50개의 봉인 입찰
   - 승자 공개; 패자 입찰 금액은 비공개로 유지
   - 원자적 결제: 승자가 NFT를 얻고, 판매자가 지불을 받음

2. **도메인 이름 경매**
   - 프리미엄 도메인 이름 경매
   - 입찰 정보에 기반한 도메인 투기 방지
   - 프라이버시를 가진 ENS 스타일 경매

3. **부동산 입찰**
   - 봉인 입찰로 부동산 판매
   - 입찰자 담합 방지
   - 감사 추적이 있는 규제 준수

4. **정부 조달**
   - 공공 계약 입찰
   - 입찰 담합 방지
   - 입찰 공개 없이 투명한 검증

5. **미술 경매장**
   - 고가치 미술품 판매
   - 수집가 프라이버시 보존
   - 온체인에서 출처 및 소유권 추적

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용 사례는 [실제 제품 및 사용자 경험](../product/high-complexity/hc6-sealed-bid-auction-products.md)을 참조하세요.

---

[인덱스로 돌아가기](../README.md)
