<template>
  <g
    :transform="`translate(${node.x}, ${node.y})`"
    :class="{ clickable: !masked && isValidNote && isMyNote }"
    @click="handleClick"
  >
    <!-- Merge bracket (orange) -->
    <rect
      v-if="node.data.isMerge"
      :x="-14"
      :y="2"
      :width="10"
      :height="NODE_HEIGHT - 4"
      rx="3"
      fill="none"
      stroke="#e08040"
      stroke-width="2"
    />
    <!-- Node background -->
    <rect
      :width="NODE_WIDTH"
      :height="NODE_HEIGHT"
      rx="4"
      :fill="bgColor"
      :stroke="borderColor"
      stroke-width="1"
      :stroke-dasharray="masked ? 'none' : ((node.data.isMergeRef || node.data.isKnownOnly) ? '4 2' : 'none')"
      :class="{ 'hover-effect': !masked && isValidNote && isMyNote }"
    />
    <!-- Merge reference text -->
    <text
      v-if="node.data.isMergeRef"
      :x="10"
      :y="NODE_HEIGHT / 2"
      dy="0.35em"
      fill="#999"
      font-style="italic"
      font-size="12"
    >&#x21B3; combined</text>
    <!-- Normal node content -->
    <template v-else>
      <text
        :x="10"
        :y="NODE_HEIGHT / 2"
        dy="0.35em"
        font-family="monospace"
        font-size="11"
        fill="#666"
      >{{ ownerLabel }}</text>
      <text
        :x="10 + ownerWidth + 6"
        :y="NODE_HEIGHT / 2"
        dy="0.35em"
        font-size="12"
        font-weight="600"
        :fill="textColor"
      >{{ displayValue }}</text>
      <circle
        :cx="NODE_WIDTH - 14"
        :cy="NODE_HEIGHT / 2"
        r="4"
        :fill="dotColor"
      />
    </template>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFormatters } from '@/composables/useFormatters'
import { useAccountStore } from '@/stores/account'
import type { LayoutNode } from '@/types/noteTree'
import { NODE_WIDTH, NODE_HEIGHT } from '@/composables/useNoteTreeLayout'

const props = defineProps<{
  node: LayoutNode
  masked: boolean
}>()

const emit = defineEmits<{
  selectNote: [note: { hash: string; value: string; token: string; state: string; owner: string; event: MouseEvent }]
}>()

const fmt = useFormatters()
const accountStore = useAccountStore()

// Is this a known note (we know about it from a transfer, but don't own it)
const isKnownOnly = computed(() => props.node.data.isKnownOnly === true)

const bgColor = computed(() => {
  if (props.masked) return '#f5f5f5'
  if (props.node.data.isMergeRef) return '#fff'
  // Known notes: gray background regardless of state
  if (isKnownOnly.value) return '#f8f8f8'
  switch (props.node.data.state) {
    case '0x1': return '#effaf3'
    case '0x3': return '#f5f5f5'
    case '0x2': return '#fffbeb'
    default: return '#feecf0'
  }
})

const borderColor = computed(() => {
  if (props.masked) return '#ccc'
  if (props.node.data.isMergeRef) return '#ddd'
  // Known notes: use state-based border (so VALID shows green border)
  // but with dashed style (handled in template)
  switch (props.node.data.state) {
    case '0x1': return isKnownOnly.value ? '#8cd4a0' : '#48c774'  // Lighter green for known
    case '0x3': return '#ccc'
    case '0x2': return '#ffdd57'
    default: return '#f14668'
  }
})

const dotColor = computed(() => {
  if (props.masked) return '#ccc'
  // Dot always reflects actual state (so VALID shows green dot)
  switch (props.node.data.state) {
    case '0x1': return '#48c774'
    case '0x3': return '#ccc'
    case '0x2': return '#ffdd57'
    default: return '#f14668'
  }
})

const textColor = computed(() => {
  if (props.masked) return '#999'
  // Known notes: muted text color
  if (isKnownOnly.value) return '#999'
  if (props.node.data.state === '0x3') return '#999'
  return '#000'
})

const ownerLabel = computed(() => {
  if (props.masked) return '****'

  // For known notes, show the pkX directly
  if (isKnownOnly.value) {
    const pkX = props.node.data.pkX
    if (!pkX) return '?'
    if (pkX.length <= 9) return pkX
    return `${pkX.slice(0, 5)}…${pkX.slice(-3)}`
  }

  // For owned notes, look up the account by owner address
  const owner = props.node.data.owner
  if (!owner) return ''
  const acc = accountStore.accounts.find(a => a.address === owner)
  if (!acc?.publicKey?.x) return ''
  const x = acc.publicKey.x
  if (x.length <= 9) return x
  return `${x.slice(0, 5)}…${x.slice(-3)}`
})

// Monospace at font-size 11px ≈ 6.6px per char
const ownerWidth = computed(() => {
  return ownerLabel.value.length * 6.6
})

const displayValue = computed(() => {
  const tokenStr = fmt.tokenType(props.node.data.token)
  if (props.masked && !props.node.data.isRoot) {
    return `**** ${tokenStr}`
  }
  return `${fmt.formatNoteValue(props.node.data.value)} ${tokenStr}`
})

// Check if this is a valid (unspent) note
const isValidNote = computed(() => {
  return props.node.data.state === '0x1' && !props.node.data.isMergeRef
})

// Check if this note belongs to one of my unlocked accounts (not known-only)
const isMyNote = computed(() => {
  // Known-only notes are never "my note" for transfer/redeem purposes
  if (isKnownOnly.value) return false
  const owner = props.node.data.owner
  if (!owner) return false
  return accountStore.accounts.some(a => a.address === owner && a.secretKey)
})

function handleClick(event: MouseEvent) {
  if (props.masked) return
  if (!isValidNote.value || !isMyNote.value) return
  event.stopPropagation()
  emit('selectNote', {
    hash: props.node.data.hash,
    value: props.node.data.value,
    token: props.node.data.token,
    state: props.node.data.state,
    owner: props.node.data.owner,
    event
  })
}
</script>

<style scoped>
.clickable {
  cursor: pointer;
}

.hover-effect {
  transition: filter 0.15s, stroke-width 0.15s;
}

.clickable:hover .hover-effect {
  filter: brightness(0.95);
  stroke-width: 2;
}
</style>
