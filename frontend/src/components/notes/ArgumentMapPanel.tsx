'use client'

import { useQuery } from '@tanstack/react-query'

import { analysisApi } from '@/lib/api'

interface ArgumentMapPanelProps {
  noteIds: string[]
}

export function ArgumentMapPanel({ noteIds }: ArgumentMapPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['argument-map', noteIds],
    queryFn: () => analysisApi.getArgumentMap(noteIds),
    enabled: noteIds.length > 0,
  })

  if (isLoading) return <p className="text-xs text-secondary">Building argument map...</p>
  if (!data) return <p className="text-xs text-secondary">Select notes to build an argument map.</p>

  return (
    <div className="space-y-2">
      <p className="text-xs text-secondary">
        {data.nodes.length} nodes, {data.edges.length} edges
      </p>
      <div className="space-y-1 max-h-44 overflow-y-auto">
        {data.nodes.map((node) => (
          <div key={node.id} className="p-2 rounded border border-gray-100 text-xs">
            <span className="uppercase text-[10px] text-secondary mr-1">{node.node_type}</span>
            {node.label}
          </div>
        ))}
      </div>
    </div>
  )
}
