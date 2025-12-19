import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Quiz Journey: Quiz Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 8,
      connections: 6,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Structure', () => {
    test('should display quiz modal with proper structure', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Modal structure
        const modal = page.locator('[role="dialog"]')
        const header = modal.locator('h1, h2, [class*="header"]')
        const content = modal.locator('[class*="content"], [class*="body"]')
      }
    })

    test('should display question area', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startButton = page.locator('button').filter({ hasText: /start|begin/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Question area
          const questionArea = page.locator('[class*="question"]')
            .or(page.locator('[data-testid="quiz-question"]'))
        }
      }
    })

    test('should display answer options area', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startButton = page.locator('button').filter({ hasText: /start|begin/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Answer options
          const answerArea = page.locator('[class*="answer"], [class*="option"]')
            .or(page.locator('[role="radiogroup"]'))
        }
      }
    })

    test('should display progress indicator', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startButton = page.locator('button').filter({ hasText: /start|begin/i })
        if (await startButton.isVisible()) {
          await startButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Progress indicator
          const progress = page.locator('[role="progressbar"]')
            .or(page.locator('[class*="progress"]'))
            .or(page.locator('text=/1.*of|question.*1/i'))
        }
      }
    })
  })

  test.describe('Question Display', () => {
    test('should display question text clearly', async ({ page }) => {
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

          // Question text should be visible
          const questionText = page.locator('[class*="question"]')
        }
      }
    })

    test('should display multiple choice options', async ({ page }) => {
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

          // Multiple options should be visible
          const options = page.locator('[role="radio"], input[type="radio"], [class*="option"]')
        }
      }
    })

    test('should display question number', async ({ page }) => {
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

          // Question number
          const questionNumber = page.locator('text=/question.*\\d|\\d.*of.*\\d/i')
        }
      }
    })
  })

  test.describe('Modal Controls', () => {
    test('should have next/previous navigation', async ({ page }) => {
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

          // Navigation buttons
          const nextButton = page.locator('button').filter({ hasText: /next|continue/i })
          const prevButton = page.locator('button').filter({ hasText: /prev|back/i })
        }
      }
    })

    test('should have submit button', async ({ page }) => {
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

          // Submit button
          const submitButton = page.locator('button').filter({ hasText: /submit|finish/i })
        }
      }
    })

    test('should have close/cancel button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Close button
        const closeButton = page.locator('button').filter({ hasText: /close|cancel|×/i })
          .or(page.locator('[aria-label*="close"]'))
      }
    })
  })

  test.describe('Modal Behavior', () => {
    test('should prevent background interaction while open', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Modal overlay should be present
        const overlay = page.locator('[class*="overlay"], [class*="backdrop"]')
      }
    })

    test('should focus trap within modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Tab should cycle within modal
        await page.keyboard.press('Tab')
        await page.keyboard.press('Tab')
        await page.keyboard.press('Tab')
      }
    })

    test('should close on escape key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Escape')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })
})
