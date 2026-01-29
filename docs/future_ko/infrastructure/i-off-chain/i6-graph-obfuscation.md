# I6. 거래 그래프 난독화

라우팅, 믹싱, 타이밍 난독화를 통해 거래 연결성을 끊어 신원 상관관계를 방지하는 프라이버시 인프라.

**요구사항**: 믹스 네트워크 인프라 | 타이밍 무작위화 | 미끼 생성 | 그래프 분석 저항성

---

## 배경

프라이빗 거래에서도 메타데이터는 신원을 드러낼 수 있습니다:

- **거래 그래프 분석**: 흐름 패턴이 송금인-수취인 관계를 드러냄
- **타이밍 상관관계**: 거래 타이밍이 입금과 출금을 연결함
- **금액 매칭**: 거래 간 유사한 금액이 연결을 가능하게 함
- **행동 지문**: 개인에게 고유한 사용 패턴

그래프 난독화는 다음을 통해 이를 해결합니다:
- 릴레이를 통해 직접적인 거래 연결을 끊음
- 상관관계 방지를 위해 무작위 타이밍 지연 추가
- 분석을 혼란스럽게 하기 위해 미끼 거래 생성
- 모든 거래를 구별 불가능하게 만듦

ZK-DEX의 경우, 이것은 거래 암호화를 넘어선 심층 방어 프라이버시를 제공합니다.

## 기술 사양

### 아키텍처 개요

```
User                          Obfuscation Network                Final Destination
+--------+                    +------------------------+         +------------+
|        |  Transaction       |                        |         |            |
| Sender |------------------>| Relay Node 1           |         | Recipient  |
|        |                    |       |                |-------->|            |
+--------+                    |       v                |         +------------+
                              | +----------------+     |
                              | | Mix Pool       |     |
                              | | (batching)     |     |
                              | +----------------+     |
                              |       |                |
                              |       v                |
                              | Relay Node 2           |
                              |       |                |
                              |       v                |
                              | +----------------+     |
                              | | Timing Delay   |     |
                              | | (randomized)   |     |
                              | +----------------+     |
                              |       |                |
                              |       v                |
                              | Relay Node 3           |
                              +------------------------+
```

### 구성 요소 목록

| 구성 요소 | 설명 |
|-----------|-------------|
| **Relay Nodes** | 입력/출력을 연결하지 않고 거래 전달 |
| **Mix Pool** | 타이밍 상관관계를 끊기 위해 거래 일괄 처리 |
| **Timing Randomizer** | 타이밍을 난독화하기 위해 가변 지연 추가 |
| **Decoy Generator** | 분석을 혼란스럽게 하기 위해 가짜 거래 생성 |
| **Path Selector** | 프라이버시를 최대화하기 위해 릴레이 경로 선택 |
| **Graph Monitor** | 잠재적인 익명화 해제 시도 감지 |

### 데이터 흐름

1. **거래 제출**
   - 사용자가 여러 잠재적 경로로 거래 생성
   - 경로의 각 릴레이에 대해 양파 암호화
   - 첫 번째 릴레이가 수신하여 한 레이어 해제

2. **믹싱 단계**
   - 믹스 풀에 거래 수집
   - 유사한 특성을 가진 다른 거래들과 일괄 처리
   - 전달 전 무작위 지연 적용

3. **최종 전달**
   - 마지막 릴레이가 목적지로 전달
   - 어떤 단일 릴레이도 출발지와 목적지를 모두 알 수 없음
   - 타이밍이 원래 제출과 무관함

### 난독화 프로토콜

```
Protocol: Dandelion++ Style Propagation

Stem Phase (Privacy):
1. Transaction enters anonymity phase
2. Forwarded through random relay chain
3. Each relay knows only predecessor and successor
4. Chain length: random between 1-10 hops

Fluff Phase (Propagation):
1. After stem, enters normal broadcast
2. Propagates to all nodes
3. Origin indistinguishable from relay

Timing Obfuscation:
- Each hop adds random delay (0-30 seconds)
- Poisson distribution mimics natural traffic
- Batch release at regular intervals

Decoy Traffic:
- Network generates constant background transactions
- Real transactions indistinguishable from decoys
- Traffic analysis yields no information
```

### 그래프 프라이버시 회로

```circom
pragma circom 2.1.0;

include "../utils/poseidon/poseidon.circom";

template RelayHop() {
    // Public inputs
    signal input inputCommitment;    // Previous hop commitment
    signal input outputCommitment;   // This hop commitment
    signal input relayCommitment;    // Hidden relay identity

    // Private inputs
    signal input value;              // Transaction value
    signal input sender;             // Original sender (hidden)
    signal input receiver;           // Final receiver (hidden)
    signal input relayPk;            // This relay's key
    signal input hopNumber;          // Position in chain
    signal input inputSalt;
    signal input outputSalt;

    // Verify input commitment from previous hop
    component inHash = Poseidon(4);
    inHash.inputs[0] <== value;
    inHash.inputs[1] <== sender;
    inHash.inputs[2] <== hopNumber - 1;
    inHash.inputs[3] <== inputSalt;
    inHash.out === inputCommitment;

    // Create output commitment for next hop
    component outHash = Poseidon(4);
    outHash.inputs[0] <== value;
    outHash.inputs[1] <== sender;
    outHash.inputs[2] <== hopNumber;
    outHash.inputs[3] <== outputSalt;
    outHash.out === outputCommitment;

    // Verify relay commitment
    component relayHash = Poseidon(2);
    relayHash.inputs[0] <== relayPk;
    relayHash.inputs[1] <== hopNumber;
    relayHash.out === relayCommitment;
}

component main {public [inputCommitment, outputCommitment, relayCommitment]} = RelayHop();
```

## 영향

| 측면 | 영향 |
|--------|--------|
| **송금인 프라이버시** | 출력에서 원래 송금인을 판단할 수 없음 |
| **수취인 프라이버시** | 입력에서 최종 수취인을 판단할 수 없음 |
| **타이밍 프라이버시** | 무작위 지연이 타이밍 상관관계를 방지 |
| **금액 프라이버시** | 일괄 처리와 미끼가 금액 매칭을 방지 |
| **행동 프라이버시** | 믹싱으로 사용 패턴이 난독화됨 |
| **그래프 저항성** | 거래 그래프가 정보를 제공하지 않음 |

## 보안 고려사항

| 위험 | 완화 |
|------|------------|
| **릴레이 담합** | 충분한 릴레이 다양성; 임계값 경로 |
| **타이밍 분석** | 무작위 지연; 일정한 트래픽 생성 |
| **볼륨 분석** | 표준 거래 크기; 금액 분할 |
| **장기 상관관계** | 정기적인 경로 순환; 미끼 갱신 |
| **시빌 공격** | 릴레이 스테이킹; 평판 요구사항 |
| **네트워크 수준 공격** | Tor/I2P 통합; 암호화된 통신 |

## 구현 과제

1. **지연 시간 vs. 프라이버시**
   - 더 많은 믹싱 = 더 나은 프라이버시 = 더 많은 지연
   - 구성 가능한 프라이버시 수준 필요
   - 시간에 민감한 거래를 위한 고속 트랙

2. **릴레이 인센티브**
   - 릴레이는 서비스에 대한 보상 필요
   - 수수료가 거래 금액을 드러내서는 안 됨
   - 고정 릴레이 수수료 고려

3. **익명 집합 크기**
   - 더 큰 배치 = 더 나은 프라이버시
   - 낮은 볼륨은 익명성 감소
   - 사용자의 임계 질량 필요

4. **미끼 지속 가능성**
   - 미끼는 가스/리소스 비용 발생
   - 미끼 생성을 위한 경제 모델 필요
   - 프로토콜 자금 지원 또는 사용자 자금 지원

5. **능동적 공격**
   - 공격자가 거래를 주입할 수 있음
   - 익명성을 줄이기 위한 플러드 공격
   - 속도 제한 및 작업 증명

## 파생물

1. **Dandelion++ Protocol** - 2단계 전파 (stem/fluff). Stem 단계는 송금인 익명성 제공. Fluff 단계는 전달 보장.

2. **Onion Routing** - 여러 릴레이를 통한 계층적 암호화. 각 릴레이가 하나의 암호화 레이어 제거. 엔드투엔드 경로 프라이버시.

3. **Mix Networks** - 거래 일괄 처리 및 셔플. 암호학적 믹싱 프로토콜. 검증 가능한 셔플 증명.

4. **Timing Obfuscation** - 각 홉에서 무작위 지연 주입. 푸아송 분포 타이밍. 일정 속도 트래픽 패턴.

5. **Decoy Transactions** - 프로토콜 생성 가짜 거래. 실제 트래픽과 구별 불가능. 익명 집합 증가.

## 사용 사례

1. **프라이빗 급여 지급**
   - 고용주가 직원에게 월별 급여 지급
   - 직접 지급은 급여 타이밍을 드러냄
   - 난독화된 전송이 상관관계를 끊음
   - 급여 프라이버시 유지

2. **익명 기부**
   - 기부자가 수취인으로부터 프라이버시 원함
   - 직접 전송은 기부자를 드러냄
   - 믹스 네트워크를 통해 라우팅
   - 수취인이 익명 기부 수신

3. **거래 프라이버시**
   - 트레이더가 여러 거래 실행
   - 패턴이 전략을 드러냄
   - 릴레이를 통해 거래 난독화
   - 거래 행동 숨김

4. **내부고발자 보호**
   - 출처가 민감한 정보 전송
   - 추적 불가능해야 함
   - 최대 난독화 적용
   - 출처 신원 보호

## 실제 제품 및 사용자 경험

### 1. "거래 그래프 끊기" - 송금인-수취인 연결 완전 차단

**제품 설명**:
송금인과 수취인 사이의 연결을 완전히 끊어 "누가 누구에게 보냈는지" 분석이 불가능한 그래프 난독화 서비스. 블록체인 분석 회사도 추적할 수 없습니다.

**일반 사용자 경험**:
- 김프라이버시(40세)는 가족에게 송금하려 함
- 일반 송금: "김씨→가족" 연결이 영구적으로 기록됨
- 그래프 끊기: 여러 릴레이와 시간 지연을 거쳐 전송
- 분석가가 보기에 입금과 출금은 무관한 별개 거래
- 가족 관계, 금융 지원 내역이 비공개로 유지

**관찰 가능한 이점**:
- 송금 관계 그래프 분석 완전 차단
- "이 두 지갑이 연결됨" 추론 불가
- 개인 관계 네트워크 프라이버시 보호

### 2. "타이밍 난독화" - 송금 시점 추적 방지

**제품 설명**:
입금과 출금 타이밍을 무작위화하여 "같은 시간에 같은 금액" 분석을 차단하는 프라이버시 서비스.

**일반 사용자 경험**:
- 이기부씨(55세)는 $10,000 익명 기부 희망
- 일반 전송: 입금 3시, 출금 3시 5분 → "5분 차이 = 같은 자금"
- 타이밍 난독화: 무작위 지연으로 입금과 출금 시점 분리
- 입금 3시, 출금 다음날 14시 32분 (랜덤)
- 타이밍 기반 연결 분석 완전 실패

**관찰 가능한 이점**:
- 시간 상관관계 분석 차단
- "비슷한 시간 = 같은 자금" 추론 방지
- 자금 흐름의 시간적 연결고리 제거

### 3. "금액 분할 난독화" - 금액 매칭 분석 차단

**제품 설명**:
입금 금액과 출금 금액이 매칭되지 않도록 자동으로 분할하고 재조합하는 서비스. "같은 금액" 분석을 차단합니다.

**일반 사용자 경험 (기업 관점)**:
- ABC 회사가 $100,000 결제 예정
- 일반 결제: "$100K 입금 → $100K 출금" 금액 매칭 가능
- 금액 분할: $37,421 + $28,079 + $34,500 등 무작위 분할 입금
- 다른 금액들로 재조합되어 출금
- 입금-출금 금액 매칭 분석 불가

**관찰 가능한 이점**:
- "같은 금액" 기반 추적 차단
- 결제 규모 추론 방지
- 다중 거래 간 연결 분석 실패

---

[Back to Index](../../README.md)
