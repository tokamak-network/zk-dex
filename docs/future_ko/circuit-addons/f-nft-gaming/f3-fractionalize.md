# F3. NFT Fractionalize

원래 소유권과 분할 배분의 프라이버시를 보존하면서 고가치 NFT 소유권을 거래 가능한 분할 토큰으로 분할합니다.

**제약 조건**: ~200K | **복잡도**: Medium

---

## 배경

NFT 분할은 유동성과 접근성 문제를 해결합니다:

- **자본 접근성**: 고가치 NFT (>$100K)는 대부분의 수집가가 접근할 수 없습니다; 분할은 소유권을 민주화합니다
- **유동성 생성**: 전체 NFT는 얇은 시장을 가집니다; 분할은 지속적인 가격 발견을 가능하게 합니다
- **포트폴리오 다각화**: 수집가가 하나에 집중하기보다 여러 가치 있는 NFT의 조각을 소유할 수 있습니다
- **프라이버시 보존**: 현재 분할은 누가 어떤 비율을 보유하는지 드러냅니다; ZK 분할은 이를 숨깁니다

전통적인 분할 소유권은 부동산(REIT)과 미술품(Masterworks)에 존재합니다. 블록체인 분할은 기본적으로 투명하여 소유권 분포를 노출합니다. ZK 분할은 소유권 프라이버시를 보호하면서 이점을 제공합니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `nftNoteHash` | field | 분할되는 NFT의 해시 |
| `vaultHash` | field | NFT를 보유하는 vault의 해시 |
| `fractionCommitments` | field[N] | 분할 note 커밋먼트의 배열 |
| `totalFractions` | uint | 생성된 총 분할 수 |
| `nullifier` | field | 원래 NFT note에 대한 nullifier |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | NFT 소유자의 공개 키 |
| `ownerSk` | field | 소유자의 비밀 키 |
| `nftId` | uint | NFT 식별자 |
| `collectionAddress` | address | NFT 컬렉션 컨트랙트 |
| `nftSalt` | field | NFT note 랜덤성 |
| `fractionAmounts` | uint[N] | 각 분할의 금액 |
| `fractionRecipients` | field[N][2] | 분할 수신자의 공개 키 |
| `fractionSalts` | field[N] | 각 분할의 랜덤성 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template NFTFractionalize(N) {
    // ===== Public Inputs =====
    signal input nftNoteHash;
    signal input vaultHash;
    signal input fractionCommitments[N];
    signal input totalFractions;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY, ownerSk;
    signal input nftId, collectionAddress, nftSalt;
    signal input fractionAmounts[N];
    signal input fractionRecipientPkX[N], fractionRecipientPkY[N];
    signal input fractionSalts[N];

    // ===== 1. Verify NFT Note =====
    component nftNote = Poseidon(5);
    nftNote.inputs[0] <== ownerPkX;
    nftNote.inputs[1] <== ownerPkY;
    nftNote.inputs[2] <== nftId;
    nftNote.inputs[3] <== collectionAddress;
    nftNote.inputs[4] <== nftSalt;
    nftNote.out === nftNoteHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== ownerSk;
    ownership.pkX <== ownerPkX;
    ownership.pkY <== ownerPkY;

    // ===== 3. Compute Nullifier =====
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== nftId;
    nullifierCalc.inputs[1] <== nftSalt;
    nullifierCalc.inputs[2] <== ownerSk;
    nullifierCalc.out === nullifier;

    // ===== 4. Create Vault Commitment =====
    // Vault holds NFT locked for fractionalization
    component vault = Poseidon(4);
    vault.inputs[0] <== nftId;
    vault.inputs[1] <== collectionAddress;
    vault.inputs[2] <== totalFractions;
    vault.inputs[3] <== nullifier;  // Links vault to original note
    vault.out === vaultHash;

    // ===== 5. Create Fraction Notes =====
    component fractionNotes[N];
    signal fractionSum[N+1];
    fractionSum[0] <== 0;

    for (var i = 0; i < N; i++) {
        // Fraction note: Hash(recipientPkX, recipientPkY, amount, vaultHash, salt)
        fractionNotes[i] = Poseidon(5);
        fractionNotes[i].inputs[0] <== fractionRecipientPkX[i];
        fractionNotes[i].inputs[1] <== fractionRecipientPkY[i];
        fractionNotes[i].inputs[2] <== fractionAmounts[i];
        fractionNotes[i].inputs[3] <== vaultHash;
        fractionNotes[i].inputs[4] <== fractionSalts[i];
        fractionNotes[i].out === fractionCommitments[i];

        // Accumulate fractions
        fractionSum[i+1] <== fractionSum[i] + fractionAmounts[i];
    }

    // ===== 6. Verify Total Equals 100% =====
    // Using basis points: 10000 = 100%
    fractionSum[N] === totalFractions;

    // ===== 7. Verify Non-Zero Fractions =====
    component nonZero[N];
    for (var i = 0; i < N; i++) {
        nonZero[i] = GreaterThan(64);
        nonZero[i].in[0] <== fractionAmounts[i];
        nonZero[i].in[1] <== 0;
        nonZero[i].out === 1;
    }
}

component main {public [nftNoteHash, vaultHash, fractionCommitments, totalFractions, nullifier]} =
    NFTFractionalize(10);  // Support up to 10 initial fraction holders
```

### 주요 제약 조건

1. **NFT 소유권**: NFT 소유자만 분할을 시작할 수 있습니다
2. **보존**: 총 분할이 100% (또는 totalFractions 베이시스 포인트)와 같아야 합니다
3. **0이 아닌 분할**: 각 분할은 양의 값을 가져야 합니다
4. **Vault 연결**: Vault 커밋먼트가 원래 NFT에 암호화적으로 연결됩니다
5. **Nullifier 고유성**: 원래 NFT note가 소비됩니다; 두 번 분할할 수 없습니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **유동성** | 고가치 NFT가 더 작은 단위로 거래 가능 |
| **접근성** | 더 많은 수집가가 가치 있는 NFT 소유권에 참여 가능 |
| **소유권 프라이버시** | 분할 배분이 공개에서 숨겨짐 |
| **가격 발견** | 분할의 지속적인 거래가 시장 평가를 드러냄 |
| **조합 가능성** | 분할이 DeFi에서 사용 가능 (담보, LP) |
| **거버넌스** | 분할 보유자가 NFT 결정에 투표 가능 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **분할 인플레이션** | 보존 제약이 추가 분할 생성 없음을 보장 |
| **재구성 공격** | 매수 메커니즘이 임계값 필요; 다른 보유자 강제 불가 |
| **Vault 조작** | Vault 해시가 nullifier 포함; 특정 NFT에 불변적으로 연결 |
| **더스트 분할** | 최소 분할 크기 강제 가능 (예: 0.1%) |
| **거버넌스 공격** | 거버넌스 행동에 대한 타임락; 정족수 요구사항 |
| **Oracle 조작** | 매수 평가를 위해 여러 가격 소스 사용 |

## 구현 과제

1. **매수 메커니즘**
   - 누군가 100%를 획득하고 NFT를 재구성하는 방법은?
   - 공정한 가치 결정이 있는 경매 기반 매수
   - 분할 보유자가 판매 승인을 위한 임계값 투표

2. **분할 거래**
   - private 분할 전송을 지원하는 마켓플레이스 필요
   - 분할 유동성을 위한 주문서 또는 AMM
   - 보유자 위치를 드러내지 않는 가격 발견

3. **수익 배분**
   - NFT가 수익을 생성하는 경우 (로열티, 임대), 어떻게 배분할 것인가?
   - 분할 보유자가 소유권을 증명하는 청구 메커니즘
   - 가스 비용을 줄이기 위한 배치 배분

4. **거버넌스 조정**
   - NFT에 대한 결정 (대출, 전시, 라이선싱)
   - private 분할 금액을 가진 투표 메커니즘
   - 위임 및 프록시 투표 지원

## 파생 상품

1. **거버넌스 권리 분할** - 경제적 권리와 거버넌스 권리를 다른 분할 유형으로 분리합니다. 일부 분할은 수익 점유율을 받습니다; 다른 것은 NFT 결정을 제어합니다. 투자 대 큐레이션 권리와 같은 특수 소유권 구조를 허용합니다.

2. **매수 메커니즘** - 공정한 경매를 통해 완전한 재구성을 가능하게 합니다. 회로가 모든 분할이 수집되었음을 증명합니다; 원래 NFT가 vault에서 해제됩니다. 가격 발견 기간과 소수 보호를 포함합니다.

3. **분할 투표** - private 분할 금액으로 NFT 관련 결정에 투표합니다. 회로가 분할 소유권과 투표 유효성을 증명합니다. 이차 투표, 위임 및 시간 가중 투표를 지원합니다.

4. **로열티 배분** - 이차 판매 로열티를 분할 보유자에게 자동으로 배분합니다. 회로가 스냅샷 시간의 분할 소유권을 검증합니다. 개별 보유량을 드러내지 않고 청구 가능한 로열티.

5. **분할 상환** - NFT가 판매되면 분할을 비례 가치로 다시 변환합니다. 회로가 분할 소유권을 증명합니다; 지불금을 계산합니다. 부분 상환과 가격 분쟁을 처리합니다.

## 사용 사례

1. **블루칩 NFT 투자**
   - CryptoPunk가 $10M에 판매됨
   - 개당 $1,000에 10,000주로 분할됨
   - 소매 수집가가 상징적인 NFT의 일부를 소유할 수 있음
   - 분할 가격이 시장 심리에 따라 거래됨

2. **DAO 재무 다각화**
   - DAO가 초기부터 가치 있는 NFT 소유
   - 토큰 보유자에게 소유권을 배분하기 위해 분할
   - 원래 NFT는 vault에 유지됨; 그에 대한 거버넌스 공유
   - NFT를 판매하지 않고 유동성 이벤트 생성

3. **아티스트 후원**
   - 아티스트가 새 작품에 대한 분할의 20% 유지
   - 경매를 통해 수집가에게 80% 판매
   - 아티스트가 미래 감사에서 지분 유지
   - 수집가가 아티스트의 장기 성공과 정렬됨

4. **메타버스 토지 개발**
   - 가치 있는 가상 토지 구획이 분할됨
   - 여러 당사자가 개발 비용에 기여
   - 토지 사용으로 인한 수익이 분할 보유자에게 배분됨
   - 대규모 메타버스 프로젝트 가능

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F3. NFT Fractionalize - Products](../../product/f-nft-gaming/f3-fractionalize-products.md)

---

[목차로 돌아가기](../../README.md)
