'use client'

import { useState, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { aiApi, thinkersApi, connectionsApi, publicationsApi, quotesApi, ChatMessage, ChatCitation } from '@/lib/api'
import { ConnectionType, PublicationType } from '@/types'

interface AIChatPanelProps {
  isOpen: boolean
  onClose: () => void
  onThinkerSelect?: (thinkerId: string) => void
}

type TabType = 'chat' | 'summary' | 'add'

interface Message {
  role: 'user' | 'assistant'
  content: string
  citations?: ChatCitation[]
  followUpQuestions?: string[]
}

export function AIChatPanel({ isOpen, onClose, onThinkerSelect }: AIChatPanelProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Summary state
  const [summaryType, setSummaryType] = useState('overview')
  const [summaryTarget, setSummaryTarget] = useState('')
  const [summaryLength, setSummaryLength] = useState('medium')
  const [summaryResult, setSummaryResult] = useState<{
    summary: string
    key_points: string[]
    key_figures: string[]
    themes: string[]
  } | null>(null)

  // NL Entry state
  const [nlInput, setNlInput] = useState('')
  const [parsedResult, setParsedResult] = useState<{
    entity_type: string
    data: Record<string, unknown>
    confidence: number
    needs_clarification: string[]
  } | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: async (question: string) => {
      const history: ChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content,
      }))
      return aiApi.chat(question, history)
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        citations: data.citations,
        followUpQuestions: data.follow_up_questions,
      }])
      setIsLoading(false)
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }])
      setIsLoading(false)
    },
  })

  const summaryMutation = useMutation({
    mutationFn: async () => {
      return aiApi.generateSummary(
        summaryType,
        summaryType === 'thinker' ? summaryTarget : undefined,
        summaryType !== 'thinker' ? summaryTarget : undefined,
        summaryLength
      )
    },
    onSuccess: (data) => {
      setSummaryResult(data)
    },
  })

  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      return aiApi.parseNaturalLanguage(text)
    },
    onSuccess: (data) => {
      setParsedResult(data)
    },
  })

  const createFromParsedMutation = useMutation({
    mutationFn: async () => {
      if (!parsedResult) return

      const { entity_type, data } = parsedResult

      switch (entity_type) {
        case 'thinker':
          return thinkersApi.create({
            name: data.name as string,
            birth_year: data.birth_year as number | undefined,
            death_year: data.death_year as number | undefined,
            field: data.field as string | undefined,
            biography_notes: data.biography_notes as string | undefined,
          })
        case 'connection':
          if (data.from_thinker_id && data.to_thinker_id) {
            return connectionsApi.create({
              from_thinker_id: data.from_thinker_id as string,
              to_thinker_id: data.to_thinker_id as string,
              connection_type: (data.connection_type as string) as ConnectionType,
              notes: data.notes as string | undefined,
            })
          }
          throw new Error('Thinkers not found in database')
        case 'publication':
          if (data.thinker_id) {
            return publicationsApi.create({
              thinker_id: data.thinker_id as string,
              title: data.title as string,
              year: data.year as number | undefined,
              publication_type: (data.publication_type as string) as PublicationType | undefined,
            })
          }
          throw new Error('Thinker not found in database')
        case 'quote':
          if (data.thinker_id) {
            return quotesApi.create({
              thinker_id: data.thinker_id as string,
              text: data.text as string,
              source: data.source as string | undefined,
            })
          }
          throw new Error('Thinker not found in database')
        default:
          throw new Error('Unknown entity type')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thinkers'] })
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      queryClient.invalidateQueries({ queryKey: ['publications'] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      setParsedResult(null)
      setNlInput('')
    },
  })

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return

    setMessages(prev => [...prev, { role: 'user', content: inputValue }])
    setIsLoading(true)
    chatMutation.mutate(inputValue)
    setInputValue('')
  }

  const handleFollowUpClick = (question: string) => {
    setInputValue(question)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-800">AI Research Assistant</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(['chat', 'summary', 'add'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'chat' ? 'Ask Questions' : tab === 'summary' ? 'Generate Summary' : 'Quick Add'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <p className="text-lg mb-2">Ask questions about your research</p>
                    <p className="text-sm">Try asking:</p>
                    <div className="mt-2 space-y-1">
                      <button
                        onClick={() => setInputValue("Who are the most influential thinkers?")}
                        className="block mx-auto text-accent hover:underline text-sm"
                      >
                        "Who are the most influential thinkers?"
                      </button>
                      <button
                        onClick={() => setInputValue("What connections exist between philosophers?")}
                        className="block mx-auto text-accent hover:underline text-sm"
                      >
                        "What connections exist between philosophers?"
                      </button>
                      <button
                        onClick={() => setInputValue("Summarize the key themes in my database")}
                        className="block mx-auto text-accent hover:underline text-sm"
                      >
                        "Summarize the key themes in my database"
                      </button>
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === 'user'
                          ? 'bg-accent text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300">
                          <p className="text-xs font-medium mb-1">Sources:</p>
                          <div className="flex flex-wrap gap-1">
                            {msg.citations.map((citation, ci) => (
                              <button
                                key={ci}
                                onClick={() => onThinkerSelect?.(citation.id)}
                                className="text-xs px-2 py-0.5 bg-white/20 rounded hover:bg-white/30"
                              >
                                {citation.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-up questions */}
                      {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300">
                          <p className="text-xs font-medium mb-1">Follow-up questions:</p>
                          <div className="space-y-1">
                            {msg.followUpQuestions.map((q, qi) => (
                              <button
                                key={qi}
                                onClick={() => handleFollowUpClick(q)}
                                className="block text-xs text-left hover:underline"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full"></div>
                        <span className="text-sm text-gray-500">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask a question..."
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputValue.trim()}
                    className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Summary Type</label>
                  <select
                    value={summaryType}
                    onChange={(e) => setSummaryType(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="overview">Database Overview</option>
                    <option value="field">By Field</option>
                    <option value="period">By Time Period</option>
                  </select>
                </div>

                {summaryType !== 'overview' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {summaryType === 'field' ? 'Field Name' : 'Time Period'}
                    </label>
                    <input
                      type="text"
                      value={summaryTarget}
                      onChange={(e) => setSummaryTarget(e.target.value)}
                      placeholder={summaryType === 'field' ? 'e.g., Philosophy' : 'e.g., 1700-1800'}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                  <select
                    value={summaryLength}
                    onChange={(e) => setSummaryLength(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="short">Short (2-3 sentences)</option>
                    <option value="medium">Medium (1-2 paragraphs)</option>
                    <option value="detailed">Detailed (3-4 paragraphs)</option>
                  </select>
                </div>

                <button
                  onClick={() => summaryMutation.mutate()}
                  disabled={summaryMutation.isPending}
                  className="w-full px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
                >
                  {summaryMutation.isPending ? 'Generating...' : 'Generate Summary'}
                </button>
              </div>

              {summaryResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div>
                    <h3 className="font-medium text-gray-800 mb-2">Summary</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{summaryResult.summary}</p>
                  </div>

                  {summaryResult.key_points.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-1">Key Points</h4>
                      <ul className="list-disc list-inside text-sm text-gray-700">
                        {summaryResult.key_points.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaryResult.key_figures.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-1">Key Figures</h4>
                      <div className="flex flex-wrap gap-1">
                        {summaryResult.key_figures.map((name, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-accent/10 text-accent rounded">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {summaryResult.themes.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-800 mb-1">Themes</h4>
                      <div className="flex flex-wrap gap-1">
                        {summaryResult.themes.map((theme, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Quick Add Tab */}
          {activeTab === 'add' && (
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="text-sm text-gray-600 mb-4">
                <p className="mb-2">Enter information in natural language:</p>
                <ul className="list-disc list-inside text-xs space-y-1">
                  <li>"Add Immanuel Kant, born 1724, died 1804, philosopher"</li>
                  <li>"Kant influenced Hegel's dialectical method"</li>
                  <li>"Quote from Spinoza: All things excellent are as difficult as they are rare"</li>
                  <li>"Kant wrote Critique of Pure Reason in 1781"</li>
                </ul>
              </div>

              <textarea
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                placeholder="Type your entry here..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />

              <button
                onClick={() => parseMutation.mutate(nlInput)}
                disabled={parseMutation.isPending || !nlInput.trim()}
                className="w-full px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50"
              >
                {parseMutation.isPending ? 'Parsing...' : 'Parse Entry'}
              </button>

              {parsedResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Detected: <span className="text-accent capitalize">{parsedResult.entity_type}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      Confidence: {Math.round(parsedResult.confidence * 100)}%
                    </span>
                  </div>

                  <div className="text-sm space-y-1">
                    {Object.entries(parsedResult.data).map(([key, value]) => (
                      <div key={key} className="flex">
                        <span className="text-gray-500 w-32">{key}:</span>
                        <span className="text-gray-800">{String(value)}</span>
                      </div>
                    ))}
                  </div>

                  {parsedResult.needs_clarification.length > 0 && (
                    <div className="text-xs text-orange-600">
                      <p className="font-medium">Needs clarification:</p>
                      <ul className="list-disc list-inside">
                        {parsedResult.needs_clarification.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => createFromParsedMutation.mutate()}
                      disabled={createFromParsedMutation.isPending}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {createFromParsedMutation.isPending ? 'Creating...' : 'Create Entry'}
                    </button>
                    <button
                      onClick={() => setParsedResult(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
