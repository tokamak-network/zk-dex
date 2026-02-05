/**
 * Proof Generator Service
 *
 * Manages Web Worker for ZK proof generation.
 * Secret keys stay in browser memory, never sent to server.
 */

import type { WorkerMessage, WorkerResponse, FormattedProof } from '@/workers/proofWorker'
import { logger } from '@/lib/logger'

export type { FormattedProof }

export type CircuitName =
  | 'mint_burn_note'
  | 'transfer_note'
  | 'make_order'
  | 'take_order'
  | 'settle_order'
  | 'convert_note'
  | 'create_timelock'
  | 'spend_timelock'

export interface ProgressCallback {
  (stage: string, progress: number, message?: string): void
}

export interface ProofResult {
  proof: FormattedProof
  publicSignals: string[]
}

/**
 * Proof Generator Service
 * Singleton that manages the Web Worker for proof generation
 */
class ProofGeneratorService {
  private worker: Worker | null = null
  private pendingRequests: Map<string, {
    resolve: (value: ProofResult) => void
    reject: (reason: Error) => void
    onProgress?: ProgressCallback
  }> = new Map()
  private requestId = 0
  private workerReady = false
  private readyPromise: Promise<void> | null = null

  /**
   * Initialize the Web Worker
   */
  private async initWorker(): Promise<void> {
    if (this.worker && this.workerReady) {
      return
    }

    if (this.readyPromise) {
      return this.readyPromise
    }

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        // Create worker using Vite's worker import syntax
        this.worker = new Worker(
          new URL('@/workers/proofWorker.ts', import.meta.url),
          { type: 'module' }
        )

        this.worker.onmessage = (event: MessageEvent<WorkerResponse | { type: 'ready' }>) => {
          const response = event.data

          if (response.type === 'ready') {
            this.workerReady = true
            resolve()
            return
          }

          const pending = this.pendingRequests.get(response.id)
          if (!pending) {
            logger.warn('Received response for unknown request:', response.id)
            return
          }

          switch (response.type) {
            case 'success':
              if (response.data?.proof && response.data?.publicSignals) {
                pending.resolve({
                  proof: response.data.proof,
                  publicSignals: response.data.publicSignals
                })
              } else {
                // For non-proof responses (like preload success)
                pending.resolve({
                  proof: response.data?.proof || {} as FormattedProof,
                  publicSignals: response.data?.publicSignals || []
                })
              }
              this.pendingRequests.delete(response.id)
              break

            case 'error':
              pending.reject(new Error(response.error || 'Unknown error'))
              this.pendingRequests.delete(response.id)
              break

            case 'progress':
              if (pending.onProgress && response.data) {
                pending.onProgress(
                  response.data.message?.split(':')[0] || 'unknown',
                  response.data.progress || 0,
                  response.data.message
                )
              }
              break
          }
        }

        this.worker.onerror = (error) => {
          logger.error('Worker error:', error)
          reject(new Error('Worker initialization failed'))
        }

        // Set a timeout for worker initialization
        setTimeout(() => {
          if (!this.workerReady) {
            reject(new Error('Worker initialization timeout'))
          }
        }, 10000)
      } catch (error) {
        reject(error)
      }
    })

    return this.readyPromise
  }

  /**
   * Recursively resolve any Promise values nested in an object.
   * Guards against accidentally passing unresolved async results to postMessage.
   */
  private async resolveDeep(obj: unknown): Promise<unknown> {
    if (obj instanceof Promise) {
      return this.resolveDeep(await obj)
    }
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(v => this.resolveDeep(v)))
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = await this.resolveDeep(value)
      }
      return result
    }
    return obj
  }

  /**
   * Send message to worker
   */
  private async sendMessage(message: Omit<WorkerMessage, 'id'>, onProgress?: ProgressCallback): Promise<ProofResult> {
    await this.initWorker()

    if (!this.worker) {
      throw new Error('Worker not initialized')
    }

    const id = `req_${++this.requestId}`

    // Resolve any nested Promises before posting (postMessage cannot clone Promises)
    const resolvedMessage = await this.resolveDeep(message) as Omit<WorkerMessage, 'id'>

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, onProgress })

      this.worker!.postMessage({
        ...resolvedMessage,
        id
      } as WorkerMessage)
    })
  }

  /**
   * Generate a ZK proof
   *
   * @param circuitName - Name of the circuit (e.g., 'mint_burn_note')
   * @param inputs - Circuit inputs as string values
   * @param onProgress - Optional progress callback
   * @returns Proof formatted for smart contract
   */
  async generateProof(
    circuitName: CircuitName,
    inputs: Record<string, string>,
    onProgress?: ProgressCallback
  ): Promise<ProofResult> {
    return this.sendMessage(
      {
        type: 'generateProof',
        data: {
          circuitName,
          inputs
        }
      },
      onProgress
    )
  }

  /**
   * Preload circuit files (for faster proof generation later)
   *
   * @param circuitName - Name of the circuit to preload
   * @param onProgress - Optional progress callback
   */
  async preloadCircuit(
    circuitName: CircuitName,
    onProgress?: ProgressCallback
  ): Promise<void> {
    await this.sendMessage(
      {
        type: 'preload',
        data: {
          circuitName,
          inputs: {}
        }
      },
      onProgress
    )
  }

  /**
   * Clear the circuit cache in the worker
   */
  async clearCache(): Promise<void> {
    await this.sendMessage({
      type: 'clearCache'
    })
  }

  /**
   * Terminate the worker (cleanup)
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.workerReady = false
      this.readyPromise = null
      this.pendingRequests.clear()
    }
  }
}

// Export singleton instance
export const proofGenerator = new ProofGeneratorService()

// Export class for testing or multiple instances
export { ProofGeneratorService }
