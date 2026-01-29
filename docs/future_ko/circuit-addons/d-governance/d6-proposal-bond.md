# D6. Proposal Bond

제안을 제출하는 데 필요한 스테이크로, 스팸을 필터링하고 제안자의 확신을 신호합니다.

**제약 조건**: ~140K | **복잡도**: Low

---

## 배경

Proposal bond는 거버넌스 품질을 향상시킵니다:

- **스팸 방지**: 저품질 제안은 투표자의 관심과 거버넌스 리소스를 낭비합니다
- **Skin in the Game**: 경제적 지분을 가진 제안자는 제안에 대해 더 신중합니다
- **신호 품질**: Bond 크기는 제안 성공에 대한 제안자의 확신을 신호합니다
- **공격 저항**: 악의적인 거버넌스 공격은 자본 약속이 필요합니다

Proposal bond가 없으면 거버넌스는 경솔하거나 악의적인 제안으로 넘쳐날 수 있습니다. Bond는 제안자 인센티브를 거버넌스 결과와 일치시키는 경제적 필터를 생성합니다. 성공한 제안은 bond를 반환하고, 실패하거나 악의적인 제안은 몰수합니다.

## 기술 사양

### Public Inputs
| Input | Type | Description |
|-------|------|-------------|
| `bondNoteHash` | field | 스테이킹된 bond note의 해시 |
| `proposalHash` | field | 제안 내용에 대한 해시 커밋먼트 |
| `minBond` | uint | 이 제안 유형에 필요한 최소 bond |
| `proposalType` | uint | 제안 카테고리 (bond 요구 사항 결정) |
| `bondNullifier` | field | Bond 재사용을 방지하는 nullifier |

### Private Inputs
| Input | Type | Description |
|-------|------|-------------|
| `pkX, pkY` | field | 제안자의 public key |
| `sk` | field | 소유권을 증명하는 secret key |
| `bondValue` | uint | 본딩된 토큰 양 |
| `tokenType` | uint | Bond의 토큰 유형 (거버넌스 토큰) |
| `bondSalt` | field | Bond note 무작위성 |
| `proposalData` | field | 제안 내용의 해시 |
| `proposalNonce` | uint | 이 제안의 고유 nonce |
| `proposalDeadline` | uint | 투표 마감 타임스탬프 |

### Circuit Logic

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/babyjubjub/proof_of_ownership.circom";
include "../utils/comparators.circom";

template ProposalBond() {
    // ===== Public Inputs =====
    signal input bondNoteHash;
    signal input proposalHash;
    signal input minBond;
    signal input proposalType;
    signal input bondNullifier;

    // ===== Private Inputs =====
    signal input pkX, pkY, sk;
    signal input bondValue;
    signal input tokenType;
    signal input bondSalt;
    signal input proposalData;
    signal input proposalNonce;
    signal input proposalDeadline;

    // ===== 1. Verify Bond Note =====
    component bondNote = PoseidonRegularNote();
    bondNote.pkX <== pkX;
    bondNote.pkY <== pkY;
    bondNote.value <== bondValue;
    bondNote.tokenType <== tokenType;
    bondNote.salt <== bondSalt;
    bondNote.out === bondNoteHash;

    // ===== 2. Verify Ownership =====
    component ownership = ProofOfOwnershipStrict();
    ownership.sk <== sk;
    ownership.pkX <== pkX;
    ownership.pkY <== pkY;

    // ===== 3. Verify Bond Meets Minimum =====
    component bondCheck = GreaterEqThan(64);
    bondCheck.in[0] <== bondValue;
    bondCheck.in[1] <== minBond;
    bondCheck.out === 1;

    // ===== 4. Verify Token Type is Governance Token =====
    tokenType === 0;  // Governance token type ID

    // ===== 5. Compute Proposal Hash =====
    component proposal = Poseidon(6);
    proposal.inputs[0] <== proposalData;
    proposal.inputs[1] <== pkX;
    proposal.inputs[2] <== pkY;
    proposal.inputs[3] <== proposalType;
    proposal.inputs[4] <== proposalNonce;
    proposal.inputs[5] <== proposalDeadline;
    proposal.out === proposalHash;

    // ===== 6. Compute Bond Nullifier =====
    // Prevents reusing same bond for multiple proposals
    component nullifier = Poseidon(3);
    nullifier.inputs[0] <== sk;
    nullifier.inputs[1] <== bondNoteHash;
    nullifier.inputs[2] <== proposalNonce;
    nullifier.out === bondNullifier;

    // ===== 7. Validate Positive Bond =====
    component bondPositive = GreaterThan(64);
    bondPositive.in[0] <== bondValue;
    bondPositive.in[1] <== 0;
    bondPositive.out === 1;

    // ===== 8. Validate Deadline in Future =====
    // Note: currentTime would need to be public input in practice
    component deadlineValid = GreaterThan(64);
    deadlineValid.in[0] <== proposalDeadline;
    deadlineValid.in[1] <== 0;
    deadlineValid.out === 1;
}

component main {public [bondNoteHash, proposalHash, minBond, proposalType, bondNullifier]} =
    ProposalBond();
```

### 주요 제약 조건

1. **Bond 소유권**: 제안자는 bond note를 소유해야 함
2. **최소 Bond**: Bond 값은 제안 유형의 최소값을 충족하거나 초과해야 함
3. **올바른 토큰**: Bond는 거버넌스 토큰이어야 함
4. **제안 바인딩**: 제안 해시는 bond를 특정 제안 내용에 연결함
5. **Nullifier 방지**: 동일한 bond를 여러 활성 제안에 사용할 수 없음

## 효과

| 측면 | 영향 |
|--------|--------|
| **품질 필터** | 경제적 장벽이 저노력 제안을 필터링함 |
| **스팸 방지** | 제안 비용이 경솔한 제출을 억제함 |
| **확신 신호** | 더 큰 bond는 더 높은 제안자 확신을 나타냄 |
| **공격 비용** | 악의적인 제안은 위험에 처한 자본이 필요함 |
| **일치된 인센티브** | 제안자는 성공적인 결과로부터 혜택을 받음 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **Bond Griefing** | 최소 bond는 의미 있지만 접근 가능해야 함 |
| **플루토크라시 제안** | 제안자 이력을 기반으로 bond 제한 또는 슬라이딩 스케일 고려 |
| **Bond 도난** | Bond는 제안자에게 전송되지 않고 계약 에스크로에 보관됨 |
| **슬래싱 남용** | Bond 몰수에 대한 명확하고 객관적인 기준 |
| **담합** | 슬래싱된 bond는 개별 투표자가 아닌 재무로 감 |
| **플래시 론 Bond** | Bond는 투표 기간 동안 잠긴 상태로 유지되어야 함 |

## 구현 과제

1. **Bond 크기 조정**
   - 너무 낮음: 스팸을 효과적으로 필터링하지 못함
   - 너무 높음: 정당한 커뮤니티 제안을 배제함
   - 거버넌스 활동 수준에 따른 동적 bond 고려
   - 다른 제안 유형에 대한 다른 bond

2. **결과 결정**
   - Bond 반환을 위한 "성공"이란 무엇인가?
   - 통과 임계값? 정족수 도달? 구현?
   - 엣지 케이스 처리 (취소된 제안, 만료된 투표)

3. **슬래싱 메커니즘**
   - Bond가 몰수되는 때와 반환되는 때는?
   - 근접했지만 실패한 제안에 대한 부분 슬래싱?
   - 누가 악의적인 제안 슬래싱을 결정하는가?

4. **자본 효율성**
   - 투표 중 잠긴 bond는 유통되는 거버넌스 토큰을 줄임
   - Bond 위임 또는 풀링 메커니즘 고려
   - 자동 해제가 있는 시간 제한 잠금

## 파생 변형

1. **Variable Bond by Proposal Type** - 다른 제안 카테고리에 대한 다른 최소 bond입니다. 재무 제안은 매개변수 변경보다 높은 bond가 필요합니다. 제안 영향에 따른 위험 비례 자본 요구 사항입니다.

2. **Bond Delegation** - 커뮤니티 구성원이 지지하는 제안을 뒷받침하기 위해 거버넌스 토큰을 풀링합니다. 후원자 간 공유 위험과 보상입니다. 일치된 그룹에 대한 자본 효율적인 제안 제출을 가능하게 합니다.

3. **Bond Insurance** - 제안 bond의 제3자 인수입니다. 제안자는 프리미엄을 지불하고, 보험사는 슬래싱 위험을 커버합니다. 제안 품질 평가 및 위험 가격 책정을 위한 시장을 생성합니다.

4. **Gradual Bond Release** - 성공한 제안은 시간이 지남에 따라 bond를 해제합니다(예: 즉시 25%, 3개월에 걸쳐 75%). 구현 단계에 대한 제안자 책임을 보장합니다. 장기 인센티브를 일치시킵니다.

5. **Reputation-Adjusted Bonds** - 성공적인 실적이 있는 제안자는 더 작은 bond가 필요합니다. 실패한 제안은 향후 bond 요구 사항을 증가시킵니다. 제안 비용에 영향을 미치는 동적 평판 시스템을 생성합니다.

## 사용 사례

1. **프로토콜 업그레이드 제안**
   - 개발자가 중요한 코드 변경을 제안하고자 함
   - 1000 토큰을 bond로 스테이킹함 (최소값의 10배)
   - 높은 bond는 업그레이드에 대한 강한 확신을 신호함
   - 제안이 통과하고 성공적으로 구현되면 bond 반환됨
   - 커뮤니티는 제안과 신호를 모두 평가함

2. **재무 보조금 요청**
   - 프로젝트가 50,000 토큰 보조금을 요청함
   - 요청의 5%를 본딩해야 함 (2,500 토큰)
   - Bond는 프로젝트가 skin in the game을 갖도록 보장함
   - 프로젝트가 마일스톤을 제공하면 보조금과 함께 bond 반환됨
   - 제공 실패는 재무에 bond를 몰수함

3. **매개변수 변경 제안**
   - 커뮤니티 구성원이 수수료 인하를 제안함
   - 100 토큰의 최소 bond를 스테이킹함
   - 낮은 위험 변경에 적합한 낮은 스테이크
   - 제안은 기본 스팸 필터링과 함께 장점에 따라 평가됨
   - 제안이 유효하면 결과에 관계없이 bond 반환됨

4. **비상 조치 요청**
   - 보안 연구원이 취약점을 발견함
   - 일반 큐를 우회하는 비상 제안을 위해 큰 bond를 스테이킹함
   - 높은 bond는 신속한 프로세스를 보상함
   - 취약점이 확인되면 보상과 함께 bond 반환됨
   - 거짓 경보는 남용을 억제하기 위해 bond를 몰수함

## 실제 제품 및 사용자 경험

참조: [Proposal Bond Products & UX](../../../product/d-governance/d6-proposal-bond-products.md)

---

[목차로 돌아가기](../../README.md)
