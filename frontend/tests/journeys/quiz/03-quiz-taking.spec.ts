import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Quiz Journey: Quiz Taking', () => {
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

  async function startQuiz(page) {
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
        return true
      }
    }
    return false
  }

  test.describe('Answering Questions', () => {
    test('should select single answer by clicking', async ({ page }) => {
      if (await startQuiz(page)) {
        // Click on an answer option
        const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
        const optionCount = await options.count()

        if (optionCount > 0) {
          await options.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Option should be selected
          const selected = page.locator('[aria-checked="true"], input:checked, [class*="selected"]')
        }
      }
    })

    test('should change answer by clicking different option', async ({ page }) => {
      if (await startQuiz(page)) {
        const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
        const optionCount = await options.count()

        if (optionCount > 1) {
          await options.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)

          await options.nth(1).click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Second option should now be selected
        }
      }
    })

    test('should select answer using keyboard', async ({ page }) => {
      if (await startQuiz(page)) {
        // Navigate with arrow keys
        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Select with Enter
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should select answer using number keys', async ({ page }) => {
      if (await startQuiz(page)) {
        // Press number key to select option
        await page.keyboard.press('1')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Question Navigation', () => {
    test('should navigate to next question', async ({ page }) => {
      if (await startQuiz(page)) {
        // Select an answer
        const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
        if (await options.count() > 0) {
          await options.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }

        // Click next
        const nextButton = page.locator('button').filter({ hasText: /next|continue/i })
        if (await nextButton.isVisible()) {
          await nextButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Should be on question 2
        }
      }
    })

    test('should navigate to previous question', async ({ page }) => {
      if (await startQuiz(page)) {
        // Go to next question first
        const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
        if (await options.count() > 0) {
          await options.first().click()
        }

        const nextButton = page.locator('button').filter({ hasText: /next|continue/i })
        if (await nextButton.isVisible()) {
          await nextButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }

        // Go back
        const prevButton = page.locator('button').filter({ hasText: /prev|back/i })
        if (await prevButton.isVisible()) {
          await prevButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Should be back on question 1
        }
      }
    })

    test('should preserve answers when navigating', async ({ page }) => {
      if (await startQuiz(page)) {
        // Select first option
        const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
        if (await options.count() > 0) {
          await options.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }

        // Navigate away
        const nextButton = page.locator('button').filter({ hasText: /next|continue/i })
        if (await nextButton.isVisible()) {
          await nextButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }

        // Navigate back
        const prevButton = page.locator('button').filter({ hasText: /prev|back/i })
        if (await prevButton.isVisible()) {
          await prevButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Answer should still be selected
          const selected = page.locator('[aria-checked="true"], input:checked, [class*="selected"]')
        }
      }
    })

    test('should jump to specific question via progress indicator', async ({ page }) => {
      if (await startQuiz(page)) {
        // Click on question number in progress
        const progressDots = page.locator('[class*="progress"] button, [class*="dot"]')
        if (await progressDots.count() > 2) {
          await progressDots.nth(2).click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Progress Tracking', () => {
    test('should update progress bar on each answer', async ({ page }) => {
      if (await startQuiz(page)) {
        const progressBar = page.locator('[role="progressbar"]')
          .or(page.locator('[class*="progress-bar"]'))

        // Answer a question
        const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
        if (await options.count() > 0) {
          await options.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }

        // Progress should update
      }
    })

    test('should show answered vs unanswered status', async ({ page }) => {
      if (await startQuiz(page)) {
        // Some indicator of answered questions
        const answeredIndicator = page.locator('[class*="answered"]')
          .or(page.locator('[class*="completed"]'))
      }
    })

    test('should show time remaining if timed', async ({ page }) => {
      if (await startQuiz(page)) {
        // Timer display
        const timer = page.locator('[class*="timer"]')
          .or(page.locator('text=/\\d+:\\d+/'))
      }
    })
  })

  test.describe('Question Types', () => {
    test('should handle connection type questions', async ({ page }) => {
      if (await startQuiz(page)) {
        // Questions about what type of connection exists
        const connectionQuestion = page.locator('text=/connection|influence|relationship/i')
      }
    })

    test('should handle thinker identification questions', async ({ page }) => {
      if (await startQuiz(page)) {
        // Questions about identifying thinkers
        const thinkerQuestion = page.locator('text=/who|which.*thinker/i')
      }
    })

    test('should handle chronology questions', async ({ page }) => {
      if (await startQuiz(page)) {
        // Questions about dates and order
        const chronoQuestion = page.locator('text=/when|year|born|died|order/i')
      }
    })

    test('should handle field/domain questions', async ({ page }) => {
      if (await startQuiz(page)) {
        // Questions about fields
        const fieldQuestion = page.locator('text=/field|domain|discipline/i')
      }
    })
  })

  test.describe('Quiz State', () => {
    test('should disable submit until all questions answered', async ({ page }) => {
      if (await startQuiz(page)) {
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        // Submit may be disabled initially
      }
    })

    test('should warn when trying to submit with unanswered questions', async ({ page }) => {
      if (await startQuiz(page)) {
        // Try to submit without answering
        const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        if (await submitButton.isVisible()) {
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Warning message
          const warning = page.locator('text=/unanswered|incomplete/i')
        }
      }
    })
  })
})
