# ZK-DEX 미래 기능 아이디어

ZK-DEX를 위한 100가지 기능 아이디어를 구현 접근 방식별로 정리했습니다.

**노트 해시 형식 (불변)**:
- 일반 노트: `Poseidon(pkX, pkY, value, tokenType, salt)` (5개 입력)
- 스마트 노트: `Poseidon(parentHash, recipientPkX, recipientPkY, value, tokenType, salt)` (6개 입력)

---

## 디렉토리 구조

```
docs/future_ko/
├── README.md                    # 이 파일 - 100개 아이디어 요약
├── circuit-addons/              # 회로 전용 기능 (65개)
│   ├── a-core-trading/          # A1-A8
│   ├── b-time-conditions/       # B1-B6
│   ├── c-privacy/               # C1-C10
│   ├── d-governance/            # D1-D8
│   ├── e-defi/                  # E1-E15
│   ├── f-nft-gaming/            # F1-F10
│   └── g-enterprise/            # G1-G8
├── infrastructure/              # 인프라 필요 기능 (25개)
│   ├── h-cross-chain/           # H1-H7
│   ├── i-off-chain/             # I1-I10
│   └── j-protocol/              # J1-J8
└── high-complexity/             # 고복잡도 추가 기능 (10개)
```

---

## 요약: 전체 100개 아이디어

### 회로 전용 기능 (65개)

새로운 회로와 검증자 컨트랙트만 추가하여 구현 가능한 기능들입니다.

#### 카테고리 A: 핵심 거래 (8개)

| ID | 이름 | 제약 조건 수 | 설명 |
|----|------|-------------|------|
| A1 | [배치 전송](circuit-addons/a-core-trading/a1-batch-transfer.md) | ~500K | 단일 트랜잭션에서 N-to-M 노트 전송 |
| A2 | [부분 체결 주문](circuit-addons/a-core-trading/a2-partial-fill.md) | ~400K | 잔액이 남는 부분 주문 실행 |
| A3 | [손절 주문](circuit-addons/a-core-trading/a3-stop-loss.md) | ~150K | 가격이 임계값 아래로 떨어지면 자동 실행 |
| A4 | [익절 주문](circuit-addons/a-core-trading/a4-take-profit.md) | ~150K | 가격이 임계값 위로 오르면 자동 실행 |
| A5 | [OCO 주문](circuit-addons/a-core-trading/a5-oco.md) | ~180K | 손절과 익절을 결합한 주문 |
| A6 | [그리드 트레이딩](circuit-addons/a-core-trading/a6-grid-trading.md) | ~200K | 미리 설정된 가격 수준에서 자동 매수/매도 |
| A7 | [경매](circuit-addons/a-core-trading/a7-auction.md) | ~250K | 더치/잉글리시 경매 메커니즘 |
| A8 | [TWAP 주문](circuit-addons/a-core-trading/a8-twap.md) | ~200K | 시간 가중 평균 가격 실행 |

#### 카테고리 B: 시간 및 조건 (6개)

| ID | 이름 | 제약 조건 수 | 설명 |
|----|------|-------------|------|
| B1 | [시간 잠금 노트](circuit-addons/b-time-conditions/b1-time-lock.md) | ~150K | 잠금 해제 시간 이후에만 사용 가능한 노트 |
| B2 | [다중 서명 노트](circuit-addons/b-time-conditions/b2-multisig.md) | ~300K | M-of-N 임계값 지출 |
| B3 | [조건부 지급](circuit-addons/b-time-conditions/b3-conditional.md) | ~250K | 오라클 트리거 실행 |
| B4 | [스트리밍 지급](circuit-addons/b-time-conditions/b4-streaming.md) | ~200K | 시간에 따른 지속적인 지급 |
| B5 | [타임아웃 에스크로](circuit-addons/b-time-conditions/b5-escrow.md) | ~220K | 자동 해제 기능이 있는 다자간 에스크로 |
| B6 | [DCA](circuit-addons/b-time-conditions/b6-dca.md) | ~200K | 달러 코스트 평균화 자동화 |

#### 카테고리 C: 프라이버시 기능 (10개)

| ID | 이름 | 제약 조건 수 | 설명 |
|----|------|-------------|------|
| C1 | [링 서명](circuit-addons/c-privacy/c1-ring-signature.md) | ~600K | N명의 디코이 중에서 발신자 숨김 |
| C2 | [프라이버시 풀 예치](circuit-addons/c-privacy/c2-pool-deposit.md) | ~120K | 믹싱 풀에 예치 |
| C3 | [프라이버시 풀 인출](circuit-addons/c-privacy/c3-pool-withdraw.md) | ~180K | 믹싱 풀에서 인출 |
| C4 | [스텔스 주소](circuit-addons/c-privacy/c4-stealth-address.md) | ~250K | 일회용 수신자 주소 |
| C5 | [선택적 공개](circuit-addons/c-privacy/c5-selective-disclosure.md) | ~150K | 특정 속성만 공개 |
| C6 | [뷰 키 위임](circuit-addons/c-privacy/c6-view-key.md) | ~180K | 읽기 전용 접근 권한 위임 |
| C7 | [규정 준수 증명](circuit-addons/c-privacy/c7-compliance.md) | ~120K | AML 규정 준수 검증 |
| C8 | [소득 범위 증명](circuit-addons/c-privacy/c8-income-range.md) | ~400K | 범위 내 소득 증명 |
| C9 | [제재 준수](circuit-addons/c-privacy/c9-sanctions.md) | ~800K | 제재 대상과의 비상호작용 증명 |
| C10 | [적격 투자자](circuit-addons/c-privacy/c10-accredited.md) | ~350K | 순자산 임계값 증명 |

#### 카테고리 D: 거버넌스 (8개)

| ID | 이름 | 제약 조건 수 | 설명 |
|----|------|-------------|------|
| D1 | [비밀 투표](circuit-addons/d-governance/d1-private-voting.md) | ~150K | 커밋-리빌 투표 |
| D2 | [쿼드라틱 투표](circuit-addons/d-governance/d2-quadratic.md) | ~140K | 비용이 제곱으로 증가 |
| D3 | [컨빅션 투표](circuit-addons/d-governance/d3-conviction.md) | ~130K | 시간에 따라 투표력 축적 |
| D4 | [위임 투표](circuit-addons/d-governance/d4-delegated.md) | ~160K | 투표권 양도 |
| D5 | [레이지 퀴트](circuit-addons/d-governance/d5-rage-quit.md) | ~250K | 비례 지분으로 DAO 탈퇴 |
| D6 | [제안 본드](circuit-addons/d-governance/d6-proposal-bond.md) | ~140K | 제안을 위한 스테이킹 필요 |
| D7 | [스냅샷 투표](circuit-addons/d-governance/d7-snapshot.md) | ~200K | 과거 잔액 기준 투표 |
| D8 | [준비금 증명](circuit-addons/d-governance/d8-reserves.md) | ~600K | 공개하지 않고 보유량 증명 |

#### 카테고리 E: DeFi (15개)

| ID | 이름 | 제약 조건 수 | 설명 |
|----|------|-------------|------|
| E1 | [프라이빗 AMM](circuit-addons/e-defi/e1-private-amm.md) | ~300K | 숨겨진 풀 준비금 및 거래 |
| E2 | [옵션](circuit-addons/e-defi/e2-options.md) | ~300K | 옵션 계약 작성/행사 |
| E3 | [무기한 선물](circuit-addons/e-defi/e3-perpetuals.md) | ~350K | 무기한 선물 포지션 |
| E4 | [보험](circuit-addons/e-defi/e4-insurance.md) | ~200K | 보험 구매, 이벤트 청구 |
| E5 | [합성 자산](circuit-addons/e-defi/e5-synthetics.md) | ~250K | 합성 자산 발행/소각 |
| E6 | [채권](circuit-addons/e-defi/e6-bonds.md) | ~200K | 고정 수익 발행/상환 |
| E7 | [유동성](circuit-addons/e-defi/e7-liquidity.md) | ~250K | LP 포지션 추가/제거 |
| E8 | [스테이킹](circuit-addons/e-defi/e8-staking.md) | ~180K | 보상을 위한 토큰 스테이킹 |
| E9 | [수익률 청구](circuit-addons/e-defi/e9-yield.md) | ~150K | 누적된 보상 청구 |
| E10 | [레버리지](circuit-addons/e-defi/e10-leverage.md) | ~300K | 레버리지 포지션 |
| E11 | [범위 주문](circuit-addons/e-defi/e11-range-order.md) | ~250K | 집중 유동성 |
| E12 | [포트폴리오 리밸런싱](circuit-addons/e-defi/e12-rebalance.md) | ~400K | 자동 할당 리밸런싱 |
| E13 | [플래시 론](circuit-addons/e-defi/e13-flash-loan.md) | ~200K | 원자적 무담보 대출 |
| E14 | [담보 예치](circuit-addons/e-defi/e14-collateral.md) | ~200K | 대출을 위한 담보 예치 |
| E15 | [대출 상환](circuit-addons/e-defi/e15-loan-repay.md) | ~200K | 빌린 금액 상환 |

#### 카테고리 F: NFT 및 게임 (10개)

| ID | 이름 | 제약 조건 수 | 설명 |
|----|------|-------------|------|
| F1 | [프라이빗 NFT 전송](circuit-addons/f-nft-gaming/f1-nft-transfer.md) | ~120K | 숨겨진 NFT 소유권 전송 |
| F2 | [블라인드 경매](circuit-addons/f-nft-gaming/f2-blind-auction.md) | ~150K | 봉인 입찰 경매 |
| F3 | [NFT 분할](circuit-addons/f-nft-gaming/f3-fractionalize.md) | ~200K | NFT를 지분으로 분할 |
| F4 | [루트 박스](circuit-addons/f-nft-gaming/f4-loot-box.md) | ~180K | 검증 가능한 랜덤 보상 |
| F5 | [게임 아이템 거래](circuit-addons/f-nft-gaming/f5-gaming-items.md) | ~150K | 프라이빗 게임 내 거래 |
| F6 | [토너먼트 참가](circuit-addons/f-nft-gaming/f6-tournament.md) | ~140K | 프라이빗 토너먼트 참여 |
| F7 | [업적 증명](circuit-addons/f-nft-gaming/f7-achievement.md) | ~130K | 게임 업적 증명 |
| F8 | [카드 뽑기](circuit-addons/f-nft-gaming/f8-card-draw.md) | ~200K | 공정한 카드 게임 메커니즘 |
| F9 | [NFT 임대](circuit-addons/f-nft-gaming/f9-rental.md) | ~180K | 임시 NFT 액세스 |
| F10 | [로열티 지급](circuit-addons/f-nft-gaming/f10-royalty.md) | ~160K | 판매 시 창작자 로열티 |

#### 카테고리 G: 엔터프라이즈 (8개)

| ID | 이름 | 제약 조건 수 | 설명 |
|----|------|-------------|------|
| G1 | [프라이빗 급여](circuit-addons/g-enterprise/g1-payroll.md) | ~400K | 배치 급여 지급 |
| G2 | [공급망](circuit-addons/g-enterprise/g2-supply-chain.md) | ~180K | 프라이버시를 보장하는 상품 추적 |
| G3 | [인보이스 팩토링](circuit-addons/g-enterprise/g3-invoice.md) | ~200K | 프라이빗 인보이스 팩토링 |
| G4 | [세금 보고](circuit-addons/g-enterprise/g4-tax-report.md) | ~500K | 세금 보고서 생성 |
| G5 | [감사 공개](circuit-addons/g-enterprise/g5-audit.md) | ~250K | 감사자를 위한 선택적 공개 |
| G6 | [KYC 검증](circuit-addons/g-enterprise/g6-kyc.md) | ~150K | 신원 검증 |
| G7 | [신용 점수 범위](circuit-addons/g-enterprise/g7-credit.md) | ~200K | 신용도 증명 |
| G8 | [무역 규정 준수](circuit-addons/g-enterprise/g8-trade-compliance.md) | ~300K | 국제 무역 규정 준수 |

---

### 인프라 필요 기능 (25개)

추가 오프체인 시스템, 프로토콜 변경 또는 외부 통합이 필요한 기능들입니다.

#### 카테고리 H: 크로스체인 (7개)

| ID | 이름 | 요구 사항 | 설명 |
|----|------|-----------|------|
| H1 | [ZK 라이트 클라이언트 브릿지](infrastructure/h-cross-chain/h1-light-client.md) | 라이트 클라이언트 + 릴레이 네트워크 | 신뢰 불필요 크로스체인 검증 |
| H2 | [HTLC 원자적 스왑](infrastructure/h-cross-chain/h2-htlc.md) | 크로스체인 조정 | 체인 간 원자적 스왑 |
| H3 | [래핑 자산 브릿지](infrastructure/h-cross-chain/h3-wrapped-asset.md) | 양쪽 체인의 브릿지 컨트랙트 | 래핑 토큰 발행 |
| H4 | [크로스체인 메시징](infrastructure/h-cross-chain/h4-messaging.md) | 릴레이 인프라 | 프라이빗 크로스체인 통신 |
| H5 | [멀티체인 포트폴리오](infrastructure/h-cross-chain/h5-portfolio.md) | 체인별 인덱서 | 체인 간 통합 뷰 |
| H6 | [크로스체인 차익거래](infrastructure/h-cross-chain/h6-arbitrage.md) | MEV 인프라 | 프라이빗 차익거래 실행 |
| H7 | [롤업 정산](infrastructure/h-cross-chain/h7-rollup.md) | L1 컨트랙트 + 시퀀서 | L1으로 트랜잭션 배치 |

#### 카테고리 I: 오프체인 시스템 (10개)

| ID | 이름 | 요구 사항 | 설명 |
|----|------|-----------|------|
| I1 | [다크 풀](infrastructure/i-off-chain/i1-dark-pool.md) | 암호화된 오더북 + MPC | 숨겨진 주문 매칭 |
| I2 | [RFQ 시스템](infrastructure/i-off-chain/i2-rfq.md) | 오프체인 협상 | 견적 요청 프로토콜 |
| I3 | [수익률 애그리게이터](infrastructure/i-off-chain/i3-yield-aggregator.md) | 전략 실행기 | 자동 복리 수익 |
| I4 | [차익거래 봇](infrastructure/i-off-chain/i4-arbitrage-bot.md) | 가격 피드 + 실행 | 프라이빗 차익거래 전략 |
| I5 | [지오펜싱](infrastructure/i-off-chain/i5-geofencing.md) | 신뢰할 수 있는 위치 오라클 | 위치 기반 규정 준수 |
| I6 | [그래프 난독화](infrastructure/i-off-chain/i6-graph-obfuscation.md) | 자동 라우팅 릴레이 | 트랜잭션 링크 끊기 |
| I7 | [퓨타키 시장](infrastructure/i-off-chain/i7-futarchy.md) | 예측 시장 통합 | 예측에 의한 거버넌스 |
| I8 | [홀로그래픽 합의](infrastructure/i-off-chain/i8-holographic.md) | 스테이킹 코디네이터 | 제안 임계값 부스트 |
| I9 | [낙관적 거버넌스](infrastructure/i-off-chain/i9-optimistic-gov.md) | 시간 기반 실행 데몬 | 거부되지 않으면 통과 |
| I10 | [증명자 시장](infrastructure/i-off-chain/i10-prover-market.md) | 탈중앙화 증명자 네트워크 | 아웃소싱 증명 생성 |

#### 카테고리 J: 프로토콜 변경 (8개)

| ID | 이름 | 요구 사항 | 설명 |
|----|------|-----------|------|
| J1 | [재귀 집계](infrastructure/j-protocol/j1-recursive.md) | PLONK/Nova 마이그레이션 | 여러 증명 집계 |
| J2 | [증명 압축](infrastructure/j-protocol/j2-compression.md) | 커스텀 증명 형식 | 더 작은 증명 크기 |
| J3 | [스테이트 채널](infrastructure/j-protocol/j3-state-channels.md) | 오프체인 상태 프로토콜 | 오프체인 트랜잭션 |
| J4 | [낙관적 롤업](infrastructure/j-protocol/j4-optimistic.md) | 사기 증명 시스템 | 유효하다고 가정, 사기 시 이의 제기 |
| J5 | [하드웨어 가속](infrastructure/j-protocol/j5-hardware.md) | GPU/FPGA 통합 | 더 빠른 증명 생성 |
| J6 | [증인 암호화](infrastructure/j-protocol/j6-witness-encryption.md) | 새로운 암호화 기본 요소 | 증명 기반 복호화 |
| J7 | [VDF 통합](infrastructure/j-protocol/j7-vdf.md) | 타임락 퍼즐 시스템 | 검증 가능한 지연 함수 |
| J8 | [임계값 서명](infrastructure/j-protocol/j8-threshold-sig.md) | MPC 키 생성 | 분산 키 관리 |

---

### 고복잡도 추가 기능 (10개)

상당한 증명자 리소스가 필요한 300K 이상의 제약 조건을 가진 고급 기능들입니다.

| ID | 이름 | 제약 조건 수 | 설명 |
|----|------|-------------|------|
| HC1 | [배치 머클 업데이트](high-complexity/hc1-batch-merkle-update.md) | ~800K | 단일 증명으로 여러 노트 업데이트 |
| HC2 | [다중 자산 원자적 스왑](high-complexity/hc2-multi-asset-atomic-swap.md) | ~600K | 여러 토큰 쌍을 원자적으로 스왑 |
| HC3 | [프라이빗 오더북 매칭](high-complexity/hc3-private-order-book-match.md) | ~1M | 암호화된 오더북에서 주문 매칭 |
| HC4 | [포트폴리오 리밸런싱](high-complexity/hc4-portfolio-rebalancing.md) | ~500K | N개 자산을 목표 할당으로 리밸런싱 |
| HC5 | [배치 청산](high-complexity/hc5-batch-liquidation.md) | ~700K | 여러 포지션을 원자적으로 청산 |
| HC6 | [봉인 입찰 경매](high-complexity/hc6-sealed-bid-auction.md) | ~600K | 승자만 공개하는 경매 정산 |
| HC7 | [멀티홉 전송](high-complexity/hc7-multi-hop-transfer.md) | ~400K | 중개자를 통한 지급 라우팅 |
| HC8 | [프라이빗 신용 점수](high-complexity/hc8-private-credit-score.md) | ~450K | 데이터를 공개하지 않고 점수 계산 |
| HC9 | [집계 서명](high-complexity/hc9-aggregate-signatures.md) | ~800K | 하나의 증명으로 많은 서명 검증 |
| HC10 | [프라이빗 인덱스 펀드](high-complexity/hc10-private-index-fund.md) | ~900K | 완전한 프라이버시로 펀드 관리 |

---

## 카테고리별 실제 제품 유즈케이스

ZK-DEX 로드맵의 각 기능에는 실제 프라이버시 가치를 보여주는 상세한 제품 시나리오가 포함되어 있습니다. 아래는 제품 문서에서 추출한 모든 유즈케이스 제목입니다(총 85개 기능, 245개 유즈케이스).

### A. 핵심 거래 (8개 기능, 24개 유즈케이스)

**A1. 배치 전송** ([제품 문서](product/a-core-trading/a1-batch-transfer-products.md))
- 기업 비밀 급여 시스템
- 익명 기부 풀
- DAO 보조금 프라이버시 배포

**A2. 부분 체결 주문** ([제품 문서](product/a-core-trading/a2-partial-fill-products.md))
- 고래 은폐 거래 시스템
- 기업 인수 비밀 매집 서비스
- OTC 거래 정보 차단기

**A3. 손절 주문** ([제품 문서](product/a-core-trading/a3-stop-loss-products.md))
- 스톱헌팅 방어 시스템
- 청산 가격 비공개 레버리지
- 포지션 비공개 리스크 관리

**A4. 익절 주문** ([제품 문서](product/a-core-trading/a4-take-profit-products.md))
- 익시트 전략 비공개 시스템
- 기관 청산 프라이버시
- 프론트러닝 방지 익절 주문

**A5. OCO 주문** ([제품 문서](product/a-core-trading/a5-oco-products.md))
- 완전 비공개 브라켓 오더
- 기관 포지션 완전 보호
- MEV 완전 차단 브라켓

**A6. 그리드 트레이딩** ([제품 문서](product/a-core-trading/a6-grid-trading-products.md))
- 그리드 레벨 은닉 마켓메이킹
- 마켓메이커 재고 비공개
- 기관급 프라이빗 AMM

**A7. 경매** ([제품 문서](product/a-core-trading/a7-auction-products.md))
- 봉인 입찰 경매
- 청산 경매 프라이버시
- DAO 자산 매각 비공개 경매

**A8. TWAP 주문** ([제품 문서](product/a-core-trading/a8-twap-products.md))
- 기관 매집 은폐 시스템
- 프로젝트 토큰 조용한 매도
- DAO 재무 프라이버시

### B. 시간 및 조건 (6개 기능, 18개 유즈케이스)

**B1. 시간 잠금 노트** ([제품 문서](product/b-time-conditions/b1-time-lock-products.md))
- 비밀 베스팅 스케줄
- 익명 유산 상속
- 기밀 투자 락업

**B2. 다중 서명 노트** ([제품 문서](product/b-time-conditions/b2-multisig-products.md))
- 익명 DAO 거버넌스
- 기업 재무팀 프라이버시
- 내부고발자 보호 기금

**B3. 조건부 지급** ([제품 문서](product/b-time-conditions/b3-conditional-products.md))
- 비밀 M&A 조건부 결제
- 익명 정치 서약금
- 기밀 거래 트리거

**B4. 스트리밍 지급** ([제품 문서](product/b-time-conditions/b4-streaming-products.md))
- 비공개 급여 스트리밍
- 익명 창작자 후원
- 기밀 고문료 지급

**B5. 타임아웃 에스크로** ([제품 문서](product/b-time-conditions/b5-escrow-products.md))
- 비밀 협상 에스크로
- 익명 분쟁 중재
- 민감 거래 보호

**B6. DCA** ([제품 문서](product/b-time-conditions/b6-dca-products.md))
- 고래 추적 방지 적립
- DAO 재무 분산 익명화
- 익명 정치 자금 적립

### C. 프라이버시 기능 (10개 기능, 30개 유즈케이스)

**C1. 링 서명** ([제품 문서](product/c-privacy/c1-ring-signature-products.md))
- 익명 기부 플랫폼
- 내부고발자 보호 시스템
- 프라이버시 급여 시스템

**C2. 프라이버시 풀 예치** ([제품 문서](product/c-privacy/c2-pool-deposit-products.md))
- 프라이버시 저축 계좌
- 급여 프라이버시 브릿지
- 크라우드펀딩 익명 후원

**C3. 프라이버시 풀 인출** ([제품 문서](product/c-privacy/c3-pool-withdraw-products.md))
- 프라이버시 저축 계좌
- 거래소 프라이버시 브릿지
- 익명 결제 수령

**C4. 스텔스 주소** ([제품 문서](product/c-privacy/c4-stealth-address-products.md))
- 일회용 결제 주소 생성기
- 프리랜서 익명 청구서
- 후원자 감사 시스템

**C5. 선택적 공개** ([제품 문서](product/c-privacy/c5-selective-disclosure-products.md))
- 신원 확인 without 전체 공개
- 토큰 보유 인증
- 거래 범위 증명

**C6. 뷰 키 위임** ([제품 문서](product/c-privacy/c6-view-key-products.md))
- 프라이버시 보호 세무 대행
- 감사 대응 프라이버시 시스템
- 이혼 소송 자산 보호

**C7. 규정 준수 증명** ([제품 문서](product/c-privacy/c7-compliance-products.md))
- 해외 송금 프라이버시 서비스
- 거래소 출금 추적 차단
- 기업 거래 기밀 보호

**C8. 소득 범위 증명** ([제품 문서](product/c-privacy/c8-income-range-products.md))
- 소득 기반 차별 방지 대출
- 월세 협상력 보호
- 존엄성 보호 복지 신청

**C9. 제재 준수** ([제품 문서](product/c-privacy/c9-sanctions-products.md))
- 거래 이력 보호 제재 검증
- DeFi 참여자 프라이버시 보호
- 거래 파트너 상호 익명 검증

**C10. 적격 투자자** ([제품 문서](product/c-privacy/c10-accredited-products.md))
- 투자 자격 증명 서비스
- 부동산 신디케이션 자격 검증
- STO 자동 화이트리스트

### D. 거버넌스 (8개 기능, 24개 유즈케이스)

**D1. 비밀 투표** ([제품 문서](product/d-governance/d1-private-voting-products.md))
- 노조 파업 투표 시스템
- DAO 고래 보호 투표
- 내부고발자 안건 제출

**D2. 쿼드라틱 투표** ([제품 문서](product/d-governance/d2-quadratic-products.md))
- DAO 예산 배분 비밀 투표
- 민감 안건 선호도 투표
- 임원 성과 평가 투표

**D3. 컨빅션 투표** ([제품 문서](product/d-governance/d3-conviction-products.md))
- 익명 장기 지지 투표
- 비밀 지지 철회 시스템
- 플래시론 방지 + 프라이버시 투표

**D4. 위임 투표** ([제품 문서](product/d-governance/d4-delegated-products.md))
- 비밀 위임 네트워크
- 기관 투표 전략 보호
- 내부자 보호 위임

**D5. 레이지 퀴트** ([제품 문서](product/d-governance/d5-rage-quit-products.md))
- 익명 대량 이탈 경고 시스템
- 내부자 조용한 이탈
- 반대파 보복 방지 탈퇴

**D6. 제안 본드** ([제품 문서](product/d-governance/d6-proposal-bond-products.md))
- 익명 내부고발 안건 제출
- 논쟁적 안건 익명 제안
- 경쟁사 비밀 유지 제안

**D7. 스냅샷 투표** ([제품 문서](product/d-governance/d7-snapshot-products.md))
- 고래 지분 비밀 유지 스냅샷
- 과거 보유 익명 증명
- 멀티체인 익명 통합 투표

**D8. 준비금 증명** ([제품 문서](product/d-governance/d8-reserves-products.md))
- 거래소 지급능력 증명
- DAO 트레저리 건전성 검증
- 스테이블코인 담보 비밀 증명

### E. DeFi (15개 기능, 45개 유즈케이스)

**E1. 프라이빗 AMM** ([제품 문서](product/e-defi/e1-private-amm-products.md))
- 고래 스왑
- 시크릿 리밸런서
- 스텔스 청산 방어

**E2. 옵션** ([제품 문서](product/e-defi/e2-options-products.md))
- 스텔스 풋
- 시크릿 커버드콜
- 히든 스트라이크

**E3. 무기한 선물** ([제품 문서](product/e-defi/e3-perpetuals-products.md))
- 청산 방어막
- 고스트 트레이딩
- 펀딩비 익스플로잇 방어

**E4. 보험** ([제품 문서](product/e-defi/e4-insurance-products.md))
- 해킹 보험 스텔스
- 청구 패닉 방어
- 익스플로잇 감지 방어

**E5. 합성 자산** ([제품 문서](product/e-defi/e5-synthetics-products.md))
- 스텔스 민트
- 청산가 은닉
- 인버스 전략 보호

**E6. 채권** ([제품 문서](product/e-defi/e6-bonds-products.md))
- 발행규모 은닉
- 만기 클리프 방어
- 금리 시그널 차단

**E7. 유동성** ([제품 문서](product/e-defi/e7-liquidity-products.md))
- LP 스텔스
- IL 계산 차단
- 고래 추적 방지

**E8. 스테이킹** ([제품 문서](product/e-defi/e8-staking-products.md))
- 거버넌스 익명성
- 슬래싱 타겟 방어
- 언스테이킹 러시 방지

**E9. 수익률 청구** ([제품 문서](product/e-defi/e9-yield-products.md))
- 수익률 역추적 차단
- 전략 유출 방지
- 청구 러시 방지

**E10. 레버리지** ([제품 문서](product/e-defi/e10-leverage-products.md))
- 청산 사냥 방어
- 대출 규모 은닉
- 캐스케이드 청산 방지

**E11. 범위 주문** ([제품 문서](product/e-defi/e11-range-order-products.md))
- 히든 리밋
- 레인지 전략 보호
- 지지/저항 은닉

**E12. 포트폴리오 리밸런싱** ([제품 문서](product/e-defi/e12-rebalance-products.md))
- 리밸런싱 프론트런 방어
- 전략 복제 차단
- 쏠림 신호 차단

**E13. 플래시 론** ([제품 문서](product/e-defi/e13-flash-loan-products.md))
- 아비트라지 전략 보호
- 기회 규모 은닉
- 청산 전략 보호

**E14. 담보 예치** ([제품 문서](product/e-defi/e14-collateral-products.md))
- 청산 사냥 방어
- 자산 규모 은닉
- 카스케이드 청산 방지

**E15. 대출 상환** ([제품 문서](product/e-defi/e15-loan-repay-products.md))
- 상환 패턴 보호
- 부채 규모 은닉
- 조기 상환 시그널 차단

### F. NFT 및 게임 (10개 기능, 20개 유즈케이스)

**F1. 프라이빗 NFT 전송** ([제품 문서](product/f-nft-gaming/f1-nft-transfer-products.md))
- 프라이빗 컬렉터 네트워크
- 셀럽 시크릿 갤러리

**F2. 블라인드 경매** ([제품 문서](product/f-nft-gaming/f2-blind-auction-products.md))
- 안티스나이핑 경매장
- 담합방지 한정판 드롭

**F3. NFT 분할** ([제품 문서](product/f-nft-gaming/f3-fractionalize-products.md))
- 익명 지분 투자
- 시크릿 길드 금고

**F4. 루트 박스** ([제품 문서](product/f-nft-gaming/f4-loot-box-products.md))
- 시크릿 루트박스
- 안티스나이핑 미스터리 민팅

**F5. 게임 아이템 거래** ([제품 문서](product/f-nft-gaming/f5-gaming-items-products.md))
- 스텔스 인벤토리
- 시크릿 길드 무기고

**F6. 토너먼트 참가** ([제품 문서](product/f-nft-gaming/f6-tournament-products.md))
- 블라인드 토너먼트
- 시크릿 스테이크

**F7. 업적 증명** ([제품 문서](product/f-nft-gaming/f7-achievement-products.md))
- 스머프 실드
- 시크릿 트로피

**F8. 카드 뽑기** ([제품 문서](product/f-nft-gaming/f8-card-draw-products.md))
- 시크릿 핸드
- 페어플레이 TCG

**F9. NFT 임대** ([제품 문서](product/f-nft-gaming/f9-rental-products.md))
- 시크릿 렌탈
- 익명 스칼라십

**F10. 로열티 지급** ([제품 문서](product/f-nft-gaming/f10-royalty-products.md))
- 스텔스 로열티
- 시크릿 수익 분배

### G. 엔터프라이즈 (8개 기능, 24개 유즈케이스)

**G1. 프라이빗 급여** ([제품 문서](product/g-enterprise/g1-payroll-products.md))
- 경쟁사 차단 급여 시스템
- 직원 프라이버시 급여 증명
- 인건비 구조 기밀 보호

**G2. 공급망** ([제품 문서](product/g-enterprise/g2-supply-chain-products.md))
- 공급업체 기밀 보호 시스템
- 거래 물량 비밀 유지
- 원가 구조 은닉 시스템

**G3. 인보이스 팩토링** ([제품 문서](product/g-enterprise/g3-invoice-products.md))
- 거래 규모 비밀 유지
- 가격 정책 보호
- 현금흐름 상태 은닉

**G4. 세금 보고** ([제품 문서](product/g-enterprise/g4-tax-report-products.md))
- 재무 구조 비공개 세금 신고
- 거래처 비밀 유지 부가세 신고
- 개인 재무 프라이버시 세금 신고

**G5. 감사 공개** ([제품 문서](product/g-enterprise/g5-audit-products.md))
- M&A 협상용 선별 공개 감사
- 대출 심사용 비밀 유지 감사
- 부서 간 내부 감사

**G6. KYC 검증** ([제품 문서](product/g-enterprise/g6-kyc-products.md))
- 신원 확인, 신원 비저장
- 익명 적격투자자 인증
- 서비스 간 신원 비연결

**G7. 신용 점수 범위** ([제품 문서](product/g-enterprise/g7-credit-products.md))
- 정확한 점수 숨김 대출
- 신용이력 비공개 취업
- 여러 대출 비교해도 점수 안 깎이는 서비스

**G8. 무역 규정 준수** ([제품 문서](product/g-enterprise/g8-trade-compliance-products.md))
- 수출 바이어 비밀 유지
- 기술 수출 스펙 비공개
- 제재 스크리닝 비추적

### H. 크로스체인 (7개 기능, 21개 유즈케이스)

**H1. ZK 라이트 클라이언트 브릿지** ([제품 문서](product/h-cross-chain/h1-light-client-products.md))
- 프라이빗 브릿지
- 익명 크로스체인 포트폴리오
- 스텔스 크로스체인 송금

**H2. HTLC 원자적 스왑** ([제품 문서](product/h-cross-chain/h2-htlc-products.md))
- 체인 연결 끊기
- 비밀 크로스체인 OTC
- 프라이빗 온램프

**H3. 래핑 자산 브릿지** ([제품 문서](product/h-cross-chain/h3-wrapped-asset-products.md))
- 숨겨진 브릿지 금액
- 출처 숨김 래핑
- 선택적 공개 래핑

**H4. 크로스체인 메시징** ([제품 문서](product/h-cross-chain/h4-messaging-products.md))
- 메타데이터 숨김 메시징
- 프라이빗 크로스체인 지시
- 익명 크로스체인 투표

**H5. 멀티체인 포트폴리오** ([제품 문서](product/h-cross-chain/h5-portfolio-products.md))
- 총 자산 숨기기
- 비밀 리밸런싱
- 증명 가능한 잔액

**H6. 크로스체인 차익거래** ([제품 문서](product/h-cross-chain/h6-arbitrage-products.md))
- 숨겨진 차익거래
- MEV 보호 크로스체인
- 비공개 수익 축적

**H7. 롤업 정산** ([제품 문서](product/h-cross-chain/h7-rollup-products.md))
- 시퀀서 블라인드 롤업
- 배치 내 프라이버시
- DA 레이어 프라이버시

### HC. 고복잡도 추가 기능 (10개 기능, 30개 유즈케이스)

**HC1. 배치 머클 업데이트** ([제품 문서](product/high-complexity/hc1-batch-merkle-update-products.md))
- 시크릿 페이롤
- 익명 세틀먼트
- 프라이빗 벤딩

**HC2. 다중 자산 원자적 스왑** ([제품 문서](product/high-complexity/hc2-multi-asset-atomic-swap-products.md))
- 시크릿 OTC
- 프라이빗 네팅
- 익명 LP 스왑

**HC3. 프라이빗 오더북 매칭** ([제품 문서](product/high-complexity/hc3-private-order-book-match-products.md))
- 완전 암호화 다크풀
- 인스티튜셔널 RFQ
- 프라이빗 프라이머리

**HC4. 포트폴리오 리밸런싱** ([제품 문서](product/high-complexity/hc4-portfolio-rebalancing-products.md))
- 알파가드
- 컴플라이언스 프루프
- 프라이빗 패밀리오피스

**HC5. 배치 청산** ([제품 문서](product/high-complexity/hc5-batch-liquidation-products.md))
- 프라이빗 리퀴데이터
- 익명 디레버리징
- 시스테믹 쉴드

**HC6. 봉인 입찰 경매** ([제품 문서](product/high-complexity/hc6-sealed-bid-auction-products.md))
- 프라이빗 M&A
- 시크릿 IP 옥션
- 익명 부동산 입찰

**HC7. 멀티홉 전송** ([제품 문서](product/high-complexity/hc7-multi-hop-transfer-products.md))
- 인스티튜셔널 라우팅
- 프라이빗 트레저리
- 익명 M&A 펀딩

**HC8. 프라이빗 신용 점수** ([제품 문서](product/high-complexity/hc8-private-credit-score-products.md))
- 인스티튜셔널 크레딧
- 프라이빗 언더라이팅
- 멀티소스 크레딧

**HC9. 집계 서명** ([제품 문서](product/high-complexity/hc9-aggregate-signatures-products.md))
- 익명 거버넌스
- 프라이빗 밸리데이터
- 익명 멀티시그

**HC10. 프라이빗 인덱스 펀드** ([제품 문서](product/high-complexity/hc10-private-index-fund-products.md))
- 시크릿 알파
- 인비저블 트레저리
- 스텔스 펀드

### I. 오프체인 시스템 (10개 기능, 9개 유즈케이스)

**I1. 다크 풀** ([제품 문서](product/i-off-chain/i1-dark-pool-products.md))
- 완전 비공개 거래소
- 신원 격리 매칭
- 패턴 방지 실행

**I2. RFQ 시스템** ([제품 문서](product/i-off-chain/i2-rfq-products.md))
- 비공개 견적 요청
- 견적 내용 비공개
- 거래 이력 격리

**I3. 수익률 애그리게이터** ([제품 문서](product/i-off-chain/i3-yield-aggregator-products.md))
- 숨겨진 예금 규모
- 전략 배분 비공개
- 리밸런싱 은닉

### J. 프로토콜 변경 (8개 기능, 24개 유즈케이스)

**J1. 재귀적 증명 집계** ([제품 문서](product/j-protocol/j1-recursive-products.md))
- 패턴 숨김 배치 - 여러 거래를 하나로 합쳐 개별 분석 방지
- 크로스롤업 프라이버시 허브 - 롤업 간 자산 흐름 숨김
- 시간 윈도우 난독화 - 거래 시점 정보 제거

**J2. 증명 압축** ([제품 문서](product/j-protocol/j2-compression-products.md))
- 프라이버시 유지 압축 - 압축해도 정보 노출 없음
- 익명 크로스롤업 - 롤업 이동 시 연결고리 제거
- 제로 메타데이터 압축 - 증명 시스템 정보도 숨김

**J3. 스테이트 채널** ([제품 문서](product/j-protocol/j3-state-channels-products.md))
- 완전 비공개 채널 - 중간 상태 영구 비밀
- 프라이빗 게임 채널 - 게임 행동 완전 비공개
- 비밀 트레이딩 채널 - 거래 내역 제로 노출

**J4. 낙관적 롤업 모드** ([제품 문서](product/j-protocol/j4-optimistic-products.md))
- 프라이버시 폴백 - 분쟁 시에도 프라이버시 유지
- 숨겨진 가치 계층 - 어떤 거래가 ZK인지 숨김
- 프라이버시 우선 마이그레이션 - 전환 과정도 비공개

**J5. 하드웨어 가속** ([제품 문서](product/j-protocol/j5-hardware-products.md))
- 로컬 프루빙 - 데이터가 기기를 떠나지 않음
- TEE 보호 프루빙 - 프루버 운영자도 모름
- 프라이버시 우선 모바일 - 폰에서 완전 비공개 거래

**J6. 위트니스 암호화** ([제품 문서](product/j-protocol/j6-witness-encryption-products.md))
- 프라이빗 유산 전달 - 수취인도 조건 전까지 모름
- 숨겨진 조건부 주문 - 조건 자체도 비밀
- 영구 비밀 입찰 - 낙찰 외 입찰가 영원히 비공개

**J7. VDF 통합** ([제품 문서](product/j-protocol/j7-vdf-products.md))
- 익명 공정 추첨 - 참여자 신원 숨김 + 공정성
- 숨겨진 순서 매칭 - 최종 순서도 비공개
- 비공개 선정 - 누가 선정됐는지 숨김

**J8. 임계값 서명** ([제품 문서](product/j-protocol/j8-threshold-sig-products.md))
- 익명 서명자 금고 - 누가 승인했는지 숨김
- 비공개 노드 브릿지 - 어떤 노드가 승인했는지 숨김
- 프라이빗 거버넌스 서명 - DAO 키홀더 익명성

---

### 유즈케이스 통계

- **총 기능 수**: 93개
- **총 유즈케이스 수**: 269개
- **카테고리별 분포**:
  - A. 핵심 거래: 8개 기능, 24개 유즈케이스
  - B. 시간 및 조건: 6개 기능, 18개 유즈케이스
  - C. 프라이버시 기능: 10개 기능, 30개 유즈케이스
  - D. 거버넌스: 8개 기능, 24개 유즈케이스
  - E. DeFi: 15개 기능, 45개 유즈케이스
  - F. NFT 및 게임: 10개 기능, 20개 유즈케이스
  - G. 엔터프라이즈: 8개 기능, 24개 유즈케이스
  - H. 크로스체인: 7개 기능, 21개 유즈케이스
  - HC. 고복잡도: 10개 기능, 30개 유즈케이스
  - I. 오프체인 시스템: 3개 기능, 9개 유즈케이스
  - J. 프로토콜 변경: 8개 기능, 24개 유즈케이스

각 유즈케이스는 실제 사용자 시나리오, 제품 설명, 관찰 가능한 이점을 포함한 상세한 문서로 작성되어 있습니다.

---

## 구현 우선순위

### 1단계: 기초

- [A1 배치 전송](circuit-addons/a-core-trading/a1-batch-transfer.md)
- [A2 부분 체결](circuit-addons/a-core-trading/a2-partial-fill.md)
- [B1 시간 잠금 노트](circuit-addons/b-time-conditions/b1-time-lock.md)
- [D1 비밀 투표](circuit-addons/d-governance/d1-private-voting.md)

### 2단계: DeFi 확장

- [E1 프라이빗 AMM](circuit-addons/e-defi/e1-private-amm.md)
- [E2 옵션](circuit-addons/e-defi/e2-options.md)
- [E13 플래시 론](circuit-addons/e-defi/e13-flash-loan.md)
- [C4 스텔스 주소](circuit-addons/c-privacy/c4-stealth-address.md)

### 3단계: 프라이버시 및 규정 준수

- [C1 링 서명](circuit-addons/c-privacy/c1-ring-signature.md)
- [C6 뷰 키 위임](circuit-addons/c-privacy/c6-view-key.md)
- [C7 규정 준수 증명](circuit-addons/c-privacy/c7-compliance.md)
- [G5 감사 공개](circuit-addons/g-enterprise/g5-audit.md)

### 4단계: 크로스체인 및 확장

- [H1 ZK 라이트 클라이언트 브릿지](infrastructure/h-cross-chain/h1-light-client.md)
- [HC1 배치 머클 업데이트](high-complexity/hc1-batch-merkle-update.md)
- [J3 스테이트 채널](infrastructure/j-protocol/j3-state-channels.md)
- [I10 증명자 시장](infrastructure/i-off-chain/i10-prover-market.md)

---

## 참고 자료

- [ZKDIP-1: Fungible Smart Notes](../zkdip/zkdip-1.md)
- [Circom 문서](https://docs.circom.io/)
- [snarkjs](https://github.com/iden3/snarkjs)

---

## 라이선스

MIT License
