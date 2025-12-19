'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { thinkersApi, connectionsApi } from '@/lib/api'
import {
  calculateAllMetrics,
  calculateNetworkStats,
  findShortestPath,
  getClusterSummary,
  ThinkerMetrics,
} from '@/lib/networkMetrics'

interface NetworkMetricsPanelProps {
  isOpen: boolean
  onClose: () => void
  onThinkerSelect?: (thinkerId: string) => void
}

type TabType = 'overview' | 'rankings' | 'paths' | 'clusters'

export function NetworkMetricsPanel({
  isOpen,
  onClose,
  onThinkerSelect,
}: NetworkMetricsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [pathFromId, setPathFromId] = useState<string>('')
  const [pathToId, setPathToId] = useState<string>('')
  const [sortBy, setSortBy] = useState<keyof ThinkerMetrics>('pageRank')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
  })

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: connectionsApi.getAll,
  })

  const metrics = useMemo(
    () => calculateAllMetrics(thinkers, connections),
    [thinkers, connections]
  )

  const stats = useMemo(
    () => calculateNetworkStats(thinkers, connections),
    [thinkers, connections]
  )

  const clusters = useMemo(
    () => getClusterSummary(thinkers, connections),
    [thinkers, connections]
  )

  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
      }
      return 0
    })
  }, [metrics, sortBy, sortOrder])

  const pathResult = useMemo(() => {
    if (!pathFromId || !pathToId) return null
    return findShortestPath(pathFromId, pathToId, thinkers, connections)
  }, [pathFromId, pathToId, thinkers, connections])

  if (!isOpen) return null

  const handleSort = (column: keyof ThinkerMetrics) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            Network Analysis
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(['overview', 'rankings', 'paths', 'clusters'] as TabType[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize ${
                  activeTab === tab
                    ? 'border-b-2 border-brown-600 text-brown-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            )
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Thinkers" value={stats.totalThinkers} />
                <StatCard
                  label="Total Connections"
                  value={stats.totalConnections}
                />
                <StatCard
                  label="Avg. Connections"
                  value={stats.averageDegree.toFixed(2)}
                />
                <StatCard
                  label="Network Density"
                  value={`${(stats.networkDensity * 100).toFixed(1)}%`}
                />
              </div>

              {/* Top Influential */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Most Influential (by PageRank)
                </h3>
                <div className="space-y-1">
                  {stats.mostInfluential.map((m, i) => (
                    <div
                      key={m.thinkerId}
                      className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => onThinkerSelect?.(m.thinkerId)}
                    >
                      <span className="text-sm">
                        <span className="text-gray-400 mr-2">{i + 1}.</span>
                        {m.thinkerName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {(m.pageRank * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Most Connected */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Most Connected (by degree)
                </h3>
                <div className="space-y-1">
                  {stats.mostConnected.map((m, i) => (
                    <div
                      key={m.thinkerId}
                      className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => onThinkerSelect?.(m.thinkerId)}
                    >
                      <span className="text-sm">
                        <span className="text-gray-400 mr-2">{i + 1}.</span>
                        {m.thinkerName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {m.totalDegree} connections
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Rankings Tab */}
          {activeTab === 'rankings' && (
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Name</th>
                    <SortableHeader
                      label="In"
                      sortKey="inDegree"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Out"
                      sortKey="outDegree"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Total"
                      sortKey="totalDegree"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="PageRank"
                      sortKey="pageRank"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Betweenness"
                      sortKey="betweenness"
                      currentSort={sortBy}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedMetrics.map((m) => (
                    <tr
                      key={m.thinkerId}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => onThinkerSelect?.(m.thinkerId)}
                    >
                      <td className="py-2 px-2">{m.thinkerName}</td>
                      <td className="py-2 px-2 text-center">{m.inDegree}</td>
                      <td className="py-2 px-2 text-center">{m.outDegree}</td>
                      <td className="py-2 px-2 text-center">{m.totalDegree}</td>
                      <td className="py-2 px-2 text-center">
                        {(m.pageRank * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 px-2 text-center">
                        {m.betweenness.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paths Tab */}
          {activeTab === 'paths' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">
                    From
                  </label>
                  <select
                    value={pathFromId}
                    onChange={(e) => setPathFromId(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select thinker...</option>
                    {thinkers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">To</label>
                  <select
                    value={pathToId}
                    onChange={(e) => setPathToId(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select thinker...</option>
                    {thinkers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {pathFromId && pathToId && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  {pathResult ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Shortest path ({pathResult.length}{' '}
                        {pathResult.length === 1 ? 'step' : 'steps'}):
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {pathResult.pathNames.map((name, i) => (
                          <div key={i} className="flex items-center">
                            <span
                              className="px-2 py-1 bg-white rounded border text-sm cursor-pointer hover:bg-gray-100"
                              onClick={() =>
                                onThinkerSelect?.(pathResult.path[i])
                              }
                            >
                              {name}
                            </span>
                            {i < pathResult.pathNames.length - 1 && (
                              <span className="mx-2 text-gray-400">&rarr;</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No path found between these thinkers.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Clusters Tab */}
          {activeTab === 'clusters' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Detected {clusters.length} cluster
                {clusters.length !== 1 ? 's' : ''} using label propagation.
              </p>

              {clusters.map((cluster, i) => (
                <div key={cluster.clusterId} className="border rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Cluster {i + 1}
                    <span className="text-gray-400 font-normal ml-2">
                      ({cluster.members.length} members)
                    </span>
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {cluster.members.map((member) => (
                      <span
                        key={member.id}
                        className="px-2 py-1 bg-gray-100 rounded text-xs cursor-pointer hover:bg-gray-200"
                        onClick={() => onThinkerSelect?.(member.id)}
                      >
                        {member.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-2xl font-semibold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  sortOrder,
  onSort,
}: {
  label: string
  sortKey: keyof ThinkerMetrics
  currentSort: keyof ThinkerMetrics
  sortOrder: 'asc' | 'desc'
  onSort: (key: keyof ThinkerMetrics) => void
}) {
  const isActive = currentSort === sortKey

  return (
    <th
      className="py-2 px-2 cursor-pointer hover:bg-gray-100"
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-center gap-1">
        <span>{label}</span>
        {isActive && (
          <span className="text-xs">{sortOrder === 'desc' ? '▼' : '▲'}</span>
        )}
      </div>
    </th>
  )
}
