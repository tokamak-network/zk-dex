/**
 * Circuit Loader with IndexedDB Caching
 *
 * Handles fetching, caching, and version management of circuit files (wasm, zkey).
 * Uses IndexedDB for persistent caching of large files.
 */

export type CircuitName =
  | 'mint_burn_note'
  | 'transfer_note'
  | 'make_order'
  | 'take_order'
  | 'settle_order'
  | 'convert_note'

export interface CircuitManifest {
  version: string
  circuits: {
    [key: string]: {
      wasm: string
      zkey: string
      wasmSize: number
      zkeySize: number
    }
  }
}

export interface ProgressCallback {
  (loaded: number, total: number, stage: string): void
}

const DB_NAME = 'zkdex-circuits'
const DB_VERSION = 1
const STORE_NAME = 'circuit-files'

/**
 * Circuit Loader Service
 */
class CircuitLoaderService {
  private db: IDBDatabase | null = null
  private manifestCache: CircuitManifest | null = null

  /**
   * Open IndexedDB connection
   */
  private async openDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' })
        }
      }
    })
  }

  /**
   * Get cached file from IndexedDB
   */
  private async getCached(key: string): Promise<ArrayBuffer | null> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onerror = () => reject(new Error('Failed to read from cache'))
      request.onsuccess = () => {
        const result = request.result
        resolve(result?.data || null)
      }
    })
  }

  /**
   * Store file in IndexedDB cache
   */
  private async setCached(key: string, data: ArrayBuffer, version: string): Promise<void> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({ key, data, version, timestamp: Date.now() })

      request.onerror = () => reject(new Error('Failed to write to cache'))
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Get cached version info
   */
  private async getCachedVersion(circuitName: string): Promise<string | null> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(`${circuitName}_version`)

      request.onerror = () => reject(new Error('Failed to read version'))
      request.onsuccess = () => {
        const result = request.result
        resolve(result?.version || null)
      }
    })
  }

  /**
   * Set cached version info
   */
  private async setCachedVersion(circuitName: string, version: string): Promise<void> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({ key: `${circuitName}_version`, version, timestamp: Date.now() })

      request.onerror = () => reject(new Error('Failed to write version'))
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Fetch manifest file
   */
  async getManifest(): Promise<CircuitManifest> {
    if (this.manifestCache) {
      return this.manifestCache
    }

    try {
      const response = await fetch('/circuits/manifest.json')
      if (!response.ok) {
        // Return default manifest if not found
        return this.getDefaultManifest()
      }
      this.manifestCache = await response.json()
      return this.manifestCache!
    } catch {
      return this.getDefaultManifest()
    }
  }

  /**
   * Default manifest when no manifest file exists
   */
  private getDefaultManifest(): CircuitManifest {
    return {
      version: '2.0.0',
      circuits: {
        mint_burn_note: {
          wasm: '/circuits/mint_burn_note/mint_burn_note.wasm',
          zkey: '/circuits/mint_burn_note/mint_burn_note.zkey',
          wasmSize: 942 * 1024,
          zkeySize: 86 * 1024 * 1024
        },
        transfer_note: {
          wasm: '/circuits/transfer_note/transfer_note.wasm',
          zkey: '/circuits/transfer_note/transfer_note.zkey',
          wasmSize: 2 * 1024 * 1024,
          zkeySize: 255 * 1024 * 1024
        },
        make_order: {
          wasm: '/circuits/make_order/make_order.wasm',
          zkey: '/circuits/make_order/make_order.zkey',
          wasmSize: 500 * 1024,
          zkeySize: 65 * 1024 * 1024
        },
        take_order: {
          wasm: '/circuits/take_order/take_order.wasm',
          zkey: '/circuits/take_order/take_order.zkey',
          wasmSize: 1 * 1024 * 1024,
          zkeySize: 128 * 1024 * 1024
        },
        settle_order: {
          wasm: '/circuits/settle_order/settle_order.wasm',
          zkey: '/circuits/settle_order/settle_order.zkey',
          wasmSize: 2 * 1024 * 1024,
          zkeySize: 341 * 1024 * 1024
        },
        convert_note: {
          wasm: '/circuits/convert_note/convert_note.wasm',
          zkey: '/circuits/convert_note/convert_note.zkey',
          wasmSize: 1.5 * 1024 * 1024,
          zkeySize: 198 * 1024 * 1024
        }
      }
    }
  }

  /**
   * Fetch file with progress reporting
   */
  private async fetchWithProgress(
    url: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<ArrayBuffer> {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`)
    }

    const contentLength = response.headers.get('content-length')
    const total = contentLength ? parseInt(contentLength, 10) : 0

    if (!response.body || !total) {
      return response.arrayBuffer()
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let loaded = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      loaded += value.length
      onProgress?.(loaded, total)
    }

    const result = new Uint8Array(loaded)
    let position = 0
    for (const chunk of chunks) {
      result.set(chunk, position)
      position += chunk.length
    }

    return result.buffer
  }

  /**
   * Load circuit files (from cache or network)
   */
  async loadCircuit(
    circuitName: CircuitName,
    onProgress?: ProgressCallback
  ): Promise<{ wasm: ArrayBuffer; zkey: ArrayBuffer }> {
    const manifest = await this.getManifest()
    const circuitInfo = manifest.circuits[circuitName]

    if (!circuitInfo) {
      throw new Error(`Unknown circuit: ${circuitName}`)
    }

    // Check if cache is valid
    const cachedVersion = await this.getCachedVersion(circuitName)
    const cacheValid = cachedVersion === manifest.version

    let wasm: ArrayBuffer | null = null
    let zkey: ArrayBuffer | null = null

    if (cacheValid) {
      wasm = await this.getCached(`${circuitName}_wasm`)
      zkey = await this.getCached(`${circuitName}_zkey`)
    }

    const totalSize = circuitInfo.wasmSize + circuitInfo.zkeySize
    let loadedTotal = 0

    // Load wasm if not cached
    if (!wasm) {
      onProgress?.(0, totalSize, 'wasm')
      wasm = await this.fetchWithProgress(circuitInfo.wasm, (loaded) => {
        loadedTotal = loaded
        onProgress?.(loadedTotal, totalSize, 'wasm')
      })
      await this.setCached(`${circuitName}_wasm`, wasm, manifest.version)
    } else {
      loadedTotal = circuitInfo.wasmSize
      onProgress?.(loadedTotal, totalSize, 'wasm (cached)')
    }

    // Load zkey if not cached
    if (!zkey) {
      const wasmLoaded = loadedTotal
      onProgress?.(loadedTotal, totalSize, 'zkey')
      zkey = await this.fetchWithProgress(circuitInfo.zkey, (loaded) => {
        loadedTotal = wasmLoaded + loaded
        onProgress?.(loadedTotal, totalSize, 'zkey')
      })
      await this.setCached(`${circuitName}_zkey`, zkey, manifest.version)
    } else {
      loadedTotal = totalSize
      onProgress?.(loadedTotal, totalSize, 'zkey (cached)')
    }

    // Update version cache
    await this.setCachedVersion(circuitName, manifest.version)

    return { wasm, zkey }
  }

  /**
   * Preload a circuit into cache
   */
  async preload(circuitName: CircuitName, onProgress?: ProgressCallback): Promise<void> {
    await this.loadCircuit(circuitName, onProgress)
  }

  /**
   * Preload multiple circuits
   */
  async preloadAll(circuits: CircuitName[], onProgress?: (circuit: string, progress: number) => void): Promise<void> {
    for (const circuit of circuits) {
      onProgress?.(circuit, 0)
      await this.preload(circuit)
      onProgress?.(circuit, 1)
    }
  }

  /**
   * Check if circuit is cached
   */
  async isCached(circuitName: CircuitName): Promise<boolean> {
    const manifest = await this.getManifest()
    const cachedVersion = await this.getCachedVersion(circuitName)

    if (cachedVersion !== manifest.version) {
      return false
    }

    const wasm = await this.getCached(`${circuitName}_wasm`)
    const zkey = await this.getCached(`${circuitName}_zkey`)

    return wasm !== null && zkey !== null
  }

  /**
   * Get cache status for all circuits
   */
  async getCacheStatus(): Promise<{ [key: string]: boolean }> {
    const circuits: CircuitName[] = [
      'mint_burn_note',
      'transfer_note',
      'make_order',
      'take_order',
      'settle_order',
      'convert_note'
    ]

    const status: { [key: string]: boolean } = {}

    for (const circuit of circuits) {
      status[circuit] = await this.isCached(circuit)
    }

    return status
  }

  /**
   * Clear all cached circuit files
   */
  async clearCache(): Promise<void> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onerror = () => reject(new Error('Failed to clear cache'))
      request.onsuccess = () => resolve()
    })
  }

  /**
   * Get estimated cache size
   */
  async getCacheSize(): Promise<number> {
    const db = await this.openDB()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.openCursor()

      let totalSize = 0

      request.onerror = () => reject(new Error('Failed to calculate cache size'))
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (cursor) {
          const data = cursor.value?.data
          if (data instanceof ArrayBuffer) {
            totalSize += data.byteLength
          }
          cursor.continue()
        } else {
          resolve(totalSize)
        }
      }
    })
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// Export singleton instance
export const circuitLoader = new CircuitLoaderService()

// Export class for testing
export { CircuitLoaderService }
