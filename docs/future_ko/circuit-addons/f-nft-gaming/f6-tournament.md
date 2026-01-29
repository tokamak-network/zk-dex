# F6. Tournament Entry

private 스테이크 금액, 숨겨진 참가자 수 및 검증 가능한 자격 요구사항을 갖춘 익명 토너먼트 등록.

**제약 조건**: ~140K | **복잡도**: Medium

---

## 배경

토너먼트 진입은 경쟁 정보를 드러냅니다:

- **참가자 프라이버시**: 공개 등록은 누가 경쟁하는지 노출하여 표적 준비를 허용합니다
- **스테이크 은닉**: 가시적인 스테이크 금액은 플레이어의 자신감과 재정 능력을 드러냅니다
- **자격 프라이버시**: 플레이어 통계나 이력을 노출하지 않는 요구사항 검증
- **안티 담합**: 익명 진입이 참가자의 조정을 더 어렵게 만듭니다

E스포츠와 게임 토너먼트는 정보 비대칭이 중요한 고위험 경쟁입니다. ZK 토너먼트 진입은 매치가 시작될 때까지 참가자 신원을 보호하면서 공정한 경쟁을 허용합니다.

## 기술 명세

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `entryCommitment` | field | 진입 세부사항에 대한 해시 커밋먼트 |
| `tournamentId` | uint | 토너먼트의 고유 식별자 |
| `stakeNoteHash` | field | 스테이크/진입 수수료 note의 해시 |
| `qualificationProof` | field | 요구사항 충족 증명 |
| `nullifier` | field | 이중 진입 방지 |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `playerPkX, playerPkY` | field | 플레이어의 공개 키 |
| `playerSk` | field | 플레이어의 비밀 키 |
| `entrySalt` | field | 진입 커밋먼트를 위한 랜덤성 |
| `stakeValue` | uint | 진입 스테이크 금액 |
| `stakeSalt` | field | 스테이크 note 랜덤성 |
| `playerRating` | uint | 플레이어의 스킬 등급 |
| `playerHistory` | field | 매치 이력의 해시 |
| `minRating` | uint | 필요한 최소 등급 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template TournamentEntry() {
    // ===== Public Inputs =====
    signal input entryCommitment;
    signal input tournamentId;
    signal input stakeNoteHash;
    signal input qualificationProof;
    signal input nullifier;

    // ===== Private Inputs =====
    signal input playerPkX, playerPkY, playerSk;
    signal input entrySalt;
    signal input stakeValue, stakeSalt, stakeToken;
    signal input playerRating, playerHistory;
    signal input minRating, minStake;

    // ===== 1. Verify Entry Commitment =====
    // Entry = Hash(playerPkX, playerPkY, tournamentId, entrySalt)
    component entryHash = Poseidon(4);
    entryHash.inputs[0] <== playerPkX;
    entryHash.inputs[1] <== playerPkY;
    entryHash.inputs[2] <== tournamentId;
    entryHash.inputs[3] <== entrySalt;
    entryHash.out === entryCommitment;

    // ===== 2. Verify Player Identity =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== playerSk;
    ownership.pkX <== playerPkX;
    ownership.pkY <== playerPkY;

    // ===== 3. Compute Nullifier =====
    // Prevents same player from entering twice
    component nullifierCalc = Poseidon(3);
    nullifierCalc.inputs[0] <== tournamentId;
    nullifierCalc.inputs[1] <== playerSk;
    nullifierCalc.inputs[2] <== entrySalt;
    nullifierCalc.out === nullifier;

    // ===== 4. Verify Stake Note =====
    component stakeNote = Poseidon(5);
    stakeNote.inputs[0] <== playerPkX;
    stakeNote.inputs[1] <== playerPkY;
    stakeNote.inputs[2] <== stakeValue;
    stakeNote.inputs[3] <== stakeToken;
    stakeNote.inputs[4] <== stakeSalt;
    stakeNote.out === stakeNoteHash;

    // ===== 5. Verify Minimum Stake =====
    component stakeCheck = GreaterEqThan(64);
    stakeCheck.in[0] <== stakeValue;
    stakeCheck.in[1] <== minStake;
    stakeCheck.out === 1;

    // ===== 6. Verify Rating Qualification =====
    component ratingCheck = GreaterEqThan(64);
    ratingCheck.in[0] <== playerRating;
    ratingCheck.in[1] <== minRating;
    ratingCheck.out === 1;

    // ===== 7. Generate Qualification Proof =====
    // Proof that player meets requirements without revealing exact stats
    component qualProof = Poseidon(4);
    qualProof.inputs[0] <== playerRating;
    qualProof.inputs[1] <== playerHistory;
    qualProof.inputs[2] <== minRating;
    qualProof.inputs[3] <== playerSk;
    qualProof.out === qualificationProof;
}

component main {public [entryCommitment, tournamentId, stakeNoteHash, qualificationProof, nullifier]} =
    TournamentEntry();
```

### 주요 제약 조건

1. **신원 검증**: 플레이어가 자신의 게임 신원의 소유권을 증명합니다
2. **단일 진입**: Nullifier가 한 플레이어가 여러 번 진입하는 것을 방지합니다
3. **스테이크 요구사항**: 진입 스테이크가 토너먼트 최소치를 충족합니다
4. **등급 자격**: 플레이어 등급이 최소 임계값을 초과합니다
5. **커밋먼트 바인딩**: 등록 후 진입 세부사항을 변경할 수 없습니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **참가자 프라이버시** | 매치 시간까지 경쟁자 미상 |
| **스테이크 프라이버시** | 진입 금액 숨김; 부의 신호 없음 |
| **공정한 경쟁** | 알려진 상대에 대한 표적 준비 없음 |
| **안티 담합** | 익명 진입이 조정 능력 감소 |
| **자격 증명** | 통계를 노출하지 않고 요구사항 검증 |
| **시빌 방지** | Nullifier가 중복 진입 방지 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **다중 계정** | 검증된 신원에 연결하거나 스테이크 요구 |
| **등급 조작** | 신뢰할 수 있는 oracle 또는 온체인 이력의 등급 |
| **진입 Grinding** | Salt가 엔트로피 제공; nullifier가 재시도 방지 |
| **스테이크 인출** | 토너먼트가 완료될 때까지 스테이크 잠김 |
| **브라켓 조작** | 진입 마감 후 VRF 기반 브라켓 생성 |
| **담합 탐지** | 매치 모니터링 및 통계 분석 |

## 구현 과제

1. **등급 시스템 통합**
   - 플레이어 등급은 어디에서 오는가?
   - 온체인 ELO 시스템 또는 신뢰할 수 있는 oracle
   - 등급 업데이트가 검증 가능해야 함

2. **공개 타이밍**
   - 참가자가 언제 공개되는가?
   - 매치 직전 또는 토너먼트 후?
   - 프라이버시와 청중 경험의 균형

3. **브라켓 생성**
   - 익명으로 공정한 브라켓을 만드는 방법은?
   - 모든 진입 후 VRF 기반 시드
   - 브라켓 조작 방지

4. **상금 배분**
   - 우승자가 전체 신원 공개 없이 청구해야 함
   - 매치 결과의 증명
   - 우승자에게 private 상금 전송

## 파생 상품

1. **익명 브라켓** - 참가자 신원을 공개하지 않고 토너먼트 브라켓을 생성합니다. 브라켓 위치가 진입 마감 후 VRF에서 파생됩니다. 플레이어는 매치 직전 상대에게만 공개됩니다.

2. **상금 풀 기여** - 최소치를 초과하는 추가 스테이크가 상금 풀에 기여합니다. 회로가 금액을 공개하지 않고 기여를 검증합니다. 숨겨진 기여로 가변 상금 풀을 생성합니다.

3. **탈락 증명** - 플레이어 신원을 공개하지 않고 매치 결과와 탈락을 증명합니다. 우승자가 새 커밋먼트로 진행합니다; 패자의 진입이 무효화됩니다. 익명으로 브라켓 무결성을 유지합니다.

4. **스킬 기반 매치메이킹** - 등급을 공개하지 않고 유사한 스킬의 플레이어를 매치합니다. 회로가 두 플레이어가 동일한 등급 밴드에 있음을 증명합니다. 정확한 등급을 숨기면서 공정한 매치를 보장합니다.

5. **안티 시빌 진입** - 여러 신원 프레임워크에서 고유성을 증명합니다. 회로가 플레이어가 다른 신원으로 등록되지 않았음을 검증합니다. 스테이크와 결합하여 다중 계정을 방지합니다.

## 사용 사례

1. **프로 E스포츠 토너먼트**
   - $1M 상금 풀이 있는 주요 토너먼트
   - 최고 플레이어가 표적 연습을 방지하기 위해 익명으로 진입
   - 정확한 통계를 공개하지 않고 자격 검증
   - 라이브 이벤트에서만 신원 공개

2. **일일 게임 대회**
   - 진입 스테이크가 있는 일일 토너먼트
   - 플레이어가 상금 풀을 위해 익명으로 경쟁
   - 정규 플레이어 간의 담합 방지
   - 스킬 브라켓 전체에서 공정한 경쟁

3. **길드 대 길드 전쟁**
   - 길드가 명단을 공개하지 않고 팀 등록
   - 상대가 특정 플레이어를 준비할 수 없음
   - 숨겨진 팀 구성에서 전략적 이점
   - 라이브 매치 중에만 회원 공개

4. **고위험 포커 토너먼트**
   - 플레이어가 숨겨진 뱅크롤 정보로 진입
   - 부유한 플레이어를 표적으로 하는 능력 없음
   - 테이블에 앉을 때까지 익명
   - 상금 청구가 우승자 프라이버시 유지

## 실제 제품 및 사용자 경험

자세한 제품 설명 및 사용자 경험 참조: [F6. Tournament Entry - Products](../../product/f-nft-gaming/f6-tournament-products.md)

---

[목차로 돌아가기](../../README.md)
