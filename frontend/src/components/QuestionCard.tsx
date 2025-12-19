'use client'

import { useState, useEffect, useRef } from 'react'
import type { QuizQuestion, QuizDifficulty } from '@/types'

interface QuestionCardProps {
  question: QuizQuestion
  onAnswer: (answer: string, timeTaken: number) => void
  showResult?: boolean
  userAnswer?: string
  isCorrect?: boolean
  disabled?: boolean
  timerEnabled?: boolean
  timerSeconds?: number
  onTimeUp?: () => void
}

const difficultyColors: Record<QuizDifficulty, string> = {
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
  adaptive: 'bg-blue-100 text-blue-800',
}

const categoryLabels: Record<string, string> = {
  birth_year: 'Birth Year',
  death_year: 'Death Year',
  quote: 'Quote',
  quote_completion: 'Quote Completion',
  publication: 'Publication',
  connection: 'Connection',
  field: 'Field',
  biography: 'Biography',
}

export default function QuestionCard({
  question,
  onAnswer,
  showResult = false,
  userAnswer,
  isCorrect,
  disabled = false,
  timerEnabled = false,
  timerSeconds = 30,
  onTimeUp,
}: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [shortAnswer, setShortAnswer] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(timerSeconds)
  const [startTime] = useState(Date.now())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Timer effect
  useEffect(() => {
    if (timerEnabled && !showResult && !disabled) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current)
            onTimeUp?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerEnabled, showResult, disabled, onTimeUp])

  // Reset state when question changes
  useEffect(() => {
    setSelectedOption(null)
    setShortAnswer('')
    setTimeRemaining(timerSeconds)
  }, [question.question_id, timerSeconds])

  const handleSubmit = () => {
    if (disabled || showResult) return

    const answer = question.question_type === 'multiple_choice' ? selectedOption : shortAnswer
    if (!answer) return

    const timeTaken = Math.round((Date.now() - startTime) / 1000)
    if (timerRef.current) clearInterval(timerRef.current)
    onAnswer(answer, timeTaken)
  }

  const handleOptionClick = (option: string) => {
    if (disabled || showResult) return
    setSelectedOption(option)
  }

  const getOptionClass = (option: string) => {
    const baseClass = 'w-full p-4 text-left rounded-lg border-2 transition-all font-serif'

    if (showResult) {
      if (option === question.correct_answer) {
        return `${baseClass} border-green-500 bg-green-50 text-green-800`
      }
      if (option === userAnswer && !isCorrect) {
        return `${baseClass} border-red-500 bg-red-50 text-red-800`
      }
      return `${baseClass} border-gray-200 bg-gray-50 text-gray-500`
    }

    if (option === selectedOption) {
      return `${baseClass} border-amber-600 bg-amber-50 text-amber-900`
    }

    return `${baseClass} border-gray-200 hover:border-amber-400 hover:bg-amber-50 cursor-pointer`
  }

  const timerColor = timeRemaining <= 10 ? 'text-red-600' : timeRemaining <= 20 ? 'text-yellow-600' : 'text-gray-600'
  const timerProgress = (timeRemaining / timerSeconds) * 100

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
      {/* Header with category and difficulty */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-medium text-gray-500">
          {categoryLabels[question.category] || question.category}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${difficultyColors[question.difficulty]}`}>
          {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
        </span>
      </div>

      {/* Timer */}
      {timerEnabled && !showResult && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className={`text-sm font-medium ${timerColor}`}>
              Time: {timeRemaining}s
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${
                timeRemaining <= 10 ? 'bg-red-500' : timeRemaining <= 20 ? 'bg-yellow-500' : 'bg-amber-600'
              }`}
              style={{ width: `${timerProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Question text */}
      <h3 className="text-xl font-serif text-gray-900 mb-6 leading-relaxed">
        {question.question_text}
      </h3>

      {/* Multiple choice options */}
      {question.question_type === 'multiple_choice' && question.options && (
        <div className="space-y-3 mb-6">
          {question.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleOptionClick(option)}
              disabled={disabled || showResult}
              className={getOptionClass(option)}
            >
              <span className="inline-block w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-sm font-medium mr-3 text-center leading-6">
                {String.fromCharCode(65 + index)}
              </span>
              {option}
            </button>
          ))}
        </div>
      )}

      {/* Short answer input */}
      {question.question_type === 'short_answer' && (
        <div className="mb-6">
          <input
            type="text"
            value={showResult ? (userAnswer || '') : shortAnswer}
            onChange={(e) => setShortAnswer(e.target.value)}
            disabled={disabled || showResult}
            placeholder="Type your answer..."
            className={`w-full p-4 border-2 rounded-lg font-serif text-lg ${
              showResult
                ? isCorrect
                  ? 'border-green-500 bg-green-50'
                  : 'border-red-500 bg-red-50'
                : 'border-gray-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
            }`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shortAnswer) {
                handleSubmit()
              }
            }}
          />
          {showResult && !isCorrect && (
            <p className="mt-2 text-green-700 font-medium">
              Correct answer: {question.correct_answer}
            </p>
          )}
        </div>
      )}

      {/* Result feedback */}
      {showResult && (
        <div className={`p-4 rounded-lg mb-6 ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center mb-2">
            {isCorrect ? (
              <>
                <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold text-green-800">Correct!</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="font-semibold text-red-800">Incorrect</span>
              </>
            )}
          </div>
          {question.explanation && (
            <p className="text-gray-700 font-serif leading-relaxed">
              {question.explanation}
            </p>
          )}
        </div>
      )}

      {/* Submit button */}
      {!showResult && (
        <button
          onClick={handleSubmit}
          disabled={disabled || (question.question_type === 'multiple_choice' ? !selectedOption : !shortAnswer)}
          className="w-full py-3 px-6 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Answer
        </button>
      )}
    </div>
  )
}
