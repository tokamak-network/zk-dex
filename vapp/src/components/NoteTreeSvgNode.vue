<template>
  <g :transform="`translate(${node.x}, ${node.y})`">
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
      :stroke-dasharray="node.data.isMergeRef ? '4 2' : 'none'"
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
      >{{ hashLabel }}</text>
      <text
        :x="10 + hashWidth + 6"
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
import type { LayoutNode } from '@/types/noteTree'
import { NODE_WIDTH, NODE_HEIGHT } from '@/composables/useNoteTreeLayout'

const props = defineProps<{
  node: LayoutNode
  masked: boolean
}>()

const fmt = useFormatters()

const bgColor = computed(() => {
  if (props.node.data.isMergeRef) return '#fff'
  switch (props.node.data.state) {
    case '0x1': return '#effaf3'
    case '0x3': return '#f5f5f5'
    case '0x2': return '#fffbeb'
    default: return '#feecf0'
  }
})

const borderColor = computed(() => {
  if (props.node.data.isMergeRef) return '#ddd'
  switch (props.node.data.state) {
    case '0x1': return '#48c774'
    case '0x3': return '#ccc'
    case '0x2': return '#ffdd57'
    default: return '#f14668'
  }
})

const dotColor = computed(() => {
  switch (props.node.data.state) {
    case '0x1': return '#48c774'
    case '0x3': return '#ccc'
    case '0x2': return '#ffdd57'
    default: return '#f14668'
  }
})

const textColor = computed(() => {
  if (props.node.data.state === '0x3') return '#999'
  return '#000'
})

const hashLabel = computed(() => {
  return props.masked ? 'zk****' : fmt.abbreviateZk(props.node.data.hash)
})

// Monospace at font-size 11px ≈ 6.6px per char
const hashWidth = computed(() => {
  return hashLabel.value.length * 6.6
})

const displayValue = computed(() => {
  const tokenStr = fmt.tokenType(props.node.data.token)
  if (props.masked && !props.node.data.isRoot) {
    return `**** ${tokenStr}`
  }
  return `${fmt.hexToNumberString(props.node.data.value)} ${tokenStr}`
})
</script>

<style scoped>
</style>
