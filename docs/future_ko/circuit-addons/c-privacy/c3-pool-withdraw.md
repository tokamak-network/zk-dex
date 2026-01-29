# C3. Privacy Pool Withdraw

어떤 예치가 당신의 것이었는지 드러내지 않으면서 커밋먼트 멤버십을 증명하여 믹싱 풀에서 자금을 출금합니다.

**제약 조건**: ~180K | **복잡도**: 중간

---

## 배경

풀 출금은 예치로 시작된 프라이버시 루프를 완성합니다:

- **연결 불가능성**: 출금은 어떤 예치인지 드러내지 않고 예치 집합의 멤버십을 증명합니다
- **널리파이어 메커니즘**: 사용된 특정 커밋먼트를 숨기면서 이중 출금을 방지합니다
- **새 주소 출력**: 자금은 모든 이전 연결을 끊고 새 주소로 출금될 수 있습니다
- **Merkle 증명 효율성**: 풀 크기에 관계없이 로그 증명 크기
- **릴레이어 지원**: 수신자를 드러내지 않고 제3자가 제출할 수 있습니다

출금 회로는 중요한 프라이버시 구성 요소입니다. 풀 트리의 유효한 커밋먼트에 대한 지식을 증명하고 재사용을 방지하는 널리파이어를 생성합니다. 널리파이어는 커밋먼트로부터 결정론적이지만 어떤 커밋먼트가 사용되었는지에 대해서는 아무것도 드러내지 않습니다.

## 기술 사양

### 공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `poolRoot` | field | 커밋먼트 풀의 Merkle 루트 |
| `nullifierHash` | field | 이중 출금을 방지하는 해시 |
| `outputHash` | field | 출력 노트의 해시 |
| `denomination` | uint | 출금되는 풀 액면가 |
| `tokenType` | uint | 출금되는 토큰 타입 |
| `relayerFee` | uint | 릴레이어 수수료 (자체 릴레이 시 0) |
| `relayerAddress` | field | 수수료를 받을 주소 (없으면 0) |

### 비공개 입력
| 입력 | 타입 | 설명 |
|-------|------|-------------|
| `noteHash` | field | 예치로부터의 원래 노트 해시 |
| `secret` | field | 예치로부터의 무작위 비밀 |
| `nullifierSeed` | field | 널리파이어 생성에 사용된 시드 |
| `merklePath[TREE_DEPTH]` | field[] | Merkle 증명 경로 |
| `merkleIndex` | uint | Merkle 트리 위치 (비트로) |
| `outPkX, outPkY` | field | 출력 노트 소유자 공개키 |
| `outSalt` | field | 출력 노트 무작위성 |

### 회로 로직

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/poseidon/poseidon_note.circom";
include "../utils/merkle/merkle_proof.circom";
include "../utils/comparators.circom";

template PoolWithdraw(TREE_DEPTH) {
    // ===== Public Inputs =====
    signal input poolRoot;
    signal input nullifierHash;
    signal input outputHash;
    signal input denomination;
    signal input tokenType;
    signal input relayerFee;
    signal input relayerAddress;

    // ===== Private Inputs =====
    signal input noteHash;
    signal input secret;
    signal input nullifierSeed;
    signal input merklePath[TREE_DEPTH];
    signal input merkleIndex;
    signal input outPkX, outPkY, outSalt;

    // ===== 1. Recompute Commitment =====
    component comm = Poseidon(3);
    comm.inputs[0] <== noteHash;
    comm.inputs[1] <== secret;
    comm.inputs[2] <== nullifierSeed;

    // ===== 2. Verify Merkle Inclusion =====
    component merkle = MerkleProof(TREE_DEPTH);
    merkle.leaf <== comm.out;
    merkle.root <== poolRoot;
    for (var i = 0; i < TREE_DEPTH; i++) {
        merkle.path[i] <== merklePath[i];
    }
    merkle.index <== merkleIndex;

    // ===== 3. Compute and Verify Nullifier =====
    // nullifier = H(nullifierSeed, merkleIndex, poolRoot)
    // Including merkleIndex and poolRoot prevents cross-pool attacks
    component nullifier = Poseidon(3);
    nullifier.inputs[0] <== nullifierSeed;
    nullifier.inputs[1] <== merkleIndex;
    nullifier.inputs[2] <== poolRoot;
    nullifier.out === nullifierHash;

    // ===== 4. Compute Output Value (denomination - relayerFee) =====
    signal outputValue;
    outputValue <== denomination - relayerFee;

    // Verify relayer fee is reasonable (< denomination)
    component feeCheck = LessThan(64);
    feeCheck.in[0] <== relayerFee;
    feeCheck.in[1] <== denomination;
    feeCheck.out === 1;

    // ===== 5. Verify Output Note =====
    component outNote = PoseidonRegularNote();
    outNote.pkX <== outPkX;
    outNote.pkY <== outPkY;
    outNote.value <== outputValue;
    outNote.tokenType <== tokenType;
    outNote.salt <== outSalt;
    outNote.out === outputHash;

    // ===== 6. Verify Relayer Address Constraint =====
    // If relayerFee > 0, relayerAddress must be non-zero
    component feeNonZero = IsZero();
    feeNonZero.in <== relayerFee;

    component addrNonZero = IsZero();
    addrNonZero.in <== relayerAddress;

    // Either fee is 0, or address is non-zero
    signal feeImpliesAddress;
    feeImpliesAddress <== (1 - feeNonZero.out) * addrNonZero.out;
    feeImpliesAddress === 0;
}

component main {public [poolRoot, nullifierHash, outputHash, denomination, tokenType, relayerFee, relayerAddress]} =
    PoolWithdraw(20);
```

### 주요 제약 조건

1. **커밋먼트 재계산**: 풀 트리의 커밋먼트와 일치해야 합니다
2. **Merkle 멤버십**: 커밋먼트에서 풀 루트까지의 유효한 경로
3. **널리파이어 유도**: 비밀 입력으로부터 결정론적이며, 이중 지출을 방지합니다
4. **값 보존**: 출력 값 = 액면가 - 릴레이어 수수료
5. **릴레이어 검증**: 수수료는 유효한 릴레이어 주소가 필요합니다

## 효과

| 측면 | 영향 |
|--------|--------|
| **연결 불가능성** | 예치 트랜잭션과 완전한 분리 |
| **이중 지출 방지** | 온체인 널리파이어 세트가 재사용을 차단합니다 |
| **수신자 유연성** | 모든 주소가 출금된 자금을 받을 수 있습니다 |
| **릴레이어 지원** | 제3자 제출이 프라이버시를 유지합니다 |
| **가스 프라이버시** | 릴레이어가 가스를 지불하여 수신자의 지갑을 숨깁니다 |
| **익명성 집합** | 총 예치금에서 지출된 널리파이어를 뺀 값과 같습니다 |

## 보안 고려사항

| 위험 | 완화 방법 |
|------|------------|
| **널리파이어 재사용** | O(1) 조회로 온체인 널리파이어 세트 |
| **루트 구식화** | 최근 루트만 포함 (예: 마지막 100개) |
| **릴레이어 검열** | 여러 독립 릴레이어 |
| **타이밍 상관관계** | 지연된 출금 권장 |
| **금액 상관관계** | 고정 액면가가 금액 연결을 방지합니다 |
| **IP 주소 유출** | 릴레이어와 상호 작용 시 Tor/VPN 사용 |
| **Merkle 증명 유효성** | 회로가 전체 경로를 검증합니다 |

## 구현 과제

1. **널리파이어 저장**
   - 모든 지출된 널리파이어의 증가하는 세트
   - 효율적인 조회 필요 (Solidity의 매핑)
   - 출금당 ~32 바이트, ~100만 출금 = 32MB

2. **루트 관리**
   - 각 예치마다 풀 루트가 변경됩니다
   - UX를 위해 최근 루트를 수락해야 합니다 (대기 중인 예치)
   - 구성 가능한 루트 이력 깊이 (일반적으로 30-100 루트)

3. **릴레이어 네트워크**
   - 분산형 릴레이어 인프라 필요
   - 경쟁력 있는 가격 책정을 위한 수수료 시장
   - 신뢰성 및 가동 시간 요구 사항

4. **출금 타이밍**
   - 사용자는 즉시 출금을 원합니다
   - 프라이버시는 더 많은 예치를 기다리는 것이 필요합니다
   - UX 균형: 익명성 집합 크기 표시

5. **실패한 출금 복구**
   - 증명이 실패하면 자금이 풀에 남아 있습니다
   - 사용자는 올바른 입력으로 재시도해야 합니다
   - 제출 전 증명 시뮬레이션 고려

## 파생물

1. **스텔스 주소로 출금** - 풀 출금을 스텔스 주소 생성과 결합합니다. 수신자가 메타 주소를 게시하고, 출금자가 일회성 스텔스 주소를 계산합니다. 이중 프라이버시: 풀 익명성과 주소 연결 불가능성.

2. **부분 풀 출금** - 예치금의 일부를 출금하고 나머지는 풀에 남깁니다. 동형 커밋먼트 업데이트 또는 여러 하위 커밋먼트가 필요합니다. 유연성을 증가시키지만 익명성 집합을 복잡하게 만듭니다.

3. **지연 출금 보상** - 수익률 또는 수수료 할인으로 더 긴 잠금 기간을 장려합니다. 더 오래 기다리는 사용자는 더 큰 익명성 집합에 기여합니다. 프라이버시를 위한 자연스러운 인센티브 정렬을 생성합니다.

4. **출처 증명과 함께 풀 탈출** - 출금자가 자금이 특정 허용 목록 주소에서 발생했음을 증명하는 선택적 규정 준수 모드. 정확한 예치를 드러내지 않고 규제 기관의 참여를 가능하게 합니다.

5. **출금 릴레이어 네트워크** - 평판, 스테이킹, 수수료 시장이 있는 분산형 릴레이어 프로토콜. 릴레이어가 가격과 신뢰성에서 경쟁합니다. 검열을 방지하고 출금 가용성을 보장합니다.

## 사용 사례

1. **익명 지급 수령**
   - 프리랜서가 공개 주소로 지급을 받습니다
   - 풀에 예치하고, 기다린 후, 새 지갑으로 출금합니다
   - 고객이 자금이 어떻게 사용되는지 추적할 수 없습니다
   - 재정 프라이버시가 유지됩니다

2. **거래소 출금 프라이버시**
   - 사용자가 중앙화 거래소에서 출금합니다
   - 개인 지갑 전에 프라이버시 풀을 통해 라우팅합니다
   - 거래소가 사용자의 DeFi 활동을 추적할 수 없습니다
   - 감시 자본주의를 줄입니다

3. **투자 프라이버시**
   - 투자자가 비공개로 포지션을 축적합니다
   - 시간이 지남에 따라 풀에 여러 예치
   - 투자 지갑으로 단일 출금
   - 포지션 크기가 경쟁업체로부터 숨겨집니다

4. **급여 프라이버시 (수신자 측)**
   - 직원이 알려진 주소로 급여를 받습니다
   - 매주 풀에 급여를 예치합니다
   - 매월 지출 지갑으로 출금합니다
   - 지출 패턴이 고용주로부터 숨겨집니다

## 실제 제품 및 사용자 경험

자세한 실제 응용 프로그램 및 사용자 경험 시나리오는 [Privacy Pool Withdraw - Products & UX](../../product/c-privacy/c3-pool-withdraw-products.md)를 참조하세요.

---

[목차로 돌아가기](../../README.md)
