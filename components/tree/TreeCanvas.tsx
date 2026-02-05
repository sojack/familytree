'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { createClient } from '@/lib/supabase/client'
import { Member, Relationship } from '@/types'
import MemberNodeComponent from './MemberNode'
import AddMemberModal from './AddMemberModal'
import EditMemberModal from './EditMemberModal'
import styles from './TreeCanvas.module.css'

interface TreeCanvasProps {
  initialMembers: Member[]
  initialRelationships: Relationship[]
  userId: string
}

const nodeTypes = {
  memberNode: MemberNodeComponent,
}

export default function TreeCanvas({ initialMembers, initialRelationships, userId }: TreeCanvasProps) {
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

  // Convert relationships to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return initialRelationships.map((rel) => ({
      id: rel.id,
      source: rel.source_id,
      target: rel.target_id,
      type: 'smoothstep',
      animated: rel.type === 'spouse',
      style: { 
        stroke: rel.type === 'spouse' ? '#ec4899' : '#667eea',
        strokeWidth: rel.type === 'spouse' ? 3 : 2,
      },
      label: rel.type === 'spouse' ? '❤️' : undefined,
      labelStyle: { fontSize: 12 },
      data: { type: rel.type },
    }))
  }, [initialRelationships])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [connectMode, setConnectMode] = useState<'parent' | 'spouse' | null>(null)

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance)
    instance.fitView({ padding: 0.2 })
  }, [])

  // Update nodes when initialMembers change (from server)
  useEffect(() => {
    setNodes(initialNodes)
  }, [initialMembers, setNodes])

  // Update edges when initialRelationships change (from server)
  useEffect(() => {
    setEdges(initialEdges)
  }, [initialRelationships, setEdges])

  const handleAddMember = async (name: string, birthYear: string) => {
    const supabase = createClient()
    
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

    // Delete related relationships first
    await supabase
      .from('relationships')
      .delete()
      .or(`source_id.eq.${id},target_id.eq.${id}`)
      .eq('user_id', userId)

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting member:', error)
      return
    }

    setNodes((nds) => nds.filter((node) => node.id !== id))
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id))
    setEditingMember(null)
  }

  // Handle creating relationships by connecting nodes
  const onConnect = useCallback(async (connection: Connection) => {
    if (!connectMode || !connection.source || !connection.target) {
      // If not in connect mode, don't create edges
      return
    }

    const supabase = createClient()

    // Prevent self-connections
    if (connection.source === connection.target) {
      alert('Cannot connect a person to themselves!')
      return
    }

    // Check if relationship already exists
    const existingEdge = edges.find(
      e => 
        (e.source === connection.source && e.target === connection.target) ||
        (e.source === connection.target && e.target === connection.source)
    )
    
    if (existingEdge) {
      alert('These people are already connected!')
      return
    }

    const { data, error } = await supabase
      .from('relationships')
      .insert({
        user_id: userId,
        source_id: connection.source,
        target_id: connection.target,
        type: connectMode,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating relationship:', error)
      if (error.code === '23505') {
        alert('This relationship already exists!')
      }
      return
    }

    const newEdge: Edge = {
      id: data.id,
      source: connection.source,
      target: connection.target,
      type: 'smoothstep',
      animated: connectMode === 'spouse',
      style: {
        stroke: connectMode === 'spouse' ? '#ec4899' : '#667eea',
        strokeWidth: connectMode === 'spouse' ? 3 : 2,
      },
      label: connectMode === 'spouse' ? '❤️' : undefined,
      labelStyle: { fontSize: 12 },
      data: { type: connectMode },
    }

    setEdges((eds) => addEdge(newEdge, eds))
    setConnectMode(null) // Exit connect mode after creating
  }, [connectMode, edges, userId])

  // Add handlers to each node's data
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: (member: Member) => setEditingMember(member),
        onDelete: (id: string) => {
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
        onConnect={onConnect}
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

      {/* Connection Mode Toolbar */}
      <div className={styles.toolbar}>
        <button
          className={`${styles.toolbarButton} ${connectMode === 'parent' ? styles.active : ''}`}
          onClick={() => setConnectMode(connectMode === 'parent' ? null : 'parent')}
          title="Connect Parent → Child"
        >
          👨‍👧 Parent
        </button>
        <button
          className={`${styles.toolbarButton} ${connectMode === 'spouse' ? styles.active : ''}`}
          onClick={() => setConnectMode(connectMode === 'spouse' ? null : 'spouse')}
          title="Connect Spouses"
        >
          ❤️ Spouse
        </button>
        {connectMode && (
          <span className={styles.connectHint}>
            Drag from one person to another
          </span>
        )}
      </div>

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
