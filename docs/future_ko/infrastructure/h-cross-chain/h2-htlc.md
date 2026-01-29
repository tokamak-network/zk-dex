# H2. HTLC Atomic Swap

스왑 금액과 참여자를 숨기는 영지식 증명과 함께 무신뢰 크로스체인 교환을 가능하게 하는 Hash Time-Locked Contracts.

**요구사항**: HTLC contract on each chain | Timelock coordination | ZK proof of preimage knowledge

---

## 배경

원자적 스왑은 별도의 블록체인 간 무신뢰 교환의 근본적인 문제를 해결합니다:

- **거래 상대방 위험**: 전통적인 크로스체인 거래는 거래 상대방이나 에스크로 서비스를 신뢰해야 합니다
- **중개 수수료**: 중앙화된 거래소와 브릿지가 크로스체인 서비스에 대해 상당한 수수료를 부과합니다
- **프라이버시 노출**: 표준 HTLC는 양쪽 체인에서 스왑 금액, 참여자, 타이밍을 드러냅니다
- **MEV 취약성**: 보이는 대기 중인 스왑은 선행거래나 샌드위치 공격을 받을 수 있습니다

Hash Time-Locked Contracts (HTLC)는 암호화 해시 락과 타임락을 사용하여 원자성을 보장합니다: 스왑의 양쪽 다리가 모두 완료되거나, 둘 다 완료되지 않습니다. 영지식 증명을 통합함으로써 다음을 숨길 수 있습니다:
- 교환되는 금액
- 스왑 참여자의 신원
- 다른 체인의 거래 간 관계

ZK-DEX의 경우, 이를 통해 신뢰받는 중개자 없이 프라이빗 크로스체인 거래가 가능합니다.

## 기술 사양

### 아키텍처 개요

```
Chain A (e.g., Bitcoin)                    Chain B (ZK-DEX)
+------------------------+                 +------------------------+
|                        |                 |                        |
|  HTLC Contract         |                 |  ZK-HTLC Contract      |
|  +------------------+  |                 |  +------------------+  |
|  | hashLock: H(s)   |  |                 |  | commitment: C    |  |
|  | timelock: T1     |  |  Preimage 's'   |  | timelock: T2     |  |
|  | amount: visible  |  | <=============> |  | amount: hidden   |  |
|  | sender: Alice    |  |                 |  | sender: hidden   |  |
|  | receiver: Bob    |  |                 |  | receiver: hidden |  |
|  +------------------+  |                 |  +------------------+  |
|                        |                 |                        |
+------------------------+                 +------------------------+
        |                                           |
        | Reveal 's' to claim                       | ZK proof of
        | (links chains)                            | preimage knowledge
        v                                           v
   Bob claims on A                            Alice claims on B
```

### 구성 요소 목록

| 구성 요소 | 설명 |
|-----------|-------------|
| **HTLC Contract (Chain A)** | 자산을 보유하는 표준 해시 락 컨트랙트 |
| **ZK-HTLC Contract (Chain B)** | 커밋먼트를 사용하는 프라이버시 보존 HTLC |
| **Preimage Generator** | 해시 락을 위한 무작위 비밀 생성 |
| **ZK Preimage Circuit** | 프리이미지를 드러내지 않고 지식을 증명 |
| **Timelock Coordinator** | 체인 간 안전한 타임락 차이 보장 |

### 데이터 흐름

1. **스왑 시작**
   - Alice(개시자)가 무작위 비밀 `s` 생성, `H(s)` 계산
   - Alice가 Chain A의 HTLC에 `hashLock = H(s)`, `timelock = T1`로 자금 잠금
   - Bob이 Chain A의 HTLC가 올바르게 자금이 지원되었는지 확인

2. **거래 상대방 잠금**
   - Bob이 Chain B (ZK-DEX)에 ZK-HTLC 생성
   - 커밋먼트 `C`가 금액과 참여자를 숨김
   - 동일한 `hashLock = H(s)`, 더 짧은 `timelock = T2 < T1`

3. **청구 단계**
   - Alice가 `H(s) = hashLock`인 `s`를 아는 ZK 증명 생성
   - Chain B의 ZK-HTLC에 증명을 제출하여 청구 (온체인에 `s` 공개 안 됨)
   - Alice가 오프체인에서 Bob에게 `s`를 프라이빗하게 공개 (또는 ZK 릴레이 통해)

4. **완료**
   - Bob이 `s`를 사용하여 Chain A의 HTLC에서 청구
   - 스왑 완료; 온체인 관찰자는 A와 B 거래를 연결할 수 없음

### ZK 프리이미지 회로

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template HTLCPreimageProof() {
    // Public inputs
    signal input hashLock;        // H(s) - the hash lock
    signal input nullifier;       // Prevents double-claim
    signal input recipientCommit; // Commitment to recipient

    // Private inputs
    signal input preimage;        // The secret 's'
    signal input recipientPk;     // Recipient public key
    signal input salt;            // Randomness for commitments

    // Verify preimage hashes to hashLock
    component hasher = Poseidon(1);
    hasher.inputs[0] <== preimage;
    hasher.out === hashLock;

    // Verify recipient commitment
    component recipCommit = Poseidon(2);
    recipCommit.inputs[0] <== recipientPk;
    recipCommit.inputs[1] <== salt;
    recipCommit.out === recipientCommit;

    // Compute nullifier (prevents double-spend)
    component nullHash = Poseidon(2);
    nullHash.inputs[0] <== preimage;
    nullHash.inputs[1] <== recipientPk;
    // Nullifier verified externally
}

component main {public [hashLock, nullifier, recipientCommit]} = HTLCPreimageProof();
```

## 효과

| 측면 | 영향 |
|--------|--------|
| **무신뢰성** | 중개자 불필요; 암호화 보장이 원자성 보장 |
| **프라이버시** | ZK 증명이 금액, 참여자, 크로스체인 연결을 숨김 |
| **검열 저항** | P2P 스왑; 중앙화된 병목 현상 없음 |
| **비용 효율성** | 가스 비용만; 거래소 수수료나 브릿지 프리미엄 없음 |
| **최종성** | 결정적 완료; 확률적 정산 없음 |
| **크로스체인 MEV** | 스왑 세부사항 숨김; 선행거래 방지 |

## 보안 고려사항

| 위험 | 완화책 |
|------|------------|
| **타임락 경쟁** | T1 >> T2 보장, 블록체인 지연에 대한 충분한 여유 |
| **프리이미지 보류** | 개시자가 공개하도록 인센티브; 그렇지 않으면 자금 손실 |
| **체인 재조직** | 프리이미지 공개 전 충분한 확인 대기 |
| **해시 함수 약점** | 충돌 저항, 프리이미지 저항 해시 사용 (Poseidon, SHA-256) |
| **그리핑 공격** | 개시자가 거래 상대방 자금을 일시적으로 잠글 수 있음; 평판이나 본드 요구 |
| **네트워크 지연** | 보수적 타임락 여유; 모니터링 인프라 |

## 구현 과제

1. **타임락 조정**
   - 다른 체인은 다른 블록 시간과 최종성을 가집니다
   - 최악의 경우 네트워크 지연을 고려해야 합니다
   - 크로스체인 시간 동기화는 부정확합니다
   - 권장사항: T1은 T2의 최소 2배여야 합니다

2. **프리이미지 릴레이 프라이버시**
   - 표준 HTLC는 온체인에서 프리이미지를 공개하여 스왑을 연결합니다
   - 프리이미지 전송을 위한 안전한 오프체인 채널 또는 ZK 릴레이 필요
   - 수신자의 키로 암호화된 프리이미지 사용 고려

3. **유동성 발견**
   - 중앙화된 주문장 없이 스왑 거래 상대방 찾기
   - 프라이버시 보존 P2P 발견 필요 (onion routing, mixnets)
   - 탈중앙화된 스왑 조정 프로토콜 필요

4. **멀티홉 라우팅**
   - 직접 스왑은 정확한 거래 상대방을 찾아야 합니다
   - 지불 채널 네트워크가 중개자를 통해 라우팅할 수 있습니다
   - 각 홉은 지연 시간과 타임락 요구사항을 추가합니다

5. **실패한 스왑 복구**
   - 스왑이 중간에 실패하면 자금이 타임락 만료까지 잠깁니다
   - 긴 대기 시간으로 사용자 경험 저하
   - 상호 동의로 더 빠른 취소 고려

## 파생물

1. **멀티홉 스왑** - Lightning Network처럼 중개 노드를 통해 스왑 라우팅. 유동성 제공자를 통해 모든 자산 쌍 간 스왑 가능. 각 홉은 감소하는 타임락으로 체인 HTLC 사용.

2. **타임락 스왑** - 특정 시간 창 내에서만 실행되는 스왑. 예약된 거래나 조건부 실행에 유용. HTLC를 추가 시간 제약과 결합.

3. **부분 스왑** - 스왑 주문의 부분 체결 허용. 거래 상대방이 부분 유동성만 있는 경우 가능한 금액에 대해 스왑 완료. 여러 프리이미지가 있는 분할 가능한 HTLC 설계 필요.

4. **스왑 집계** - 여러 소규모 스왑을 단일 원자적 작업으로 배치. 스왑당 오버헤드를 줄이고 더 나은 가격 발견 가능. 코디네이터가 호환 가능한 스왑을 오프체인에서 매칭.

5. **크로스체인 DEX** - 정산을 위해 HTLC를 사용하는 완전한 탈중앙화 거래소. 주문장은 어떤 체인에도 있을 수 있음; 정산은 크로스체인으로 발생. 양쪽에서 ZK-HTLC를 통해 프라이버시 보존.

## 사용 사례

1. **Bitcoin에서 ZK-DEX로 스왑**
   - Alice가 BTC를 ZK-DEX의 프라이빗 토큰으로 거래하고 싶어합니다
   - Bitcoin에서 해시락으로 HTLC 생성
   - Bob이 ZK-DEX에서 ZK-HTLC 생성
   - Alice가 ZK 증명을 사용하여 프라이빗하게 청구
   - Bob이 BTC 청구; 거래 간 온체인 연결 없음

2. **프라이빗 OTC 거래**
   - 두 기관이 대량 거래를 실행하고 싶어합니다
   - 어느 쪽도 거래 관계를 드러내고 싶지 않습니다
   - HTLC가 원자성을 보장; ZK 증명이 신원을 숨김
   - 거래는 각 체인에서 무관한 거래로 나타납니다

3. **탈중앙화된 스테이블코인 게이트웨이**
   - 사용자가 USDC를 프라이빗 ZK-DEX 포지션으로 온램프하고 싶어합니다
   - 마켓 메이커가 Ethereum USDC에서 HTLC 스왑 제공
   - 사용자가 KYC가 필요한 온램프 없이 프라이빗 스테이블 노트를 받습니다
   - 마켓 메이커가 스프레드를 벌고; 신뢰받는 브릿지 없음

4. **크로스체인 차익거래**
   - Ethereum DEX와 ZK-DEX 간 가격 차이
   - 차익거래자가 HTLC를 사용하여 동시 스왑 실행
   - 원자성이 실행 위험을 방지
   - 프라이버시가 모방 전략을 방지

## 실제 제품 및 사용자 경험

### 1. "체인 연결 끊기" - 크로스체인 거래 링크 차단 서비스

**제품 설명**:
ZK-HTLC를 사용해 두 체인의 거래가 연결되지 않도록 하는 프라이버시 스왑. 일반 HTLC는 같은 해시로 두 체인 거래가 연결되어 추적됩니다.

**일반 사용자 경험**:
- 최민수씨(31세)는 비트코인을 ZK-DEX 토큰으로 교환하려 함
- 일반 HTLC: 같은 preimage가 양쪽 체인에 공개되어 거래 연결됨
- ZK-HTLC: preimage 지식을 ZK로 증명, 체인에 공개하지 않음
- 비트코인 거래와 ZK-DEX 거래가 별개 거래로 보임
- 블록체인 분석가도 민수씨의 크로스체인 활동을 추적 불가

**관찰 가능한 이점**:
- 두 체인 간 거래 연결고리 완전 차단
- 크로스체인 자산 흐름 추적 방지
- 거래 상대방에게도 다른 체인 활동 숨김

### 2. "비밀 크로스체인 OTC" - 대량 거래 완전 비공개

**제품 설명**:
대량의 크로스체인 스왑을 실행할 때 거래 금액, 참여자, 타이밍이 모두 숨겨지는 기관급 프라이버시 서비스.

**일반 사용자 경험**:
- 정예진씨(35세)는 $500,000 규모의 ETH를 BTC로 교환하려 함
- 일반 스왑: "이 지갑이 대량 스왑했다"가 양쪽 체인에 공개
- 비밀 OTC: 금액이 commitment로 숨겨지고, ZK로 정확한 교환 증명
- 양쪽 체인에서 거래 금액이 보이지 않음
- 예진씨가 대량 거래자라는 사실 자체가 비공개

**관찰 가능한 이점**:
- 거래 규모가 시장에 노출되지 않아 가격 영향 없음
- "고래" 라벨링 및 추적 방지
- 거래 상대방에게도 자산 규모 비공개

### 3. "프라이빗 온램프" - 투명 자산을 프라이빗하게 전환

**제품 설명**:
공개 체인의 스테이블코인을 ZK-DEX의 프라이빗 자산으로 전환할 때, 전환 과정 자체도 숨겨지는 서비스.

**일반 사용자 경험**:
- 박현우씨(27세)는 USDC 급여를 프라이빗하게 관리하고 싶음
- 일반 브릿지: "현우씨가 USDC를 프라이빗 체인으로 보냈다" 공개
- 프라이빗 온램프: HTLC로 교환하되, 연결고리 없이 전환
- 이더리움에서는 "누군가에게 USDC 전송", ZK-DEX에서는 "새로운 프라이빗 자산"
- 두 이벤트가 연결되지 않아 프라이버시 전환 자체가 숨겨짐

**관찰 가능한 이점**:
- 프라이버시 체인으로의 이동 자체가 비공개
- "이 사람이 프라이버시를 원한다"는 신호 숨김
- 프라이빗 자산과 공개 자산 간 연결 차단

---

[목차로 돌아가기](../../README.md)
