'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { quizApi } from '@/lib/api'
import QuestionCard from './QuestionCard'
import type { QuizQuestion } from '@/types'

interface QuizPopupModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenFullQuiz: () => void
  selectedTimelineId?: string | null
  reviewMode?: boolean
}

export default function QuizPopupModal({
  isOpen,
  onClose,
  onOpenFullQuiz,
  selectedTimelineId,
  reviewMode = false,
}: QuizPopupModalProps) {
  const [showResult, setShowResult] = useState(false)
  const [userAnswer, setUserAnswer] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [question, setQuestion] = useState<QuizQuestion | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [nextReviewAt, setNextReviewAt] = useState<string | null>(null)

  // Fetch a single question on mount
  useEffect(() => {
    if (isOpen) {
      loadQuestion()
    }
  }, [isOpen, selectedTimelineId, reviewMode])

  const loadQuestion = async () => {
    setIsLoading(true)
    setShowResult(false)
    setUserAnswer(null)

    try {
      // First, create a session to track this popup question
      // Use force_fresh to always get questions based on current data
      const quizSession = await quizApi.generateQuiz({
        timeline_id: selectedTimelineId || undefined,
        question_categories: ['birth_year', 'death_year', 'quote', 'publication', 'connection', 'field'],
        difficulty: 'medium',
        question_count: 1,
        multiple_choice_ratio: 0.8,
        force_fresh: true, // Always generate fresh questions from current data
      })

      if (quizSession.questions.length > 0) {
        setQuestion(quizSession.questions[0])
        setSessionId(quizSession.id)
      }
    } catch (error) {
      console.error('Failed to load question:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswer = async (answer: string, timeTaken: number) => {
    if (!question || !sessionId) return

    setUserAnswer(answer)

    try {
      const validation = await quizApi.validateAnswer(
        question.question_id,
        answer,
        sessionId,
        timeTaken
      )

      setIsCorrect(validation.correct)
      setNextReviewAt(validation.next_review_at || null)
      setShowResult(true)

      // Complete the session
      await quizApi.completeSession(sessionId, timeTaken)
    } catch (error) {
      console.error('Failed to validate answer:', error)
      // Show result anyway with local validation
      setIsCorrect(answer.toLowerCase() === question.correct_answer.toLowerCase())
      setShowResult(true)
    }
  }

  const handleTimeUp = () => {
    if (question) {
      handleAnswer('', 30)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-b from-amber-50 to-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-700 text-white px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-serif font-semibold">
                {reviewMode ? 'Review Question' : 'Question of the Day'}
              </h2>
              <p className="text-amber-100 text-sm mt-1">
                Test your knowledge of intellectual history
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-amber-600 rounded-full transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-200 border-t-amber-700" />
              <p className="mt-4 text-gray-600 font-serif">Loading question...</p>
            </div>
          ) : question ? (
            <QuestionCard
              question={question}
              onAnswer={handleAnswer}
              showResult={showResult}
              userAnswer={userAnswer || undefined}
              isCorrect={isCorrect}
              timerEnabled={!reviewMode}
              timerSeconds={30}
              onTimeUp={handleTimeUp}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 font-serif">
                No questions available. Add more thinkers to your database!
              </p>
            </div>
          )}

          {/* Spaced repetition info */}
          {showResult && nextReviewAt && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
              <p className="text-sm text-blue-700">
                This question will come up for review on{' '}
                <span className="font-medium">
                  {new Date(nextReviewAt).toLocaleDateString()}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition"
          >
            {showResult ? 'Close' : 'Skip'}
          </button>

          <button
            onClick={onOpenFullQuiz}
            className="px-6 py-2 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Take Full Quiz
          </button>
        </div>
      </div>
    </div>
  )
}
