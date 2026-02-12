export interface Tree {
  id: string
  owner_id: string
  name: string
  created_at: string
}

export interface Member {
  id: string
  tree_id: string
  name: string
  birth_year: number | null
  position_x: number | null
  position_y: number | null
  created_at: string
}

export interface Relationship {
  id: string
  tree_id: string
  source_id: string
  target_id: string
  type: 'parent' | 'spouse'
  created_at: string
}

export interface MemberNode {
  id: string
  type: 'memberNode'
  position: { x: number; y: number }
  data: {
    member: Member
  }
}
