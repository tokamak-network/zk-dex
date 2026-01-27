# ZK-DEX Docker 문서

Docker 환경 구성, 멀티스테이지 빌드 아키텍처, 서비스 구성, 테스트 인프라에 대한 가이드.

## 목차

1. [개요](#개요)
2. [아키텍처](#아키텍처)
3. [Dockerfile: 멀티스테이지 빌드](#dockerfile-멀티스테이지-빌드)
4. [docker-compose.yml: 서비스 구성](#docker-composeyml-서비스-구성)
5. [nginx 설정](#nginx-설정)
6. [.dockerignore](#dockerignore)
7. [빌드 과정](#빌드-과정)
8. [테스트](#테스트)
9. [앱 실행](#앱-실행)
10. [설계 결정 사항](#설계-결정-사항)
11. [문제 해결](#문제-해결)

---

## 개요

ZK-DEX는 5개의 named stage로 구성된 단일 Dockerfile로 모든 서비스를 제공합니다 — 회로 컴파일, 컨트랙트 테스트부터 프론트엔드 개발 및 프로덕션 배포까지. Docker Compose는 개발 생명주기 전체를 커버하는 9개의 서비스를 오케스트레이션합니다.

### 파일 구조

```
Dockerfile              # 멀티스테이지 빌드 (회로, 컨트랙트, 테스트, 프론트엔드 개발/프로덕션)
docker-compose.yml      # 서비스 오케스트레이션
.dockerignore           # 제외 파일 목록
vapp/nginx.conf         # 프론트엔드 프로덕션 nginx 설정
```

---

## 아키텍처

### 빌드 파이프라인 (Dockerfile 스테이지)

Docker 빌드 스테이지가 아티팩트를 생성하고 하위 스테이지로 전달하는 흐름:

```
┌────────────────────┐
│  circom-builder     │  Rust → circom 바이너리
│  (rust:1.75-slim)   │
└────────┬───────────┘
         │ COPY --from (circom 바이너리)
         ▼
┌────────────────────┐
│  zkdex-base         │  회로 + 컨트랙트 + 테스트
│  (node:20-slim)     │  ├── npm install (루트 + circuits-circom)
│                     │  ├── 조건부 회로 빌드
│                     │  └── npx truffle compile → build/contracts/*.json
│                     │  └── 빌드 시 마이그레이션 (임시 Ganache → 결정적 주소)
└────────┬───────────┘
         │ COPY --from (컨트랙트 ABI + 회로 아티팩트)
         ▼
┌────────────────────┐
│  vapp-development   │  프론트엔드 개발 (Vite)
│  (node:20-slim)     │  ├── npm ci --legacy-peer-deps
│                     │  ├── 컨트랙트 ABI → /build/contracts/
│                     │  └── 회로 wasm/zkey → public/circuits/
└────────┬───────────┘
         │ inherits (FROM vapp-development)
         ▼
┌────────────────────┐
│  vapp-builder       │  npm run build (TypeScript + Vite)
│  (node:20-slim)     │
└────────┬───────────┘
         │ COPY --from (dist/)
         ▼
┌────────────────────┐
│  vapp-production    │  nginx 정적 파일 서빙
│  (nginx:alpine)     │  ├── 빌드된 프론트엔드 → /usr/share/nginx/html
│                     │  └── nginx.conf (COOP/COEP, SPA 라우팅)
└────────────────────┘
```

### 런타임 아키텍처 (컨테이너 간 통신)

전체 스택 실행 시 컨테이너 간 통신 구조:

```
 Host Machine
+===========================================================================+
|                                                                           |
|  Browser                                                                  |
|  :8080 --------> [vapp]          HTML/JS/CSS, circuit wasm/zkey           |
|  :3000 --------> [vapp-api]      REST API (CORS)                          |
|  :8545 --------> [ganache]       JSON-RPC (MetaMask / ethers.js)          |
|                                                                           |
|  Docker Network: zkdex-network                                            |
|  +---------------------------------------------------------------------+  |
|  |                                                                     |  |
|  |  +------------------+          +------------------+                 |  |
|  |  | ganache          |          | migrate          |                 |  |
|  |  | Ganache v7.9.1   | <------- | truffle migrate  |                 |  |
|  |  | :8545            | JSON-RPC | (run and exit)   |                 |  |
|  |  | networkId: 5777  |          +------------------+                 |  |
|  |  | 10 accounts      |                                              |  |
|  |  | 1000 ETH each    |          +------------------+                 |  |
|  |  | deterministic    | <------- | zkdex            |                 |  |
|  |  |   mnemonic       | JSON-RPC | Truffle tests    |                 |  |
|  |  |                  |          | (run and exit)   |                 |  |
|  |  |                  |          +------------------+                 |  |
|  |  |                  |                                              |  |
|  |  |                  |          +------------------+                 |  |
|  |  |                  | <------- | test-*           |                 |  |
|  |  |                  | JSON-RPC | (run and exit)   |                 |  |
|  |  +--------+---------+          +------------------+                 |  |
|  |           |                                                         |  |
|  |           | JSON-RPC (ganache:8545)                                 |  |
|  |           |                                                         |  |
|  |  +--------v---------+                                               |  |
|  |  | vapp-api         |                                               |  |
|  |  | Express (app.cjs)|                                               |  |
|  |  | :3000            |                                               |  |
|  |  | POST /accounts   |                                               |  |
|  |  | POST /notes      |                                               |  |
|  |  | POST /orders     |                                               |  |
|  |  | CORS: all origins|                                               |  |
|  |  +------------------+                                               |  |
|  |                                                                     |  |
|  |  +------------------+          +------------------+                 |  |
|  |  | vapp             |          | vapp-dev         |                 |  |
|  |  | nginx:alpine     |          | Vite dev server  |                 |  |
|  |  | :80 -> host:8080 |          | :8080 -> host    |                 |  |
|  |  |                  |          |          :8081   |                 |  |
|  |  | /html/           |          | hot reload       |                 |  |
|  |  |   index.html     |          | src/ mounted     |                 |  |
|  |  |   assets/        |          +------------------+                 |  |
|  |  |   circuits/      |                                               |  |
|  |  |     6x wasm+zkey |                                               |  |
|  |  |     (~28MB)      |                                               |  |
|  |  | Headers:         |                                               |  |
|  |  |   COOP + COEP    |                                               |  |
|  |  +------------------+                                               |  |
|  |                                                                     |  |
|  +---------------------------------------------------------------------+  |
|                                                                           |
+===========================================================================+
```

### 데이터 흐름

**증명 생성 흐름** (브라우저 측, 서버 개입 없음):

```
Browser                         nginx (vapp)
  |                                |
  +-- GET /circuits/X/X.wasm ---->[ ]  circuit WASM
  +-- GET /circuits/X/X.zkey ---->[ ]  proving key
  |
  +-- snarkjs.groth16.fullProve()
  |   (Web Worker + SharedArrayBuffer)
  |   => { proof, publicSignals }
  |
  +-- eth_sendTransaction -----------> ganache:8545
  |   (proof.a, proof.b, proof.c,      (on-chain verification)
  |    proof.input, encryptedNote)
  |
  +-- POST /notes -------------------> vapp-api:3000
      (note metadata)                  (off-chain storage)
```

**서비스 의존 관계**:

```
ganache (healthy first)
  +-- migrate           (컨트랙트 배포, exit)
  |   +-- vapp-api      (long-running API server)
  |   |   +-- vapp      (long-running nginx, production)
  |   |   +-- vapp-dev  (long-running Vite, development)
  +-- zkdex             (run tests, exit)
  +-- test-frontend     (run tests, exit)
  +-- test-production   (run tests, exit)
```

### 네트워크 구성

모든 컨테이너는 `zkdex-network` (bridge 드라이버)를 공유합니다. 컨테이너 간 통신은 컨테이너 이름을 호스트명으로 사용합니다:

| From | To | Address | Protocol | Purpose |
|------|----|---------|----------|---------|
| `migrate` | `ganache` | `ganache:8545` | JSON-RPC | 컨트랙트 배포 |
| `zkdex` | `ganache` | `ganache:8545` | JSON-RPC | Contract deploy & test |
| `vapp-api` | `ganache` | `ganache:8545` | JSON-RPC | Blockchain queries |
| `test-*` | `ganache` | `ganache:8545` | JSON-RPC | Test transactions |
| Browser | `vapp` | `localhost:8080` | HTTP | Static files (HTML/JS/CSS/wasm/zkey) |
| Browser | `vapp-api` | `localhost:3000` | HTTP (CORS) | REST API (accounts, notes, orders) |
| Browser | `ganache` | `localhost:8545` | JSON-RPC | MetaMask / ethers.js |

핵심: 브라우저는 nginx 리버스 프록시를 거치지 않고 `vapp-api`와 `ganache`에 호스트 매핑 포트로 직접 통신합니다. 프론트엔드가 axios base URL로 `VITE_API_URL || 'http://127.0.0.1:3000'`을 사용하고, MetaMask는 `localhost:8545`에 직접 연결하기 때문입니다.

---

## Dockerfile: 멀티스테이지 빌드

### Stage 1: circom-builder

```dockerfile
FROM rust:1.75-slim-bookworm AS circom-builder
```

- Circom 2.1.8 컴파일러를 Rust 소스에서 빌드
- 출력: `/circom/target/release/circom` 바이너리
- 컴파일러 바이너리만 생성하며, 최종 이미지에는 포함되지 않음

### Stage 2: zkdex-base

```dockerfile
FROM node:20-bookworm-slim AS zkdex-base
```

모든 백엔드 서비스가 사용하는 핵심 빌드 스테이지:

1. **시스템 의존성**: git, python3, build-essential, curl
2. **Circom 바이너리**: `circom-builder`에서 복사
3. **npm install**: 루트 의존성 + `circuits-circom` 의존성 (레이어 캐싱을 위해 분리)
4. **소스 코드**: `COPY . .` — 로컬에 사전 빌드된 회로 아티팩트가 있으면 포함
5. **조건부 회로 빌드**:
   - `.zkey` 파일이 존재하면 (로컬 사전 빌드): 회로 컴파일 건너뜀
   - 없으면: 회로 컴파일 → ptau 다운로드 → trusted setup → Solidity 검증자 생성
6. **컨트랙트 컴파일**: `npx truffle compile`로 `build/contracts/*.json` ABI 파일 생성
7. **빌드 시 마이그레이션**: 컨테이너 내부에서 임시 Ganache를 시작하고, `npx truffle migrate --network development --reset`를 실행한 후 Ganache를 종료합니다. 이를 통해 `build/contracts/*.json`에 결정적 컨트랙트 주소가 채워집니다 (동일한 니모닉 + 새 체인 = 매번 동일한 주소). 이 주소들은 프론트엔드 JavaScript에 번들링됩니다.
8. **환경**: `PTAU_SIZE=20` (pot20, ~400MB; 모든 회로에 충분한 ~1M 제약 조건 지원)

**사용하는 서비스**: `zkdex`, `zkdex-dev`, `migrate`, `vapp-api`, `test-frontend`, `test-production`

### Stage 3: vapp-development

```dockerfile
FROM node:20-bookworm-slim AS vapp-development
```

프론트엔드 개발 스테이지:

1. **npm ci --legacy-peer-deps**: vapp 의존성 설치 (`@pinia/testing` peer dep 호환을 위해 legacy 플래그 필요)
2. **소스 코드**: `vapp/` 소스 복사
3. **컨트랙트 ABI**: `COPY --from=zkdex-base /app/build/contracts/ /build/contracts/`
   - `vapp/src/stores/contract.ts`가 `../../../build/contracts/`에서 임포트하므로 필요
4. **회로 파일**: `zkdex-base`에서 6개 회로의 wasm/zkey 복사:
   ```
   public/circuits/{circuit_name}/{circuit_name}.wasm
   public/circuits/{circuit_name}/{circuit_name}.zkey
   ```
   총 크기: ~28MB
5. **기본 명령어**: `npm run dev -- --host 0.0.0.0` (Vite 개발 서버)

**사용하는 서비스**: `vapp-dev`

### Stage 4: vapp-builder

```dockerfile
FROM vapp-development AS vapp-builder
```

`vapp-development`을 상속하여 `npm run build` (TypeScript 컴파일 + Vite 프로덕션 빌드) 실행. 출력은 `/app/dist/`로.

### Stage 5: vapp-production

```dockerfile
FROM nginx:alpine AS vapp-production
```

최소 프로덕션 이미지:

1. **빌드 파일**: `COPY --from=vapp-builder /app/dist /usr/share/nginx/html`
2. **nginx 설정**: 커스텀 `vapp/nginx.conf`
3. **포트**: 80

**사용하는 서비스**: `vapp`

---

## docker-compose.yml: 서비스 구성

### 서비스 개요

| 서비스 | 타겟 스테이지 | 포트 | 프로필 | 설명 |
|--------|-------------|------|--------|------|
| `ganache` | (이미지) | 8545 | default | Ganache v7.9.1 로컬 블록체인 |
| `migrate` | `zkdex-base` | - | default | 컨트랙트 배포 (초기화, 1회 실행) |
| `zkdex` | `zkdex-base` | - | default | 컨트랙트 테스트 러너 (Truffle) |
| `vapp-api` | `zkdex-base` | 3000 | default | Express 백엔드 API |
| `vapp` | `vapp-production` | 8080 | default | 프로덕션 프론트엔드 (nginx) |
| `vapp-dev` | `vapp-development` | 8081 | dev | 개발 프론트엔드 (Vite 핫 리로드) |
| `zkdex-dev` | `zkdex-base` | - | dev | 인터랙티브 개발 셸 |
| `test-frontend` | `zkdex-base` | - | test | 프론트엔드 통합 테스트 러너 |
| `test-production` | `zkdex-base` | - | test | 프로덕션 (Groth16) 테스트 러너 |

### Ganache 설정

```yaml
image: trufflesuite/ganache:v7.9.1
command:
  - --networkId=5777
  - --accounts=10
  - --defaultBalanceEther=1000
  - --gasLimit=12000000
  - --mnemonic=candy maple cake sugar pudding cream honey rich smooth crumble sweet treat
```

- 재현 가능한 테스트 계정을 위한 결정적 니모닉
- 헬스 체크: 5초마다 HTTP 프로브, 최대 15회 재시도
- 블록체인 접근이 필요한 모든 서비스는 `depends_on: ganache: condition: service_healthy` 사용

### 네트워크

모든 서비스는 `zkdex-network` (bridge 드라이버)를 공유. 컨테이너 이름이 네트워크 내에서 호스트명으로 해석됩니다 (예: `ganache:8545`).

### 프로필

- **default** (프로필 없음): `ganache`, `migrate`, `zkdex`, `vapp-api`, `vapp`
- **dev**: `vapp-dev`, `zkdex-dev`
- **test**: `test-frontend`, `test-production`

---

## nginx 설정

`vapp/nginx.conf`는 프로덕션 프론트엔드를 설정합니다:

### COOP/COEP 헤더

```nginx
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
```

snarkjs Web Worker가 브라우저 측 ZK 증명 생성에 사용하는 `SharedArrayBuffer`에 필요합니다. 이 헤더 없이는 `snarkjs.groth16.fullProve()`가 브라우저에서 실패합니다.

### SPA 라우팅

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Vue Router history 모드는 모든 경로가 `index.html`로 폴백되어야 합니다.

### 회로 파일

```nginx
location /circuits/ {
    types {
        application/wasm wasm;
        application/octet-stream zkey;
    }
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

- 회로 파일을 위한 WASM MIME 타입
- 1년 캐시 (파일은 내용 해시 기반으로 불변)
- COOP/COEP 헤더도 여기에 적용

### Gzip 압축

`text/plain`, `text/css`, `application/json`, `application/javascript`, `text/xml`, `application/xml`, `application/wasm`에 대해 활성화.

---

## .dockerignore

빌드 컨텍스트 크기를 줄이기 위한 주요 제외 항목:

| 패턴 | 이유 |
|------|------|
| `node_modules` | 컨테이너 내에서 재설치 |
| `circuits-circom/ptau/` | 대용량 파일 (~400MB–4.5GB), 빌드 중 다운로드 |
| `circuits-circom/build/*_0000.zkey` | 중간 ceremony 파일 |
| `*.md` (`README.md` 제외) | 빌드 시 불필요한 문서 |
| `Dockerfile`, `docker-compose.yml`, `.dockerignore` | 자기 참조 파일 |
| `circuits/` | 이전 ZoKrates 회로 (Circom으로 대체됨) |
| `test/debug-*.js` | 미설치 의존성의 디버그 스크립트 |

참고: `circuits-circom/build`는 제외되지 **않습니다** — 사전 빌드된 회로 아티팩트(`.zkey`, `.wasm`)가 있으면 의도적으로 포함됩니다. 이를 통해 조건부 빌드가 가능합니다: 로컬에 아티팩트가 있으면 Docker는 회로 컴파일을 건너뜁니다.

---

## 빌드 과정

### 최초 빌드 (사전 빌드된 회로 없음)

```bash
docker compose build zkdex
```

1. **circom-builder** (~5분): Circom을 Rust에서 클론 및 컴파일
2. **zkdex-base** (~20–30분):
   - npm install (루트 + circuits-circom)
   - 6개 Circom 회로 컴파일
   - pot20 다운로드 (~400MB, Google Storage)
   - Trusted setup (각 회로에 대해 zkey 생성)
   - Solidity 검증자 생성
   - Truffle로 Solidity 컨트랙트 컴파일

### 최초 빌드 (사전 빌드된 회로 있음)

`circuits-circom/build/`에 사전 빌드된 `.zkey` 및 `.wasm` 파일이 있는 경우:

```bash
docker compose build zkdex
```

1. **circom-builder** (~5분): 동일
2. **zkdex-base** (~3분): 기존 `.zkey` 파일 감지, 회로 컴파일 건너뜀. `npx truffle compile`만 실행.

### 프론트엔드 빌드

```bash
docker compose build vapp
```

`zkdex-base` 빌드 이후:

1. **vapp-development** (~2분): npm ci, ABI 및 회로 파일 복사
2. **vapp-builder** (~1분): TypeScript + Vite 프로덕션 빌드 (814개 모듈)
3. **vapp-production**: dist를 nginx로 복사 (최소 이미지)

### 모든 서비스 빌드

```bash
docker compose build
```

모든 기본 프로필 이미지를 빌드합니다. 동일한 `target`을 공유하는 서비스(예: `zkdex`와 `vapp-api` 모두 `zkdex-base` 타겟)는 Docker 레이어 캐시를 공유합니다.

---

## 테스트

### 컨트랙트 테스트

```bash
# 모든 컨트랙트 테스트 실행 (19개)
docker compose run --rm zkdex
```

실행되는 테스트: `test/ZkDex.groth16.test.js` + `test/ZkDex.production.test.js`

범위:
- 컨트랙트 배포 및 초기화
- 노트 민팅 (ETH/DAI)
- Groth16 증명을 통한 노트 전송
- 주문 생성, 체결, 정산 (E2E 거래 플로우)

**결과: 19/19 통과**

### 프론트엔드 통합 테스트

```bash
docker compose --profile test run --rm test-frontend
```

`test/frontend-integration.test.js` 실행 — 브라우저 없이 프론트엔드 API 레이어와 증명 생성을 테스트합니다.

### 프로덕션 테스트

```bash
docker compose --profile test run --rm test-production
```

Ganache에서 실제 Groth16 증명 검증으로 `test/ZkDex.production.test.js`를 실행합니다.

### 정리

```bash
docker compose down -v
```

모든 컨테이너, 네트워크, 네임드 볼륨을 제거합니다.

---

## 앱 실행

### 전체 스택 (프로덕션)

```bash
# ganache + 백엔드 API + 프론트엔드 (nginx) 시작
docker compose up ganache vapp-api vapp -d

# 프론트엔드: http://localhost:8080
# 백엔드 API: http://localhost:3000
# Ganache RPC: http://localhost:8545
```

### 전체 스택 (개발)

```bash
# Vite 핫 리로드로 시작
docker compose --profile dev up ganache vapp-api vapp-dev -d

# 프론트엔드: http://localhost:8081
# 백엔드 API: http://localhost:3000
```

개발 모드에서는 `./vapp/src`와 `./vapp/public`을 볼륨으로 마운트하여 실시간 편집이 가능합니다.

### 인터랙티브 개발 셸

```bash
docker compose --profile dev run zkdex-dev

# 컨테이너 내부:
npx truffle test
npx truffle console --network docker
node test/integration-test.js
```

### 개별 서비스

```bash
docker compose up ganache -d          # 블록체인만
docker compose up vapp-api -d         # 백엔드만 (ganache 필요)
docker compose up vapp -d             # 프론트엔드만 (vapp-api 필요)
```

---

## 설계 결정 사항

### 1. 통합 Dockerfile vs. 개별 Dockerfile

**결정**: 모든 서비스를 위한 named stage가 있는 단일 Dockerfile.

**근거**:
- 프론트엔드 스테이지(`vapp-development`, `vapp-builder`, `vapp-production`)가 `zkdex-base`의 아티팩트(컨트랙트 ABI, 회로 파일)에 의존
- `COPY --from=zkdex-base`로 볼륨 마운트나 별도 아티팩트 복사 불필요
- 모든 서비스가 동일한 빌드 컨텍스트를 공유하여 일관된 레이어 캐싱 가능
- 두 개 대신 하나의 Dockerfile만 유지보수

### 2. Docker에서 pot20 vs. pot22

**결정**: Docker에서 `PTAU_SIZE=20` (pot20, ~400MB).

**근거**:
- pot20은 ~1M 제약 조건까지 지원, 모든 6개 회로에 충분 (최대: `settle_order` 641K)
- pot22는 4.5GB — Docker 이미지 크기와 다운로드 시간에 부적합
- 로컬 개발에서는 `setup.sh`의 기본값으로 pot22 사용 가능

### 3. 조건부 회로 빌드

**결정**: 회로 컴파일 전 기존 `.zkey` 파일 확인.

**근거**:
- 회로 컴파일 + trusted setup이 가장 느린 부분 (~20분)
- 로컬에서 회로를 빌드한 개발자는 Docker에서 이 단계를 건너뛸 수 있음
- Docker만 사용하는 사용자도 처음부터 완전한 빌드 가능

### 4. 프론트엔드 --legacy-peer-deps

**결정**: vapp 의존성에 `npm ci --legacy-peer-deps` 사용.

**근거**:
- `@pinia/testing@1.0.3`이 `pinia@>=3.0.4`에 대한 peer dependency를 선언하지만, 프로젝트는 `pinia@2.3.1` 사용
- 테스트 전용 패키지의 느슨한 peer dep 불일치 — 기능적으로 호환
- npm 7+의 엄격한 peer dep 해석이 전체 설치를 차단

### 5. COOP/COEP 헤더

**결정**: `Cross-Origin-Opener-Policy: same-origin`과 `Cross-Origin-Embedder-Policy: require-corp`를 전역 적용.

**근거**:
- snarkjs가 멀티스레드 WASM 증명 생성에 `SharedArrayBuffer` 필요
- 브라우저가 `SharedArrayBuffer`를 활성화하려면 COOP과 COEP 헤더 모두 필요
- nginx (프로덕션)과 Vite 설정 (개발) 모두에 적용

### 6. 직접 API 호출 (리버스 프록시 없음)

**결정**: 프론트엔드가 백엔드를 `http://localhost:3000`으로 직접 호출.

**근거**:
- Express 백엔드(`vapp/app.cjs`)가 CORS 활성화
- 프론트엔드 axios 클라이언트가 `VITE_API_URL || 'http://127.0.0.1:3000'`을 base URL로 사용
- nginx `/api` 리버스 프록시 불필요 — 더 단순한 아키텍처
- Docker에서 브라우저는 호스트 매핑 포트(3000)를 통해 백엔드에 접근

### 7. 결정적 컨트랙트 주소 (빌드 시 마이그레이션)

**결정**: Docker 빌드 시 임시 Ganache에 `truffle migrate`를 실행하여 ABI JSON 파일에 컨트랙트 주소를 채움.

**근거**:
- 프론트엔드가 Vite 빌드 시 `build/contracts/ZkDex.json`을 임포트 — `npm run build` 전에 주소가 있어야 함
- Docker 빌드 타임에는 별도 컨테이너로 Ganache를 실행할 수 없으므로, 프로세스 내 임시 Ganache 사용
- 컨트랙트 주소는 결정적: 동일한 니모닉 + 새 체인 + 동일한 배포 순서 = 매번 동일한 주소
- 런타임에서 `migrate` 초기화 서비스가 Docker Ganache에 동일한 컨트랙트를 배포하여, 프론트엔드에 번들링된 것과 같은 주소를 생성
- 런타임 주소 주입이나 프론트엔드 코드 변경 불필요

### 8. 컨트랙트 배포 초기화 서비스 (migrate)

**결정**: Docker Compose `service_completed_successfully` 의존성을 사용하여 앱 시작 전 컨트랙트가 배포되도록 보장.

**근거**:
- 프론트엔드나 API가 사용하기 전에 컨트랙트가 Ganache에 배포되어야 함
- `migrate` 서비스가 `npx truffle migrate --network docker --reset`를 1회 실행 후 종료
- `vapp-api`와 `vapp`가 `depends_on: migrate: condition: service_completed_successfully`로 대기
- 이는 초기화 컨테이너의 표준 Docker Compose 패턴 — 엔트리포인트 스크립트에 마이그레이션을 임베드하는 것보다 깔끔

---

## 문제 해결

### 빌드 실패

**회로 컴파일이 "out of memory"로 실패**:
- Docker 메모리 제한 증가 (권장: 8GB+)
- `settle_order` 회로(641K 제약 조건)는 상당한 메모리 필요

**npm install이 peer dependency 오류로 실패**:
- 루트 패키지: `npm install` 사용 (strict 모드 없음)
- vapp 패키지: `npm ci --legacy-peer-deps` 사용

**TypeScript 컴파일이 vapp-builder에서 실패**:
- `/build/contracts/`에 컨트랙트 ABI가 있는지 확인 (`zkdex-base`의 `npx truffle compile`로 빌드)
- `COPY --from=zkdex-base /app/build/contracts/ /build/contracts/`가 있는지 확인

### 런타임 문제

**프론트엔드 로드되지만 증명 생성 실패**:
- 브라우저 DevTools로 COOP/COEP 헤더 확인 (Network 탭 → Response Headers)
- 회로 파일 서빙 확인: `curl http://localhost:8080/circuits/mint_burn_note/mint_burn_note.wasm`
- 브라우저 콘솔에서 `SharedArrayBuffer is not defined` 오류 확인

**백엔드 API가 502/connection refused 반환**:
- `vapp-api` 컨테이너 실행 중인지 확인: `docker compose ps`
- 로그 확인: `docker compose logs vapp-api`
- Ganache 상태 확인: `docker compose ps ganache`

**테스트가 "could not connect to server"로 실패**:
- Ganache 헬스 체크가 아직 준비되지 않았을 수 있음. `docker-compose.yml`에서 `start_period` 증가
- Ganache 로그 확인: `docker compose logs ganache`
