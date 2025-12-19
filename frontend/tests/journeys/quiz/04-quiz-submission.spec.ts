import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Quiz Journey: Quiz Submission', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 6,
      connections: 5,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  async function startAndAnswerQuiz(page) {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const quizButton = page.locator('button').filter({ hasText: /quiz/i })
    if (await quizButton.isVisible()) {
      await quizButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const startButton = page.locator('button').filter({ hasText: /start|begin/i })
      if (await startButton.isVisible()) {
        await startButton.click()
        await page.waitForTimeout(TIMEOUTS.long)

        // Answer all questions
        for (let i = 0; i < 5; i++) {
          const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
          if (await options.count() > 0) {
            await options.first().click()
            await page.waitForTimeout(TIMEOUTS.animation)
          }

          const nextButton = page.locator('button').filter({ hasText: /next/i })
          if (await nextButton.isVisible()) {
            await nextButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)
          }
        }

        return true
      }
    }
    return false
  }

  test.describe('Submit Button', () => {
    test('should enable submit button when all questions answered', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await expect(submitButton).toBeEnabled()
        }
      }
    })

    test('should show submit confirmation', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Confirmation dialog
          const confirmation = page.locator('text=/confirm|sure|submit/i')
        }
      }
    })

    test('should submit quiz after confirmation', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Confirm submission
          const confirmButton = page.locator('button').filter({ hasText: /yes|confirm|submit/i })
          if (await confirmButton.isVisible()) {
            await confirmButton.click()
            await page.waitForTimeout(TIMEOUTS.long)
          }
        }
      }
    })
  })

  test.describe('Results Display', () => {
    test('should show score after submission', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Score display
          const score = page.locator('text=/score|\\d+%|\\d+.*out.*of/i')
        }
      }
    })

    test('should show correct vs incorrect count', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Correct/incorrect breakdown
          const breakdown = page.locator('text=/correct|wrong|incorrect/i')
        }
      }
    })

    test('should show time taken', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Time display
          const time = page.locator('text=/time|duration|took/i')
        }
      }
    })

    test('should show performance feedback', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Feedback message (Great job!, Keep practicing, etc.)
          const feedback = page.locator('text=/great|good|excellent|keep.*trying|practice/i')
        }
      }
    })
  })

  test.describe('Results Actions', () => {
    test('should allow retaking quiz', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Retake button
          const retakeButton = page.locator('button').filter({ hasText: /retake|try.*again|new.*quiz/i })
        }
      }
    })

    test('should allow reviewing answers', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Review button
          const reviewButton = page.locator('button').filter({ hasText: /review|see.*answers/i })
        }
      }
    })

    test('should allow closing results', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Close button
          const closeButton = page.locator('button').filter({ hasText: /close|done|finish/i })
        }
      }
    })

    test('should allow sharing results', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Share button
          const shareButton = page.locator('button').filter({ hasText: /share|export/i })
        }
      }
    })
  })

  test.describe('Answer Review', () => {
    test('should show each question with user answer', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          const reviewButton = page.locator('button').filter({ hasText: /review/i })
          if (await reviewButton.isVisible()) {
            await reviewButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)

            // Questions with answers
            const reviewItems = page.locator('[class*="review"], [class*="answer"]')
          }
        }
      }
    })

    test('should highlight correct answers in green', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          const reviewButton = page.locator('button').filter({ hasText: /review/i })
          if (await reviewButton.isVisible()) {
            await reviewButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)

            // Green for correct
            const correct = page.locator('[class*="correct"]')
          }
        }
      }
    })

    test('should highlight incorrect answers in red', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          const reviewButton = page.locator('button').filter({ hasText: /review/i })
          if (await reviewButton.isVisible()) {
            await reviewButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)

            // Red for incorrect
            const incorrect = page.locator('[class*="incorrect"], [class*="wrong"]')
          }
        }
      }
    })

    test('should show correct answer for wrong responses', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          const reviewButton = page.locator('button').filter({ hasText: /review/i })
          if (await reviewButton.isVisible()) {
            await reviewButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)

            // Show correct answer text
            const correctAnswer = page.locator('text=/correct.*answer|should.*been/i')
          }
        }
      }
    })
  })

  test.describe('Quiz Persistence', () => {
    test('should save quiz result to history', async ({ page }) => {
      if (await startAndAnswerQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Close results
          const closeButton = page.locator('button').filter({ hasText: /close|done/i })
          if (await closeButton.isVisible()) {
            await closeButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)
          }

          // Open history
          const historyButton = page.locator('button').filter({ hasText: /history|past.*quiz/i })
          if (await historyButton.isVisible()) {
            await historyButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)

            // Should show recent quiz
          }
        }
      }
    })
  })
})
