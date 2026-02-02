export interface NoteTreeNode {
  hash: string
  value: string
  token: string
  state: string
  owner: string
  pkX?: string          // BabyJubJub public key X (for known-only notes)
  pkY?: string          // BabyJubJub public key Y (for known-only notes)
  createdBy?: string    // Ethereum address that minted the note
  spentBy?: string      // Ethereum address that redeemed/spent the note
  children: NoteTreeNode[]
  isRoot?: boolean
  isMerge?: boolean
  mergeParents?: string[]
  isMergeRef?: boolean
  isKnownOnly?: boolean // True if we know this note from a transfer but don't own it
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
