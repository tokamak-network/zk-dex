<template>
  <div class="box">
    <div class="tree-header">
      <p style="margin-left: 10px; margin-bottom: 0;">Note Transfer Tree</p>
      <button class="ctrl-btn" :class="{ active: masked }" @click="masked = !masked">
        {{ masked ? '&#x1F512;' : '&#x1F513;' }}
      </button>
    </div>
    <div v-if="treeData.roots.length === 0" style="clear: both; padding: 20px; color: #999; text-align: center;">
      No note history found.
    </div>
    <div v-else class="tree-container" style="clear: both; overflow: auto; padding: 10px 0; text-align: left;">
      <svg :viewBox="`0 0 ${totalWidth} ${totalHeight}`" preserveAspectRatio="xMinYMin meet" :style="{ maxWidth: totalWidth + 'px' }" class="tree-svg">
        <g v-for="(group, gi) in layoutGroups" :key="group.createdBy || `g${gi}`"
           :transform="`translate(${group.offsetX}, ${group.offsetY})`">
          <!-- Creator label (Ethereum address that minted the note) -->
          <foreignObject
            v-if="group.createdBy"
            :x="group.labelX"
            :y="group.labelY"
            :width="CREATOR_LABEL_WIDTH"
            :height="24"
          >
            <div xmlns="http://www.w3.org/1999/xhtml" class="creator-label">
              {{ fmt.abbreviate(group.createdBy) }}
            </div>
          </foreignObject>
          <!-- Links -->
          <path
            v-for="(link, li) in group.links"
            :key="`link-${li}`"
            :d="getLinkPath(link)"
            class="tree-link"
            :class="{ 'merge-link': link.isMergeLink }"
            fill="none"
          />
          <!-- Nodes -->
          <NoteTreeSvgNode
            v-for="node in group.nodes"
            :key="node.data.hash"
            :node="node"
            :masked="masked"
          />
        </g>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { toBigInt } from 'ethers'
import type { Note } from '@/stores/note'
import type { NoteTreeNode, CreatorGroup } from '@/types/noteTree'
import NoteTreeSvgNode from './NoteTreeSvgNode.vue'
import { useFormatters } from '@/composables/useFormatters'
import { useNoteTreeLayout, CREATOR_LABEL_WIDTH } from '@/composables/useNoteTreeLayout'

const props = defineProps<{
  notes: Note[]
}>()

const fmt = useFormatters()
const masked = ref(false)

const treeData = computed(() => {
  const notesByHash = new Map<string, Note>()
  const childrenByTx = new Map<string, string[]>()
  const parentsByTx = new Map<string, string[]>()

  for (const note of props.notes) {
    notesByHash.set(note.hash, note)

    if (note.createdInTx) {
      const list = childrenByTx.get(note.createdInTx) || []
      list.push(note.hash)
      childrenByTx.set(note.createdInTx, list)
    }

    if (note.spentInTx) {
      const list = parentsByTx.get(note.spentInTx) || []
      list.push(note.hash)
      parentsByTx.set(note.spentInTx, list)
    }
  }

  // Build parent→children and child→parents relationships
  const noteChildren = new Map<string, string[]>()
  const noteParents = new Map<string, string[]>()

  for (const [tx, spentHashes] of parentsByTx) {
    const createdHashes = childrenByTx.get(tx) || []
    // Filter out zero-value notes (change notes with 0 value from combine)
    const meaningfulChildren = createdHashes.filter(h => {
      const n = notesByHash.get(h)
      return n && toBigInt(n.value) > BigInt(0)
    })

    for (const parentHash of spentHashes) {
      noteChildren.set(parentHash, meaningfulChildren)
    }
    for (const childHash of meaningfulChildren) {
      const parents = noteParents.get(childHash) || []
      parents.push(...spentHashes)
      noteParents.set(childHash, parents)
    }
  }

  // Identify merge nodes (2+ parents)
  const mergeNodes = new Set<string>()
  const mergeParentsMap = new Map<string, string[]>()
  for (const [childHash, parents] of noteParents) {
    if (parents.length > 1) {
      mergeNodes.add(childHash)
      mergeParentsMap.set(childHash, parents)
    }
  }

  // Find root notes (no parents)
  const hasParent = new Set<string>(noteParents.keys())

  // Build tree recursively
  const visited = new Set<string>()

  function buildNode(hash: string): NoteTreeNode | null {
    const note = notesByHash.get(hash)
    if (!note) return null
    if (visited.has(hash)) return null

    visited.add(hash)

    const children: NoteTreeNode[] = []
    const childHashes = noteChildren.get(hash) || []

    for (const childHash of childHashes) {
      const isMerge = mergeNodes.has(childHash)
      const mergeParents = mergeParentsMap.get(childHash)

      if (isMerge && mergeParents) {
        const isPrimary = mergeParents[0] === hash
        if (isPrimary) {
          const childNode = buildNode(childHash)
          if (childNode) {
            childNode.isMerge = true
            childNode.mergeParents = mergeParents
            children.push(childNode)
          }
        } else {
          // Secondary parent shows a merge reference
          const refNote = notesByHash.get(childHash)
          children.push({
            hash: childHash,
            value: refNote?.value || '0',
            token: refNote?.token || '0x0',
            state: refNote?.state || '0x0',
            owner: refNote?.owner || '',
            children: [],
            isMergeRef: true
          })
        }
      } else {
        const childNode = buildNode(childHash)
        if (childNode) {
          children.push(childNode)
        }
      }
    }

    return {
      hash,
      value: note.value,
      token: note.token,
      state: note.state,
      owner: note.owner,
      createdBy: note.createdBy,
      children
    }
  }

  const roots: NoteTreeNode[] = []
  for (const note of props.notes) {
    if (!hasParent.has(note.hash) && !visited.has(note.hash)) {
      const node = buildNode(note.hash)
      if (node) {
        node.isRoot = true
        roots.push(node)
      }
    }
  }

  // Group roots by createdBy (Ethereum address) for branching display
  const groups: CreatorGroup[] = []
  for (const root of roots) {
    if (root.createdBy) {
      const existing = groups.find(g => g.createdBy === root.createdBy)
      if (existing) {
        existing.roots.push(root)
      } else {
        groups.push({ createdBy: root.createdBy, roots: [root] })
      }
    } else {
      groups.push({ createdBy: undefined, roots: [root] })
    }
  }

  return { roots, groups }
})

// D3 layout computation
const groupsRef = computed(() => treeData.value.groups)
const { layoutGroups, totalWidth, totalHeight, getLinkPath } = useNoteTreeLayout(groupsRef)

</script>

<style scoped>
.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.ctrl-btn {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 1em;
  line-height: 1;
}

.ctrl-btn:hover {
  background: #f0f0f0;
}

.tree-container {
  font-size: 0.85em;
  text-align: left;
}

.tree-svg {
  display: block;
  width: 100%;
  height: auto;
}

.tree-link {
  stroke: #bbb;
  stroke-width: 1.5;
}

.tree-link.merge-link {
  stroke: #e08040;
  stroke-dasharray: 4 2;
}

.creator-label {
  font-family: monospace;
  font-size: 0.8em;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
