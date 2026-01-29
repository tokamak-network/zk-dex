# H7. 롤업 결제

프라이빗 상태 전환 및 효율적인 온체인 결제로 트랜잭션을 배치하는 ZK-롤업 인프라.

**요구사항**: 상태 commitment 스킴 | 배치 증명 생성 | 데이터 가용성 솔루션 | 탈출구 메커니즘

---

## 배경

직접 온체인 실행은 DeFi 수요를 충족하도록 확장할 수 없습니다:

- **가스 비용**: 높은 혼잡 시 개별 트랜잭션 비용이 $5-50+
- **처리량 제한**: 이더리움은 ~15-30 TPS 처리; 수요에 훨씬 못 미침
- **상태 증가**: 온체인 상태 비대화로 노드 요구사항 증가
- **최종성 지연**: 블록 시간이 트랜잭션 확인 속도를 제한

ZK-롤업은 다음을 통해 이러한 문제를 해결합니다:
- 수천 개의 트랜잭션을 단일 증명으로 배치
- 상태 전환을 오프체인에서 계산; 온체인에서 검증
- 현재 기술로 ~1000-10000 TPS 달성
- 유효성 증명을 통한 L1 보안 상속

ZK-DEX의 경우, 롤업 결제는 저비용으로 고빈도 프라이빗 거래를 가능하게 합니다.

## 기술 사양

### 아키텍처 개요

```
Users                          ZK-DEX Rollup                      L1 (Ethereum)
+--------+                     +-----------------------+          +-------------+
|        |   Transactions      |                       |          |             |
| User 1 |-------------------->|  Sequencer           |          |  Rollup     |
| User 2 |-------------------->|       |              |          |  Contract   |
| User 3 |-------------------->|       v              |  Proof   |  +-------+  |
+--------+                     |  +-----------+       |--------->|  |Verify |  |
                               |  | Batch     |       |          |  +-------+  |
                               |  | Builder   |       |          |      |      |
                               |  +-----------+       |  State   |      v      |
                               |       |              |  Root    |  +-------+  |
                               |       v              |--------->|  |State  |  |
                               |  +-----------+       |          |  |Commit |  |
                               |  | Prover    |       |          |  +-------+  |
                               |  | Network   |       |          |             |
                               |  +-----------+       |  DA      +-------------+
                               |       |              |--------->  Data
                               |       v              |          Availability
                               |  State Transition    |            Layer
                               +-----------------------+
```

### 컴포넌트 목록

| 컴포넌트 | 설명 |
|-----------|-------------|
| **Sequencer** | 트랜잭션 순서 지정; 배치 생성 |
| **Batch Builder** | 트랜잭션 집계; 상태 전환 계산 |
| **Prover Network** | 배치 유효성의 ZK 증명 생성 |
| **Rollup Contract** | 증명을 검증하고 상태 루트를 저장하는 L1 컨트랙트 |
| **Data Availability** | 재구성을 위해 트랜잭션 데이터가 사용 가능함을 보장 |
| **Escape Hatch** | 시퀀서 실패 시 사용자 자체 출금 메커니즘 |

### 데이터 플로우

1. **트랜잭션 제출**
   - 사용자가 서명된 트랜잭션을 시퀀서에 제출
   - 시퀀서가 트랜잭션 순서 지정, 유효성 확인
   - 배치 포함을 위해 트랜잭션 대기열에 추가

2. **배치 처리**
   - 배치 빌더가 트랜잭션을 그룹화(예: 배치당 1000개)
   - 상태 전환이 오프체인에서 계산됨
   - 배치 실행에서 새로운 상태 루트 도출

3. **증명 생성**
   - 증명자가 유효한 상태 전환의 ZK 증명 생성
   - 증명은 다음을 증명: 초기 상태 + 트랜잭션 = 최종 상태
   - 온체인 검증을 위해 증명 압축

4. **L1 결제**
   - 배치 증명이 롤업 컨트랙트에 제출됨
   - 컨트랙트가 증명 유효성 검증
   - 상태 루트 업데이트; 배치 최종화

### 롤업 상태 회로

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/merkle/sparse_merkle_tree.circom";

template RollupBatch(batchSize, treeDepth) {
    // Public inputs
    signal input oldStateRoot;
    signal input newStateRoot;
    signal input batchCommitment;
    signal input blockNumber;

    // Private inputs - transaction data
    signal input txSenders[batchSize];
    signal input txReceivers[batchSize];
    signal input txAmounts[batchSize];
    signal input txNonces[batchSize];
    signal input txSignatures[batchSize][2];

    // Private inputs - state witnesses
    signal input senderBalances[batchSize];
    signal input receiverBalances[batchSize];
    signal input senderProofs[batchSize][treeDepth];
    signal input receiverProofs[batchSize][treeDepth];

    // Process each transaction
    signal intermediateRoots[batchSize + 1];
    intermediateRoots[0] <== oldStateRoot;

    component txProcessor[batchSize];
    for (var i = 0; i < batchSize; i++) {
        txProcessor[i] = ProcessTransaction(treeDepth);
        txProcessor[i].stateRoot <== intermediateRoots[i];
        txProcessor[i].sender <== txSenders[i];
        txProcessor[i].receiver <== txReceivers[i];
        txProcessor[i].amount <== txAmounts[i];
        txProcessor[i].nonce <== txNonces[i];
        txProcessor[i].senderBalance <== senderBalances[i];
        txProcessor[i].receiverBalance <== receiverBalances[i];
        // ... additional inputs

        intermediateRoots[i + 1] <== txProcessor[i].newStateRoot;
    }

    // Verify final state matches
    intermediateRoots[batchSize] === newStateRoot;

    // Verify batch commitment
    component batchHash = Poseidon(batchSize * 4 + 1);
    for (var i = 0; i < batchSize; i++) {
        batchHash.inputs[i * 4] <== txSenders[i];
        batchHash.inputs[i * 4 + 1] <== txReceivers[i];
        batchHash.inputs[i * 4 + 2] <== txAmounts[i];
        batchHash.inputs[i * 4 + 3] <== txNonces[i];
    }
    batchHash.inputs[batchSize * 4] <== blockNumber;
    batchHash.out === batchCommitment;
}

component main {public [oldStateRoot, newStateRoot, batchCommitment, blockNumber]} =
    RollupBatch(1000, 32);
```

## 효과

| 측면 | 영향 |
|--------|--------|
| **처리량** | L1의 15 TPS 대비 1000-10000 TPS |
| **비용** | L1의 $5-50 대비 트랜잭션당 ~$0.01-0.10 |
| **지연** | 수 초 내 소프트 확인; 수 분 내 L1 최종성 |
| **보안** | L1과 동등; 암호학적으로 유효하지 않은 상태 불가능 |
| **프라이버시** | 증명에 트랜잭션 세부 사항 숨김; 루트만 온체인 |
| **탈중앙화** | 점진적으로 탈중앙화 가능(시퀀서, 증명자) |

## 보안 고려사항

| 리스크 | 완화 |
|------|------------|
| **시퀀서 검열** | 강제 포함 메커니즘; 탈중앙화된 시퀀서 |
| **시퀀서 다운타임** | 사용자 자체 출금을 위한 탈출구 |
| **데이터 보류** | 온체인 데이터 가용성 또는 DAC를 사용한 validium |
| **증명자 활성** | 여러 독립 증명자; 누구나 증명 가능 |
| **상태 손상** | ZK 증명으로 유효하지 않은 상태 전환 방지 |
| **업그레이드 리스크** | 업그레이드에 타임락; 긴급 일시 중지 기능 |

## 구현 과제

1. **증명자 성능**
   - 대규모 배치 증명은 수 분에서 수 시간 소요
   - GPU/FPGA 가속 필수
   - 더 빠른 최종성을 위해 재귀 증명 고려

2. **데이터 가용성**
   - L1의 전체 DA는 비용이 많이 듦(롤업 비용의 ~80%)
   - Validium(오프체인 DA)은 보안 보장 감소
   - DAC, EIP-4844 blob 또는 전용 DA 레이어 고려

3. **시퀀서 탈중앙화**
   - 중앙화된 시퀀서는 검열, MEV 리스크
   - 탈중앙화는 복잡성과 지연 추가
   - Based sequencing 또는 리더 순환 고려

4. **크로스 롤업 상호운용성**
   - 각 롤업은 격리된 상태 머신
   - 크로스 롤업 통신은 지연 추가
   - 공유 유효성 증명 또는 메시징 레이어 필요

5. **사용자 경험**
   - 입출금에 L1 트랜잭션 필요
   - 출금 지연(낙관적 롤업은 7일, ZK는 수 분)
   - 빠른 출금 유동성 공급자 필요

## 파생

1. **Validium 모드** - 데이터 가용성 위원회를 통한 오프체인 데이터 가용성. 전체 롤업보다 ~100배 저렴. 낮은 가치 트랜잭션 또는 게임에 적합.

2. **데이터 가용성** - 여러 DA 솔루션: 온체인 calldata, EIP-4844 blob, Celestia, EigenDA, Avail. 비용과 보안 보장 간 트레이드오프.

3. **탈출구** - 시퀀서 실패 시 긴급 출금 메커니즘. 사용자가 L1에 직접 Merkle 증명 제출 가능. 롤업 상태와 관계없이 자금 복구 보장.

4. **강제 포함** - 시퀀서가 검열하는 경우 트랜잭션 포함을 강제하는 메커니즘. 사용자가 L1에 제출; 시퀀서는 포함하거나 보증금 상실. 검열 저항 보장.

5. **크로스 롤업 브리지** - ZK-롤업 간 무신뢰 브리지. 공유 증명 시스템으로 더 빠른 검증 가능. 즉시 전송을 위한 유동성 네트워크.

## 사용 사례

1. **고빈도 거래**
   - 트레이더가 하루에 수백 개의 주문 실행
   - 각 주문이 L1의 $20+ 대비 롤업에서 ~$0.05 비용
   - 반응적인 거래를 위한 1초 미만 소프트 확인
   - 최종 보안 보장을 위한 L1 결제

2. **기관 결제**
   - 펀드가 복잡한 다중 레그 전략 실행
   - 모든 트랜잭션이 배치됨; 단일 L1 결제
   - 프라이버시 보존; 상태 루트만 표시
   - DA 레이어를 통해 감사 추적 가능

3. **대중 시장 접근**
   - $100 포트폴리오를 가진 소매 사용자
   - L1 가스 비용이 금지적; 롤업으로 참여 가능
   - 적은 비용으로 L1과 동일한 보안
   - 확장성을 통한 금융 포용

4. **프라이빗 DEX 운영**
   - 모든 거래가 ZK-DEX 롤업에서 실행
   - 배치 증명에 거래 세부 사항 숨김
   - 대중이 시스템 무결성 검증 가능(인플레이션 없음)
   - 개인 프라이버시 유지

## 실제 제품 및 사용자 경험

### 1. "시퀀서 블라인드 롤업" - 운영자로부터의 프라이버시

**제품 설명**:
롤업 시퀀서조차 거래 내용을 볼 수 없는 프라이버시 롤업. 일반 롤업은 시퀀서가 모든 거래를 보고 MEV를 추출할 수 있습니다.

**일반 사용자 경험**:
- 한지원씨(24세)는 롤업에서 대량 매수를 실행하려 함
- 일반 롤업: 시퀀서가 거래를 보고 프론트러닝 가능
- 블라인드 롤업: 거래가 암호화되어 시퀀서에게 전달
- 시퀀서는 순서만 정하고 내용은 알 수 없음
- 배치 증명 생성 시에만 거래가 처리됨

**관찰 가능한 이점**:
- 시퀀서 MEV 추출 원천 차단
- 롤업 운영자를 신뢰할 필요 없음
- 거래 의도가 체결 전까지 완전히 비공개

### 2. "배치 내 프라이버시" - 거래 간 연결 차단

**제품 설명**:
같은 배치에 포함된 여러 거래가 서로 연결되지 않도록 하는 프라이버시 레이어. 배치 분석으로 사용자 패턴 파악을 방지합니다.

**일반 사용자 경험 (트레이더 관점)**:
- 김성준씨(30세)는 하루 수백 번 거래
- 일반 롤업: "같은 배치의 이 거래들이 같은 사람" 분석 가능
- 프라이버시 배치: 각 거래가 독립적인 노트로 처리
- 배치 내 거래 간 연결고리 없음
- 성준씨의 고빈도 거래 패턴이 숨겨짐

**관찰 가능한 이점**:
- 배치 분석으로 트레이딩 패턴 추론 방지
- 고빈도 거래자 식별 차단
- 거래 전략의 완전한 비밀 유지

### 3. "DA 레이어 프라이버시" - 데이터 가용성도 비공개

**제품 설명**:
롤업의 데이터 가용성 레이어에 저장되는 데이터도 암호화하여 DA 노드조차 거래 내용을 알 수 없게 하는 서비스.

**일반 사용자 경험**:
- 윤서연씨(26세)는 롤업에서 프라이빗 결제를 사용
- 일반 롤업: DA 레이어에 평문 거래 데이터 저장
- 프라이빗 DA: 암호화된 데이터만 DA에 게시
- DA 노드 운영자도 거래 내용을 볼 수 없음
- 검증에 필요한 commitment만 공개

**관찰 가능한 이점**:
- DA 레이어를 통한 거래 분석 차단
- "롤업 데이터 = 공개 데이터" 전제 제거
- 완전한 엔드투엔드 프라이버시

---

[목차로 돌아가기](../../README.md)
