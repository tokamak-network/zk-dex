# ZK-DEX 프로덕션 배포 체크리스트

**최종 업데이트**: 2026-01-29
**보안 수준**: 중요(CRITICAL)

---

## ⚠️ 배포 전 보안 점검

### 1. 개발 모드 확인 (중요)

- [ ] **네트워크 설정 확인**
  ```bash
  # truffle-config.js 또는 hardhat.config.js에서 대상 네트워크 확인
  cat truffle-config.js | grep -A 10 "networks:"
  ```

- [ ] **개발 모드 비활성화 확인**
  - 배포 스크립트(`migrations/2_deploy_contracts.js`)는 프로덕션 네트워크에서 자동으로 `development = false`로 설정합니다
  - 컨트랙트 생성자(`ZkDaiBase.sol`)는 chainId 검사를 수행합니다 - 프로덕션 네트워크에서 `development = true`인 경우 REVERT됩니다

- [ ] **chainId 제한 확인**
  - 개발 모드는 다음 네트워크에서만 허용됩니다:
    - `chainId 1337` (Ganache)
    - `chainId 31337` (Hardhat Network)
  - 개발 모드를 거부하는 프로덕션 네트워크:
    - `chainId 1` (Ethereum Mainnet)
    - `chainId 11155111` (Sepolia)
    - `chainId 137` (Polygon)
    - `chainId 42161` (Arbitrum One)
    - `chainId 10` (Optimism)

### 2. ZK 회로 검증

- [ ] **모든 회로가 프로덕션 파라미터로 컴파일되었는지 확인**
  ```bash
  ls -lh vapp/public/circuits/
  # 다음 파일들이 포함되어야 합니다:
  # - mint_burn_note.wasm
  # - transfer_note.wasm
  # - convert_note.wasm
  # - make_order.wasm
  # - take_order.wasm
  # - settle_order.wasm
  # - 모든 해당 verification_key.json 파일
  ```

- [ ] **검증자 컨트랙트가 회로 버전과 일치하는지 확인**
  ```bash
  # 회로와 검증자의 git 커밋 해시 확인
  git log --oneline contracts/verifiers/ vapp/public/circuits/ | head -5
  ```

- [ ] **회로 보안 검사 실행** (가능한 경우)
  ```bash
  # Circomspect 정적 분석 (설치된 경우)
  circomspect circuits-circom/main/*.circom

  # R1CS 제약 조건 검증
  snarkjs r1cs info vapp/public/circuits/transfer_note.r1cs
  ```

### 3. 스마트 컨트랙트 보안

- [ ] **Slither 정적 분석 실행**
  ```bash
  slither contracts/ --exclude-dependencies
  ```

- [ ] **단위 테스트 실행**
  ```bash
  npm test
  # 모든 테스트가 통과해야 합니다
  ```

- [ ] **컨트랙트 주소 확인**
  - [ ] DAI 토큰 주소가 대상 네트워크에 맞는지 확인
  - [ ] 모든 검증자 컨트랙트가 배포되었는지 확인
  - [ ] 하드코딩된 주소가 남아있지 않은지 확인

### 4. 프론트엔드 보안

- [ ] **Content Security Policy 활성화됨** (`vapp/index.html`)
  ```html
  <meta http-equiv="Content-Security-Policy" content="...">
  ```

- [ ] **암호화 보안 수정사항 적용됨**
  - [ ] `normalizeFieldElement()`가 일관되게 사용됨
  - [ ] `getSecureRandomBytes()`가 모든 `crypto.getRandomValues()`를 대체함
  - [ ] 모든 암호화 연산에서 필드 축소가 균일하게 적용됨

- [ ] **프로덕션용 프론트엔드 빌드**
  ```bash
  cd vapp
  npm run build
  # dist/ 출력 확인
  ```

### 5. 환경 변수

- [ ] **프로덕션 환경 변수 설정**
  ```bash
  export NODE_ENV=production
  export INFURA_API_KEY=<your-key>
  # 또는 .env.production 파일 사용
  ```

- [ ] **환경 또는 설정 파일에 개인 키가 없는지 확인**
  ```bash
  grep -r "PRIVATE_KEY\|SECRET\|0x[a-f0-9]{64}" . --exclude-dir=node_modules
  # 일치하는 항목이 없어야 합니다
  ```

---

## 🚀 배포 단계

### 단계 1: 컨트랙트 배포

```bash
# 드라이 런 (선택 사항)
truffle migrate --network <target-network> --dry-run

# 실제 배포
truffle migrate --network <target-network>
```

**예상 출력:**
```
📋 Deployment Configuration:
   Network: <target-network>
   Development mode: false
   ZK proof verification: ✅ ENABLED

✅ Deployment completed:
   ZkDex address: 0x...
   Development mode: false

🔒 Security verification passed: ZK proof verification is ENABLED.
```

**⚠️ 다음 경우 배포를 중단하세요:**
- 출력에 `Development mode: true`가 표시되는 경우
- 출력에 `ZK proof verification: ❌ DISABLED`가 표시되는 경우
- "SECURITY ERROR"를 언급하는 오류 메시지가 있는 경우

### 단계 2: 배포 후 검증

- [ ] **블록 탐색기에서 확인**
  ```bash
  # Etherscan 예시
  open "https://etherscan.io/address/<zkdex-address>"
  ```

- [ ] **컨트랙트 view 함수 호출**
  ```bash
  truffle console --network <target-network>

  # 콘솔에서:
  const zkDex = await ZkDex.deployed()
  const isDev = await zkDex.development()
  console.log("Development mode:", isDev)  // 반드시 false여야 함

  const daiAddr = await zkDex.dai()
  console.log("DAI address:", daiAddr)
  ```

- [ ] **먼저 소액으로 테스트**
  - 0.01 ETH 노트 민팅
  - 다른 계정으로 전송
  - 노트 상태 전환 확인

### 단계 3: 프론트엔드 배포

- [ ] **프론트엔드에서 컨트랙트 주소 업데이트**
  ```javascript
  // vapp/src/config/contracts.ts (또는 해당 파일)
  export const CONTRACTS = {
    ZkDex: '<deployed-address>',
    DAI: '<dai-address>',
    network: '<chainId>'
  }
  ```

- [ ] **프론트엔드 배포**
  ```bash
  cd vapp
  npm run build
  # dist/를 호스팅 서비스에 배포 (Vercel, Netlify 등)
  ```

- [ ] **프로덕션에서 CSP 확인**
  ```bash
  curl -I https://your-zkdex-frontend.com | grep -i "content-security-policy"
  ```

---

## ✅ 배포 후 검증

### 보안 검증

- [ ] **ZK 증명이 강제되는지 확인**
  ```bash
  # 유효하지 않은 증명 제출 시도 (실패해야 함)
  # 성공하면 개발 모드가 켜져 있음 - 심각한 오류!
  ```

- [ ] **컨트랙트 이벤트 확인**
  ```bash
  # NoteStateChange 이벤트가 올바르게 발생하는지 확인
  truffle console --network <target-network>
  const zkDex = await ZkDex.deployed()
  const events = await zkDex.getPastEvents('NoteStateChange', {
    fromBlock: 0,
    toBlock: 'latest'
  })
  console.log(events)
  ```

- [ ] **가스 사용량 모니터링**
  - 노트 민팅: ~500k-1M gas
  - 노트 전송: ~1M-2M gas
  - 주문 정산: ~2M-3M gas

### 기능 테스트

- [ ] **엔드투엔드 사용자 흐름 테스트**
  1. 계정 생성
  2. ETH 노트 민팅
  3. 자신에게 전송
  4. DAI 노트 민팅
  5. 판매 주문 생성
  6. 주문 수락
  7. 주문 정산

- [ ] **오류 케이스 테스트**
  - 유효하지 않은 증명 제출 (revert되어야 함)
  - 이중 지불 시도 (revert되어야 함)
  - 유효하지 않은 노트 상태 전환 (revert되어야 함)

---

## 📊 모니터링 및 사고 대응

### 추적할 지표

- [ ] **트랜잭션 성공률**
- [ ] **가스 사용량 추이**
- [ ] **노트 상태 분포** (Valid/Trading/Spent)
- [ ] **주문량 및 정산**

### 보안 모니터링

- [ ] **다음에 대한 알림 설정:**
  - 비정상적인 트랜잭션 패턴
  - 높은 가스 사용량
  - 실패한 증명 검증
  - 컨트랙트 잔액 변경

### 비상 연락처

- **보안 팀**: [email]
- **DevOps 팀**: [email]
- **회로 감사자**: [contact]

### 서킷 브레이커 (구현된 경우)

- [ ] 일시 중지 기능 테스트
- [ ] 일시 중지 해제에 다중 서명이 필요한지 확인
- [ ] 비상 종료 절차 문서화

---

## 🔴 심각한 장애 - 즉각적인 조치 필요

**다음 중 하나라도 발생하면 즉시 배포를 중단하세요:**

1. **프로덕션에서 개발 모드 활성화됨**
   - 증상: 배포 후 `development = true`
   - 조치: 사용하지 마세요. 올바른 설정으로 재배포하세요.

2. **증명 검증 우회 감지됨**
   - 증상: 유효한 증명 없이 트랜잭션 성공
   - 조치: 컨트랙트가 손상되었습니다. 비상 종료하세요.

3. **프론트엔드가 ZK 증명 없이 노트 생성 가능**
   - 증상: 증명 생성기를 호출하지 않고 노트가 생성됨
   - 조치: 프론트엔드 버그입니다. 즉시 프론트엔드를 비활성화하세요.

4. **컨트랙트 잔액 불일치**
   - 증상: 총 노트 가치 ≠ 컨트랙트 잔액
   - 조치: 이중 지불 가능성이 있습니다. 컨트랙트를 일시 중지하세요.

---

## 📝 배포 로그 템플릿

```
Deployment Date: YYYY-MM-DD HH:MM UTC
Network: <mainnet/sepolia/etc>
ChainId: <1/11155111/etc>
Deployer Address: 0x...

Contract Addresses:
- ZkDex: 0x...
- MockDai: 0x...
- MintBurnNoteVerifier: 0x...
- TransferNoteVerifier: 0x...
- ConvertNoteVerifier: 0x...
- MakeOrderVerifier: 0x...
- TakeOrderVerifier: 0x...
- SettleOrderVerifier: 0x...

Configuration:
- Development Mode: false ✅
- ZK Proof Verification: ENABLED ✅
- ChainId Check: PASSED ✅

Verification:
- Block Explorer: <link>
- Contract Verified: YES/NO
- Initial Test Transaction: <tx-hash>

Sign-off:
- Developer: [name]
- Reviewer: [name]
- Security Lead: [name]
```

---

## 📚 참고 자료

- 보안 분석 보고서: `docs/ZK-DEX_Security_Analysis_Report_EN.md`
- 보안 수정 보고서: `SECURITY_FIXES.md`
- 회로 문서: `circuits-circom/README.md`
- 아키텍처 문서: `ARCHITECTURE.md`

---

**⚠️ 기억하세요: 절대로 프로덕션 네트워크에서 `development = true`로 배포하지 마세요. 컨트랙트가 revert되지만, 이 심각한 오류를 방지하기 위해 여러 안전 검사가 존재합니다.**
