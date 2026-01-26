export interface NoteTreeNode {
  hash: string
  value: string
  token: string
  state: string
  owner: string
  createdBy?: string
  children: NoteTreeNode[]
  isRoot?: boolean
  isMerge?: boolean
  mergeParents?: string[]
  isMergeRef?: boolean
}

export interface CreatorGroup {
  createdBy?: string
  roots: NoteTreeNode[]
}

export interface LayoutNode {
  x: number
  y: number
  data: NoteTreeNode
  depth: number
}

export interface LayoutLink {
  source: { x: number; y: number }
  target: { x: number; y: number }
  isMergeLink?: boolean
}

export interface LayoutGroup {
  createdBy?: string
  nodes: LayoutNode[]
  links: LayoutLink[]
  width: number
  height: number
  offsetX: number
  offsetY: number
  labelX: number
  labelY: number
}
