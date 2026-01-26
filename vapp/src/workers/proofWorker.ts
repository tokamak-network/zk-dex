/**
 * Web Worker for ZK proof generation
 *
 * This worker runs snarkjs.groth16.fullProve in a separate thread
 * to avoid blocking the main UI thread during proof generation.
 *
 * SECURITY: Secret key stays in browser memory, never sent to server
 */

// Import snarkjs (use dynamic import for browser compatibility)
let snarkjs: typeof import('snarkjs') | null = null

/**
 * Message types for worker communication
 */
export interface WorkerMessage {
  type: 'generateProof' | 'preload' | 'clearCache'
  id: string
  data?: {
    circuitName: string
    inputs: Record<string, string>
    wasmUrl?: string
    zkeyUrl?: string
  }
}

export interface WorkerResponse {
  type: 'success' | 'error' | 'progress'
  id: string
  data?: {
    proof?: FormattedProof
    publicSignals?: string[]
    progress?: number
    message?: string
  }
  error?: string
}

export interface FormattedProof {
  a: [string, string]
  b: [[string, string], [string, string]]
  c: [string, string]
  input: string[]
}

// Circuit file cache (in worker memory)
const circuitCache: Map<string, { wasm: ArrayBuffer; zkey: ArrayBuffer }> = new Map()

/**
 * Initialize snarkjs
 */
async function initSnarkjs(): Promise<void> {
  if (!snarkjs) {
    snarkjs = await import('snarkjs')
  }
}

/**
 * Fetch circuit file with progress reporting
 */
async function fetchCircuitFile(url: string, onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!response.body) {
    return response.arrayBuffer()
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    chunks.push(value)
    received += value.length

    if (total > 0 && onProgress) {
      onProgress(received / total)
    }
  }

  // Combine chunks
  const combined = new Uint8Array(received)
  let position = 0
  for (const chunk of chunks) {
    combined.set(chunk, position)
    position += chunk.length
  }

  return combined.buffer
}

/**
 * Load circuit files (wasm and zkey)
 */
async function loadCircuit(
  circuitName: string,
  wasmUrl: string,
  zkeyUrl: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ wasm: ArrayBuffer; zkey: ArrayBuffer }> {
  // Check cache first
  const cached = circuitCache.get(circuitName)
  if (cached) {
    return cached
  }

  // Fetch wasm file
  onProgress?.('wasm', 0)
  const wasm = await fetchCircuitFile(wasmUrl, (p) => onProgress?.('wasm', p))
  onProgress?.('wasm', 1)

  // Fetch zkey file
  onProgress?.('zkey', 0)
  const zkey = await fetchCircuitFile(zkeyUrl, (p) => onProgress?.('zkey', p))
  onProgress?.('zkey', 1)

  // Cache the files
  const files = { wasm, zkey }
  circuitCache.set(circuitName, files)

  return files
}

/**
 * Convert BigInt-containing object to strings for JSON serialization
 */
function stringifyBigInts(obj: unknown): unknown {
  if (typeof obj === 'bigint') {
    return obj.toString()
  }
  if (Array.isArray(obj)) {
    return obj.map(stringifyBigInts)
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {}
    for (const key in obj) {
      result[key] = stringifyBigInts((obj as Record<string, unknown>)[key])
    }
    return result
  }
  return obj
}

/**
 * Format proof for smart contract call (Groth16 format)
 */
function formatProofForContract(
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] },
  publicSignals: string[]
): FormattedProof {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]], // Note: snarkjs outputs b in different order
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    c: [proof.pi_c[0], proof.pi_c[1]],
    input: publicSignals
  }
}

/**
 * Generate proof
 */
async function generateProof(
  circuitName: string,
  inputs: Record<string, string>,
  wasmUrl: string,
  zkeyUrl: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<{ proof: FormattedProof; publicSignals: string[] }> {
  await initSnarkjs()

  if (!snarkjs) {
    throw new Error('snarkjs not initialized')
  }

  // Load circuit files
  onProgress?.('loading', 0)
  const { wasm, zkey } = await loadCircuit(circuitName, wasmUrl, zkeyUrl, onProgress)
  onProgress?.('loading', 1)

  // Generate proof
  onProgress?.('proving', 0)
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    stringifyBigInts(inputs) as Record<string, string>,
    new Uint8Array(wasm),
    new Uint8Array(zkey)
  )
  onProgress?.('proving', 1)

  return {
    proof: formatProofForContract(proof, publicSignals),
    publicSignals
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, data } = event.data

  try {
    switch (type) {
      case 'generateProof': {
        if (!data) {
          throw new Error('Missing data for generateProof')
        }

        const baseUrl = '/circuits'
        const wasmUrl = data.wasmUrl || `${baseUrl}/${data.circuitName}/${data.circuitName}.wasm`
        const zkeyUrl = data.zkeyUrl || `${baseUrl}/${data.circuitName}/${data.circuitName}.zkey`

        const result = await generateProof(
          data.circuitName,
          data.inputs,
          wasmUrl,
          zkeyUrl,
          (stage, progress) => {
            const response: WorkerResponse = {
              type: 'progress',
              id,
              data: {
                progress,
                message: `${stage}: ${Math.round(progress * 100)}%`
              }
            }
            self.postMessage(response)
          }
        )

        const response: WorkerResponse = {
          type: 'success',
          id,
          data: {
            proof: result.proof,
            publicSignals: result.publicSignals
          }
        }
        self.postMessage(response)
        break
      }

      case 'preload': {
        if (!data) {
          throw new Error('Missing data for preload')
        }

        const baseUrl = '/circuits'
        const wasmUrl = data.wasmUrl || `${baseUrl}/${data.circuitName}/${data.circuitName}.wasm`
        const zkeyUrl = data.zkeyUrl || `${baseUrl}/${data.circuitName}/${data.circuitName}.zkey`

        await loadCircuit(
          data.circuitName,
          wasmUrl,
          zkeyUrl,
          (stage, progress) => {
            const response: WorkerResponse = {
              type: 'progress',
              id,
              data: {
                progress,
                message: `Preloading ${stage}: ${Math.round(progress * 100)}%`
              }
            }
            self.postMessage(response)
          }
        )

        const response: WorkerResponse = {
          type: 'success',
          id,
          data: { message: 'Circuit preloaded successfully' }
        }
        self.postMessage(response)
        break
      }

      case 'clearCache': {
        circuitCache.clear()
        const response: WorkerResponse = {
          type: 'success',
          id,
          data: { message: 'Cache cleared' }
        }
        self.postMessage(response)
        break
      }

      default:
        throw new Error(`Unknown message type: ${type}`)
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error)
    }
    self.postMessage(response)
  }
}

// Signal that worker is ready
self.postMessage({ type: 'ready' })
