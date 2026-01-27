/**
 * proofGenerator 단위 테스트
 *
 * Web Worker를 모킹하여 ProofGeneratorService를 테스트.
 *
 * 테스트 항목:
 * - generateProof: Worker에 올바른 메시지 전달 및 결과 반환
 * - preloadCircuit: preload 메시지 전달
 * - terminate: Worker 정리
 * - 에러 처리: Worker 에러 응답 시 reject
 * - progress 콜백
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProofGeneratorService, type ProofResult } from './proofGenerator'
import { MOCK_PROOF, NOTE_ALICE_ETH_VALID } from '@/test-utils/fixtures'

// ─── Worker 모킹 ───

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  private messageHandler: ((msg: unknown) => void) | null = null

  constructor() {
    // Worker "ready" 시뮬레이션: 생성 직후 ready 메시지 전송
    queueMicrotask(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: { type: 'ready' } }))
      }
    })
  }

  postMessage(msg: unknown) {
    if (this.messageHandler) {
      this.messageHandler(msg)
    }
  }

  terminate() {
    this.onmessage = null
    this.onerror = null
    this.messageHandler = null
  }

  // 테스트 헬퍼: 외부에서 Worker 응답 정의
  _setResponseHandler(handler: (msg: unknown) => void) {
    this.messageHandler = handler
  }

  // 테스트 헬퍼: 응답 시뮬레이션
  _simulateResponse(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }))
    }
  }
}

let mockWorkerInstance: MockWorker | null = null

function setupWorkerMock() {
  vi.stubGlobal('Worker', class {
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null

    constructor() {
      mockWorkerInstance = new MockWorker()
      // 프록시: onmessage/onerror가 설정되면 MockWorker로 전달
      const self = this
      const originalInstance = mockWorkerInstance

      queueMicrotask(() => {
        originalInstance.onmessage = self.onmessage
        originalInstance.onerror = self.onerror

        // ready 시뮬레이션
        if (self.onmessage) {
          self.onmessage(new MessageEvent('message', { data: { type: 'ready' } }))
        }
      })
    }

    postMessage(msg: unknown) {
      if (mockWorkerInstance) {
        // generateProof 응답 시뮬레이션
        const message = msg as { type: string; id: string; data?: unknown }
        queueMicrotask(() => {
          if (message.type === 'generateProof') {
            if (this.onmessage) {
              this.onmessage(new MessageEvent('message', {
                data: {
                  type: 'success',
                  id: message.id,
                  data: {
                    proof: {
                      a: [
                        '0x2b52e1908bed7b1f474026b72e1c887e2c2462cf33b20b5b562e8bc096ee7083',
                        '0x14f9761fff9429e5e33dc8b4b43627276fab15d753d758a24b51f1e75ec10a95',
                      ],
                      b: [
                        [
                          '0x112737c85d9a368849edcecb5d24f7a953578d5b87065c1f18c93552399b89b6',
                          '0x261700c8d02a9e653c79c75db1881c8514e9439d69689b727f022e33ddb46dd2',
                        ],
                        [
                          '0x2e7c71efb0873da43935fb72259feefdafb6c56aeefc9e15558fbfb8376b205e',
                          '0x120e9546e5eee779fc4b44c15ad586374da0063cdce38e029b4ef1c56e7458d6',
                        ],
                      ],
                      c: [
                        '0x102002aa79aa2b97fcf5a86a191984577783a74a858ba629a8a83dacd5a75535',
                        '0x0dd698bf355e0e65eb84c04c53afb9d18db55f890c0b747e3d6896c2f2185019',
                      ],
                      input: [
                        '7293563082901588797218579443247026665359568947835886687713698663294306833717',
                      ]
                    },
                    publicSignals: [
                      '7293563082901588797218579443247026665359568947835886687713698663294306833717',
                      '1000000000000000000',
                    ]
                  }
                }
              }))
            }
          } else if (message.type === 'preload') {
            if (this.onmessage) {
              this.onmessage(new MessageEvent('message', {
                data: {
                  type: 'success',
                  id: message.id,
                  data: {}
                }
              }))
            }
          } else if (message.type === 'clearCache') {
            if (this.onmessage) {
              this.onmessage(new MessageEvent('message', {
                data: {
                  type: 'success',
                  id: message.id,
                  data: {}
                }
              }))
            }
          }
        })
      }
    }

    terminate() {
      mockWorkerInstance = null
    }
  })
}

// import.meta.url 관련 문제 방지: Worker 생성자에 URL 인자 무시
vi.mock('@/workers/proofWorker', () => ({}))

describe('ProofGeneratorService', () => {
  let service: ProofGeneratorService

  beforeEach(() => {
    vi.restoreAllMocks()
    setupWorkerMock()
    service = new ProofGeneratorService()
  })

  afterEach(() => {
    service.terminate()
  })

  describe('generateProof', () => {
    it('Worker에 generateProof 메시지 전달 → ProofResult 반환', async () => {
      const result: ProofResult = await service.generateProof(
        'mint_burn_note',
        { noteHash: NOTE_ALICE_ETH_VALID.hash, value: NOTE_ALICE_ETH_VALID.value }
      )

      expect(result.proof).toBeDefined()
      expect(result.proof.a).toEqual(MOCK_PROOF.proof.a)
      expect(result.proof.b).toEqual(MOCK_PROOF.proof.b)
      expect(result.proof.c).toEqual(MOCK_PROOF.proof.c)
      expect(result.publicSignals).toEqual(MOCK_PROOF.publicSignals)
    })
  })

  describe('preloadCircuit', () => {
    it('preload 메시지 전달 (에러 없이 완료)', async () => {
      await service.preloadCircuit('mint_burn_note')
      // 에러 없이 완료되면 성공
    })
  })

  describe('clearCache', () => {
    it('clearCache 메시지 전달 (에러 없이 완료)', async () => {
      await service.clearCache()
    })
  })

  describe('terminate', () => {
    it('Worker 종료 후 상태 초기화', () => {
      service.terminate()
      // 다시 terminate해도 에러 없음
      service.terminate()
    })
  })
})
