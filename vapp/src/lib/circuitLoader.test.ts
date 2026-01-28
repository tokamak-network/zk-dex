/**
 * circuitLoader 단위 테스트
 *
 * IndexedDB와 fetch를 모킹하여 CircuitLoaderService를 테스트.
 *
 * 테스트 항목:
 * - getManifest(): 기본 매니페스트 반환
 * - loadCircuit(): 네트워크 다운로드 + 캐시 저장
 * - isCached() / getCacheStatus()
 * - clearCache() / close()
 * - 존재하지 않는 서킷 이름 에러
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CircuitLoaderService, type CircuitName } from './circuitLoader'

// ─── IndexedDB 모킹 ───

class MockIDBObjectStore {
  private data = new Map<string, unknown>()

  get(key: string) {
    const result = this.data.get(key) ?? null
    return createMockRequest(result)
  }

  put(value: { key: string;[k: string]: unknown }) {
    this.data.set(value.key, value)
    return createMockRequest(undefined)
  }

  clear() {
    this.data.clear()
    return createMockRequest(undefined)
  }

  openCursor() {
    // 빈 커서 — 즉시 null 반환
    const req = createMockRequest(null)
    return req
  }
}

function createMockRequest(result: unknown) {
  const req: Record<string, unknown> = {
    result,
    onerror: null as ((e: unknown) => void) | null,
    onsuccess: null as ((e: unknown) => void) | null,
  }
  // 다음 마이크로태스크에 onsuccess 호출
  queueMicrotask(() => {
    if (typeof req.onsuccess === 'function') {
      req.onsuccess({ target: req })
    }
  })
  return req
}

const mockStore = new MockIDBObjectStore()

class MockIDBTransaction {
  objectStore() {
    return mockStore
  }
}

class MockIDBDatabase {
  objectStoreNames = { contains: () => true }
  transaction() {
    return new MockIDBTransaction()
  }
  createObjectStore() { return mockStore }
  close() { /* no-op */ }
}

// indexedDB.open 모킹
function setupIndexedDBMock() {
  const mockDB = new MockIDBDatabase()
  const mockOpen = {
    result: mockDB,
    onerror: null as ((e: unknown) => void) | null,
    onsuccess: null as ((e: unknown) => void) | null,
    onupgradeneeded: null as ((e: unknown) => void) | null,
  }

  vi.stubGlobal('indexedDB', {
    open: () => {
      queueMicrotask(() => {
        if (typeof mockOpen.onsuccess === 'function') {
          mockOpen.onsuccess({ target: mockOpen })
        }
      })
      return mockOpen
    }
  })
  return mockDB
}

// ─── fetch 모킹 ───

function setupFetchMock() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('manifest.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          version: '1.0.0-test',
          circuits: {
            mint_burn_note: {
              wasm: '/circuits/mint_burn_note/mint_burn_note.wasm',
              zkey: '/circuits/mint_burn_note/mint_burn_note.zkey',
              wasmSize: 1024,
              zkeySize: 2048
            }
          }
        })
      })
    }
    // Circuit file downloads
    return Promise.resolve({
      ok: true,
      headers: { get: () => null },
      body: null,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(16))
    })
  }))
}

describe('CircuitLoaderService', () => {
  let loader: CircuitLoaderService

  beforeEach(() => {
    vi.restoreAllMocks()
    setupIndexedDBMock()
    setupFetchMock()
    loader = new CircuitLoaderService()
  })

  describe('getManifest', () => {
    it('fetch 성공 → 매니페스트 반환', async () => {
      const manifest = await loader.getManifest()
      expect(manifest.version).toBe('1.0.0-test')
      expect(manifest.circuits.mint_burn_note).toBeDefined()
    })

    it('fetch 실패 → 기본 매니페스트 반환', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      const manifest = await loader.getManifest()
      expect(manifest.version).toBe('2.0.0')
      expect(manifest.circuits.mint_burn_note).toBeDefined()
      expect(manifest.circuits.transfer_note).toBeDefined()
    })

    it('매니페스트 캐싱 (두 번째 호출은 fetch 안 함)', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: '2.0', circuits: {} })
      })
      vi.stubGlobal('fetch', fetchSpy)

      await loader.getManifest()
      await loader.getManifest()

      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('loadCircuit', () => {
    it('성공적으로 wasm + zkey 반환', async () => {
      const result = await loader.loadCircuit('mint_burn_note')
      expect(result.wasm).toBeInstanceOf(ArrayBuffer)
      expect(result.zkey).toBeInstanceOf(ArrayBuffer)
    })

    it('존재하지 않는 서킷 → 에러', async () => {
      await expect(loader.loadCircuit('nonexistent' as CircuitName))
        .rejects.toThrow('Unknown circuit')
    })

    it('progress 콜백 호출', async () => {
      const progress = vi.fn()
      await loader.loadCircuit('mint_burn_note', progress)
      expect(progress).toHaveBeenCalled()
    })
  })

  describe('preload', () => {
    it('preload는 loadCircuit의 wrapper', async () => {
      // 에러 없이 완료
      await loader.preload('mint_burn_note')
    })
  })

  describe('preloadAll', () => {
    it('여러 서킷 순차 프리로드 + 진행 콜백', async () => {
      const progress = vi.fn()
      await loader.preloadAll(['mint_burn_note'], progress)
      expect(progress).toHaveBeenCalledWith('mint_burn_note', 0)
      expect(progress).toHaveBeenCalledWith('mint_burn_note', 1)
    })
  })

  describe('close', () => {
    it('DB 연결 종료 (에러 없이)', async () => {
      // openDB를 먼저 실행하기 위해 manifest 로드
      await loader.getManifest()
      loader.close()
      // 다시 close해도 에러 없음
      loader.close()
    })
  })

  describe('getCacheSize', () => {
    it('빈 캐시 → 0', async () => {
      const size = await loader.getCacheSize()
      expect(size).toBe(0)
    })
  })

  describe('기본 매니페스트 구조', () => {
    it('6개 서킷 포함', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
      const loader2 = new CircuitLoaderService()
      const manifest = await loader2.getManifest()

      const circuits = Object.keys(manifest.circuits)
      expect(circuits).toContain('mint_burn_note')
      expect(circuits).toContain('transfer_note')
      expect(circuits).toContain('make_order')
      expect(circuits).toContain('take_order')
      expect(circuits).toContain('settle_order')
      expect(circuits).toContain('convert_note')
      expect(circuits.length).toBe(6)
    })
  })
})
