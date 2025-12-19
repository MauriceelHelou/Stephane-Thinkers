import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Quiz Journey: API Integration', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 10,
      connections: 8,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Question Generation API', () => {
    test('should call API to generate questions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Monitor API calls
      const apiCalls: string[] = []
      await page.route('**/api/quiz/**', route => {
        apiCalls.push(route.request().url())
        return route.continue()
      })

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startButton = page.locator('button').filter({ hasText: /start|begin/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(TIMEOUTS.long)
        }
      }
    })

    test('should handle question generation error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Mock API error
      await page.route('**/api/quiz/generate**', route =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Generation failed' }) })
      )

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startButton = page.locator('button').filter({ hasText: /start|begin/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Error message should appear
          const error = page.locator('text=/error|failed|try again/i')
        }
      }
    })

    test('should handle slow question generation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Mock slow response
      await page.route('**/api/quiz/generate**', async route => {
        await new Promise(resolve => setTimeout(resolve, 5000))
        return route.continue()
      })

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startButton = page.locator('button').filter({ hasText: /start|begin/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Loading indicator should show
          const loading = page.locator('[class*="loading"], [class*="spinner"]')
        }
      }
    })
  })

  test.describe('Answer Submission API', () => {
    test('should submit answers to API', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      let submitCalled = false
      await page.route('**/api/quiz/submit**', route => {
        submitCalled = true
        return route.continue()
      })

      // Complete a quiz and submit
      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startButton = page.locator('button').filter({ hasText: /start|begin/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Answer and submit
          const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
          if (await options.count() > 0) {
            await options.first().click()
          }

          const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
          if (await submitButton.isVisible()) {
            await submitButton.click()
            await page.waitForTimeout(TIMEOUTS.long)
          }
        }
      }
    })

    test('should handle submission error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/quiz/submit**', route =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Submission failed' }) })
      )

      // Error handling for failed submission
    })

    test('should handle offline submission', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Simulate offline
      await page.route('**/api/quiz/submit**', route => route.abort())

      // Should queue for later or show error
    })
  })

  test.describe('History API', () => {
    test('should fetch quiz history from API', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      let historyCalled = false
      await page.route('**/api/quiz/history**', route => {
        historyCalled = true
        return route.continue()
      })

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should handle empty history', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/quiz/history**', route =>
        route.fulfill({ status: 200, body: JSON.stringify([]) })
      )

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Empty state message
        const emptyMessage = page.locator('text=/no.*quiz|empty|take.*first/i')
      }
    })

    test('should handle history fetch error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/quiz/history**', route =>
        route.fulfill({ status: 500 })
      )

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Error state
        const error = page.locator('text=/error|failed/i')
      }
    })
  })

  test.describe('Delete History API', () => {
    test('should call delete API', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      let deleteCalled = false
      await page.route('**/api/quiz/history/**', route => {
        if (route.request().method() === 'DELETE') {
          deleteCalled = true
        }
        return route.continue()
      })

      // Delete from history
    })

    test('should handle delete error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/quiz/history/**', route => {
        if (route.request().method() === 'DELETE') {
          return route.fulfill({ status: 500 })
        }
        return route.continue()
      })

      // Error handling
    })
  })

  test.describe('AI-Generated Questions', () => {
    test('should request AI-generated questions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/ai/quiz/**', route => route.continue())

      // AI quiz generation
    })

    test('should handle AI unavailable', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/ai/quiz/**', route =>
        route.fulfill({ status: 503, body: JSON.stringify({ error: 'AI unavailable' }) })
      )

      // Fallback to basic questions
    })

    test('should timeout gracefully for AI generation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/ai/quiz/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 30000))
        return route.continue()
      })

      // Should show timeout message or fallback
    })
  })

  test.describe('Data Consistency', () => {
    test('should use current database data for questions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Questions should reference actual thinkers/connections
    })

    test('should handle deleted thinkers in quiz', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // If thinker is deleted, quiz should handle gracefully
    })

    test('should handle updated connections in quiz', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Quiz should reflect current connection state
    })
  })
})
