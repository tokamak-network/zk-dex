<template>
  <div class="box tree-box">
    <div class="tree-header">
      <button class="ctrl-btn" :class="{ active: masked }" @click="masked = !masked">
        {{ masked ? '&#x1F512;' : '&#x1F513;' }}
      </button>
    </div>
    <div v-if="treeData.roots.length === 0" style="clear: both; padding: 20px; color: #999; text-align: center;">
      No note history found.
    </div>
    <div v-else class="tree-container" style="clear: both; overflow: auto; padding: 10px 0; text-align: left; position: relative;" @click="closeActionMenu">
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
            style="pointer-events: auto;"
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              class="creator-label"
              :class="{
                clickable: !masked && isMyAccount(group.createdBy),
                highlighted: !masked && isMyAccount(group.createdBy)
              }"
              @click="handleCreatorClick(group.createdBy)"
              :title="!masked && isMyAccount(group.createdBy) ? 'Click to issue note' : group.createdBy"
            >
              {{ fmt.abbreviate(group.createdBy) }}
              <span v-if="!masked && isMyAccount(group.createdBy)" class="issue-icon">+</span>
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
            @selectNote="handleNoteSelect"
          />
        </g>
      </svg>
      <!-- Action menu for selected note -->
      <div
        v-if="selectedNoteForAction"
        class="note-action-menu"
        :style="{ left: actionMenuPosition.x + 'px', top: actionMenuPosition.y + 'px' }"
        @click.stop
      >
        <div class="menu-header">{{ fmt.formatNoteValue(selectedNoteForAction.value) }} {{ fmt.tokenType(selectedNoteForAction.token) }}</div>
        <button class="menu-item" @click="handleTransfer">
          <span class="menu-icon">&#x2192;</span> Transfer
        </button>
        <button class="menu-item" @click="handleRedeem">
          <span class="menu-icon">&#x21B5;</span> Redeem
        </button>
      </div>
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
import { logger } from '@/lib/logger'

const props = defineProps<{
  notes: Note[]
  currentAccount?: string  // Connected MetaMask account
}>()

const emit = defineEmits<{
  issueNote: [createdBy: string]
  transferNote: [note: SelectedNote]
  redeemNote: [note: SelectedNote]
}>()

interface SelectedNote {
  hash: string
  value: string
  token: string
  state: string
  owner: string
}

const selectedNoteForAction = ref<SelectedNote | null>(null)
const actionMenuPosition = ref({ x: 0, y: 0 })

const fmt = useFormatters()
const masked = ref(false)

function handleCreatorClick(createdBy: string) {
  if (masked.value) return
  if (isMyAccount(createdBy)) {
    emit('issueNote', createdBy)
  }
}

function isMyAccount(address: string): boolean {
  if (!props.currentAccount) return false
  return address.toLowerCase() === props.currentAccount.toLowerCase()
}

function handleNoteSelect(payload: SelectedNote & { event: MouseEvent }) {
  const { event, ...note } = payload
  selectedNoteForAction.value = note
  // Position the menu near the click
  const container = (event.target as Element)?.closest('.tree-container')
  if (container) {
    const rect = container.getBoundingClientRect()
    actionMenuPosition.value = {
      x: event.clientX - rect.left + container.scrollLeft,
      y: event.clientY - rect.top + container.scrollTop
    }
  }
}

function handleTransfer() {
  if (selectedNoteForAction.value) {
    emit('transferNote', selectedNoteForAction.value)
  }
  selectedNoteForAction.value = null
}

function handleRedeem() {
  if (selectedNoteForAction.value) {
    emit('redeemNote', selectedNoteForAction.value)
  }
  selectedNoteForAction.value = null
}

function closeActionMenu() {
  selectedNoteForAction.value = null
}

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
            pkX: refNote?.pkX,
            pkY: refNote?.pkY,
            children: [],
            isMergeRef: true,
            isKnownOnly: refNote?.isKnownOnly
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
      pkX: note.pkX,
      pkY: note.pkY,
      createdBy: note.createdBy,
      children,
      isKnownOnly: note.isKnownOnly
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
  // Only show createdBy for notes that were minted by the owner (not transferred)

  const groups: CreatorGroup[] = []
  for (const root of roots) {
    const note = notesByHash.get(root.hash)
    // Only show createdBy if the note was minted (no visible parent = root note from mint)
    // If there's a visible parent in the same tx, it's a transfer/combine output
    const noVisibleParent = note?.createdInTx && !parentsByTx.has(note.createdInTx)
    // Show createdBy only for minted notes (no parent = minted directly on-chain)
    const effectiveCreatedBy = noVisibleParent && root.createdBy ? root.createdBy : undefined

    if (effectiveCreatedBy) {
      const existing = groups.find(g => g.createdBy === effectiveCreatedBy)
      if (existing) {
        existing.roots.push(root)
      } else {
        groups.push({ createdBy: effectiveCreatedBy, roots: [root] })
      }
    } else {
      groups.push({ createdBy: undefined, roots: [root] })
    }
  }

  // Move logged-in Ethereum account to the top (or add if not present)
  if (props.currentAccount) {
    const currentAccountLower = props.currentAccount.toLowerCase()
    const accountIndex = groups.findIndex(g =>
      g.createdBy && g.createdBy.toLowerCase() === currentAccountLower
    )

    if (accountIndex >= 0) {
      // Move existing group to the top
      const [accountGroup] = groups.splice(accountIndex, 1)
      groups.unshift(accountGroup)
    } else {
      // Add new empty group at the top
      groups.unshift({ createdBy: props.currentAccount, roots: [] })
    }
  }

  return { roots, groups }
})

// D3 layout computation
const groupsRef = computed(() => treeData.value.groups)
const { layoutGroups, totalWidth, totalHeight, getLinkPath } = useNoteTreeLayout(groupsRef)

</script>

<style scoped>
.tree-box {
  padding-top: 15px;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
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
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
}

.creator-label.clickable {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background 0.15s, color 0.15s;
  background: #f5f5f5;
  border: 1px solid #ddd;
}

.creator-label.clickable:hover {
  background: #e3f2fd;
  color: #1976d2;
  border-color: #1976d2;
}

.creator-label.highlighted {
  background: #e3f2fd;
  color: #1976d2;
  border-color: #1976d2;
}

.issue-icon {
  font-weight: bold;
  font-size: 1.1em;
  opacity: 0;
  transition: opacity 0.15s;
}

.creator-label.clickable:hover .issue-icon {
  opacity: 1;
}

.creator-label.highlighted .issue-icon {
  opacity: 1;
}

.note-action-menu {
  position: absolute;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 140px;
  z-index: 100;
  overflow: hidden;
}

.menu-header {
  padding: 8px 12px;
  font-size: 0.85em;
  font-weight: 600;
  background: #f5f5f5;
  border-bottom: 1px solid #eee;
  color: #333;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: white;
  cursor: pointer;
  font-size: 0.9em;
  text-align: left;
  transition: background 0.15s;
}

.menu-item:hover {
  background: #f0f7ff;
}

.menu-item:not(:last-child) {
  border-bottom: 1px solid #f0f0f0;
}

.menu-icon {
  font-size: 1.1em;
  color: #666;
}
</style>
