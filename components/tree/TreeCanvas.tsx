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
  type Connection,
  type ReactFlowInstance,
  type NodeDragHandler,
  type NodeChange,
  type EdgeChange,
  ConnectionMode,
  ConnectionLineType,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { createClient } from '@/lib/supabase/client'
import { Member, Relationship } from '@/types'
import MemberNodeComponent from './MemberNode'
import JunctionNodeComponent from './JunctionNode'
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
  junction: JunctionNodeComponent,
}

const JUNCTION_SIZE = 8

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
      data: { member },
    }))
  }, [initialMembers])

  const initialEdges: Edge[] = useMemo(() => {
    return initialRelationships.map((rel) => {
      const isSpouse = rel.type === 'spouse'
      return {
        id: rel.id,
        source: rel.source_id,
        target: rel.target_id,
        sourceHandle: isSpouse ? 'right' : 'bottom',
        targetHandle: isSpouse ? 'left' : 'top',
        type: 'smoothstep',
        animated: false,
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

  // Raw state: only member nodes and relationship edges
  const [nodes, setNodes, onMemberNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onRawEdgesChange] = useEdgesState(initialEdges)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)

  // Editable tree name state
  const [currentTreeName, setCurrentTreeName] = useState(treeName || 'My Family Tree')
  const [isEditingName, setIsEditingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Compute junction nodes and transformed edges for display
  const { displayNodes, displayEdges } = useMemo(() => {
    const spouseEdges = edges.filter(e => e.data?.type === 'spouse')
    const parentEdges = edges.filter(e => e.data?.type === 'parent')

    // Map each parent to their children
    const parentChildren = new Map<string, Set<string>>()
    for (const pe of parentEdges) {
      if (!parentChildren.has(pe.source)) parentChildren.set(pe.source, new Set())
      parentChildren.get(pe.source)!.add(pe.target)
    }

    const junctionNodes: Node[] = []
    const transformedEdges: Edge[] = []
    const handledParentEdgeIds = new Set<string>()
    const handledSpouseEdgeIds = new Set<string>()

    for (const se of spouseEdges) {
      // Collect children of either spouse
      const s1Children = parentChildren.get(se.source) || new Set<string>()
      const s2Children = parentChildren.get(se.target) || new Set<string>()
      const allChildren = new Set([...s1Children, ...s2Children])

      if (allChildren.size === 0) continue

      const s1 = nodes.find(n => n.id === se.source)
      const s2 = nodes.find(n => n.id === se.target)
      if (!s1 || !s2) continue

      handledSpouseEdgeIds.add(se.id)
      const junctionId = `junction-${se.id}`

      // Position junction at midpoint of the spouse connection line
      const nodeW = s1.width ?? 160
      const nodeH = s1.height ?? 120
      junctionNodes.push({
        id: junctionId,
        type: 'junction',
        position: {
          x: (s1.position.x + nodeW + s2.position.x) / 2 - JUNCTION_SIZE / 2,
          y: (s1.position.y + s2.position.y) / 2 + nodeH / 2 - JUNCTION_SIZE / 2,
        },
        data: {},
        draggable: false,
        selectable: false,
        focusable: false,
      })

      // Split spouse edge into two halves through junction
      const spouseStyle = se.style
      transformedEdges.push({
        id: `${se.id}-a`,
        source: se.source,
        target: junctionId,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'smoothstep',
        animated: false,
        style: spouseStyle,
        data: { ...se.data, rawEdgeIds: [se.id] },
      })
      transformedEdges.push({
        id: `${se.id}-b`,
        source: junctionId,
        target: se.target,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'smoothstep',
        animated: false,
        style: spouseStyle,
        data: { ...se.data, rawEdgeIds: [se.id] },
      })

      // Junction → child edges
      for (const childId of allChildren) {
        // Find parent edge(s) from either spouse to this child
        const parentEdgeIds = parentEdges
          .filter(pe => (pe.source === se.source || pe.source === se.target) && pe.target === childId)
          .map(pe => pe.id)
        transformedEdges.push({
          id: `${junctionId}-${childId}`,
          source: junctionId,
          target: childId,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#667eea', strokeWidth: 2 },
          data: { type: 'parent', rawEdgeIds: parentEdgeIds },
        })
      }

      // Mark original parent edges as handled
      for (const pe of parentEdges) {
        if ((pe.source === se.source || pe.source === se.target) && allChildren.has(pe.target)) {
          handledParentEdgeIds.add(pe.id)
        }
      }
    }

    // Pass through unhandled spouse edges as-is
    for (const se of spouseEdges) {
      if (!handledSpouseEdgeIds.has(se.id)) {
        transformedEdges.push({ ...se, data: { ...se.data, rawEdgeIds: [se.id] } })
      }
    }

    // Pass through unhandled parent edges as-is
    for (const pe of parentEdges) {
      if (!handledParentEdgeIds.has(pe.id)) {
        transformedEdges.push({ ...pe, data: { ...pe.data, rawEdgeIds: [pe.id] } })
      }
    }

    return {
      displayNodes: [...nodes, ...junctionNodes],
      displayEdges: transformedEdges,
    }
  }, [nodes, edges])

  // Filter out junction node changes so they don't pollute member state
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const memberChanges = changes.filter((c) => {
      if (c.type === 'add' || c.type === 'reset') return true
      return !c.id.startsWith('junction-')
    })
    onMemberNodesChange(memberChanges)
  }, [onMemberNodesChange])

  // Filter display-only edge changes so they map back to raw edges.
  // We manage all edge add/remove ourselves via setEdges, so only allow
  // select and reset changes through — otherwise ReactFlow's diff between
  // displayEdges and raw edges corrupts state when junctions transform edges.
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const rawChanges = changes.filter((c) => {
      if (c.type === 'reset') return true
      // Block add/remove — we handle these via setEdges in onConnect/onEdgeClick
      if (c.type === 'add' || c.type === 'remove') return false
      // For select etc., only pass through for raw edges (not display-only)
      if ('id' in c) {
        const id = c.id
        if (id.startsWith('junction-') || id.endsWith('-a') || id.endsWith('-b')) return false
      }
      return true
    })
    onRawEdgesChange(rawChanges)
  }, [onRawEdgesChange])

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
    if (node.id.startsWith('junction-')) return
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
      data: { member: newMember },
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

  const onConnect = useCallback(async (connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection
    if (!source || !target || source === target) return

    // Determine relationship type from handle positions
    const sideHandles = ['left', 'right']
    const verticalHandles = ['top', 'bottom']

    const sourceIsSide = sideHandles.includes(sourceHandle || '')
    const targetIsSide = sideHandles.includes(targetHandle || '')
    const sourceIsVertical = verticalHandles.includes(sourceHandle || '')
    const targetIsVertical = verticalHandles.includes(targetHandle || '')

    let relType: 'spouse' | 'parent'
    let parentId: string
    let childId: string

    if (sourceIsSide && targetIsSide) {
      // Side → Side = spouse
      relType = 'spouse'
      parentId = source
      childId = target
    } else if (sourceIsVertical && targetIsVertical) {
      // Vertical → Vertical = parent
      // Normalize: bottom-side is parent, top-side is child
      relType = 'parent'
      if (sourceHandle === 'bottom') {
        parentId = source
        childId = target
      } else {
        // top → bottom means child dragged to parent, reverse
        parentId = target
        childId = source
      }
    } else {
      // Mixed handle types — ignore
      return
    }

    // Check for duplicate edges
    const existingEdge = edges.find(
      e =>
        (e.source === parentId && e.target === childId) ||
        (e.source === childId && e.target === parentId)
    )
    if (existingEdge) return

    let relationshipId = `rel-${Date.now()}`

    const sourceId = relType === 'spouse' ? source : parentId
    const targetId = relType === 'spouse' ? target : childId

    if (!isDevBypass) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('relationships')
        .insert({
          tree_id: treeId,
          source_id: sourceId,
          target_id: targetId,
          type: relType,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating relationship:', error)
        return
      }
      relationshipId = data.id
    }

    const isSpouse = relType === 'spouse'

    const newEdge: Edge = {
      id: relationshipId,
      source: sourceId,
      target: targetId,
      sourceHandle: isSpouse ? 'right' : 'bottom',
      targetHandle: isSpouse ? 'left' : 'top',
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: isSpouse ? '#ec4899' : '#667eea',
        strokeWidth: isSpouse ? 3 : 2,
      },
      label: isSpouse ? '❤️' : undefined,
      labelStyle: { fontSize: 12 },
      data: { type: relType },
    }

    setEdges((eds) => [...eds, newEdge])
  }, [treeId, edges, setEdges])

  const onEdgeClick = useCallback(async (_event: React.MouseEvent, edge: Edge) => {
    const rawEdgeIds: string[] = edge.data?.rawEdgeIds || [edge.id]
    const edgeType = edge.data?.type === 'spouse' ? 'spouse' : 'parent'
    if (!confirm(`Delete this ${edgeType} connection?`)) return

    if (!isDevBypass) {
      const supabase = createClient()
      for (const id of rawEdgeIds) {
        const { error } = await supabase
          .from('relationships')
          .delete()
          .eq('id', id)
          .eq('tree_id', treeId)
        if (error) {
          console.error('Error deleting relationship:', error)
        }
      }
    }

    setEdges((eds) => eds.filter((e) => !rawEdgeIds.includes(e.id)))
  }, [treeId, setEdges])

  const nodesWithHandlers = useMemo(() => {
    return displayNodes.map((node) => {
      if (node.type === 'junction') return node
      return {
        ...node,
        data: {
          ...node.data,
          onEdit: (member: Member) => setEditingMember(member),
          onDelete: (id: string) => {
            const found = nodes.find((n) => n.id === id)
            if (found?.data?.member) setEditingMember(found.data.member)
          },
        },
      }
    })
  }, [displayNodes, nodes])

  return (
    <div className={styles.canvasContainer}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={displayEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: '#667eea', strokeWidth: 2 }}
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

      {treeName !== undefined && (
        <div className={styles.toolbar}>
          {isEditingName ? (
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
          )}
        </div>
      )}

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
