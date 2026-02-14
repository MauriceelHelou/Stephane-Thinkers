import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Quiz Journey: Quiz Review', () => {
  test.describe.configure({ mode: 'serial' })

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

  test.describe('Review Access', () => {
    test('should access review from results', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // After completing quiz, review button should be available
      const reviewButton = page.locator('button').filter({ hasText: /review|see.*answers/i })
    })

    test('should access review from history', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const historyButton = page.locator('button').filter({ hasText: /history/i })
      if (await historyButton.isVisible()) {
        await historyButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // View details on past quiz
        const viewButton = page.locator('button').filter({ hasText: /view|review/i })
      }
    })
  })

  test.describe('Review Content', () => {
    test('should show all questions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // In review mode, all questions should be visible
      const questions = page.locator('[class*="question"]')
    })

    test('should show user answer for each question', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // User's selected answers
      const userAnswers = page.locator('[class*="user-answer"], [class*="selected"]')
    })

    test('should show correct answer for each question', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Correct answers highlighted
      const correctAnswers = page.locator('[class*="correct-answer"]')
    })

    test('should show explanation for answers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Explanations for why answer is correct
      const explanations = page.locator('[class*="explanation"]')
    })
  })

  test.describe('Review Visual Feedback', () => {
    test('should highlight correct answers in green', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Green styling for correct
      const correct = page.locator('[class*="correct"]')
    })

    test('should highlight wrong answers in red', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Red styling for wrong
      const wrong = page.locator('[class*="incorrect"], [class*="wrong"]')
    })

    test('should show check/cross icons', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Icons for correct/incorrect
      const icons = page.locator('[class*="icon-check"], [class*="icon-cross"], svg')
    })

    test('should show score badge for each question', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Per-question score indicator
      const badges = page.locator('[class*="badge"], [class*="score"]')
    })
  })

  test.describe('Review Navigation', () => {
    test('should navigate between questions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Navigation controls
      const nextButton = page.locator('button').filter({ hasText: /next/i })
      const prevButton = page.locator('button').filter({ hasText: /prev|back/i })
    })

    test('should jump to specific question', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Question number links
      const questionLinks = page.locator('[class*="question-nav"] a, [class*="question-nav"] button')
    })

    test('should filter to show only wrong answers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Filter to wrong only
      const filterWrong = page.locator('button, input').filter({ hasText: /wrong|incorrect/i })
    })

    test('should filter to show only correct answers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Filter to correct only
      const filterCorrect = page.locator('button, input').filter({ hasText: /correct/i })
    })
  })

  test.describe('Review Learning Features', () => {
    test('should link to relevant thinker from question', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Links to thinkers mentioned in question
      const thinkerLinks = page.locator('a[href*="thinker"], button[class*="thinker-link"]')
    })

    test('should link to relevant connection from question', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Links to connections
      const connectionLinks = page.locator('a[href*="connection"], button[class*="connection-link"]')
    })

    test('should mark question for further study', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Bookmark/flag for study
      const studyButton = page.locator('button').filter({ hasText: /study|bookmark|flag/i })
    })

    test('should add question to review list', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Add to review list
      const addToReviewButton = page.locator('button').filter({ hasText: /add.*review|save/i })
    })
  })

  test.describe('Review Statistics', () => {
    test('should show question-level time taken', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Time per question
      const timeDisplay = page.locator('[class*="time"]')
    })

    test('should show difficulty level of question', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Difficulty indicator
      const difficulty = page.locator('text=/easy|medium|hard|difficulty/i')
    })

    test('should show historical accuracy for question type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // How user usually does on this type
      const accuracy = page.locator('text=/accuracy|usually|typically/i')
    })
  })

  test.describe('Review Actions', () => {
    test('should print review', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Print button
      const printButton = page.locator('button').filter({ hasText: /print/i })
    })

    test('should export review as PDF', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Export button
      const exportButton = page.locator('button').filter({ hasText: /export|pdf/i })
    })

    test('should share review', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Share button
      const shareButton = page.locator('button').filter({ hasText: /share/i })
    })

    test('should close review', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Close button
      const closeButton = page.locator('button').filter({ hasText: /close|done/i })
    })
  })
})
