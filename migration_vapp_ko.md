# vapp Vue 3 마이그레이션 가이드

## 개요

이 문서는 `vapp` 프론트엔드 애플리케이션을 Vue 2에서 Vue 3로 마이그레이션한 내용을 설명합니다.

### 마이그레이션 요약

| 구성 요소 | 이전 | 이후 |
|-----------|--------|-------|
| Vue | 2.6.10 | 3.4.21 |
| 상태 관리 | Vuex 3 | Pinia 2.1.7 |
| UI 라이브러리 | Buefy 0.8.2 | Oruga UI 0.8.12 + Bulma |
| 빌드 도구 | Vue CLI 3.9.0 | Vite 5.1.5 |
| 언어 | JavaScript | TypeScript 5.4.2 |
| Web3 라이브러리 | web3.js 1.0.0-beta.37 | ethers.js 6.11.1 |
| CSS 전처리기 | node-sass | sass (dart-sass) 1.71.1 |
| 라우터 | Vue Router 3 | Vue Router 4.3.0 |

## 파일 구조 변경

### 새로 생성된 파일

```
vapp/
├── vite.config.ts          # Vite 설정
├── tsconfig.json           # TypeScript 설정
├── tsconfig.node.json      # Node TypeScript 설정
├── index.html              # Vite 진입 HTML (public/에서 이동)
├── src/
│   ├── main.ts             # 새 진입점 (main.js 대체)
│   ├── env.d.ts            # TypeScript 환경 선언
│   ├── stores/             # Pinia 스토어 (store/ 대체)
│   │   ├── index.ts
│   │   ├── account.ts
│   │   ├── contract.ts
│   │   ├── note.ts
│   │   ├── order.ts
│   │   └── web3.ts
│   ├── api/
│   │   └── index.ts        # 타입이 지정된 API 모듈
│   ├── composables/
│   │   └── useFormatters.ts  # Vue 2 필터 대체
│   └── router/
│       └── index.ts        # Vue Router 4 설정
```

### 삭제된 파일

```
vapp/
├── src/
│   ├── main.js             # main.ts로 대체
│   ├── store/              # stores/ (Pinia)로 대체
│   │   ├── index.js
│   │   ├── state.js
│   │   ├── mutations.js
│   │   ├── actions.js
│   │   └── getters.js
│   ├── filters/            # composables로 대체
│   │   └── index.js
│   └── router/
│       └── index.js        # index.ts로 대체
├── babel.config.js         # Vite에서 불필요
└── vue.config.js           # vite.config.ts로 대체
```

## 주요 마이그레이션 변경 사항

### 1. 진입점 (main.ts)

**이전 (Vue 2):**
```javascript
import Vue from 'vue'
import Vuex from 'vuex'
import Buefy from 'buefy'
import App from './App.vue'
import router from './router'
import store from './store'

Vue.use(Vuex)
Vue.use(Buefy)

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
```

**이후 (Vue 3):**
```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Oruga from '@oruga-ui/oruga-next'
import { bulmaConfig } from '@oruga-ui/theme-bulma'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Oruga, bulmaConfig)
app.mount('#app')
```

### 2. 컴포넌트 문법 (Script Setup)

**이전 (Options API):**
```javascript
<script>
import { mapState, mapMutations } from 'vuex'

export default {
  data() {
    return {
      loading: false
    }
  },
  computed: {
    ...mapState(['accounts', 'notes'])
  },
  created() {
    this.loadData()
  },
  methods: {
    ...mapMutations(['SET_ACCOUNTS']),
    async loadData() {
      // ...
    }
  }
}
</script>
```

**이후 (Composition API + Script Setup):**
```typescript
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import { useNoteStore } from '@/stores/note'

const accountStore = useAccountStore()
const noteStore = useNoteStore()

const loading = ref(false)

onMounted(async () => {
  await loadData()
})

async function loadData() {
  // ...
}
</script>
```

### 3. 상태 관리 (Vuex → Pinia)

**이전 (Vuex):**
```javascript
// store/index.js
export default new Vuex.Store({
  state: {
    accounts: null,
    notes: null
  },
  mutations: {
    SET_ACCOUNTS(state, accounts) {
      state.accounts = accounts
    }
  },
  actions: {
    async loadAccounts({ commit }) {
      const accounts = await api.getAccounts()
      commit('SET_ACCOUNTS', accounts)
    }
  },
  getters: {
    validNotes: state => state.notes?.filter(n => n.state === '0x1')
  }
})
```

**이후 (Pinia):**
```typescript
// stores/account.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '@/api'

export interface Account {
  address: string
  publicKey: string
}

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<Account[]>([])

  const accountCount = computed(() => accounts.value.length)

  async function loadAccounts() {
    const data = await api.getAccounts(key.value!)
    accounts.value = data || []
  }

  function reset() {
    accounts.value = []
  }

  return { accounts, accountCount, loadAccounts, reset }
})
```

### 4. 필터 → Composables

**이전 (Vue 2 필터):**
```javascript
// filters/index.js
Vue.filter('abbreviate', (value) => {
  if (!value) return ''
  return value.slice(0, 6) + '...' + value.slice(-4)
})

// 템플릿에서 사용
{{ address | abbreviate }}
```

**이후 (Composable):**
```typescript
// composables/useFormatters.ts
export function useFormatters() {
  function abbreviate(value: string): string {
    if (!value) return ''
    return value.slice(0, 6) + '...' + value.slice(-4)
  }

  return { abbreviate }
}

// 컴포넌트에서 사용
const fmt = useFormatters()

// 템플릿에서 사용
{{ fmt.abbreviate(address) }}
```

### 5. 이벤트 버스 → Props/Emits 또는 Pinia

**이전 (이벤트 버스):**
```javascript
// 부모에서
this.$bus.$emit('select-note', note)

// 자식에서
created() {
  this.$bus.$on('select-note', this.handleNote)
},
beforeDestroy() {
  this.$bus.$off('select-note')
}
```

**이후 (Emits/Props):**
```typescript
// 자식 컴포넌트에서
const emit = defineEmits<{
  selectNote: [note: Note]
}>()

// 이벤트 발생
emit('selectNote', note)

// 부모 템플릿에서
<ChildComponent @selectNote="handleNote" />
```

### 6. UI 컴포넌트 (Buefy → Oruga)

| Buefy | Oruga |
|-------|-------|
| `<b-field>` | `<o-field>` |
| `<b-input>` | `<o-input>` |
| `<b-button>` | `<o-button>` |
| `<b-modal>` | `<o-modal>` |
| `<b-table>` | `<o-table>` |
| `<b-tabs>` | `<o-tabs>` |
| `<b-radio>` | `<o-radio>` |
| `<b-switch>` | `<o-switch>` |
| `<b-select>` | `<o-select>` |

### 7. Web3 라이브러리 (web3.js → ethers.js)

**이전 (web3.js):**
```javascript
import Web3 from 'web3'

const web3 = new Web3(window.ethereum)
const accounts = await web3.eth.getAccounts()
const balance = await web3.eth.getBalance(account)
```

**이후 (ethers.js):**
```typescript
import { BrowserProvider } from 'ethers'

const provider = new BrowserProvider(window.ethereum)
const accounts = await provider.send('eth_requestAccounts', [])
const balance = await provider.getBalance(account)
```

## 빌드 명령어

```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 타입 검사
npm run type-check

# 프로덕션 빌드 미리보기
npm run preview

# Express 백엔드 시작
npm run server
```

## 알려진 이슈 및 참고 사항

1. **청크 크기 경고**: 프로덕션 빌드에서 청크 크기(>500 kB) 경고가 표시됩니다. 프로덕션 최적화를 위해 코드 분할 구현을 고려하세요.

2. **Sass 지원 중단 경고**: Sass의 레거시 JS API 경고는 `sass-embedded`로 업그레이드하거나 Vite의 sass 옵션을 설정하여 해결할 수 있습니다.

3. **백엔드 서버**: Express 백엔드(`app.js` 및 `router/` 디렉토리)는 수정되지 않았으며 이전과 동일하게 작동합니다.

## 테스트 체크리스트

- [ ] MetaMask 연결
- [ ] 계정 가져오기/내보내기/삭제
- [ ] 노트 발행(mint) 및 청산(liquidate)
- [ ] 노트 전송
- [ ] 노트 결합
- [ ] 주문 생성 (make order)
- [ ] 주문 수락 (take order)
- [ ] 주문 정산
- [ ] 주문 내역 표시

## 의존성

### 프로덕션 의존성
```json
{
  "@oruga-ui/oruga-next": "^0.8.12",
  "@oruga-ui/theme-bulma": "^0.3.0",
  "axios": "^1.6.7",
  "bulma": "^0.9.4",
  "ethers": "^6.11.1",
  "pinia": "^2.1.7",
  "vue": "^3.4.21",
  "vue-router": "^4.3.0"
}
```

### 개발 의존성
```json
{
  "@vitejs/plugin-vue": "^5.0.4",
  "sass": "^1.71.1",
  "typescript": "^5.4.2",
  "vite": "^5.1.5",
  "vue-tsc": "^2.0.6"
}
```

## 마이그레이션 진행 단계

1. **Phase 1**: package.json 의존성 업데이트, Vite + TypeScript 설정 파일 생성
2. **Phase 2**: main.ts + App.vue + router 마이그레이션
3. **Phase 3**: Vuex → Pinia 스토어 마이그레이션 (5개 스토어)
4. **Phase 4**: 컴포넌트 마이그레이션 (17개) + 뷰 마이그레이션 (16개)
5. **Phase 5**: API + composables 마이그레이션
6. **Phase 6**: 빌드 테스트 및 검증
