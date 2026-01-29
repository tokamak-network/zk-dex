# 보안 수정 구현 보고서

**날짜**: 2026-01-29
**참조**: docs/ZK-DEX_Security_Analysis_Report_EN.md

## 개요

보안 분석 보고서를 기반으로 4가지 보안 수정 사항을 구현하였습니다. 프론트엔드 암호화 모듈에서 1개의 High 심각도 이슈와 3개의 Medium 심각도 이슈를 해결하였습니다.

## 구현된 수정 사항

### 1. 비밀키 필드 리덕션 불일치 (High 심각도 - 이슈 3.3)

**문제점**: 필드 리덕션(BN128_FIELD_PRIME으로 모듈로 연산)이 일관되지 않게 적용되었습니다 - 조건문 `if`를 사용하는 경우와 직접 적용하는 경우가 혼재되어 있었습니다.

**해결 방안**: `normalizeFieldElement()` 헬퍼 함수를 생성하고 모든 암호화 연산에 일관되게 적용하였습니다.

**수정된 파일**:
- `vapp/src/lib/accountCrypto.ts`
- `vapp/src/lib/ecdhCrypto.ts`

**변경 사항**:
```typescript
// accountCrypto.ts의 새로운 헬퍼 함수
export function normalizeFieldElement(value: bigint): bigint {
  return value % BN128_FIELD_PRIME
}

// 다음 위치에 일관되게 적용:
// - accountCrypto.ts: generateSecretKey() 133번째 줄
// - accountCrypto.ts: derivePublicKey() 147번째 줄
// - ecdhCrypto.ts: generateEphemeralKeypair() 44번째 줄
// - ecdhCrypto.ts: decryptWithSecretKey() 186번째 줄
```

### 2. 랜덤 엔트로피 검증 부재 (Medium 심각도 - 이슈 3.5)

**문제점**: `crypto.getRandomValues()` 실패가 감지되지 않아 CSPRNG 실패 시 예측 가능한 키가 생성될 수 있었습니다.

**해결 방안**: 엔트로피 검증이 포함된 `getSecureRandomBytes()` 래퍼 함수를 생성하였습니다.

**수정된 파일**:
- `vapp/src/lib/accountCrypto.ts`
- `vapp/src/lib/ecdhCrypto.ts`

**변경 사항**:
```typescript
// accountCrypto.ts의 새로운 헬퍼 함수
export function getSecureRandomBytes(length: number): Uint8Array {
  if (!crypto || !crypto.getRandomValues) {
    throw new Error('Secure random number generator not available')
  }

  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  // 간단한 엔트로피 검사 (모두 0 = 실패)
  const sum = bytes.reduce((acc, val) => acc + val, 0)
  if (sum === 0) {
    throw new Error('Random number generator produced all zeros - possible CSPRNG failure')
  }

  return bytes
}

// 다음 위치에 적용:
// - accountCrypto.ts: generateSecretKey() - 32 bytes
// - accountCrypto.ts: encryptSecretKey() - salt (32 bytes) + IV (16 bytes)
// - ecdhCrypto.ts: generateEphemeralKeypair() - 32 bytes
// - ecdhCrypto.ts: encryptForRecipient() - nonce (12 bytes)
```

### 3. Content Security Policy 부재 (Medium 심각도 - 이슈 4.4)

**문제점**: XSS 및 기타 인젝션 공격을 방지하기 위한 CSP 메타 태그가 없었습니다.

**해결 방안**: snarkjs 호환성을 위해 `'wasm-unsafe-eval'`이 포함된 종합적인 CSP 메타 태그를 추가하였습니다.

**수정된 파일**:
- `vapp/index.html`

**변경 사항**:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://*.infura.io https://*.alchemy.com ws://localhost:* wss://localhost:*;
  img-src 'self' data:;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
">
```

**CSP 디렉티브 설명**:
- `script-src 'wasm-unsafe-eval'`: snarkjs WebAssembly 실행에 필요
- `style-src 'unsafe-inline'`: Vue 컴포넌트 스타일에 필요
- `connect-src`: Ethereum RPC 제공자 + localhost WebSocket 허용
- `object-src 'none'`: Flash/플러그인 차단
- `frame-ancestors 'none'`: 클릭재킹 방지

### 4. 키 삭제 기능 부재 (Medium 심각도 - 이슈 3.4)

**문제점**: 비밀키가 사용 후에도 메모리에 남아있어 메모리 덤프를 통해 복구될 가능성이 있었습니다.

**해결 방안**: 최선의 노력으로 메모리를 지우는 `wipeKey()` 함수를 구현하였습니다.

**수정된 파일**:
- `vapp/src/lib/accountCrypto.ts`

**변경 사항**:
```typescript
// 새로운 헬퍼 함수
export function wipeKey(key: Uint8Array): void {
  // 먼저 랜덤 데이터로 덮어쓰기
  crypto.getRandomValues(key)
  // 그 다음 0으로 초기화
  key.fill(0)
}
```

**참고**: JavaScript는 가비지 컬렉션과 최적화로 인해 메모리 삭제를 보장하지 않지만, 이 방법은 심층 방어(defense-in-depth)를 제공합니다. 완벽한 키 삭제는 네이티브 코드가 필요합니다.

## 테스트 결과

보안 수정 구현 후 모든 암호화 관련 테스트가 통과하였습니다:

- ✅ `src/lib/accountCrypto.test.ts` - 17개 테스트 (1140ms)
- ✅ `src/lib/ecdhCrypto.test.ts` - 17개 테스트 (963ms)
- ✅ `src/utils/noteEncryption.test.ts` - 13개 테스트 (700ms)
- ✅ `src/lib/circuitInputs.test.ts` - 25개 테스트 (389ms)
- ✅ `src/lib/poseidon.test.ts` - 12개 테스트 (368ms)
- ✅ 모든 스토어 테스트 (account, note, order, contract, web3)

**총계**: 244개 테스트 통과, 시각화 레이아웃 테스트에서 관련 없는 3개 실패.

## 보안 영향

### 수정 전:
- **위험**: 불일치한 필드 리덕션으로 인해 회로-브라우저 간 키 불일치 발생 가능
- **위험**: CSPRNG 자동 실패 시 약하거나 예측 가능한 키 생성 가능
- **위험**: XSS 보호 헤더 부재
- **위험**: 키가 메모리에 무기한 남아있음

### 수정 후:
- ✅ **일관된 암호화**: 모든 필드 연산이 동일한 리덕션 로직 사용
- ✅ **엔트로피 검증**: CSPRNG 실패 감지 및 보고
- ✅ **XSS 보호**: CSP가 대부분의 인젝션 공격 방지
- ✅ **메모리 위생**: 최선의 노력으로 키 삭제하여 공격 표면 감소

## 보안 점수 영향

**수정 전**: B+ (85/100)
**수정 후**: 예상 A- (90-92/100)

보안 점수 향상 내역:
- 1개의 High 심각도 이슈 수정 (+3 포인트)
- 3개의 Medium 심각도 이슈 수정 (+2 포인트 각각 = +6 포인트)
- 총 향상: +9 포인트

남은 보안 우려 사항 (이번 PR에서 미해결):
- **이슈 2.1** (High): 스마트 노트 부모 검증 - Solidity 변경 필요
- **이슈 3.2** (Medium): 스마트 노트 salt의 불충분한 엔트로피 - 아키텍처 결정 필요
- **이슈 4.3** (Medium): Scrypt 파라미터 - 보안과 UX 간의 트레이드오프

## 향후 작업 권장 사항

1. **이슈 2.1 (High)**: settle/convert 회로에 부모 노트 검증 추가
2. **이슈 3.2 (Medium)**: 스마트 노트 salt 엔트로피를 전체 256 bits로 증가 고려
3. **이슈 4.3 (Medium)**: 프로덕션 환경에서 scrypt N 파라미터를 65536으로 증가 고려
4. **키 저장소**: 정지 상태 암호화가 적용된 IndexedDB 사용 고려
5. **메모리 보호**: 가능한 경우 Web Crypto API의 추출 불가능한 키 사용 고려

## 참조

- 보안 분석 보고서: `docs/ZK-DEX_Security_Analysis_Report_EN.md`
- 수정된 파일:
  - `vapp/src/lib/accountCrypto.ts`
  - `vapp/src/lib/ecdhCrypto.ts`
  - `vapp/index.html`
