import { computed, type Ref } from 'vue'
import { hierarchy, tree } from 'd3-hierarchy'
import type {
  NoteTreeNode,
  CreatorGroup,
  LayoutNode,
  LayoutLink,
  LayoutGroup
} from '@/types/noteTree'

// Node dimensions
export const NODE_WIDTH = 200
export const NODE_HEIGHT = 36

// Spacing between nodes (horizontal: left→right)
const DEPTH_SPACING = 230   // depth spacing (parent→child distance)
const BREADTH_SPACING = 52  // breadth spacing (sibling distance)

// Creator label area
export const CREATOR_LABEL_WIDTH = 105
const GROUP_GAP = 30

export function useNoteTreeLayout(
  groups: Ref<CreatorGroup[]>
) {
  const layoutGroups = computed<LayoutGroup[]>(() => {
    const result: LayoutGroup[] = []
    let cumulativeOffsetY = 0

    for (const group of groups.value) {
      const layout = computeGroupLayout(group)
      layout.offsetX = 0
      layout.offsetY = cumulativeOffsetY
      result.push(layout)
      cumulativeOffsetY += layout.height + GROUP_GAP
    }

    return result
  })

  const totalWidth = computed(() => {
    if (layoutGroups.value.length === 0) return 0
    return Math.max(...layoutGroups.value.map(g => g.width))
  })

  const totalHeight = computed(() => {
    if (layoutGroups.value.length === 0) return 0
    const last = layoutGroups.value[layoutGroups.value.length - 1]
    return last.offsetY + last.height
  })

  function getLinkPath(link: LayoutLink): string {
    const { source: s, target: t } = link
    const midX = (s.x + t.x) / 2
    return `M${s.x},${s.y} H${midX} V${t.y} H${t.x}`
  }

  return {
    layoutGroups,
    totalWidth,
    totalHeight,
    getLinkPath,
    NODE_WIDTH,
    NODE_HEIGHT,
    CREATOR_LABEL_WIDTH
  }
}

function computeGroupLayout(group: CreatorGroup): LayoutGroup {
  const nodes: LayoutNode[] = []
  const links: LayoutLink[] = []

  if (group.roots.length === 0) {
    // Empty group (e.g., logged-in account with no notes yet)
    // Show creator label with minimal space
    const width = CREATOR_LABEL_WIDTH + 20
    const height = 30
    return {
      createdBy: group.createdBy,
      nodes,
      links,
      width,
      height,
      offsetX: 0,
      offsetY: 0,
      labelX: 0,
      labelY: 3
    }
  }

  // Always use a synthetic root for consistent layout and creator label connection
  const hasSyntheticRoot = true
  const rootData: NoteTreeNode = {
    hash: '__synthetic__',
    value: '0',
    token: '0x0',
    state: '0x0',
    owner: '',
    children: group.roots
  }

  const root = hierarchy(rootData, d => d.children)

  // d3.tree nodeSize: [breadth, depth]
  // Use separation to adjust spacing: normal spacing for siblings, wider spacing between branches
  const treeLayout = tree<NoteTreeNode>()
    .nodeSize([BREADTH_SPACING, DEPTH_SPACING])
    .separation((a, b) => {
      // Same parent (siblings): use slightly reduced spacing
      if (a.parent === b.parent) {
        return 0.85  // Slightly reduced spacing (44px center-to-center, 8px gap)
      }
      // Different parents: add extra spacing to separate different branches clearly
      return 2.0  // Double spacing (104px) between different branches
    })
  treeLayout(root)

  const d3Nodes = root.descendants()

  // --- Phase 1: Make coordinates non-negative ---
  let minX = Infinity, minY = Infinity
  for (const d3Node of d3Nodes) {
    minX = Math.min(minX, d3Node.y!)
    minY = Math.min(minY, d3Node.x!)
  }

  const nodeMap = new Map<NoteTreeNode, { x: number; y: number }>()
  for (const d3Node of d3Nodes) {
    nodeMap.set(d3Node.data, {
      x: d3Node.y! - minX,  // depth → screen X
      y: d3Node.x! - minY   // breadth → screen Y
    })
  }

  // --- Phase 1.25: Align first child's top with parent's top ---
  function alignFirstChildToParent(node: (typeof d3Nodes)[number]) {
    if (!node.children || node.children.length === 0) return
    if (node.data.hash === '__synthetic__') {
      for (const child of node.children) {
        alignFirstChildToParent(child)
      }
      return
    }

    const parentY = nodeMap.get(node.data)!.y
    const minChildY = Math.min(...node.children.map(c => nodeMap.get(c.data)!.y))
    const shift = parentY - minChildY

    if (Math.abs(shift) > 0.01) {
      for (const child of node.children) {
        for (const desc of child.descendants()) {
          const p = nodeMap.get(desc.data)
          if (p) p.y += shift
        }
      }
    }

    for (const child of node.children) {
      alignFirstChildToParent(child)
    }
  }
  alignFirstChildToParent(root)

  // --- Phase 1.5: Compact root node subtrees (pack them tightly) ---
  if (hasSyntheticRoot) {
    const rootD3Nodes = d3Nodes.filter(n => n.parent?.data.hash === '__synthetic__')
    if (rootD3Nodes.length > 1) {
      // Sort by current Y position
      rootD3Nodes.sort((a, b) => nodeMap.get(a.data)!.y - nodeMap.get(b.data)!.y)

      const SUBTREE_GAP = 8  // Small gap between adjacent subtrees

      for (let i = 1; i < rootD3Nodes.length; i++) {
        const prevSubtree = rootD3Nodes[i - 1]
        const currentSubtree = rootD3Nodes[i]

        // Find max Y of previous subtree (including all descendants)
        let prevMaxY = -Infinity
        for (const desc of prevSubtree.descendants()) {
          const pos = nodeMap.get(desc.data)
          if (pos) {
            prevMaxY = Math.max(prevMaxY, pos.y + NODE_HEIGHT)
          }
        }

        // Find min Y of current subtree
        let currentMinY = Infinity
        for (const desc of currentSubtree.descendants()) {
          const pos = nodeMap.get(desc.data)
          if (pos) {
            currentMinY = Math.min(currentMinY, pos.y)
          }
        }

        // Calculate shift to place current subtree right after previous
        const shift = (prevMaxY + SUBTREE_GAP) - currentMinY

        // Apply shift to entire current subtree
        if (Math.abs(shift) > 0.5) {
          for (const desc of currentSubtree.descendants()) {
            const pos = nodeMap.get(desc.data)
            if (pos) pos.y += shift
          }
        }
      }
    }
  }

  // --- Phase 2: Reposition synthetic root closer to children ---
  if (hasSyntheticRoot) {
    const syntheticPos = nodeMap.get(rootData)
    const childXs = group.roots.map(r => nodeMap.get(r)?.x ?? 0)
    const childYs = group.roots.map(r => nodeMap.get(r)?.y ?? 0)
    if (syntheticPos && childXs.length > 0) {
      syntheticPos.x = Math.min(...childXs) - 30
      syntheticPos.y = (Math.min(...childYs) + Math.max(...childYs)) / 2
    }
  }

  // --- Phase 3: Compute creator label position ---
  let labelX = 0
  let labelY = 0
  if (group.createdBy) {
    const rootPositions: { x: number; y: number }[] = []
    for (const d3Node of d3Nodes) {
      if (hasSyntheticRoot && d3Node.data.hash === '__synthetic__') continue
      const depth = hasSyntheticRoot ? d3Node.depth - 1 : d3Node.depth
      if (depth === 0) {
        const pos = nodeMap.get(d3Node.data)
        if (pos) rootPositions.push(pos)
      }
    }
    const rootYs = rootPositions.map(p => p.y)
    const minRootY = Math.min(...rootYs)
    const maxRootY = Math.max(...rootYs)
    const anchorX = hasSyntheticRoot
      ? nodeMap.get(rootData)?.x ?? Math.min(...rootPositions.map(p => p.x))
      : Math.min(...rootPositions.map(p => p.x))
    labelX = anchorX - CREATOR_LABEL_WIDTH - 6
    labelY = (minRootY + maxRootY) / 2 + (NODE_HEIGHT - 18) / 2
  }

  // --- Phase 4: Find actual bounds of all rendered content ---
  let actualMinX = Infinity, actualMinY = Infinity
  let actualMaxX = -Infinity, actualMaxY = -Infinity

  for (const d3Node of d3Nodes) {
    const pos = nodeMap.get(d3Node.data)!
    if (d3Node.data.hash === '__synthetic__') {
      // Synthetic root contributes only its point (link start)
      actualMinX = Math.min(actualMinX, pos.x)
      actualMinY = Math.min(actualMinY, pos.y)
    } else {
      actualMinX = Math.min(actualMinX, pos.x)
      actualMinY = Math.min(actualMinY, pos.y)
      actualMaxX = Math.max(actualMaxX, pos.x + NODE_WIDTH)
      actualMaxY = Math.max(actualMaxY, pos.y + NODE_HEIGHT)
    }
  }

  if (group.createdBy) {
    actualMinX = Math.min(actualMinX, labelX)
    actualMinY = Math.min(actualMinY, labelY)
    actualMaxX = Math.max(actualMaxX, labelX + CREATOR_LABEL_WIDTH)
    actualMaxY = Math.max(actualMaxY, labelY + 24)
  }

  // --- Phase 5: Final shift — align all content to top-left with padding ---
  const PAD = 8
  const shiftX = -actualMinX + PAD
  const shiftY = -actualMinY + PAD

  for (const [, pos] of nodeMap) {
    pos.x += shiftX
    pos.y += shiftY
  }
  labelX += shiftX
  labelY += shiftY

  // --- Phase 6: Collect layout nodes (skip synthetic root) ---
  for (const d3Node of d3Nodes) {
    if (hasSyntheticRoot && d3Node.data.hash === '__synthetic__') continue
    const pos = nodeMap.get(d3Node.data)!
    nodes.push({
      x: pos.x,
      y: pos.y,
      data: d3Node.data,
      depth: hasSyntheticRoot ? d3Node.depth - 1 : d3Node.depth
    })
  }

  // --- Phase 7: Build links from parent→child relationships ---
  for (const d3Node of d3Nodes) {
    if (!d3Node.parent) continue

    const sourceData = d3Node.parent.data
    const targetData = d3Node.data
    const sourcePos = nodeMap.get(sourceData)
    const targetPos = nodeMap.get(targetData)
    if (!sourcePos || !targetPos) continue

    const isSynthetic = sourceData.hash === '__synthetic__'
    const source = {
      x: isSynthetic ? sourcePos.x : sourcePos.x + NODE_WIDTH,
      y: sourcePos.y + NODE_HEIGHT / 2
    }
    const target = {
      x: targetPos.x,
      y: targetPos.y + NODE_HEIGHT / 2
    }

    links.push({
      source,
      target,
      isMergeLink: targetData.isMerge || targetData.isMergeRef
    })
  }

  // --- Phase 8: Final dimensions from actual content bounds ---
  const width = (actualMaxX - actualMinX) + PAD * 2
  const height = (actualMaxY - actualMinY) + PAD * 2

  return {
    createdBy: group.createdBy,
    nodes,
    links,
    width,
    height,
    offsetX: 0,
    offsetY: 0,
    labelX,
    labelY
  }
}
