/**
 * useNoteTreeLayout 단위 테스트
 *
 * 테스트 항목:
 * - 빈 그룹 → 빈 레이아웃
 * - 단일 노드 레이아웃
 * - 부모-자식 관계 레이아웃
 * - getLinkPath SVG 경로
 * - 다중 그룹 오프셋
 * - totalWidth / totalHeight
 */

import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useNoteTreeLayout, NODE_WIDTH, NODE_HEIGHT, CREATOR_LABEL_WIDTH } from './useNoteTreeLayout'
import type { CreatorGroup, NoteTreeNode } from '@/types/noteTree'
import {
  ALICE_ADDRESS_0X,
  NOTE_ALICE_ETH_VALID, NOTE_ALICE_DAI_VALID, NOTE_ALICE_ETH_SPENT,
  NOTE_BOB_ETH_VALID, NOTE_BOB_DAI_VALID, NOTE_ALICE_DAI_VALID_2,
} from '@/test-utils/fixtures'

function createNode(hash: string, children: NoteTreeNode[] = []): NoteTreeNode {
  return {
    hash,
    value: '1000000000000000000',
    token: '0x0',
    state: '0x1',
    owner: ALICE_ADDRESS_0X,
    children
  }
}

describe('useNoteTreeLayout', () => {
  describe('빈 그룹', () => {
    it('빈 배열 → totalWidth/totalHeight = 0', () => {
      const groups = ref<CreatorGroup[]>([])
      const { layoutGroups, totalWidth, totalHeight } = useNoteTreeLayout(groups)

      expect(layoutGroups.value).toEqual([])
      expect(totalWidth.value).toBe(0)
      expect(totalHeight.value).toBe(0)
    })
  })

  describe('단일 노드', () => {
    it('루트 하나 → 노드 1개, 링크 0개', () => {
      const node = createNode(NOTE_ALICE_ETH_VALID.hashHex)
      const groups = ref<CreatorGroup[]>([{ roots: [node] }])
      const { layoutGroups } = useNoteTreeLayout(groups)

      const group = layoutGroups.value[0]
      expect(group.nodes.length).toBe(1)
      expect(group.links.length).toBe(0)
      expect(group.nodes[0].data.hash).toBe(NOTE_ALICE_ETH_VALID.hashHex)
    })

    it('노드 좌표가 양수', () => {
      const node = createNode(NOTE_ALICE_ETH_VALID.hashHex)
      const groups = ref<CreatorGroup[]>([{ roots: [node] }])
      const { layoutGroups } = useNoteTreeLayout(groups)

      const n = layoutGroups.value[0].nodes[0]
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeGreaterThanOrEqual(0)
    })

    it('width/height 양수', () => {
      const node = createNode(NOTE_ALICE_ETH_VALID.hashHex)
      const groups = ref<CreatorGroup[]>([{ roots: [node] }])
      const { layoutGroups } = useNoteTreeLayout(groups)

      expect(layoutGroups.value[0].width).toBeGreaterThan(0)
      expect(layoutGroups.value[0].height).toBeGreaterThan(0)
    })
  })

  describe('부모-자식 관계', () => {
    it('부모 + 자식 1 → 노드 2개, 링크 1개', () => {
      const child = createNode(NOTE_ALICE_DAI_VALID.hashHex)
      const parent = createNode(NOTE_ALICE_ETH_VALID.hashHex, [child])
      const groups = ref<CreatorGroup[]>([{ roots: [parent] }])
      const { layoutGroups } = useNoteTreeLayout(groups)

      const group = layoutGroups.value[0]
      expect(group.nodes.length).toBe(2)
      expect(group.links.length).toBe(1)
    })

    it('자식 노드의 depth = 부모 depth + 1', () => {
      const child = createNode(NOTE_ALICE_DAI_VALID.hashHex)
      const parent = createNode(NOTE_ALICE_ETH_VALID.hashHex, [child])
      const groups = ref<CreatorGroup[]>([{ roots: [parent] }])
      const { layoutGroups } = useNoteTreeLayout(groups)

      const parentNode = layoutGroups.value[0].nodes.find(n => n.data.hash === NOTE_ALICE_ETH_VALID.hashHex)!
      const childNode = layoutGroups.value[0].nodes.find(n => n.data.hash === NOTE_ALICE_DAI_VALID.hashHex)!
      expect(childNode.depth).toBe(parentNode.depth + 1)
    })

    it('자식이 부모보다 오른쪽에 위치 (x 좌표)', () => {
      const child = createNode(NOTE_ALICE_DAI_VALID.hashHex)
      const parent = createNode(NOTE_ALICE_ETH_VALID.hashHex, [child])
      const groups = ref<CreatorGroup[]>([{ roots: [parent] }])
      const { layoutGroups } = useNoteTreeLayout(groups)

      const parentNode = layoutGroups.value[0].nodes.find(n => n.data.hash === NOTE_ALICE_ETH_VALID.hashHex)!
      const childNode = layoutGroups.value[0].nodes.find(n => n.data.hash === NOTE_ALICE_DAI_VALID.hashHex)!
      expect(childNode.x).toBeGreaterThan(parentNode.x)
    })
  })

  describe('다중 루트 (synthetic root)', () => {
    it('2개 루트 → synthetic root 없이 노드 2개', () => {
      const root1 = createNode(NOTE_ALICE_ETH_VALID.hashHex)
      const root2 = createNode(NOTE_ALICE_DAI_VALID.hashHex)
      const groups = ref<CreatorGroup[]>([{ roots: [root1, root2] }])
      const { layoutGroups } = useNoteTreeLayout(groups)

      const group = layoutGroups.value[0]
      // synthetic root는 제외되므로 실제 노드만 포함
      expect(group.nodes.length).toBe(2)
      const hashes = group.nodes.map(n => n.data.hash)
      expect(hashes).not.toContain('__synthetic__')
    })
  })

  describe('다중 그룹', () => {
    it('여러 그룹의 오프셋이 증가', () => {
      const groups = ref<CreatorGroup[]>([
        { roots: [createNode(NOTE_ALICE_ETH_VALID.hashHex)] },
        { roots: [createNode(NOTE_ALICE_DAI_VALID.hashHex)] },
        { roots: [createNode(NOTE_ALICE_ETH_SPENT.hashHex)] }
      ])
      const { layoutGroups } = useNoteTreeLayout(groups)

      const offsets = layoutGroups.value.map(g => g.offsetY)
      expect(offsets[0]).toBe(0)
      expect(offsets[1]).toBeGreaterThan(0)
      expect(offsets[2]).toBeGreaterThan(offsets[1])
    })

    it('totalHeight가 마지막 그룹의 offsetY + height', () => {
      const groups = ref<CreatorGroup[]>([
        { roots: [createNode(NOTE_ALICE_ETH_VALID.hashHex)] },
        { roots: [createNode(NOTE_ALICE_DAI_VALID.hashHex)] }
      ])
      const { layoutGroups, totalHeight } = useNoteTreeLayout(groups)

      const last = layoutGroups.value[layoutGroups.value.length - 1]
      expect(totalHeight.value).toBe(last.offsetY + last.height)
    })
  })

  describe('getLinkPath', () => {
    it('유효한 SVG 경로 생성', () => {
      const child = createNode(NOTE_ALICE_DAI_VALID.hashHex)
      const parent = createNode(NOTE_ALICE_ETH_VALID.hashHex, [child])
      const groups = ref<CreatorGroup[]>([{ roots: [parent] }])
      const { layoutGroups, getLinkPath } = useNoteTreeLayout(groups)

      const link = layoutGroups.value[0].links[0]
      const path = getLinkPath(link)

      // M, H, V, H 커맨드 포함
      expect(path).toMatch(/^M[\d.]+,[\d.]+ H[\d.]+ V[\d.]+ H[\d.]+$/)
    })
  })

  describe('createdBy 레이블', () => {
    it('createdBy 있으면 labelX/labelY 설정', () => {
      const node = createNode(NOTE_ALICE_ETH_VALID.hashHex)
      const groups = ref<CreatorGroup[]>([{ createdBy: ALICE_ADDRESS_0X, roots: [node] }])
      const { layoutGroups } = useNoteTreeLayout(groups)

      const group = layoutGroups.value[0]
      expect(typeof group.labelX).toBe('number')
      expect(typeof group.labelY).toBe('number')
    })
  })

  describe('상수 export', () => {
    it('NODE_WIDTH = 200', () => {
      expect(NODE_WIDTH).toBe(200)
    })

    it('NODE_HEIGHT = 36', () => {
      expect(NODE_HEIGHT).toBe(36)
    })

    it('CREATOR_LABEL_WIDTH = 100', () => {
      expect(CREATOR_LABEL_WIDTH).toBe(100)
    })
  })
})
