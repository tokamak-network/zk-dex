# ZK-DEX Improvement Proposals (ZKDIP)

ZKDIP는 ZK-DEX 프로토콜의 개선 제안을 문서화하는 표준 형식입니다.

## 목적

- 프로토콜 변경 사항의 체계적인 문서화
- 커뮤니티 리뷰 및 토론 촉진
- 구현 전 설계 검토

## ZKDIP 목록

| 번호 | 제목 | 상태 | 타입 |
|------|------|------|------|
| [ZKDIP-1](zkdip-1.md) ([KO](zkdip-1_ko.md)) | 대체 가능한(Fungible) 스마트 노트 | Draft | Standards Track |

## 상태 정의

| 상태 | 설명 |
|------|------|
| **Draft** | 초안 작성 중 |
| **Review** | 커뮤니티 리뷰 진행 중 |
| **Accepted** | 승인됨, 구현 대기 |
| **Implemented** | 구현 완료 |
| **Rejected** | 거절됨 |
| **Superseded** | 다른 ZKDIP로 대체됨 |

## 타입 정의

| 타입 | 설명 |
|------|------|
| **Standards Track** | 회로, 컨트랙트, 프로토콜 변경 |
| **Informational** | 설계 지침, 모범 사례 |
| **Meta** | ZKDIP 프로세스 자체에 대한 제안 |

## ZKDIP 작성 가이드

새 ZKDIP를 작성할 때는 다음 형식을 따릅니다:

```markdown
# ZKDIP-N: 제목

| 항목 | 내용 |
|------|------|
| **ZKDIP** | N |
| **제목** | 제안 제목 |
| **작성자** | 이름/팀 |
| **상태** | Draft |
| **타입** | Standards Track / Informational / Meta |
| **생성일** | YYYY-MM-DD |
| **관련 이슈** | 관련 이슈 번호/링크 |

## 요약
한 문단 요약

## 동기
왜 이 변경이 필요한가?

## 명세
상세 기술 명세

## 근거
설계 결정의 이유

## 보안 고려사항
보안 관련 영향

## 하위 호환성
기존 시스템과의 호환성

## 구현
구현 계획/순서

## 참조
관련 문서/링크
```

## 미래 아이디어

[**미래 기능 아이디어**](../future/README.md)에서 구현 방식별로 정리된 100개의 기능 제안을 확인하세요:

- **회로 애드온** (65개) - 새 회로 추가만으로 구현 가능
  - [핵심 거래](../future/circuit-addons/a-core-trading/) (8개)
  - [시간 & 조건](../future/circuit-addons/b-time-conditions/) (6개)
  - [프라이버시](../future/circuit-addons/c-privacy/) (10개)
  - [거버넌스](../future/circuit-addons/d-governance/) (8개)
  - [DeFi](../future/circuit-addons/e-defi/) (15개)
  - [NFT & 게이밍](../future/circuit-addons/f-nft-gaming/) (10개)
  - [엔터프라이즈](../future/circuit-addons/g-enterprise/) (8개)

- **인프라 필요** (25개) - 추가 오프체인 시스템 필요
  - [크로스체인](../future/infrastructure/h-cross-chain/) (7개)
  - [오프체인 시스템](../future/infrastructure/i-off-chain/) (10개)
  - [프로토콜 변경](../future/infrastructure/j-protocol/) (8개)

- **고복잡도** (10개) - 300K 이상 제약조건의 고급 기능
  - [고복잡도 아이디어](../future/high-complexity/)

## 기여

ZKDIP 제안은 누구나 할 수 있습니다. 새 제안은 Draft 상태로 시작하며, 리뷰 과정을 거쳐 승인됩니다.
