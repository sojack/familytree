'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'

const handleStyle = { background: 'transparent', border: 'none', width: 6, height: 6 }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function JunctionNodeComponent(props: NodeProps) {
  return (
    <div style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#667eea',
    }}>
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} isConnectable={false} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} isConnectable={false} />
    </div>
  )
}

export default memo(JunctionNodeComponent)
