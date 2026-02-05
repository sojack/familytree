'use client'

import { useState, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { createClient } from '@/lib/supabase/client'
import { Member, MemberNode } from '@/types'
import MemberNodeComponent from './MemberNode'
import AddMemberModal from './AddMemberModal'
import styles from './TreeCanvas.module.css'

interface TreeCanvasProps {
  initialMembers: Member[]
  userId: string
}

const nodeTypes = {
  memberNode: MemberNodeComponent,
}

export default function TreeCanvas({ initialMembers, userId }: TreeCanvasProps) {
  // Convert members to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return initialMembers.map((member, index) => ({
      id: member.id,
      type: 'memberNode',
      position: { 
        x: 100 + (index % 3) * 250, 
        y: 100 + Math.floor(index / 3) * 150 
      },
      data: { member },
    }))
  }, [initialMembers])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance)
    instance.fitView({ padding: 0.2 })
  }, [])

  const handleAddMember = async (name: string, birthYear: string) => {
    const supabase = createClient()
    
    // Find a good position for the new node
    const newX = 100 + (nodes.length % 3) * 250
    const newY = 100 + Math.floor(nodes.length / 3) * 150

    const { data, error } = await supabase
      .from('members')
      .insert({
        user_id: userId,
        name,
        birth_year: birthYear ? parseInt(birthYear) : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding member:', error)
      return
    }

    const newNode: Node = {
      id: data.id,
      type: 'memberNode',
      position: { x: newX, y: newY },
      data: { member: data },
    }

    setNodes((nds) => [...nds, newNode])
    setIsModalOpen(false)

    // Center view on new node after a short delay
    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.2 })
    }, 100)
  }

  return (
    <div className={styles.canvasContainer}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        className={styles.reactFlow}
      >
        <Background color="#cbd5e1" gap={20} />
        <Controls />
        <MiniMap 
          nodeStrokeColor="#667eea"
          nodeColor="#e0e7ff"
          className={styles.miniMap}
        />
      </ReactFlow>

      <button
        className={styles.addButton}
        onClick={() => setIsModalOpen(true)}
      >
        + Add Person
      </button>

      {isModalOpen && (
        <AddMemberModal
          onClose={() => setIsModalOpen(false)}
          onAdd={handleAddMember}
        />
      )}
    </div>
  )
}
