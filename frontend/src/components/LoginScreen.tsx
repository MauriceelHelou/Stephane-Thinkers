'use client'

import { useState } from 'react'
import { authApi } from '@/lib/api'

interface LoginScreenProps {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await authApi.login(password)
      if (response.success) {
        sessionStorage.setItem('auth_token', response.token || 'auth-disabled')
        // Store in sessionStorage so it persists during the session
        sessionStorage.setItem('authenticated', 'true')
        onSuccess()
      }
    } catch (err) {
      setError('Incorrect password. Try again.')
      setPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif text-[#1A1A1A] mb-2">
            Intellectual Genealogy
          </h1>
          <p className="text-gray-600 text-sm">
            A timeline-based knowledge graph
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Enter Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B4513] focus:border-transparent text-lg"
              placeholder="Password"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-3 px-4 bg-[#8B4513] text-white rounded-lg font-medium hover:bg-[#6B3410] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Checking...' : 'Enter'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-xs mt-6">
          Harvard PhD Research Tool
        </p>
      </div>
    </div>
  )
}
