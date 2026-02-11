'use client'

import { Handle, Position, type NodeProps } from 'reactflow'
import { Member } from '@/types'
import styles from './MemberNode.module.css'

interface MemberNodeData {
  member: Member
  isSelectedSource: boolean
  onEdit: (member: Member) => void
  onDelete: (id: string) => void
}

export default function MemberNodeComponent({ data, selected }: NodeProps<MemberNodeData>) {
  const { member, isSelectedSource, onEdit, onDelete } = data
  
  return (
    <div className={`${styles.node} ${selected ? styles.selected : ''} ${isSelectedSource ? styles.selectedSource : ''}`}>
      {/* Top handle - target for parent connections (child receives here) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className={styles.handle}
        id="top"
      />
      
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
      
      {/* Bottom handle - source for parent connections (parent starts here) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className={styles.handle}
        id="bottom"
      />
      
      {/* Left side handles for spouses - overlapping so they look like one */}
      <Handle 
        type="source" 
        position={Position.Left} 
        className={`${styles.handle} ${styles.handleSide} ${styles.handleLeft}`}
        id="left"
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className={`${styles.handle} ${styles.handleSide} ${styles.handleLeftTarget}`}
        id="left-target"
      />
      
      {/* Right side handles for spouses - overlapping so they look like one */}
      <Handle 
        type="source" 
        position={Position.Right} 
        className={`${styles.handle} ${styles.handleSide} ${styles.handleRight}`}
        id="right"
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        className={`${styles.handle} ${styles.handleSide} ${styles.handleRightTarget}`}
        id="right-target"
      />
    </div>
  )
}
