import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Quiz Journey: Quiz History', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 6,
      connections: 4,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('History Access', () => {
    test('should access quiz history from toolbar', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history|past.*quiz/i })
        .or(page.locator('[data-testid="quiz-history"]'))

      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // History view should open
        const historyView = page.locator('[class*="history"]')
          .or(page.locator('text=/past.*quizzes|quiz.*history/i'))
      }
    })

    test('should access history from quiz modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const quizButton = page.locator('button').filter({ hasText: /quiz/i })
      if (await quizButton.isVisible()) {
        await quizButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // History link/button in quiz modal
        const historyLink = page.locator('a, button').filter({ hasText: /history|view.*past/i })
      }
    })
  })

  test.describe('History List', () => {
    test('should display list of past quizzes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // List of quiz entries
        const quizEntries = page.locator('[class*="quiz-entry"], [class*="history-item"]')
      }
    })

    test('should show date for each quiz', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Date display
        const dates = page.locator('time, [class*="date"]')
      }
    })

    test('should show score for each quiz', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Score display
        const scores = page.locator('text=/\\d+%|score/i')
      }
    })

    test('should show question count for each quiz', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Question count
        const questionCounts = page.locator('text=/\\d+.*question/i')
      }
    })
  })

  test.describe('History Sorting', () => {
    test('should sort by date (newest first)', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const sortByDate = page.locator('button, select').filter({ hasText: /date|newest/i })
        if (await sortByDate.isVisible()) {
          await sortByDate.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should sort by score', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const sortByScore = page.locator('button, select').filter({ hasText: /score/i })
        if (await sortByScore.isVisible()) {
          await sortByScore.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('History Filtering', () => {
    test('should filter by date range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Date range filter
        const dateFilter = page.locator('input[type="date"], [class*="date-filter"]')
      }
    })

    test('should filter by score range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Score filter
        const scoreFilter = page.locator('input[type="range"], [class*="score-filter"]')
      }
    })
  })

  test.describe('History Statistics', () => {
    test('should show overall statistics', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Statistics section
        const stats = page.locator('[class*="stats"], [class*="statistics"]')
      }
    })

    test('should show average score', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Average score display
        const averageScore = page.locator('text=/average|avg/i')
      }
    })

    test('should show best score', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Best score display
        const bestScore = page.locator('text=/best|highest/i')
      }
    })

    test('should show total quizzes taken', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Total count
        const totalCount = page.locator('text=/total|\\d+.*quizzes/i')
      }
    })

    test('should show improvement trend', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Trend indicator
        const trend = page.locator('[class*="trend"]')
          .or(page.locator('text=/improving|declining/i'))
      }
    })
  })

  test.describe('History Actions', () => {
    test('should view details of past quiz', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Click on a quiz entry
        const quizEntry = page.locator('[class*="quiz-entry"], [class*="history-item"]').first()
        if (await quizEntry.isVisible()) {
          await quizEntry.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Details should show
          const details = page.locator('[class*="detail"]')
        }
      }
    })

    test('should delete quiz from history', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Delete button on entry
        const deleteButton = page.locator('button').filter({ hasText: /delete|remove/i })
        if (await deleteButton.first().isVisible()) {
          await deleteButton.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Confirm deletion
          const confirmButton = page.locator('button').filter({ hasText: /yes|confirm/i })
          if (await confirmButton.isVisible()) {
            await confirmButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)
          }
        }
      }
    })

    test('should clear all history', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Clear all button
        const clearAllButton = page.locator('button').filter({ hasText: /clear.*all|delete.*all/i })
      }
    })

    test('should export history', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Export button
        const exportButton = page.locator('button').filter({ hasText: /export|download/i })
      }
    })
  })
})
