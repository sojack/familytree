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
import { Member } from '@/types'
import MemberNodeComponent from './MemberNode'
import AddMemberModal from './AddMemberModal'
import EditMemberModal from './EditMemberModal'
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
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
    setIsAddModalOpen(false)

    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.2 })
    }, 100)
  }

  const handleEditMember = async (id: string, name: string, birthYear: string) => {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('members')
      .update({
        name,
        birth_year: birthYear ? parseInt(birthYear) : null,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating member:', error)
      return
    }

    // Update the node in the canvas
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, member: data } }
          : node
      )
    )
    setEditingMember(null)
  }

  const handleDeleteMember = async (id: string) => {
    const supabase = createClient()

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting member:', error)
      return
    }

    // Remove the node from the canvas
    setNodes((nds) => nds.filter((node) => node.id !== id))
    setEditingMember(null)
  }

  // Add edit/delete handlers to each node's data
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: (member: Member) => setEditingMember(member),
        onDelete: (id: string) => {
          // Find member and open edit modal with delete confirmation
          const member = nodes.find((n) => n.id === id)?.data.member
          if (member) setEditingMember(member)
        },
      },
    }))
  }, [nodes])

  return (
    <div className={styles.canvasContainer}>
      <ReactFlow
        nodes={nodesWithHandlers}
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
        onClick={() => setIsAddModalOpen(true)}
      >
        + Add Person
      </button>

      {isAddModalOpen && (
        <AddMemberModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddMember}
        />
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleEditMember}
          onDelete={handleDeleteMember}
        />
      )}
    </div>
  )
}
