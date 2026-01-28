/**
 * stores/note 단위 테스트
 *
 * Pinia 스토어를 실제 픽스처 데이터로 테스트.
 * 블록체인 의존 함수는 모킹하고, 순수 상태 관리 로직을 검증.
 *
 * 테스트 항목:
 * - 초기 상태
 * - setNotes / addNote / updateNoteState / setSelectedNote
 * - computed: validNotes, smartNotes, ethNotes, daiNotes
 * - numberOfNotesInAccount
 * - addNote 중복 방지
 * - reset
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNoteStore, type Note } from './note'
import {
  ALICE_ADDRESS, ALICE_PK, BOB_ADDRESS, CAROL_ADDRESS,
  NOTE_ALICE_ETH_VALID, NOTE_ALICE_DAI_VALID, NOTE_ALICE_ETH_SPENT,
  NOTE_ALICE_DAI_VALID_2, NOTE_ALICE_INVALID, NOTE_ALICE_SMART,
  NOTE_BOB_ETH_VALID,
} from '@/test-utils/fixtures'

// 의존 스토어 모킹
vi.mock('./account', () => ({
  useAccountStore: () => ({
    accounts: [],
    currentAccount: null,
    secretKey: null,
  })
}))

vi.mock('./contract', () => ({
  useContractStore: () => ({
    dexContract: null,
  })
}))

vi.mock('@/utils/noteEncryption', () => ({
  decodeNoteData: vi.fn(),
  isNoteOwner: vi.fn(),
}))

vi.mock('@/lib/ecdhCrypto', () => ({
  isECDHEncrypted: vi.fn(),
}))

vi.mock('@/lib/circuitInputs', () => ({
  computeCircuitHash: vi.fn().mockResolvedValue('12345'),
}))

vi.mock('@/api', () => ({
  getTransferNotes: vi.fn().mockResolvedValue([]),
}))

function createNote(overrides?: Partial<Note>): Note {
  return {
    hash: NOTE_ALICE_ETH_VALID.hashHex,
    owner: ALICE_ADDRESS,
    pkX: ALICE_PK.x,
    pkY: ALICE_PK.y,
    value: NOTE_ALICE_ETH_VALID.value,
    token: '0x0',
    state: '0x1', // VALID
    isSmart: '0x0',
    ...overrides,
  }
}

describe('stores/note', () => {
  let store: ReturnType<typeof useNoteStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useNoteStore()
  })

  describe('초기 상태', () => {
    it('notes = []', () => expect(store.notes).toEqual([]))
    it('transferNotes = []', () => expect(store.transferNotes).toEqual([]))
    it('selectedNote = null', () => expect(store.selectedNote).toBeNull())
    it('isScanning = false', () => expect(store.isScanning).toBe(false))
  })

  describe('setNotes', () => {
    it('노트 배열 설정', () => {
      const notes = [
        createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex }),
        createNote({ hash: NOTE_ALICE_DAI_VALID.hashHex }),
      ]
      store.setNotes(notes)
      expect(store.notes.length).toBe(2)
    })
  })

  describe('addNote', () => {
    it('새 노트 추가', () => {
      store.addNote(createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex }))
      expect(store.notes.length).toBe(1)
    })

    it('동일 hash 중복 방지', () => {
      store.addNote(createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex }))
      store.addNote(createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex }))
      expect(store.notes.length).toBe(1)
    })

    it('다른 hash는 추가', () => {
      store.addNote(createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex }))
      store.addNote(createNote({ hash: NOTE_ALICE_DAI_VALID.hashHex }))
      expect(store.notes.length).toBe(2)
    })
  })

  describe('updateNoteState', () => {
    it('존재하는 노트의 상태 업데이트', () => {
      store.addNote(createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex, state: '0x1' }))
      store.updateNoteState(NOTE_ALICE_ETH_VALID.hashHex, '0x3')
      expect(store.notes[0].state).toBe('0x3')
    })

    it('존재하지 않는 노트는 무시', () => {
      store.addNote(createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex, state: '0x1' }))
      store.updateNoteState(NOTE_BOB_ETH_VALID.hashHex, '0x3')
      expect(store.notes[0].state).toBe('0x1')
    })
  })

  describe('setSelectedNote', () => {
    it('노트 선택', () => {
      const note = createNote()
      store.setSelectedNote(note)
      expect(store.selectedNote).toEqual(note)
    })

    it('null 설정', () => {
      store.setSelectedNote(null)
      expect(store.selectedNote).toBeNull()
    })
  })

  describe('setTransferNotes', () => {
    it('전송 노트 설정', () => {
      store.setTransferNotes([{ hash: NOTE_ALICE_ETH_VALID.hashHex, type: '0x0', value: '1000000000000000000', token: '0x0' }])
      expect(store.transferNotes.length).toBe(1)
    })
  })

  describe('computed: validNotes', () => {
    it('state=0x1 인 노트만 필터', () => {
      store.setNotes([
        createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex, state: '0x1' }),
        createNote({ hash: NOTE_ALICE_DAI_VALID.hashHex, state: '0x0' }),
        createNote({ hash: NOTE_ALICE_ETH_SPENT.hashHex, state: '0x1' }),
        createNote({ hash: NOTE_ALICE_DAI_VALID_2.hashHex, state: '0x3' }),
      ])
      expect(store.validNotes.length).toBe(2)
    })
  })

  describe('computed: smartNotes', () => {
    it('isSmart=0x1 인 노트만 필터', () => {
      store.setNotes([
        createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex, isSmart: '0x0' }),
        createNote({ hash: NOTE_ALICE_DAI_VALID.hashHex, isSmart: '0x1' }),
      ])
      expect(store.smartNotes.length).toBe(1)
      expect(store.smartNotes[0].hash).toBe(NOTE_ALICE_DAI_VALID.hashHex)
    })
  })

  describe('computed: ethNotes', () => {
    it('token=0x0 & state=0x1 인 노트', () => {
      store.setNotes([
        createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex, token: '0x0', state: '0x1' }),
        createNote({ hash: NOTE_ALICE_DAI_VALID.hashHex, token: '0x1', state: '0x1' }),
        createNote({ hash: NOTE_ALICE_ETH_SPENT.hashHex, token: '0x0', state: '0x3' }),
      ])
      expect(store.ethNotes.length).toBe(1)
      expect(store.ethNotes[0].hash).toBe(NOTE_ALICE_ETH_VALID.hashHex)
    })
  })

  describe('computed: daiNotes', () => {
    it('token=0x1 & state=0x1 인 노트', () => {
      store.setNotes([
        createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex, token: '0x0', state: '0x1' }),
        createNote({ hash: NOTE_ALICE_DAI_VALID.hashHex, token: '0x1', state: '0x1' }),
        createNote({ hash: NOTE_ALICE_ETH_SPENT.hashHex, token: '0x1', state: '0x3' }),
      ])
      expect(store.daiNotes.length).toBe(1)
      expect(store.daiNotes[0].hash).toBe(NOTE_ALICE_DAI_VALID.hashHex)
    })
  })

  describe('numberOfNotesInAccount', () => {
    it('특정 계정의 노트 수', () => {
      store.setNotes([
        createNote({ hash: NOTE_ALICE_ETH_VALID.hashHex, owner: ALICE_ADDRESS }),
        createNote({ hash: NOTE_ALICE_DAI_VALID.hashHex, owner: BOB_ADDRESS }),
        createNote({ hash: NOTE_ALICE_ETH_SPENT.hashHex, owner: ALICE_ADDRESS }),
      ])
      expect(store.numberOfNotesInAccount(ALICE_ADDRESS)).toBe(2)
      expect(store.numberOfNotesInAccount(BOB_ADDRESS)).toBe(1)
      expect(store.numberOfNotesInAccount(CAROL_ADDRESS)).toBe(0)
    })
  })

  describe('scanBlockchainNotes', () => {
    it('dexContract가 null이면 조기 리턴', async () => {
      // contractStore.dexContract = null (모킹 기본값)
      await store.scanBlockchainNotes()
      // 스캔이 시작되지 않음
      expect(store.isScanning).toBe(false)
    })
  })

  describe('reset', () => {
    it('모든 상태 초기화', () => {
      store.setNotes([createNote()])
      store.setTransferNotes([{ hash: NOTE_ALICE_ETH_VALID.hashHex, type: '0x0', value: '1000000000000000000', token: '0x0' }])
      store.setSelectedNote(createNote())

      store.reset()

      expect(store.notes).toEqual([])
      expect(store.transferNotes).toEqual([])
      expect(store.selectedNote).toBeNull()
    })
  })
})
