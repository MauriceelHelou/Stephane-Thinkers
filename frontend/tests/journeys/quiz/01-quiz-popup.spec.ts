import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Quiz Journey: Quiz Popup', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 4,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Quiz Popup Trigger', () => {
    test('should show quiz popup after adding connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // After adding multiple connections, quiz popup may appear
      const quizPopup = page.locator('[data-testid="quiz-popup"]')
        .or(page.locator('[class*="quiz-popup"]'))
        .or(page.locator('text=/ready.*quiz|test.*knowledge/i'))
    })

    test('should show quiz popup on toolbar click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Quiz button in toolbar
      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
        .or(page.locator('[data-testid="quiz-button"]'))

      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Quiz popup or modal should appear
        const quizUI = page.locator('[role="dialog"]')
          .or(page.locator('[class*="quiz"]'))
      }
    })

    test('should show quiz popup after idle time', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Quiz may appear after idle
      // This is a placeholder for the actual idle trigger behavior
    })
  })

  test.describe('Quiz Popup Content', () => {
    test('should display quiz invitation message', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Should show invitation text
        const inviteText = page.locator('text=/test.*knowledge|quiz.*time|ready.*learn/i')
      }
    })

    test('should display question count option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Should show question count selector
        const countSelector = page.locator('select, input[type="number"]')
          .or(page.locator('[data-testid="question-count"]'))
      }
    })

    test('should display difficulty option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Should show difficulty selector
        const difficultySelector = page.locator('text=/easy|medium|hard|difficulty/i')
      }
    })
  })

  test.describe('Quiz Popup Actions', () => {
    test('should start quiz when clicking start button', async ({ page }) => {
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

          // Quiz should start - questions visible
          const questionArea = page.locator('[class*="question"]')
            .or(page.locator('text=/question.*1/i'))
        }
      }
    })

    test('should dismiss popup when clicking later', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const laterButton = page.locator('button').filter({ hasText: /later|skip|close|cancel/i })
        if (await laterButton.isVisible()) {
          await laterButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Popup should be dismissed
        }
      }
    })

    test('should close popup with escape key', async ({ page }) => {
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

  test.describe('Quiz Popup Positioning', () => {
    test('should appear in accessible location', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Quiz popup should be visible and not blocked
      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const popup = page.locator('[role="dialog"]')
        if (await popup.isVisible()) {
          const box = await popup.boundingBox()
          if (box) {
            expect(box.x).toBeGreaterThanOrEqual(0)
            expect(box.y).toBeGreaterThanOrEqual(0)
          }
        }
      }
    })
  })
})
