# J3. 스테이트 채널 (State Channels)

온체인 정산 보장과 프라이버시 보존을 통해 즉각적이고 가스 없는 전송을 가능하게 하는 오프체인 트랜잭션 인프라.

**요구사항**: 채널 개설/종료 컨트랙트 | 상태 업데이트 프로토콜 | 분쟁 해결 | ZK 상태 증명

---

## 배경

온체인 트랜잭션은 근본적인 한계가 있습니다:

- **지연시간**: 블록 시간으로 최소 확인 지연 발생
- **비용**: 모든 트랜잭션이 가스 지불 필요
- **처리량**: 블록 가스 제한으로 트랜잭션 볼륨 제한
- **프라이버시**: 모든 온체인 트랜잭션이 공개적으로 가시

스테이트 채널은 다음을 통해 이를 해결합니다:
- 즉각적인 실행을 위해 트랜잭션을 오프체인으로 이동
- 최종 상태만 온체인 정산
- 채널당 무제한 트랜잭션 가능
- 공개 보기에서 중간 상태 숨김

ZK-DEX의 경우, 스테이트 채널은 최소한의 온체인 공간으로 고빈도 프라이빗 거래를 가능하게 합니다.

## 기술 명세

### 아키텍처 개요

```
Party A                       State Channel                      Party B
+--------+                    +-------------------+              +--------+
|        |  Open Channel      |                   |              |        |
|        |------------------->|  On-Chain         |<-------------|        |
|        |  (deposit funds)   |  Channel Contract |  (deposit)   |        |
+--------+                    +-------------------+              +--------+
    |                                  |                              |
    |        Off-Chain State Updates   |                              |
    |<---------------------------------+------------------------------>|
    |   State 0 -> State 1 -> ... -> State N                         |
    |              (instant, free, private)                          |
    |                                  |                              |
    |         Close Channel            |                              |
    +--------------------------------->|<-----------------------------+
                              (settle final state)
```

### 구성 요소 목록

| 구성 요소 | 설명 |
|-----------|-------------|
| **Channel Contract** | 예치, 인출 및 분쟁 관리 |
| **State Signing** | 상태 업데이트에 대한 암호화 서명 |
| **Update Protocol** | 유효한 상태 전환 규칙 |
| **Dispute Handler** | 온체인 중재로 충돌 해결 |
| **Watchtower** | 악의적인 종료를 위해 체인 모니터링 |
| **ZK State Prover** | 유효한 상태 전환 증명 생성 |

### 데이터 흐름

1. **채널 개설**
   - 당사자들이 채널 컨트랙트에 자금 예치
   - 초기 상태 합의 및 서명
   - 채널 활성화

2. **오프체인 업데이트**
   - 당사자들이 서명된 상태 업데이트 교환
   - 각 업데이트가 이전 업데이트 대체
   - 온체인 트랜잭션 불필요

3. **채널 종료**
   - 어느 당사자든 최종 상태 제출
   - 분쟁을 위한 챌린지 기간
   - 최종 상태에 따라 자금 분배

### 스테이트 채널 회로

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";
include "../utils/eddsa/eddsa_verify.circom";

template StateChannelUpdate() {
    // Public inputs
    signal input channelId;
    signal input oldStateHash;
    signal input newStateHash;
    signal input nonce;

    // Private inputs
    signal input balanceA;           // Party A balance
    signal input balanceB;           // Party B balance
    signal input transferAmount;     // Transfer in this update
    signal input transferDirection;  // A->B (1) or B->A (0)
    signal input oldBalanceA;
    signal input oldBalanceB;
    signal input signatureA[2];      // Party A's signature
    signal input signatureB[2];      // Party B's signature
    signal input salt;

    // Verify old state hash
    component oldHash = Poseidon(4);
    oldHash.inputs[0] <== channelId;
    oldHash.inputs[1] <== oldBalanceA;
    oldHash.inputs[2] <== oldBalanceB;
    oldHash.inputs[3] <== nonce - 1;
    oldHash.out === oldStateHash;

    // Verify balance update
    signal newBalA, newBalB;
    newBalA <== oldBalanceA - transferAmount * transferDirection +
                transferAmount * (1 - transferDirection);
    newBalB <== oldBalanceB + transferAmount * transferDirection -
                transferAmount * (1 - transferDirection);

    newBalA === balanceA;
    newBalB === balanceB;

    // Verify new state hash
    component newHash = Poseidon(4);
    newHash.inputs[0] <== channelId;
    newHash.inputs[1] <== balanceA;
    newHash.inputs[2] <== balanceB;
    newHash.inputs[3] <== nonce;
    newHash.out === newStateHash;

    // Verify balances non-negative
    component checkA = GreaterEqThan(64);
    checkA.in[0] <== balanceA;
    checkA.in[1] <== 0;
    checkA.out === 1;

    component checkB = GreaterEqThan(64);
    checkB.in[0] <== balanceB;
    checkB.in[1] <== 0;
    checkB.out === 1;
}

component main {public [channelId, oldStateHash, newStateHash, nonce]} = StateChannelUpdate();
```

## 효과

| 측면 | 영향 |
|--------|--------|
| **지연시간** | 즉각적; 네트워크 왕복 시간만 제한 |
| **비용** | 오프체인 업데이트에 가스 제로 |
| **처리량** | 채널당 무제한 트랜잭션 |
| **프라이버시** | 체인에서 중간 상태 숨김 |
| **완결성** | 오프체인에서 즉각적; 종료 시 온체인 |
| **자본 효율성** | 운영 중 채널에 자금 잠금 |

## 보안 고려사항

| 위험 | 완화 방안 |
|------|------------|
| **오래된 상태 제출** | Nonce 순서 지정; 챌린지 기간 |
| **상대방 무응답** | 타임아웃으로 일방적 종료 |
| **Watchtower 실패** | 다수의 watchtower; 자체 모니터링 |
| **상태 손실** | 중복 상태 저장; 복구 프로토콜 |
| **방해 공격** | 보증금 요구; 평판 시스템 |
| **채널 고갈** | 잔액 모니터링; 충전 메커니즘 |

## 구현 과제

1. **활성 요구사항**
   - 분쟁 기간 동안 체인 모니터링 필요
   - Watchtower 인프라 필요
   - 상대방이 사라질 경우 위험

2. **자본 잠금**
   - 채널 기간 동안 자금 잠금
   - 자본 효율성 감소
   - 완화를 위해 가상 채널 고려

3. **라우팅 복잡성**
   - 직접 채널은 양자 관계 필요
   - 멀티홉 라우팅은 복잡성 추가
   - 결제 라우팅 프로토콜 필요

4. **상태 동기화**
   - 양 당사자가 현재 상태에 동의해야 함
   - 경쟁 조건 가능
   - 견고한 동기화 프로토콜 필요

5. **분쟁 해결 가스**
   - 온체인 분쟁 비용 많이 듦
   - 소액의 경우 채널 가치 초과할 수 있음
   - 집계 분쟁 메커니즘 고려

## 파생형

1. **Payment Channels** - 단순 단방향 또는 양방향 결제 전송. Lightning Network 스타일 시스템의 기반. 빈번한 소액 결제에 효율적.

2. **Virtual Channels** - 기존 채널 위에 구축된 채널. 새로운 온체인 트랜잭션 불필요. 전이적 채널 관계 가능.

3. **Channel Factories** - 단일 온체인 트랜잭션으로 여러 채널 개설. 설정 비용 극적 감소. 그룹 채널이 자금 트랜잭션 공유.

4. **Cross-Channel Routing** - 여러 채널을 통해 결제 라우팅. 결제 네트워크 토폴로지. 직접 채널 없이 결제 가능.

5. **Channel Disputes** - 충돌하는 상태의 온체인 해결. 챌린지-응답 프로토콜. 정직한 당사자가 항상 승리 보장.

## 사용 사례

1. **고빈도 거래**
   - 트레이더와 마켓메이커가 채널 개설
   - 수천 건의 거래를 오프체인에서 실행
   - 주기적으로 순 포지션 정산
   - 거래당 거의 제로 비용

2. **스트리밍 결제**
   - 초/분당 결제 스트리밍
   - 채널로 마이크로 트랜잭션 가능
   - 기간 종료 시 최종 정산
   - 비디오 스트리밍, API 사용 등

3. **게임**
   - 게임 서버와 플레이어가 채널 개설
   - 모든 게임 행동을 상태 업데이트로
   - 즉각적인 응답; 행동당 가스 없음
   - 최종 점수를 온체인 정산

4. **프라이빗 양자 거래**
   - 두 당사자가 채널에서 비공개 거래
   - 모든 중간 거래 숨김
   - 순 정산만 가시
   - OTC 거래에 완벽

## 실제 제품 및 사용자 경험

### 1. "완전 비공개 채널" - 중간 상태 영구 비밀

**제품 설명**:
스테이트 채널 내 모든 중간 거래가 온체인에 기록되지 않아 "채널에서 무슨 일이 있었는지" 영원히 비공개인 프라이버시 채널.

**일반 사용자 경험**:
- 김스트리머(28세)와 시청자 간 후원 채널 개설
- 일반 채널: 정산 시 "총 N건 거래" 메타데이터 노출
- 완전 비공개 채널: 오직 최종 잔액만 기록
- "얼마나 자주, 얼마씩 후원했는지" 완전 비공개
- 후원 패턴으로 시청자 식별 불가

**관찰 가능한 이점**:
- 채널 내 활동 완전 비공개
- 거래 빈도와 금액 패턴 숨김
- 정산 후에도 이력 추적 불가

### 2. "프라이빗 게임 채널" - 게임 행동 완전 비공개

**제품 설명**:
게임 내 모든 행동(아이템 획득, 거래, 전투)이 채널 내에서 처리되어 "어떤 전략으로 플레이했는지" 공개되지 않는 서비스.

**일반 사용자 경험**:
- 이게이머(22세)는 경쟁 블록체인 게임 플레이
- 일반 온체인: "이 플레이어가 A 아이템 모으는 중" 전략 노출
- 프라이빗 채널: 모든 게임 행동이 오프체인에서 처리
- 게임 종료 시 "최종 결과"만 온체인 기록
- 경쟁자가 전략을 분석할 데이터 없음

**관찰 가능한 이점**:
- 게임 전략 완전 비공개
- 경쟁자의 행동 분석 차단
- 게임 내 프라이버시와 공정한 경쟁

### 3. "비밀 트레이딩 채널" - 거래 내역 제로 노출

**제품 설명**:
트레이더와 마켓메이커 간 채널에서 모든 거래가 비공개로 진행되어 "무슨 전략인지" 분석이 불가능한 트레이딩 인프라.

**일반 사용자 경험 (트레이더 관점)**:
- 박고빈씨는 하루 10,000건 고빈도 거래
- 일반 거래: "이 주소가 고빈도 전략 운영" 패턴 노출
- 비밀 채널: 10,000건 모두 오프체인, 순 포지션만 정산
- 외부에서 "1건 거래인지 10,000건인지" 알 수 없음
- 전략 복잡도와 거래 빈도 완전 숨김

**관찰 가능한 이점**:
- 트레이딩 전략 완전 비공개
- 고빈도 활동 식별 차단
- 경쟁자의 전략 분석 방지

---

[Back to Index](../../README.md)
