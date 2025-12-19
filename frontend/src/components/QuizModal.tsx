'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { quizApi, timelinesApi } from '@/lib/api'
import QuestionCard from './QuestionCard'
import type {
  QuizQuestion,
  QuizQuestionCategory,
  QuizDifficulty,
  QuizConfig,
  QuizAnswer,
  AnswerValidation,
  CategoryBreakdown,
} from '@/types'

interface QuizModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTimelineId?: string | null
  onSelectThinker?: (thinkerId: string) => void
}

type QuizMode = 'config' | 'quiz' | 'results'

const CATEGORY_OPTIONS: { value: QuizQuestionCategory; label: string }[] = [
  { value: 'birth_year', label: 'Birth Years' },
  { value: 'death_year', label: 'Death Years' },
  { value: 'quote', label: 'Quotes' },
  { value: 'publication', label: 'Publications' },
  { value: 'connection', label: 'Connections' },
  { value: 'field', label: 'Fields' },
]

const DIFFICULTY_OPTIONS: { value: QuizDifficulty; label: string; description: string }[] = [
  { value: 'adaptive', label: 'Adaptive', description: 'Adjusts to your performance' },
  { value: 'easy', label: 'Easy', description: 'Basic facts with obvious options' },
  { value: 'medium', label: 'Medium', description: 'Moderate challenge' },
  { value: 'hard', label: 'Hard', description: 'Subtle distinctions required' },
]

export default function QuizModal({
  isOpen,
  onClose,
  selectedTimelineId,
  onSelectThinker,
}: QuizModalProps) {
  const [mode, setMode] = useState<QuizMode>('config')
  const [config, setConfig] = useState<QuizConfig>({
    timeline_id: selectedTimelineId || null,
    question_categories: ['birth_year', 'quote', 'connection'],
    difficulty: 'adaptive',
    question_count: 10,
    multiple_choice_ratio: 0.7,
    timer_enabled: true,
    timer_seconds: 30,
    use_spaced_repetition: true,
  })

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentDifficulty, setCurrentDifficulty] = useState<QuizDifficulty>('medium')
  const [streak, setStreak] = useState(0)
  const [longestStreak, setLongestStreak] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showAnswerResult, setShowAnswerResult] = useState(false)
  const [lastValidation, setLastValidation] = useState<AnswerValidation | null>(null)
  const [totalTime, setTotalTime] = useState(0)
  const startTimeRef = useRef<number>(0)

  // Fetch timelines for dropdown
  const { data: timelines = [] } = useQuery({
    queryKey: ['timelines'],
    queryFn: () => timelinesApi.getAll(),
  })

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('config')
      setConfig((prev) => ({
        ...prev,
        timeline_id: selectedTimelineId || null,
      }))
      setAnswers([])
      setCurrentIndex(0)
      setStreak(0)
      setLongestStreak(0)
      setTotalTime(0)
    }
  }, [isOpen, selectedTimelineId])

  const startQuiz = async () => {
    setIsLoading(true)

    try {
      const session = await quizApi.generateQuiz({
        timeline_id: config.timeline_id || undefined,
        question_categories: config.question_categories,
        difficulty: config.difficulty === 'adaptive' ? 'medium' : config.difficulty,
        question_count: config.question_count,
        multiple_choice_ratio: config.multiple_choice_ratio,
      })

      setQuestions(session.questions)
      setSessionId(session.id)
      setCurrentIndex(0)
      setAnswers([])
      setCurrentDifficulty(config.difficulty === 'adaptive' ? 'medium' : config.difficulty)
      startTimeRef.current = Date.now()
      setMode('quiz')
    } catch (error) {
      console.error('Failed to start quiz:', error)
      alert('Failed to generate quiz. Make sure you have thinkers in your database.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswer = async (answer: string, timeTaken: number) => {
    const question = questions[currentIndex]
    if (!question || !sessionId) return

    try {
      const validation = await quizApi.validateAnswer(
        question.question_id,
        answer,
        sessionId,
        timeTaken
      )

      setLastValidation(validation)

      const newAnswer: QuizAnswer = {
        question_id: question.question_id,
        user_answer: answer,
        is_correct: validation.correct,
        time_taken_seconds: timeTaken,
        answered_at: new Date().toISOString(),
      }
      setAnswers((prev) => [...prev, newAnswer])

      // Update streak
      if (validation.correct) {
        const newStreak = streak + 1
        setStreak(newStreak)
        setLongestStreak((prev) => Math.max(prev, newStreak))
      } else {
        setStreak(0)
      }

      // Update difficulty for adaptive mode
      if (config.difficulty === 'adaptive' && validation.next_difficulty) {
        setCurrentDifficulty(validation.next_difficulty)
      }

      setShowAnswerResult(true)
    } catch (error) {
      console.error('Failed to validate answer:', error)
      // Fallback to local validation
      const isCorrect = answer.toLowerCase() === question.correct_answer.toLowerCase()
      const newAnswer: QuizAnswer = {
        question_id: question.question_id,
        user_answer: answer,
        is_correct: isCorrect,
        time_taken_seconds: timeTaken,
        answered_at: new Date().toISOString(),
      }
      setAnswers((prev) => [...prev, newAnswer])
      setLastValidation({
        correct: isCorrect,
        explanation: question.explanation,
        correct_answer: question.correct_answer,
      })
      setShowAnswerResult(true)
    }
  }

  const handleNext = () => {
    setShowAnswerResult(false)
    setLastValidation(null)

    if (currentIndex + 1 >= questions.length) {
      // Quiz complete
      setTotalTime(Math.round((Date.now() - startTimeRef.current) / 1000))
      completeQuiz()
    } else {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const completeQuiz = async () => {
    if (sessionId) {
      try {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
        await quizApi.completeSession(sessionId, elapsed)
      } catch (error) {
        console.error('Failed to complete session:', error)
      }
    }
    setMode('results')
  }

  const handleTimeUp = () => {
    // Submit empty answer when time runs out
    handleAnswer('', config.timer_seconds || 30)
  }

  const calculateStats = () => {
    const correct = answers.filter((a) => a.is_correct).length
    const accuracy = answers.length > 0 ? (correct / answers.length) * 100 : 0
    const avgTime = answers.length > 0
      ? answers.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0) / answers.length
      : 0

    // Category breakdown
    const categoryMap = new Map<QuizQuestionCategory, { total: number; correct: number }>()
    answers.forEach((answer, idx) => {
      const question = questions[idx]
      if (!question) return

      const existing = categoryMap.get(question.category) || { total: 0, correct: 0 }
      categoryMap.set(question.category, {
        total: existing.total + 1,
        correct: existing.correct + (answer.is_correct ? 1 : 0),
      })
    })

    const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries()).map(
      ([category, stats]) => ({
        category,
        total: stats.total,
        correct: stats.correct,
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
      })
    )

    return {
      total: answers.length,
      correct,
      accuracy,
      avgTime,
      categoryBreakdown,
    }
  }

  const retakeQuiz = () => {
    setMode('config')
  }

  const reviewMistakes = async () => {
    // Create a quiz with only missed questions
    const missed = answers
      .map((a, idx) => (!a.is_correct ? questions[idx] : null))
      .filter((q): q is QuizQuestion => q !== null)

    if (missed.length === 0) {
      alert('No mistakes to review - perfect score!')
      return
    }

    setQuestions(missed)
    setCurrentIndex(0)
    setAnswers([])
    setStreak(0)
    startTimeRef.current = Date.now()
    setShowAnswerResult(false)
    setLastValidation(null)
    setMode('quiz')
  }

  if (!isOpen) return null

  const currentQuestion = questions[currentIndex]
  const stats = mode === 'results' ? calculateStats() : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-amber-700 text-white px-6 py-4 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-serif font-semibold">
                {mode === 'config' && 'Quiz Configuration'}
                {mode === 'quiz' && 'Knowledge Quiz'}
                {mode === 'results' && 'Quiz Results'}
              </h2>
              {mode === 'quiz' && (
                <div className="flex items-center gap-4 mt-2 text-amber-100 text-sm">
                  <span>Question {currentIndex + 1} of {questions.length}</span>
                  <span>|</span>
                  <span>Streak: {streak}</span>
                  {config.difficulty === 'adaptive' && (
                    <>
                      <span>|</span>
                      <span className="capitalize">Difficulty: {currentDifficulty}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-amber-600 rounded-full transition">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar for quiz mode */}
        {mode === 'quiz' && (
          <div className="h-2 bg-gray-200 shrink-0">
            <div
              className="h-full bg-amber-600 transition-all duration-300"
              style={{ width: `${((currentIndex + (showAnswerResult ? 1 : 0)) / questions.length) * 100}%` }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Configuration Screen */}
          {mode === 'config' && (
            <div className="space-y-6">
              {/* Timeline selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Timeline</label>
                <select
                  value={config.timeline_id || ''}
                  onChange={(e) => setConfig({ ...config, timeline_id: e.target.value || null })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">All Timelines</option>
                  {timelines.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Categories</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <label
                      key={cat.value}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition ${
                        config.question_categories.includes(cat.value)
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={config.question_categories.includes(cat.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfig({
                              ...config,
                              question_categories: [...config.question_categories, cat.value],
                            })
                          } else {
                            setConfig({
                              ...config,
                              question_categories: config.question_categories.filter((c) => c !== cat.value),
                            })
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFICULTY_OPTIONS.map((diff) => (
                    <label
                      key={diff.value}
                      className={`flex flex-col p-3 rounded-lg border-2 cursor-pointer transition ${
                        config.difficulty === diff.value
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="difficulty"
                        value={diff.value}
                        checked={config.difficulty === diff.value}
                        onChange={() => setConfig({ ...config, difficulty: diff.value })}
                        className="sr-only"
                      />
                      <span className="font-medium">{diff.label}</span>
                      <span className="text-xs text-gray-500">{diff.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Question count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Questions: {config.question_count}
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={config.question_count}
                  onChange={(e) => setConfig({ ...config, question_count: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5</span>
                  <span>50</span>
                </div>
              </div>

              {/* Multiple choice ratio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Multiple Choice: {Math.round(config.multiple_choice_ratio * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={config.multiple_choice_ratio * 100}
                  onChange={(e) => setConfig({ ...config, multiple_choice_ratio: parseInt(e.target.value) / 100 })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>All Short Answer</span>
                  <span>All Multiple Choice</span>
                </div>
              </div>

              {/* Timer toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">Timer</span>
                  <p className="text-sm text-gray-500">{config.timer_seconds} seconds per question</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, timer_enabled: !config.timer_enabled })}
                  className={`relative w-14 h-8 rounded-full transition ${
                    config.timer_enabled ? 'bg-amber-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      config.timer_enabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Spaced repetition toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">Include Review Questions</span>
                  <p className="text-sm text-gray-500">Add questions from your spaced repetition queue</p>
                </div>
                <button
                  onClick={() => setConfig({ ...config, use_spaced_repetition: !config.use_spaced_repetition })}
                  className={`relative w-14 h-8 rounded-full transition ${
                    config.use_spaced_repetition ? 'bg-amber-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      config.use_spaced_repetition ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Quiz Screen */}
          {mode === 'quiz' && currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              onAnswer={handleAnswer}
              showResult={showAnswerResult}
              userAnswer={answers[currentIndex]?.user_answer}
              isCorrect={lastValidation?.correct}
              disabled={showAnswerResult}
              timerEnabled={config.timer_enabled && !showAnswerResult}
              timerSeconds={config.timer_seconds}
              onTimeUp={handleTimeUp}
            />
          )}

          {/* Results Screen */}
          {mode === 'results' && stats && (
            <div className="space-y-6">
              {/* Score display */}
              <div className="text-center py-8 bg-gradient-to-b from-amber-50 to-white rounded-xl">
                <div className="text-6xl font-bold text-amber-700 mb-2">
                  {stats.correct}/{stats.total}
                </div>
                <div className="text-xl text-gray-600 mb-4">
                  {stats.accuracy.toFixed(0)}% Correct
                </div>
                <div className="flex justify-center gap-8 text-sm text-gray-500">
                  <div>
                    <span className="font-medium text-gray-700">{Math.round(stats.avgTime)}s</span>
                    <br />avg time
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">{longestStreak}</span>
                    <br />best streak
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">{Math.floor(totalTime / 60)}:{(totalTime % 60).toString().padStart(2, '0')}</span>
                    <br />total time
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              {stats.categoryBreakdown.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Performance by Category</h3>
                  <div className="space-y-2">
                    {stats.categoryBreakdown.map((cat) => (
                      <div key={cat.category} className="flex items-center gap-3">
                        <span className="w-28 text-sm text-gray-600 capitalize">
                          {cat.category.replace('_', ' ')}
                        </span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              cat.accuracy >= 80 ? 'bg-green-500' :
                              cat.accuracy >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${cat.accuracy}%` }}
                          />
                        </div>
                        <span className="w-16 text-sm text-right">
                          {cat.correct}/{cat.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missed questions review */}
              {answers.some((a) => !a.is_correct) && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Missed Questions</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {answers.map((answer, idx) => {
                      if (answer.is_correct) return null
                      const question = questions[idx]
                      return (
                        <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="font-medium text-gray-800 mb-2">{question?.question_text}</p>
                          <p className="text-sm text-red-600">Your answer: {answer.user_answer || '(no answer)'}</p>
                          <p className="text-sm text-green-600">Correct: {question?.correct_answer}</p>
                          {question?.related_thinker_ids?.[0] && onSelectThinker && (
                            <button
                              onClick={() => {
                                onSelectThinker(question.related_thinker_ids[0])
                                onClose()
                              }}
                              className="mt-2 text-sm text-amber-700 hover:underline"
                            >
                              View related thinker
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 shrink-0">
          {mode === 'config' && (
            <button
              onClick={startQuiz}
              disabled={isLoading || config.question_categories.length === 0}
              className="w-full py-3 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Quiz
                </>
              )}
            </button>
          )}

          {mode === 'quiz' && showAnswerResult && (
            <button
              onClick={handleNext}
              className="w-full py-3 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 transition"
            >
              {currentIndex + 1 >= questions.length ? 'See Results' : 'Next Question'}
            </button>
          )}

          {mode === 'results' && (
            <div className="flex gap-3">
              <button
                onClick={retakeQuiz}
                className="flex-1 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition"
              >
                New Quiz
              </button>
              {answers.some((a) => !a.is_correct) && (
                <button
                  onClick={reviewMistakes}
                  className="flex-1 py-3 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 transition"
                >
                  Review Mistakes
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
