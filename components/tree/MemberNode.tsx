'use client'

import { Handle, Position, type NodeProps } from 'reactflow'
import { Member } from '@/types'
import styles from './MemberNode.module.css'

interface MemberNodeData {
  member: Member
  onEdit: (member: Member) => void
  onDelete: (id: string) => void
}

export default function MemberNodeComponent({ data }: NodeProps<MemberNodeData>) {
  const { member, onEdit, onDelete } = data
  
  return (
    <div className={styles.node}>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      
      <div className={styles.content}>
        <div className={styles.avatar}>
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className={styles.info}>
          <h3 className={styles.name}>{member.name}</h3>
          {member.birth_year && (
            <p className={styles.birthYear}>b. {member.birth_year}</p>
          )}
        </div>
      </div>
      
      <div className={styles.actions}>
        <button 
          className={styles.editButton}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(member)
          }}
          title="Edit"
        >
          ✎
        </button>
        <button 
          className={styles.deleteButton}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(member.id)
          }}
          title="Delete"
        >
          ×
        </button>
      </div>
      
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  )
}
