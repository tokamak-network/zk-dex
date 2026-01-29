# C6. View Key Delegation

지출 권한 없이 노트 정보에 대한 읽기 전용 액세스를 부여하여 감사 및 모니터링을 가능하게 합니다.

**제약 조건**: ~180K | **복잡도**: 중간

---

## 배경

뷰 키 위임은 실용적인 프라이버시 시스템을 위해 가시성과 제어를 분리합니다:

- **관심사 분리**: 회계사는 가시성이 필요하지만, 소유자만 지출해야 합니다
- **감사 요구 사항**: 기업은 감사관에게 재무 기록을 제공해야 합니다
- **세금 규정 준수**: 세무 당국이 트랜잭션 가시성을 요구할 수 있습니다
- **자산 관리**: 자문가가 보관 없이 포트폴리오를 모니터링합니다
- **기관 요구 사항**: 펀드 관리자는 감독 기능이 필요합니다

전통적인 금융에서는 읽기 전용 액세스가 표준입니다(은행 명세서, 포트폴리오 보기). 프라이버시 시스템에는 동등한 기능이 필요합니다. 뷰 키 위임은 위임자가 지출 기능을 얻지 않고 조회 권한이 있음을 증명하고 노트 세부 정보에 액세스할 수 있는 암호학적 위임을 생성합니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `delegationHash` | field | 위임 권한의 해시 |
| `noteHash` | field | 조회 중인 노트의 해시 |
| `merkleRoot` | field | 노트 커밋먼트 트리의 루트 |
| `currentTime` | uint | 만료 확인을 위한 현재 타임스탬프 |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `ownerPkX, ownerPkY` | field | 노트 소유자의 공개키 |
| `delegatePkX, delegatePkY` | field | 위임자의 공개키 |
| `delegateSk` | field | 위임자의 비밀키 (위임자 신원 증명) |
| `scope` | field | 위임 범위 (0 = 전체, 또는 특정 noteHash) |
| `expiry` | uint | 위임 만료 타임스탬프 |
| `delegationSalt` | field | 위임 해시를 위한 무작위성 |
| `noteValue` | uint | 노트 값 (위임자에게 공개됨) |
| `noteTokenType` | uint | 노트 토큰 타입 |
| `noteSalt` | field | 노트 무작위성 |
| `merklePath[TREE_DEPTH]` | field[] | Merkle 증명 경로 |
| `merkleIndex` | uint | Merkle 트리 위치 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template VerifyViewAccess(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input delegationHash;
    signal input noteHash;
    signal input merkleRoot;
    signal input currentTime;

    // ===== Private Inputs =====
    signal input ownerPkX, ownerPkY;
    signal input delegatePkX, delegatePkY;
    signal input delegateSk;
    signal input scope;
    signal input expiry;
    signal input delegationSalt;
    signal input noteValue, noteTokenType, noteSalt;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;

    // ===== 1. Verify Delegation Hash =====
    // delegation = H(ownerPk, delegatePk, scope, expiry, salt)
    component delegation = Poseidon(7);
    delegation.inputs[0] <== ownerPkX;
    delegation.inputs[1] <== ownerPkY;
    delegation.inputs[2] <== delegatePkX;
    delegation.inputs[3] <== delegatePkY;
    delegation.inputs[4] <== scope;
    delegation.inputs[5] <== expiry;
    delegation.inputs[6] <== delegationSalt;
    delegation.out === delegationHash;

    // ===== 2. Verify Delegate Identity =====
    component delegateOwn = ProofOfOwnershipStrict();
    delegateOwn.sk <== delegateSk;
    delegateOwn.pkX <== delegatePkX;
    delegateOwn.pkY <== delegatePkY;

    // ===== 3. Verify Note Belongs to Owner =====
    component note = PoseidonRegularNote();
    note.pkX <== ownerPkX;
    note.pkY <== ownerPkY;
    note.value <== noteValue;
    note.tokenType <== noteTokenType;
    note.salt <== noteSalt;
    note.out === noteHash;

    // ===== 4. Verify Merkle Inclusion =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== noteHash;
    merkle.root <== merkleRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 5. Verify Scope =====
    // scope = 0 means all notes; otherwise scope must equal noteHash
    component scopeCheck = IsZero();
    scopeCheck.in <== scope;

    signal scopeMatch;
    scopeMatch <== (scope - noteHash) * (1 - scopeCheck.out);
    scopeMatch === 0;

    // ===== 6. Verify Not Expired =====
    component expiryCheck = LessThan(64);
    expiryCheck.in[0] <== currentTime;
    expiryCheck.in[1] <== expiry;
    expiryCheck.out === 1;

    // ===== Output: Note details are now proven accessible =====
    // The delegate can include noteValue, noteTokenType in their report
    // These are private inputs but the proof attests to their correctness
}

component main {public [delegationHash, noteHash, merkleRoot, currentTime]} =
    VerifyViewAccess(20);
```

### 주요 제약 조건

1. **위임 진정성**: 위임 해시가 주장된 매개변수와 일치합니다
2. **위임자 신원**: 증명자가 위임자 키를 제어합니다
3. **노트 소유권**: 노트가 위임 소유자에게 속합니다
4. **범위 준수**: 위임 범위 내의 노트 (전체 또는 특정)
5. **시간 유효성**: 만료 전 현재 시간

## 효과

| 측면 | 영향 |
|--------|--------|
| **접근 제어** | 지출 없이 읽기 전용 액세스 |
| **범위 유연성** | 모든 노트 또는 특정 하위 집합 |
| **시간 제한** | 액세스 자동 만료 |
| **취소 가능성** | 소유자가 갱신하지 않음으로써 취소할 수 있습니다 |
| **감사 가능성** | 위임을 기록할 수 있습니다 |
| **프라이버시 보존** | 위임된 정보만 공개됩니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **위임 위조** | 위임에 대한 소유자 서명 (오프체인) |
| **범위 확대** | 위임 해시의 명시적 범위 |
| **만료된 위임 사용** | 온체인 시간 검증 |
| **위임자 키 침해** | 짧은 만료 기간; 순환 |
| **소유자 사칭** | 오프체인에서 위임 출처 검증 |
| **무단 노트 액세스** | 범위가 어떤 노트가 보이는지 제한합니다 |
| **위임 취소** | 취소 레지스트리 유지 |

## 구현 과제

1. **위임 생성**
   - 소유자가 오프체인에서 위임에 서명해야 합니다
   - 위임 해시가 게시되거나 비공개로 공유됩니다
   - 위임 레지스트리 컨트랙트 고려

2. **취소 메커니즘**
   - 위임은 기본적으로 만료까지 유효합니다
   - 조기 취소는 온체인 레지스트리가 필요합니다
   - 취소 확인을 위한 가스 비용

3. **계층적 위임**
   - 위임자가 재위임할 수 있습니까?
   - 깊이 제한으로 남용 방지
   - 명확한 권한 체인

4. **범위 사양**
   - 단일 노트 vs. 모든 노트 vs. 시간 범위
   - 토큰 타입 필터
   - 값 범위 필터

5. **위임자를 위한 증명 생성**
   - 위임자가 증명을 생성하려면 노트 데이터가 필요합니다
   - 소유자가 암호화된 노트 데이터를 공유해야 합니다
   - 암호화된 데이터가 있는 노트 레지스트리 고려

## 파생물

1. **계층적 뷰 키** - 위임자가 축소된 범위로 하위 위임할 수 있는 다단계 위임. CEO가 CFO에게 위임하고(모든 재무), CFO가 회계사에게 위임합니다(특정 계정). 조직 계층 매핑입니다.

2. **범위 지정 뷰 액세스** - 단일 노트를 넘어선 세밀한 범위 정의. 토큰 타입 필터, 시간 범위 필터, 값 범위 필터. 감사관이 임계값 이상의 트랜잭션만 봅니다.

3. **감사관 전용 키** - 규제 감사관이 규정 준수 특정 액세스가 있는 특수 키를 받습니다. 전체 트랜잭션 세부 정보 없이 AML 규정 준수를 확인할 수 있습니다. 규제 요구 사항을 최소한으로 충족합니다.

4. **시간 만료 뷰 위임** - 선택적 갱신이 있는 자동 만료. 분기별 감사관 액세스, 연간 세무 준비자 액세스. 위임으로 인한 장기 노출을 줄입니다.

5. **다자간 뷰 공유** - 액세스를 위해 여러 위임자가 협력해야 하는 임계값 스킴. 이사회 구성원이 공동으로 재무 뷰에 액세스합니다. 단일 당사자 감시를 방지합니다.

## 사용 사례

1. **세무 준비**
   - 사용자가 연도에 대한 뷰 액세스를 세무 준비자에게 위임합니다
   - 세무 준비자가 보유 자산 및 트랜잭션 보고서를 생성합니다
   - 준비자가 자금을 지출하거나 이체할 수 없습니다
   - 세금 신고 마감일 이후 위임이 만료됩니다

2. **펀드 관리**
   - 헤지 펀드가 관리자에게 뷰를 위임합니다
   - 관리자가 포지션을 모니터링하고 NAV 보고서를 생성합니다
   - 보관 또는 거래 기능 없음
   - 규제 감독 요구 사항을 충족합니다

3. **유산 계획**
   - 개인이 유산 변호사에게 뷰를 위임합니다
   - 변호사가 유산 계획을 위해 자산을 확인할 수 있습니다
   - 실제 제어는 개인에게 남아 있습니다
   - 사망 시 위임 이전 (별도 메커니즘)

4. **자산 관리**
   - 고객이 재무 자문가에게 뷰를 위임합니다
   - 자문가가 포트폴리오를 모니터링하고 변경을 권장합니다
   - 고객이 모든 트랜잭션을 실행합니다
   - 자문가의 다른 고객으로부터 프라이버시를 유지합니다

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [View Key Delegation - Products & UX](../../../product/c-privacy/c6-view-key-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
