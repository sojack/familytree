export interface Member {
  id: string
  user_id: string
  name: string
  birth_year: number | null
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
