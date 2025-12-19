'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { aiApi, connectionsApi, researchQuestionsApi, ConnectionSuggestion, ResearchSuggestion } from '@/lib/api'
import { ConnectionType } from '@/types'

interface AISuggestionsPanelProps {
  isOpen: boolean
  onClose: () => void
  selectedTimelineId?: string | null
}

type TabType = 'connections' | 'research' | 'status'

export function AISuggestionsPanel({ isOpen, onClose, selectedTimelineId }: AISuggestionsPanelProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('connections')

  const { data: aiStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['ai-status'],
    queryFn: aiApi.getStatus,
    retry: false,
    enabled: isOpen,
  })

  const {
    data: connectionSuggestions = [],
    isLoading: suggestionsLoading,
    refetch: refetchSuggestions,
  } = useQuery({
    queryKey: ['ai-connection-suggestions', selectedTimelineId],
    queryFn: () => aiApi.suggestConnections(5, selectedTimelineId || undefined),
    enabled: aiStatus?.enabled && activeTab === 'connections',
    retry: false,
  })

  const {
    data: researchSuggestions = [],
    isLoading: researchLoading,
    refetch: refetchResearch,
  } = useQuery({
    queryKey: ['ai-research-suggestions'],
    queryFn: () => aiApi.suggestResearch(5),
    enabled: aiStatus?.enabled && activeTab === 'research',
    retry: false,
  })

  const createConnectionMutation = useMutation({
    mutationFn: (suggestion: ConnectionSuggestion) =>
      connectionsApi.create({
        from_thinker_id: suggestion.from_thinker_id,
        to_thinker_id: suggestion.to_thinker_id,
        connection_type: suggestion.connection_type as ConnectionType,
        notes: `AI suggested: ${suggestion.reasoning}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      refetchSuggestions()
    },
  })

  const createQuestionMutation = useMutation({
    mutationFn: (suggestion: ResearchSuggestion) =>
      researchQuestionsApi.create({
        title: suggestion.question,
        description: `AI suggested: ${suggestion.rationale}`,
        category: suggestion.category as 'influence' | 'periodization' | 'methodology' | 'biography' | 'other',
        status: 'open',
        priority: 2,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-questions'] })
      refetchResearch()
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#129302;</span>
            <h2 className="text-lg font-semibold text-gray-800">AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(['connections', 'research', 'status'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'connections' ? 'Connection Ideas' : tab === 'research' ? 'Research Ideas' : 'Status'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Status Tab */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {statusLoading ? (
                <p className="text-gray-500">Checking AI status...</p>
              ) : aiStatus?.enabled ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <span className="text-lg">&#10003;</span>
                    <span className="font-medium">AI Features Enabled</span>
                  </div>
                  <p className="text-sm text-green-600">{aiStatus.message}</p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-700 mb-2">
                    <span className="text-lg">💡</span>
                    <span className="font-medium">AI Features Available</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Connect an AI provider to get intelligent suggestions for connections and research questions.
                  </p>
                  <div className="text-sm text-gray-500 bg-white rounded p-3 border">
                    <p className="font-medium mb-2">Quick Setup:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Create a <code className="bg-gray-100 px-1 rounded text-xs">.env</code> file in the backend folder</li>
                      <li>Add: <code className="bg-gray-100 px-1 rounded text-xs">DEEPSEEK_API_KEY=your_key</code></li>
                      <li>Restart the backend server</li>
                    </ol>
                    <p className="mt-2 text-xs text-gray-400">
                      Get a free API key at <a href="https://platform.deepseek.com" target="_blank" rel="noopener" className="text-accent hover:underline">platform.deepseek.com</a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Connection Suggestions Tab */}
          {activeTab === 'connections' && (
            <div className="space-y-4">
              {!aiStatus?.enabled ? (
                <p className="text-gray-500 text-sm">
                  AI features are not enabled. Check the Status tab for setup instructions.
                </p>
              ) : suggestionsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full mb-2"></div>
                  <p className="text-gray-500 text-sm">Analyzing thinker relationships...</p>
                </div>
              ) : connectionSuggestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No new connection suggestions available.</p>
                  <button
                    onClick={() => refetchSuggestions()}
                    className="mt-2 text-accent hover:underline text-sm"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-600">
                      AI-suggested intellectual connections
                    </p>
                    <button
                      onClick={() => refetchSuggestions()}
                      className="text-xs text-accent hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  {connectionSuggestions.map((suggestion, i) => (
                    <ConnectionSuggestionCard
                      key={i}
                      suggestion={suggestion}
                      onAccept={() => createConnectionMutation.mutate(suggestion)}
                      isAccepting={createConnectionMutation.isPending}
                    />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Research Suggestions Tab */}
          {activeTab === 'research' && (
            <div className="space-y-4">
              {!aiStatus?.enabled ? (
                <p className="text-gray-500 text-sm">
                  AI features are not enabled. Check the Status tab for setup instructions.
                </p>
              ) : researchLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full mb-2"></div>
                  <p className="text-gray-500 text-sm">Generating research ideas...</p>
                </div>
              ) : researchSuggestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No research suggestions available.</p>
                  <button
                    onClick={() => refetchResearch()}
                    className="mt-2 text-accent hover:underline text-sm"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-gray-600">
                      AI-suggested research questions
                    </p>
                    <button
                      onClick={() => refetchResearch()}
                      className="text-xs text-accent hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                  {researchSuggestions.map((suggestion, i) => (
                    <ResearchSuggestionCard
                      key={i}
                      suggestion={suggestion}
                      onAccept={() => createQuestionMutation.mutate(suggestion)}
                      isAccepting={createQuestionMutation.isPending}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConnectionSuggestionCard({
  suggestion,
  onAccept,
  isAccepting,
}: {
  suggestion: ConnectionSuggestion
  onAccept: () => void
  isAccepting: boolean
}) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-blue-600">{suggestion.from_thinker_name}</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="font-medium text-green-600">{suggestion.to_thinker_name}</span>
        </div>
        <span className="text-xs px-2 py-0.5 bg-gray-200 rounded capitalize">
          {suggestion.connection_type.replace('_', ' ')}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{suggestion.reasoning}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Confidence:</span>
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full"
              style={{ width: `${suggestion.confidence * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {Math.round(suggestion.confidence * 100)}%
          </span>
        </div>
        <button
          onClick={onAccept}
          disabled={isAccepting}
          className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50"
        >
          {isAccepting ? 'Adding...' : 'Add Connection'}
        </button>
      </div>
    </div>
  )
}

function ResearchSuggestionCard({
  suggestion,
  onAccept,
  isAccepting,
}: {
  suggestion: ResearchSuggestion
  onAccept: () => void
  isAccepting: boolean
}) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-800">{suggestion.question}</h4>
        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded capitalize">
          {suggestion.category}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-2">{suggestion.rationale}</p>
      {suggestion.related_thinkers.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          <span className="text-xs text-gray-400">Related:</span>
          {suggestion.related_thinkers.map((name, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 bg-gray-200 rounded"
            >
              {name}
            </span>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <button
          onClick={onAccept}
          disabled={isAccepting}
          className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {isAccepting ? 'Adding...' : 'Add Question'}
        </button>
      </div>
    </div>
  )
}
