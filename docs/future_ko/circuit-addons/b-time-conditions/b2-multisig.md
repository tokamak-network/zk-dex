# B2. 다중 서명 노트 (Multi-Signature Notes)

거래 승인에 여러 서명자가 필요한 M-of-N 임계값 지출로, 서명자 신원을 드러내지 않고 공동 보관을 가능하게 합니다.

**제약 조건**: ~300K (5명 서명자) | **복잡도**: 중간

---

## 배경

다중 서명 체계는 안전한 자금 관리에 필수적입니다:

- **단일 실패 지점**: 단일 키 제어는 하나의 침해된 키가 모든 자금을 잃는다는 것을 의미합니다
- **조직 요구사항**: 기업 재무, DAO, 파트너십은 여러 승인자가 필요합니다
- **현재 솔루션의 프라이버시 유출**: Gnosis Safe 및 유사한 멀티시그는 모든 서명자 주소를 공개적으로 노출합니다
- **유연한 임계값**: 다른 시나리오는 다른 M-of-N 구성이 필요합니다 (2-of-3, 3-of-5 등)

Gnosis Safe와 같은 전통적인 멀티시그 솔루션은 강력하지만 완전히 투명합니다. 모든 서명자 주소가 공개되어 사회 공학 공격을 가능하게 하고 조직 구조를 드러냅니다. ZK 멀티시그 노트는 서명자의 수와 그들의 신원을 숨기면서도 임계값 승인을 요구합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 멀티시그 노트의 해시 |
| `outputHash` | field | 지출 후 출력 노트의 해시 |
| `threshold` | uint | 필요한 최소 서명 수 |
| `tokenType` | uint | 토큰 타입 식별자 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `pkX[N]`, `pkY[N]` | field[] | 서명자 공개 키 배열 |
| `value` | uint | 노트 가치 (숨겨짐) |
| `salt` | field | 노트 무작위성 |
| `sk[N]` | field[] | 비밀 키 (서명 당사자만 유효한 키 제공) |
| `isSigning[N]` | binary[] | 어떤 당사자가 서명하는지 나타내는 비트맵 |
| `outPkX, outPkY` | field | 출력 노트 소유자 공개 키 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/scalar_mul_base.circom";
include "../utils/comparators.circom";

template MultiSigSpend(N_SIGNERS) {
    // ===== Public Inputs =====
    signal input noteHash;
    signal input outputHash;
    signal input threshold;
    signal input tokenType;

    // ===== Private Inputs =====
    signal input pkX[N_SIGNERS], pkY[N_SIGNERS];
    signal input value, salt;
    signal input sk[N_SIGNERS];
    signal input isSigning[N_SIGNERS];  // 0 or 1 for each signer
    signal input outPkX, outPkY, outSalt;

    // ===== 1. Verify Multisig Note Hash =====
    // Note format includes all signer public keys plus metadata
    component note = Poseidon(N_SIGNERS * 2 + 4);
    for (var i = 0; i < N_SIGNERS; i++) {
        note.inputs[i * 2] <== pkX[i];
        note.inputs[i * 2 + 1] <== pkY[i];
    }
    note.inputs[N_SIGNERS * 2] <== value;
    note.inputs[N_SIGNERS * 2 + 1] <== tokenType;
    note.inputs[N_SIGNERS * 2 + 2] <== salt;
    note.inputs[N_SIGNERS * 2 + 3] <== threshold;
    note.out === noteHash;

    // ===== 2. Count Valid Signatures =====
    signal sigCount[N_SIGNERS + 1];
    sigCount[0] <== 0;

    component own[N_SIGNERS];
    for (var i = 0; i < N_SIGNERS; i++) {
        // Ensure isSigning is binary (0 or 1)
        isSigning[i] * (1 - isSigning[i]) === 0;

        // Derive public key from secret key
        own[i] = BabyJubJubScalarMulBase();
        own[i].scalar <== sk[i];

        // If signing, verify sk derives to pk
        // Conditional check: (derived - expected) * isSigning == 0
        (own[i].outX - pkX[i]) * isSigning[i] === 0;
        (own[i].outY - pkY[i]) * isSigning[i] === 0;

        // Accumulate signature count
        sigCount[i + 1] <== sigCount[i] + isSigning[i];
    }

    // ===== 3. Threshold Check =====
    component thresholdCheck = GreaterEqThan(8);
    thresholdCheck.in[0] <== sigCount[N_SIGNERS];
    thresholdCheck.in[1] <== threshold;
    thresholdCheck.out === 1;

    // ===== 4. Verify Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== value;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;
}

component main {public [noteHash, outputHash, threshold, tokenType]} =
    MultiSigSpend(5);
```

### 핵심 제약 조건

1. **노트 형식 검증**: 노트 해시에 모든 서명자 공개 키가 커밋됨
2. **이진 서명 플래그**: 각 `isSigning[i]`는 정확히 0 또는 1이어야 함
3. **서명 검증**: `isSigning[i] == 1`이면, 제공된 `sk[i]`는 `pk[i]`로 도출되어야 함
4. **임계값 충족**: 총 유효 서명이 임계값을 충족하거나 초과해야 함
5. **가치 보존**: 출력 노트는 입력 노트와 동일한 가치를 포함

## 효과

| 측면 | 영향 |
|--------|--------|
| **보안** | 단일 키 침해로 자금을 유출할 수 없음 |
| **프라이버시** | 서명자 신원과 서명자 수가 숨겨짐 |
| **유연성** | 다양한 보안 요구사항을 위한 구성 가능한 M-of-N 임계값 |
| **신뢰 분산** | 여러 당사자에 걸쳐 분산된 제어 |
| **조직 프라이버시** | 기업 구조가 온체인에서 드러나지 않음 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **키 공모** | 신뢰 가정에 기반한 적절한 임계값 설정 |
| **사회 공학** | 숨겨진 서명자 신원이 표적 공격을 방지 |
| **키 분실** | 중복성을 위해 임계값 < 총 서명자 보장 |
| **악의적인 서명자** | 임계값 > 1이면 혼자 지출할 수 없음 |
| **재생 공격** | 노트 해시의 nullifier가 이중 지출 방지 |
| **더미 키 공격** | 노트 생성 시 모든 키가 유효한 BabyJubjub 포인트여야 함 |

## 구현 과제

1. **조정 프로토콜**
   - 서명자는 부분 서명을 공유하기 위한 보안 채널 필요
   - 비대화형 서명을 위한 임계값 서명 체계(TSS) 고려
   - 온체인 제출 전 오프체인 조정 필요

2. **회로 크기 확장**
   - 제약 조건이 N_SIGNERS와 선형적으로 증가
   - 추가 서명자당 ~50K 제약 조건
   - 대규모 그룹을 위한 계층적 멀티시그 고려

3. **키 관리**
   - 각 서명자는 자신의 키를 안전하게 저장해야 함
   - 키 회전은 새로운 멀티시그 노트 생성 필요
   - 온체인 복구 메커니즘 없음

4. **증명 생성 분산**
   - 누가 최종 증명을 생성하는가?
   - 위트니스 데이터를 안전하게 공유해야 함
   - MPC 기반 증명 생성 고려

## 파생 형태

1. **계층적 멀티시그** - 부서장이 승인한 후 경영진이 최종 승인을 제공하는 2단계 서명 구조입니다. 구조를 드러내지 않고 서명 요구사항에 조직 계층을 반영하여 기업 거버넌스를 가능하게 합니다.

2. **가중 투표 노트** - 각 서명자가 다른 투표권을 가짐 (예: CEO는 3표, 관리자는 각 1표). 임계값은 단순 카운트가 아닌 가중 합계입니다. 회로는 노트 해시에 가중치 배열을 포함하고 가중 투표를 누적합니다.

3. **시간 지연 멀티시그** - 임계값 서명이 수집된 후 거래는 실행 전 시간 지연에 들어갑니다. 나머지 서명자는 지연 중에 취소할 수 있습니다. 침해를 감지할 시간과 함께 고가치 거래를 위한 보안 버퍼를 제공합니다.

4. **역할 기반 액세스 노트** - 다른 역할이 동일한 노트에서 다른 작업을 수행할 수 있습니다. 지출에는 관리자 키가 필요하고, 잔액 보기에는 감사자 키만 필요합니다. 다양한 키 세트로 정의된 여러 액세스 계층이 있는 단일 노트입니다.

5. **소셜 복구 노트** - 주 키가 분실된 경우 집단적으로 자금을 복구할 수 있는 신뢰할 수 있는 보호자를 지정합니다. 보호자는 일반적으로 지출할 수 없지만 복구 주소로 전송할 수 있습니다. 복구 전용 3-of-5 보호자 임계값입니다.

## 사용 사례

1. **기업 재무**
   - 회사가 1천만 달러의 토큰 보유
   - CFO, CEO, 이사회 구성원 3명과 함께 3-of-5 멀티시그
   - 모든 거래는 3개의 승인 필요
   - 프라이버시: 경쟁자가 재무 보유량이나 서명자를 식별할 수 없음

2. **DAO 거버넌스**
   - DAO 자금이 선출된 평의회에 의해 제어됨
   - 4-of-7 임계값이 다수 합의를 보장
   - 평의회 구성원 변경은 새 멀티시그로 마이그레이션 필요
   - 프라이버시: 평의회 구성원 신원이 외부 압력으로부터 보호됨

3. **가족 신탁**
   - 부모가 자녀를 위한 신탁 설정
   - 양 부모와 변호사를 서명자로 하는 2-of-3
   - 주요 분배는 부모 승인 필요
   - 프라이버시: 가족 재정 협약이 기밀로 유지됨

4. **비즈니스 파트너십**
   - 두 파트너가 비즈니스 자금의 제어를 공유
   - 주요 비용은 2-of-2, 일상 운영은 1-of-2
   - 어느 파트너도 일상 비용을 처리할 수 있음
   - 프라이버시: 비즈니스 재무가 경쟁자에게 노출되지 않음

## 실제 제품 및 사용자 경험

자세한 제품 시나리오 및 사용자 스토리는 [다중 서명 노트 - 제품 및 사용자 경험](../../../future/product/b-time-conditions/b2-multisig-products.md)을 참조하세요.

---

[색인으로 돌아가기](../../README.md)
