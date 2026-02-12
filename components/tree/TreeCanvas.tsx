'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type ReactFlowInstance,
  type NodeDragHandler,
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
  treeName?: string
}

const nodeTypes = {
  memberNode: MemberNodeComponent,
}

// Check if we're in dev bypass mode
const isDevBypass = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true'

export default function TreeCanvas({ initialMembers, initialRelationships, treeId, treeName }: TreeCanvasProps) {
  const initialNodes: Node[] = useMemo(() => {
    return initialMembers.map((member, index) => ({
      id: member.id,
      type: 'memberNode',
      position: {
        x: member.position_x ?? 100 + (index % 3) * 250,
        y: member.position_y ?? 100 + Math.floor(index / 3) * 150,
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

  // Editable tree name state
  const [currentTreeName, setCurrentTreeName] = useState(treeName || 'My Family Tree')
  const [isEditingName, setIsEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  const onNodeDragStop: NodeDragHandler = useCallback(async (_event, node) => {
    if (isDevBypass) return
    const supabase = createClient()
    const { error } = await supabase
      .from('members')
      .update({ position_x: node.position.x, position_y: node.position.y })
      .eq('id', node.id)
    if (error) {
      console.error('Error saving node position:', error)
    }
  }, [])

  const handleSaveTreeName = async () => {
    setIsEditingName(false)
    const trimmed = currentTreeName.trim()
    if (!trimmed) {
      setCurrentTreeName(treeName || 'My Family Tree')
      return
    }
    if (trimmed === treeName) return
    if (!isDevBypass) {
      const supabase = createClient()
      const { error } = await supabase
        .from('trees')
        .update({ name: trimmed })
        .eq('id', treeId)
      if (error) {
        console.error('Error updating tree name:', error)
        setCurrentTreeName(treeName || 'My Family Tree')
      }
    }
  }

  const handleAddMember = async (name: string, birthYear: string) => {
    const newMember: Member = {
      id: `local-${Date.now()}`,
      tree_id: treeId,
      name,
      birth_year: birthYear ? parseInt(birthYear) : null,
      position_x: null,
      position_y: null,
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
      const { error } = await supabase
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
    if (!connectMode) return

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
        console.error('Error creating relationship:', error)
        alert('Error creating relationship. Please try again.')
        resetConnectionState()
        return
      }
      relationshipId = data.id
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

    setEdges((eds) => [...eds, newEdge])
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
    if (!connectMode) return
    event.stopPropagation()

    if (!selectedSource) {
      setSelectedSource(node.id)
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isSelectedSource: n.id === node.id },
        }))
      )
    } else if (selectedSource !== node.id) {
      createRelationship(selectedSource, node.id)
    }
  }, [connectMode, selectedSource])

  const onPaneClick = useCallback(() => {
    if (connectMode) {
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
        onNodeDragStop={onNodeDragStop}
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
        {treeName !== undefined && (
          isEditingName ? (
            <input
              ref={nameInputRef}
              className={styles.treeNameInput}
              value={currentTreeName}
              onChange={(e) => setCurrentTreeName(e.target.value)}
              onBlur={handleSaveTreeName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTreeName()
                if (e.key === 'Escape') {
                  setCurrentTreeName(treeName || 'My Family Tree')
                  setIsEditingName(false)
                }
              }}
            />
          ) : (
            <button
              className={styles.treeNameButton}
              onClick={() => setIsEditingName(true)}
              title="Click to rename"
            >
              {currentTreeName}
            </button>
          )
        )}
        {treeName !== undefined && <span className={styles.toolbarDivider} />}
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
          Parent
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
          Spouse
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
