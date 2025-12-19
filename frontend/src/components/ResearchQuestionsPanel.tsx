'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { researchQuestionsApi, thinkersApi } from '@/lib/api'
import type { ResearchQuestion, ResearchQuestionWithRelations, ResearchQuestionStats, Thinker, QuestionStatus, QuestionCategory, RelatedThinker } from '@/types'

interface ResearchQuestionsPanelProps {
  isOpen: boolean
  onClose: () => void
  onThinkerSelect?: (thinkerId: string) => void
}

export function ResearchQuestionsPanel({ isOpen, onClose, onThinkerSelect }: ResearchQuestionsPanelProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'stats'>('list')
  const [editingQuestion, setEditingQuestion] = useState<ResearchQuestionWithRelations | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterPriority, setFilterPriority] = useState<number | undefined>(undefined)
  const [formData, setFormData] = useState<{
    title: string
    description: string
    status: QuestionStatus
    category: QuestionCategory | null
    priority: number
    parent_question_id: string | null
    related_thinker_ids: string[]
  }>({
    title: '',
    description: '',
    status: 'open',
    category: null,
    priority: 3,
    parent_question_id: null,
    related_thinker_ids: [],
  })

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['research-questions', filterStatus, filterCategory, filterPriority],
    queryFn: () => researchQuestionsApi.getAll({
      status: filterStatus || undefined,
      category: filterCategory || undefined,
      priority: filterPriority,
    }),
    enabled: isOpen,
  })

  const { data: stats } = useQuery({
    queryKey: ['research-questions-stats'],
    queryFn: researchQuestionsApi.getStats,
    enabled: isOpen && activeTab === 'stats',
  })

  const { data: thinkers = [] } = useQuery({
    queryKey: ['thinkers'],
    queryFn: () => thinkersApi.getAll(),
    enabled: isOpen,
  })

  const createMutation = useMutation({
    mutationFn: researchQuestionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-questions'] })
      queryClient.invalidateQueries({ queryKey: ['research-questions-stats'] })
      resetForm()
      setActiveTab('list')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof researchQuestionsApi.update>[1] }) =>
      researchQuestionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-questions'] })
      queryClient.invalidateQueries({ queryKey: ['research-questions-stats'] })
      setEditingQuestion(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: researchQuestionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-questions'] })
      queryClient.invalidateQueries({ queryKey: ['research-questions-stats'] })
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'open',
      category: null,
      priority: 3,
      parent_question_id: null,
      related_thinker_ids: [],
    })
  }

  const handleSubmit = () => {
    if (!formData.title) return

    if (editingQuestion) {
      updateMutation.mutate({
        id: editingQuestion.id,
        data: {
          title: formData.title,
          description: formData.description || undefined,
          status: formData.status,
          category: formData.category || undefined,
          priority: formData.priority,
          parent_question_id: formData.parent_question_id,
          related_thinker_ids: formData.related_thinker_ids,
        },
      })
    } else {
      createMutation.mutate({
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        category: formData.category || undefined,
        priority: formData.priority,
        parent_question_id: formData.parent_question_id,
        related_thinker_ids: formData.related_thinker_ids,
      })
    }
  }

  const handleEdit = async (questionId: string) => {
    const question = await researchQuestionsApi.getOne(questionId)
    setEditingQuestion(question)
    setFormData({
      title: question.title,
      description: question.description || '',
      status: question.status || 'open',
      category: question.category || null,
      priority: question.priority || 3,
      parent_question_id: question.parent_question_id || null,
      related_thinker_ids: question.related_thinkers?.map((t: RelatedThinker) => t.id) || [],
    })
    setActiveTab('create')
  }

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  const cancelEdit = () => {
    setEditingQuestion(null)
    resetForm()
    setActiveTab('list')
  }

  const toggleThinker = (thinkerId: string) => {
    setFormData(prev => ({
      ...prev,
      related_thinker_ids: prev.related_thinker_ids.includes(thinkerId)
        ? prev.related_thinker_ids.filter(id => id !== thinkerId)
        : [...prev.related_thinker_ids, thinkerId],
    }))
  }

  if (!isOpen) return null

  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    answered: 'bg-green-100 text-green-800',
    abandoned: 'bg-gray-100 text-gray-800',
  }

  const priorityLabels: Record<number, string> = {
    1: 'Critical',
    2: 'High',
    3: 'Medium',
    4: 'Low',
    5: 'Someday',
  }

  // Group questions by parent for hierarchy display
  const rootQuestions = questions.filter((q: ResearchQuestion) => !q.parent_question_id)
  const childQuestions = questions.filter((q: ResearchQuestion) => q.parent_question_id)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-timeline">
          <h2 className="text-xl font-serif font-semibold text-primary">Research Questions</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="flex border-b border-timeline">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-sans ${
              activeTab === 'list'
                ? 'border-b-2 border-accent text-accent'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Questions
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 text-sm font-sans ${
              activeTab === 'stats'
                ? 'border-b-2 border-accent text-accent'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-sm font-sans ${
              activeTab === 'create'
                ? 'border-b-2 border-accent text-accent'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {editingQuestion ? 'Edit Question' : '+ New Question'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 mb-6 flex-wrap">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 border border-timeline rounded text-sm font-sans"
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="answered">Answered</option>
                  <option value="abandoned">Abandoned</option>
                </select>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1.5 border border-timeline rounded text-sm font-sans"
                >
                  <option value="">All Categories</option>
                  <option value="influence">Influence</option>
                  <option value="periodization">Periodization</option>
                  <option value="methodology">Methodology</option>
                  <option value="biography">Biography</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={filterPriority ?? ''}
                  onChange={(e) => setFilterPriority(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="px-3 py-1.5 border border-timeline rounded text-sm font-sans"
                >
                  <option value="">All Priorities</option>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {(filterStatus || filterCategory || filterPriority) && (
                  <button
                    onClick={() => {
                      setFilterStatus('')
                      setFilterCategory('')
                      setFilterPriority(undefined)
                    }}
                    className="px-3 py-1.5 text-sm text-accent hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {isLoading ? (
                <p className="text-secondary">Loading questions...</p>
              ) : questions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-secondary mb-4">No research questions yet</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90"
                  >
                    Create Your First Question
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {rootQuestions.map((question: ResearchQuestion) => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      childQuestions={childQuestions.filter((q: ResearchQuestion) => q.parent_question_id === question.id)}
                      statusColors={statusColors}
                      priorityLabels={priorityLabels}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onThinkerSelect={onThinkerSelect}
                      thinkers={thinkers}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Questions" value={stats.total} />
                <StatCard label="Open" value={stats.by_status.open || 0} color="blue" />
                <StatCard label="In Progress" value={stats.by_status.in_progress || 0} color="yellow" />
                <StatCard label="Answered" value={stats.by_status.answered || 0} color="green" />
              </div>

              <div className="border-t border-timeline pt-4">
                <h3 className="text-sm font-sans font-medium text-secondary mb-3">By Priority</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-serif">High Priority</span>
                    <span className="text-sm font-mono text-secondary">{stats.high_priority}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-serif">Medium Priority</span>
                    <span className="text-sm font-mono text-secondary">{stats.medium_priority}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  QUESTION TITLE *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="What do you want to explore?"
                />
              </div>

              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  DESCRIPTION / NOTES
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-timeline rounded font-serif focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Additional context, sub-questions, related thoughts..."
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    STATUS
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as QuestionStatus })}
                    className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="answered">Answered</option>
                    <option value="abandoned">Abandoned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    PRIORITY
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {Object.entries(priorityLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    CATEGORY
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: (e.target.value || null) as QuestionCategory | null })}
                    className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">None</option>
                    <option value="influence">Influence</option>
                    <option value="periodization">Periodization</option>
                    <option value="methodology">Methodology</option>
                    <option value="biography">Biography</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-sans font-medium text-secondary mb-1">
                    PARENT QUESTION
                  </label>
                  <select
                    value={formData.parent_question_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_question_id: e.target.value || null })}
                    className="w-full px-3 py-2 border border-timeline rounded font-sans focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="">None (Top Level)</option>
                    {rootQuestions
                      .filter((q: ResearchQuestion) => q.id !== editingQuestion?.id)
                      .map((q: ResearchQuestion) => (
                        <option key={q.id} value={q.id}>{q.title}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-sans font-medium text-secondary mb-1">
                  RELATED THINKERS
                </label>
                <div className="border border-timeline rounded p-3 max-h-40 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {thinkers.map((t: Thinker) => (
                      <button
                        key={t.id}
                        onClick={() => toggleThinker(t.id)}
                        className={`px-2 py-1 text-xs rounded font-sans transition-colors ${
                          formData.related_thinker_ids.includes(t.id)
                            ? 'bg-accent text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Click to select thinkers related to this question
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                {editingQuestion && (
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-timeline rounded font-sans text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!formData.title || createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-accent text-white rounded font-sans text-sm hover:bg-opacity-90 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingQuestion
                    ? 'Update Question'
                    : 'Create Question'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface QuestionCardProps {
  question: ResearchQuestion
  childQuestions: ResearchQuestion[]
  statusColors: Record<string, string>
  priorityLabels: Record<number, string>
  onEdit: (id: string) => void
  onDelete: (id: string, title: string) => void
  onThinkerSelect?: (thinkerId: string) => void
  thinkers: Thinker[]
  isChild?: boolean
}

function QuestionCard({
  question,
  childQuestions,
  statusColors,
  priorityLabels,
  onEdit,
  onDelete,
  onThinkerSelect,
  thinkers,
  isChild,
}: QuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className={`border rounded-lg ${isChild ? 'border-gray-200 ml-6' : 'border-timeline'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {childQuestions.length > 0 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
              <h4 className="font-serif font-medium text-primary">{question.title}</h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className={`px-2 py-0.5 rounded text-xs font-sans ${question.status ? statusColors[question.status] : 'bg-gray-100 text-gray-800'}`}>
                {question.status?.replace('_', ' ') || 'open'}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-sans bg-gray-100 text-gray-800">
                {priorityLabels[question.priority || 3]}
              </span>
              {question.category && (
                <span className="px-2 py-0.5 rounded text-xs font-sans bg-purple-100 text-purple-800">
                  {question.category}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 ml-2">
            <button
              onClick={() => onEdit(question.id)}
              className="px-2 py-1 text-xs text-accent hover:bg-gray-100 rounded"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(question.id, question.title)}
              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >
              Delete
            </button>
          </div>
        </div>
        {question.description && (
          <p className="text-sm font-serif text-secondary mt-2 whitespace-pre-wrap">
            {question.description}
          </p>
        )}
      </div>

      {isExpanded && childQuestions.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-2">
          <p className="text-xs text-gray-500 mb-2 px-2">Sub-questions:</p>
          <div className="space-y-2">
            {childQuestions.map((child: ResearchQuestion) => (
              <QuestionCard
                key={child.id}
                question={child}
                childQuestions={[]}
                statusColors={statusColors}
                priorityLabels={priorityLabels}
                onEdit={onEdit}
                onDelete={onDelete}
                onThinkerSelect={onThinkerSelect}
                thinkers={thinkers}
                isChild
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number
  color?: 'blue' | 'yellow' | 'green'
}

function StatCard({ label, value, color }: StatCardProps) {
  const bgColors = {
    blue: 'bg-blue-50',
    yellow: 'bg-yellow-50',
    green: 'bg-green-50',
  }

  return (
    <div className={`p-4 rounded-lg ${color ? bgColors[color] : 'bg-gray-50'}`}>
      <p className="text-xs font-sans text-secondary uppercase">{label}</p>
      <p className="text-2xl font-mono font-semibold text-primary">{value}</p>
    </div>
  )
}
