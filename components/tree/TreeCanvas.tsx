'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
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
import { Member, Relationship } from '@/types'
import MemberNodeComponent from './MemberNode'
import AddMemberModal from './AddMemberModal'
import EditMemberModal from './EditMemberModal'
import styles from './TreeCanvas.module.css'

interface TreeCanvasProps {
  initialMembers: Member[]
  initialRelationships: Relationship[]
  treeId: string
}

const nodeTypes = {
  memberNode: MemberNodeComponent,
}

// Check if we're in dev bypass mode
const isDevBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'

export default function TreeCanvas({ initialMembers, initialRelationships, treeId }: TreeCanvasProps) {
  const initialNodes: Node[] = useMemo(() => {
    return initialMembers.map((member, index) => ({
      id: member.id,
      type: 'memberNode',
      position: { 
        x: 100 + (index % 3) * 250, 
        y: 100 + Math.floor(index / 3) * 150 
      },
      data: { member, isSelectedSource: false },
    }))
  }, [initialMembers])

  const initialEdges: Edge[] = useMemo(() => {
    return initialRelationships.map((rel) => {
      const isSpouse = rel.type === 'spouse'
      return {
        id: rel.id,
        source: rel.source_id,
        target: rel.target_id,
        sourceHandle: isSpouse ? 'right' : undefined,
        targetHandle: isSpouse ? 'left' : undefined,
        type: 'smoothstep',
        animated: isSpouse,
        style: { 
          stroke: isSpouse ? '#ec4899' : '#667eea',
          strokeWidth: isSpouse ? 3 : 2,
        },
        label: isSpouse ? '❤️' : undefined,
        labelStyle: { fontSize: 12 },
        data: { type: rel.type },
      }
    })
  }, [initialRelationships])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [connectMode, setConnectMode] = useState<'parent' | 'spouse' | null>(null)
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance)
    instance.fitView({ padding: 0.2 })
  }, [])

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialMembers, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialRelationships, setEdges])

  const handleAddMember = async (name: string, birthYear: string) => {
    const newMember: Member = {
      id: `local-${Date.now()}`,
      tree_id: treeId,
      name,
      birth_year: birthYear ? parseInt(birthYear) : null,
      created_at: new Date().toISOString(),
    }

    if (!isDevBypass) {
      // Save to database in production
      const supabase = createClient()
      const { data, error } = await supabase
        .from('members')
        .insert({
          tree_id: treeId,
          name,
          birth_year: birthYear ? parseInt(birthYear) : null,
        })
        .select()
        .single()

      if (error) {
        console.error('Error adding member:', error)
        return
      }
      newMember.id = data.id
    }

    const newX = 100 + (nodes.length % 3) * 250
    const newY = 100 + Math.floor(nodes.length / 3) * 150

    const newNode: Node = {
      id: newMember.id,
      type: 'memberNode',
      position: { x: newX, y: newY },
      data: { member: newMember, isSelectedSource: false },
    }

    setNodes((nds) => [...nds, newNode])
    setIsAddModalOpen(false)

    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.2 })
    }, 100)
  }

  const handleEditMember = async (id: string, name: string, birthYear: string) => {
    if (!isDevBypass) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('members')
        .update({
          name,
          birth_year: birthYear ? parseInt(birthYear) : null,
        })
        .eq('id', id)
        .eq('tree_id', treeId)
        .select()
        .single()

      if (error) {
        console.error('Error updating member:', error)
        return
      }
    }

    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                member: { 
                  ...node.data.member, 
                  name, 
                  birth_year: birthYear ? parseInt(birthYear) : null 
                } 
              } 
            }
          : node
      )
    )
    setEditingMember(null)
  }

  const handleDeleteMember = async (id: string) => {
    if (!isDevBypass) {
      const supabase = createClient()
      await supabase
        .from('relationships')
        .delete()
        .or(`source_id.eq.${id},target_id.eq.${id}`)
        .eq('tree_id', treeId)

      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id)
        .eq('tree_id', treeId)

      if (error) {
        console.error('Error deleting member:', error)
        return
      }
    }

    setNodes((nds) => nds.filter((node) => node.id !== id))
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id))
    setEditingMember(null)
  }

  const createRelationship = async (sourceId: string, targetId: string) => {
    console.log('Creating relationship:', { sourceId, targetId, connectMode, isDevBypass })
    
    if (!connectMode) {
      console.log('No connect mode set')
      return
    }

    if (sourceId === targetId) {
      alert('Cannot connect a person to themselves!')
      resetConnectionState()
      return
    }

    const existingEdge = edges.find(
      e => 
        (e.source === sourceId && e.target === targetId) ||
        (e.source === targetId && e.target === sourceId)
    )
    
    if (existingEdge) {
      alert('These people are already connected!')
      resetConnectionState()
      return
    }

    let relationshipId = `rel-${Date.now()}`

    if (!isDevBypass) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('relationships')
        .insert({
          tree_id: treeId,
          source_id: sourceId,
          target_id: targetId,
          type: connectMode,
        })
        .select()
        .single()

      if (error) {
        console.error('Database error:', error)
        alert('Error creating relationship: ' + error.message)
        resetConnectionState()
        return
      }
      relationshipId = data.id
      console.log('Database success:', data)
    } else {
      console.log('DEV MODE: Skipping database, using local ID')
    }

    const isSpouse = connectMode === 'spouse'
    
    const newEdge: Edge = {
      id: relationshipId,
      source: sourceId,
      target: targetId,
      type: 'smoothstep',
      animated: isSpouse,
      style: {
        stroke: isSpouse ? '#ec4899' : '#667eea',
        strokeWidth: isSpouse ? 3 : 2,
      },
      label: isSpouse ? '❤️' : undefined,
      labelStyle: { fontSize: 12 },
      data: { type: connectMode },
    }

    console.log('Adding edge:', newEdge)
    setEdges((eds) => {
      console.log('Previous edges count:', eds.length)
      const newEdges = [...eds, newEdge]
      console.log('New edges count:', newEdges.length)
      return newEdges
    })
    resetConnectionState()
  }

  const resetConnectionState = () => {
    setSelectedSource(null)
    setConnectMode(null)
    setNodes((nds) =>
      nds.map((node) => ({ ...node, data: { ...node.data, isSelectedSource: false } }))
    )
  }

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node.id, 'connectMode:', connectMode, 'selectedSource:', selectedSource)
    
    if (!connectMode) return
    event.stopPropagation()

    if (!selectedSource) {
      console.log('Selecting source:', node.id)
      setSelectedSource(node.id)
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isSelectedSource: n.id === node.id },
        }))
      )
    } else if (selectedSource !== node.id) {
      console.log('Creating connection from', selectedSource, 'to', node.id)
      createRelationship(selectedSource, node.id)
    }
  }, [connectMode, selectedSource])

  const onPaneClick = useCallback(() => {
    if (connectMode) {
      console.log('Canvas clicked, canceling connection mode')
      resetConnectionState()
    }
  }, [connectMode])

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
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
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

      <div className={styles.toolbar}>
        <button
          className={`${styles.toolbarButton} ${connectMode === 'parent' ? styles.active : ''}`}
          onClick={() => {
            if (connectMode === 'parent') {
              resetConnectionState()
            } else {
              setConnectMode('parent')
              setSelectedSource(null)
            }
          }}
        >
          👨‍👧 Parent
        </button>
        <button
          className={`${styles.toolbarButton} ${connectMode === 'spouse' ? styles.active : ''}`}
          onClick={() => {
            if (connectMode === 'spouse') {
              resetConnectionState()
            } else {
              setConnectMode('spouse')
              setSelectedSource(null)
            }
          }}
        >
          ❤️ Spouse
        </button>
        {connectMode && (
          <span className={styles.connectHint}>
            {selectedSource 
              ? 'Click another person to connect' 
              : 'Click a person to start'}
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
