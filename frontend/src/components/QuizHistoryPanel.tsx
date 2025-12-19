'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { quizApi } from '@/lib/api'
import type { QuizSessionSummary, QuizStatistics, QuizQuestion } from '@/types'

interface QuizHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  onStartReviewSession: () => void
}

type TabType = 'history' | 'statistics' | 'review'

const categoryLabels: Record<string, string> = {
  birth_year: 'Birth Years',
  death_year: 'Death Years',
  quote: 'Quotes',
  quote_completion: 'Quote Completion',
  publication: 'Publications',
  connection: 'Connections',
  field: 'Fields',
  biography: 'Biography',
}

export default function QuizHistoryPanel({
  isOpen,
  onClose,
  onStartReviewSession,
}: QuizHistoryPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('history')

  // Fetch quiz history
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['quiz-history'],
    queryFn: () => quizApi.getHistory(20),
    enabled: isOpen,
  })

  // Fetch statistics
  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['quiz-statistics'],
    queryFn: quizApi.getStatistics,
    enabled: isOpen,
  })

  // Fetch review queue
  const { data: reviewQueue = [], isLoading: reviewLoading } = useQuery({
    queryKey: ['quiz-review-queue'],
    queryFn: () => quizApi.getReviewQueue(20),
    enabled: isOpen,
  })

  if (!isOpen) return null

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-600'
    if (accuracy >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return '↑'
    if (trend < -5) return '↓'
    return '→'
  }

  const getTrendColor = (trend: number) => {
    if (trend > 5) return 'text-green-600'
    if (trend < -5) return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-40 flex flex-col">
      {/* Header */}
      <div className="bg-amber-700 text-white px-4 py-3 flex justify-between items-center shrink-0">
        <h2 className="text-lg font-serif font-semibold">Quiz History</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-amber-600 rounded-full transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 shrink-0">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-sm font-medium transition ${
            activeTab === 'history'
              ? 'border-b-2 border-amber-600 text-amber-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          History
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`flex-1 py-3 text-sm font-medium transition ${
            activeTab === 'statistics'
              ? 'border-b-2 border-amber-600 text-amber-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Statistics
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`flex-1 py-3 text-sm font-medium transition relative ${
            activeTab === 'review'
              ? 'border-b-2 border-amber-600 text-amber-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Review
          {reviewQueue.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {reviewQueue.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>No quiz history yet</p>
                <p className="text-sm">Take a quiz to see your results here</p>
              </div>
            ) : (
              history.map((session) => (
                <div
                  key={session.session_id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-gray-500">
                      {formatDate(session.created_at)}
                    </span>
                    <span className={`font-bold ${getAccuracyColor(session.accuracy_percentage)}`}>
                      {session.accuracy_percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">
                      {session.score}/{session.total_questions} correct
                    </span>
                    <span className={`text-xs px-2 py-1 rounded capitalize ${
                      session.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                      session.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      session.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {session.difficulty}
                    </span>
                  </div>
                  {session.timeline_name && (
                    <p className="text-xs text-gray-400 mt-1">
                      Timeline: {session.timeline_name}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Statistics Tab */}
        {activeTab === 'statistics' && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full" />
              </div>
            ) : statistics ? (
              <>
                {/* Overview cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-amber-50 rounded-lg text-center">
                    <div className="text-3xl font-bold text-amber-700">
                      {statistics.total_sessions}
                    </div>
                    <div className="text-sm text-gray-600">Quizzes Taken</div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg text-center">
                    <div className="text-3xl font-bold text-amber-700">
                      {statistics.total_questions_answered}
                    </div>
                    <div className="text-sm text-gray-600">Questions</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <div className={`text-3xl font-bold ${getAccuracyColor(statistics.overall_accuracy)}`}>
                      {statistics.overall_accuracy.toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-600">Overall Accuracy</div>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <div className={`text-3xl font-bold ${getTrendColor(statistics.improvement_trend)}`}>
                      {getTrendIcon(statistics.improvement_trend)} {Math.abs(statistics.improvement_trend).toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-600">Trend</div>
                  </div>
                </div>

                {/* Category performance */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Performance by Category</h3>
                  <div className="space-y-2">
                    {statistics.category_performance.map((cat) => (
                      <div key={cat.category} className="flex items-center gap-2">
                        <span className="w-24 text-xs text-gray-600 truncate">
                          {categoryLabels[cat.category] || cat.category}
                        </span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              cat.accuracy >= 80 ? 'bg-green-500' :
                              cat.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${cat.accuracy}%` }}
                          />
                        </div>
                        <span className="w-10 text-xs text-right font-medium">
                          {cat.accuracy.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Difficulty distribution */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Questions by Difficulty</h3>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-green-50 rounded-lg text-center">
                      <div className="text-xl font-bold text-green-700">
                        {statistics.difficulty_distribution.easy}
                      </div>
                      <div className="text-xs text-gray-600">Easy</div>
                    </div>
                    <div className="flex-1 p-3 bg-yellow-50 rounded-lg text-center">
                      <div className="text-xl font-bold text-yellow-700">
                        {statistics.difficulty_distribution.medium}
                      </div>
                      <div className="text-xs text-gray-600">Medium</div>
                    </div>
                    <div className="flex-1 p-3 bg-red-50 rounded-lg text-center">
                      <div className="text-xl font-bold text-red-700">
                        {statistics.difficulty_distribution.hard}
                      </div>
                      <div className="text-xs text-gray-600">Hard</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No statistics available
              </div>
            )}
          </div>
        )}

        {/* Review Tab */}
        {activeTab === 'review' && (
          <div className="space-y-4">
            {reviewLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full" />
              </div>
            ) : reviewQueue.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No questions to review</p>
                <p className="text-sm">Keep taking quizzes to build your review queue</p>
              </div>
            ) : (
              <>
                <div className="p-4 bg-amber-50 rounded-lg text-center mb-4">
                  <div className="text-2xl font-bold text-amber-700 mb-1">
                    {reviewQueue.length}
                  </div>
                  <div className="text-sm text-gray-600">Questions ready for review</div>
                </div>

                <button
                  onClick={onStartReviewSession}
                  className="w-full py-3 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Review Session
                </button>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Upcoming Questions</h4>
                  {reviewQueue.slice(0, 5).map((question, idx) => (
                    <div
                      key={question.question_id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="text-sm text-gray-800 line-clamp-2">
                        {question.question_text}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-gray-500 capitalize">
                          {categoryLabels[question.category] || question.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                          question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                          question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {question.difficulty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
