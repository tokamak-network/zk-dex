<template>
  <div class="box tree-box">
    <div class="tree-header">
      <button class="ctrl-btn" @click="zoomOut" :disabled="zoomLevel <= 0.5" title="Zoom Out">
        &#x2212;
      </button>
      <span style="display: inline-block; min-width: 50px; text-align: center; font-size: 0.9em; color: #666;">
        {{ Math.round(zoomLevel * 100) }}%
      </span>
      <button class="ctrl-btn" @click="zoomIn" :disabled="zoomLevel >= 2.0" title="Zoom In">
        &#x002B;
      </button>
      <button class="ctrl-btn" @click="resetZoom" title="Reset Zoom" style="margin-left: 5px;">
        &#x21BA;
      </button>
      <button class="ctrl-btn" :class="{ active: masked }" @click="masked = !masked" style="margin-left: 10px;" title="Toggle Privacy">
        {{ masked ? '&#x1F512;' : '&#x1F513;' }}
      </button>
    </div>
    <div v-if="treeData.roots.length === 0" class="empty-tree-state">
      <div class="empty-message">No notes yet. Start by issuing a note:</div>
      <div v-if="props.currentAccount" class="ethereum-account-section">
        <div class="eth-account-label">Connected Ethereum Account:</div>
        <div class="eth-account-address">{{ props.currentAccount }}</div>
        <button class="issue-note-button" @click="handleIssueButtonClick">
          + Issue Note
        </button>
        <div class="helper-text">
          You'll select a ZK account and unlock it in the next step
        </div>
      </div>
      <div v-else class="no-accounts-message">
        Please connect MetaMask to issue notes
      </div>
    </div>
    <div v-else class="tree-container" @click="closeActionMenu">
      <!-- SVG: viewBox defines coordinate system with pan offset, size controlled by CSS -->
      <svg class="tree-svg"
           :class="{ dragging: isDragging }"
           :viewBox="`${panX} ${panY} ${adjustedWidth / zoomLevel} ${totalHeight / zoomLevel}`"
           :style="{ height: svgHeight + 'px' }"
           preserveAspectRatio="xMinYMin meet"
           @mousedown="handleMouseDown"
           @mousemove="handleMouseMove"
           @mouseup="handleMouseUp"
           @mouseleave="handleMouseLeave">
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
          <!-- Redeemer labels and lines (Ethereum address that redeemed the note) -->
          <template v-for="node in group.nodes.filter(n => n.data.spentBy && n.data.children.length === 0 && n.data.state === '0x3')" :key="`spent-${node.data.hash}`">
            <!-- Line from note to redeemer label -->
            <path
              :d="getRedeemerLinkPath(node, getGroupRedeemerX(group))"
              class="redeemer-link"
              fill="none"
            />
            <!-- Redeemer label -->
            <foreignObject
              :x="getGroupRedeemerX(group)"
              :y="node.y + 6"
              :width="CREATOR_LABEL_WIDTH"
              :height="24"
              style="pointer-events: none;"
            >
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                class="redeemer-label"
                :title="node.data.spentBy"
              >
                {{ fmt.abbreviate(node.data.spentBy!) }}
              </div>
            </foreignObject>
          </template>
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
import type { NoteTreeNode, CreatorGroup, LayoutNode, LayoutGroup } from '@/types/noteTree'
import NoteTreeSvgNode from './NoteTreeSvgNode.vue'
import { useFormatters } from '@/composables/useFormatters'
import { useNoteTreeLayout, CREATOR_LABEL_WIDTH } from '@/composables/useNoteTreeLayout'
import { logger } from '@/lib/logger'

interface Account {
  address: string
  publicKey?: string
}

const props = defineProps<{
  notes: Note[]
  currentAccount?: string  // Connected MetaMask account
  accounts?: Account[]     // All available accounts for empty state
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
const zoomLevel = ref(1.0)

// Pan state for drag-to-scroll
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const panStart = ref({ x: 0, y: 0 })

function zoomIn() {
  if (zoomLevel.value < 2.0) {
    zoomLevel.value = Math.min(2.0, +(zoomLevel.value + 0.1).toFixed(1))
  }
}

function zoomOut() {
  if (zoomLevel.value > 0.5) {
    zoomLevel.value = Math.max(0.5, +(zoomLevel.value - 0.1).toFixed(1))
  }
}

function resetZoom() {
  zoomLevel.value = 1.0
  panX.value = 0
  panY.value = 0
}

// Drag handlers for panning
function handleMouseDown(e: MouseEvent) {
  // Only start drag with left mouse button
  if (e.button !== 0) return
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  panStart.value = { x: panX.value, y: panY.value }
  e.preventDefault()
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value) return

  // Calculate delta in SVG coordinate space
  const viewBoxWidth = adjustedWidth.value / zoomLevel.value
  const viewBoxHeight = totalHeight.value / zoomLevel.value
  const svgElement = e.currentTarget as SVGSVGElement
  const rect = svgElement.getBoundingClientRect()

  // Convert pixel movement to viewBox units
  const scaleX = viewBoxWidth / rect.width
  const scaleY = viewBoxHeight / rect.height

  const dx = (e.clientX - dragStart.value.x) * scaleX
  const dy = (e.clientY - dragStart.value.y) * scaleY

  // Update pan (subtract because dragging right should show content on the left)
  panX.value = Math.max(0, panStart.value.x - dx)
  panY.value = Math.max(0, panStart.value.y - dy)
}

function handleMouseUp() {
  isDragging.value = false
}

function handleMouseLeave() {
  isDragging.value = false
}

function handleIssueButtonClick() {
  console.log('[NoteTree] Issue button clicked')
  // Emit with empty string - parent will show all ZK accounts
  emit('issueNote', '')
}

function handleCreatorClick(createdBy: string) {
  console.log('[NoteTree] handleCreatorClick called with:', createdBy)
  console.log('[NoteTree] masked.value:', masked.value)
  if (masked.value) {
    console.log('[NoteTree] Masked mode, skipping')
    return
  }
  // Always emit the event - let the parent component handle account selection
  console.log('[NoteTree] Emitting issueNote event')
  emit('issueNote', createdBy)
}

function isMyAccount(address: string): boolean {
  if (!props.currentAccount) return false
  // Normalize addresses: remove 0x prefix and compare in lowercase
  const normalizedAddress = address.toLowerCase().replace(/^0x/, '')
  const normalizedCurrent = props.currentAccount.toLowerCase().replace(/^0x/, '')
  console.log('[NoteTree] Comparing addresses:', { address: normalizedAddress, current: normalizedCurrent, match: normalizedAddress === normalizedCurrent })
  return normalizedAddress === normalizedCurrent
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
      spentBy: note.spentBy,
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

// Add extra width for redeemer labels (positioned at maxX + 215, plus label width 120)
const adjustedWidth = computed(() => {
  // Check if any notes have redeemer labels
  const hasRedeemers = props.notes.some(n => n.spentBy && n.state === '0x3')
  if (!hasRedeemers) return totalWidth.value

  // Add space for redeemer labels: gap (215) + label width (120) = 335
  return totalWidth.value + 335
})

// Dynamic SVG height: use content height directly (no min to avoid scaling up)
const MAX_SVG_HEIGHT = 500
const svgHeight = computed(() => {
  // Use content height directly - no minimum to prevent unwanted scaling
  const contentHeight = totalHeight.value * zoomLevel.value
  return Math.min(MAX_SVG_HEIGHT, contentHeight)
})

// Calculate redeemer label X position for a group (aligned horizontally)
function getGroupRedeemerX(group: LayoutGroup): number {
  // Find the rightmost node X coordinate
  const xCoords = group.nodes.map((n: LayoutNode) => n.x)
  const maxX = Math.max(...xCoords)

  // Position labels slightly to the right of the rightmost nodes
  return maxX + 215 // NODE_WIDTH (200) + gap (15)
}

// Calculate line path from redeemed note to redeemer label
function getRedeemerLinkPath(node: LayoutNode, labelX: number): string {
  const startX = node.x + 200 // Right edge of note (NODE_WIDTH)
  const startY = node.y + 18  // Center of note (NODE_HEIGHT / 2)
  const endX = labelX
  const endY = node.y + 18    // Same Y as start (horizontal alignment)

  return `M${startX},${startY} L${endX},${endY}`
}

</script>

<style scoped>
.tree-box {
  padding-top: 15px;
  overflow: visible;
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

.ctrl-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ctrl-btn:disabled:hover {
  background: none;
}

.ctrl-btn.active {
  background: #e3f2fd;
  border-color: #2196f3;
  color: #1976d2;
}

.tree-container {
  overflow: visible;
  max-width: 100%;  /* Constrain width to parent */
  padding: 10px 0;
  font-size: 0.85em;
  text-align: left;
  position: relative;
}


.tree-svg {
  display: block;
  width: 100%;
  /* Height is set dynamically via inline style based on content */
  cursor: grab;
}

.tree-svg.dragging {
  cursor: grabbing;
}

.tree-link {
  stroke: #bbb;
  stroke-width: 1.5;
}

.tree-link.merge-link {
  stroke: #e08040;
  stroke-dasharray: 4 2;
}

.redeemer-link {
  stroke: #999;
  stroke-width: 1;
  stroke-dasharray: 2 2;
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

.redeemer-label {
  font-family: monospace;
  font-size: 0.75em;
  color: #999;
  white-space: nowrap;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  font-style: italic;
}

.empty-tree-state {
  padding: 40px 20px;
  text-align: center;
}

.empty-message {
  color: #666;
  font-size: 1.1em;
  margin-bottom: 30px;
  font-weight: 500;
}

.ethereum-account-section {
  max-width: 500px;
  margin: 0 auto;
  padding: 30px;
  background: #f8f9fa;
  border: 2px solid #e3f2fd;
  border-radius: 12px;
}

.eth-account-label {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 8px;
  font-weight: 500;
}

.eth-account-address {
  font-family: monospace;
  font-size: 1em;
  color: #1976d2;
  font-weight: 600;
  padding: 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-bottom: 20px;
  word-break: break-all;
}

.issue-note-button {
  width: 100%;
  padding: 14px 24px;
  font-size: 1em;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
}

.issue-note-button:hover {
  background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
}

.issue-note-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(25, 118, 210, 0.3);
}

.helper-text {
  margin-top: 12px;
  color: #888;
  font-size: 0.85em;
  font-style: italic;
}

.no-accounts-message {
  margin-top: 20px;
  color: #999;
  font-style: italic;
  font-size: 1em;
}
</style>
