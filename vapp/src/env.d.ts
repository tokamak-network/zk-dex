/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Third-party module declarations for ZK libraries

declare module 'circomlibjs' {
  export interface BabyJub {
    p: bigint
    pm1d2: bigint
    F: {
      p: bigint
      toObject(x: unknown): bigint
      e(x: bigint | string): unknown
      neg(x: unknown): unknown
      add(x: unknown, y: unknown): unknown
      mul(x: unknown, y: unknown): unknown
      inv(x: unknown): unknown
      sqrt(x: unknown): unknown
      square(x: unknown): unknown
      isZero(x: unknown): boolean
    }
    Generator: [unknown, unknown]
    Base8: [unknown, unknown]
    order: bigint
    subOrder: bigint
    addPoint(p1: [unknown, unknown], p2: [unknown, unknown]): [unknown, unknown]
    mulPointEscalar(point: [unknown, unknown], scalar: bigint): [unknown, unknown]
    inCurve(p: [unknown, unknown]): boolean
    inSubgroup(p: [unknown, unknown]): boolean
    packPoint(p: [unknown, unknown]): Uint8Array
    unpackPoint(buff: Uint8Array): [unknown, unknown]
  }

  export function buildBabyjub(): Promise<BabyJub>
  export function buildPoseidon(): Promise<{
    F: unknown
    (inputs: unknown[]): Uint8Array
  }>
  export function buildPedersenHash(): Promise<{
    hash(msg: Uint8Array): [unknown, unknown]
    babyJub: BabyJub
  }>
  export function buildMimc7(): Promise<unknown>
  export function buildMimcSponge(): Promise<unknown>
  export function buildEddsa(): Promise<{
    prv2pub(prv: Uint8Array): [Uint8Array, Uint8Array]
    signPedersen(prv: Uint8Array, msg: Uint8Array): { R8: [unknown, unknown], S: bigint }
    signPoseidon(prv: Uint8Array, msg: Uint8Array): { R8: [unknown, unknown], S: bigint }
    verifyPedersen(msg: Uint8Array, sig: { R8: [unknown, unknown], S: bigint }, A: [Uint8Array, Uint8Array]): boolean
    verifyPoseidon(msg: Uint8Array, sig: { R8: [unknown, unknown], S: bigint }, A: [Uint8Array, Uint8Array]): boolean
    babyJub: BabyJub
    F: unknown
  }>
}

declare module 'snarkjs' {
  export interface Groth16Proof {
    pi_a: [string, string, string]
    pi_b: [[string, string], [string, string], [string, string]]
    pi_c: [string, string, string]
    protocol: string
    curve: string
  }

  export interface ProveResult {
    proof: Groth16Proof
    publicSignals: string[]
  }

  export interface VerificationKey {
    protocol: string
    curve: string
    nPublic: number
    vk_alpha_1: string[]
    vk_beta_2: string[][]
    vk_gamma_2: string[][]
    vk_delta_2: string[][]
    vk_alphabeta_12: string[][][]
    IC: string[][]
  }

  export const groth16: {
    prove(
      zkeyInput: string | ArrayBuffer | Uint8Array | { type: string; data: unknown },
      witnessInput: string | ArrayBuffer | Uint8Array | { type: string; data: unknown },
      logger?: { info: (msg: string) => void; debug: (msg: string) => void }
    ): Promise<ProveResult>

    verify(
      vkVerifier: VerificationKey,
      publicSignals: string[],
      proof: Groth16Proof
    ): Promise<boolean>

    fullProve(
      input: Record<string, string | string[]>,
      wasmFile: string | ArrayBuffer | Uint8Array,
      zkeyFile: string | ArrayBuffer | Uint8Array,
      logger?: { info: (msg: string) => void; debug: (msg: string) => void }
    ): Promise<ProveResult>

    exportSolidityCallData(
      proof: Groth16Proof,
      publicSignals: string[]
    ): Promise<string>
  }

  export const wtns: {
    calculate(
      input: Record<string, string | string[]>,
      wasmInput: string | ArrayBuffer | Uint8Array,
      wtnsOutput: { type: string; data?: Uint8Array },
      options?: { sanityCheck?: boolean }
    ): Promise<void>
  }

  export const zKey: {
    exportVerificationKey(zkeyFileName: string | ArrayBuffer | Uint8Array): Promise<VerificationKey>
  }
}
