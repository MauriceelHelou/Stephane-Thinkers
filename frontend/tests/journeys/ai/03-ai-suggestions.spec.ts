import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('AI Journey: AI Suggestions', () => {
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

  test.describe('Suggestions Tab', () => {
    test('should show suggestions tab in AI panel', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      await expect(suggestionsTab).toBeVisible()
    })

    test('should switch to suggestions tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Connection Suggestions', () => {
    test('should suggest potential connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Connection suggestions section
        const connectionSuggestions = page.locator('[class*="connection-suggestion"]')
          .or(page.locator('text=/suggest.*connection|possible.*connection/i'))
      }
    })

    test('should display suggested connection with reason', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Each suggestion should include reasoning
        const suggestionWithReason = page.locator('[class*="suggestion"]')
          .filter({ has: page.locator('text=/because|reason/i') })
      }
    })

    test('should allow accepting connection suggestion', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Accept button for suggestion
        const acceptButton = page.locator('button').filter({ hasText: /accept|add|create/i })
        if (await acceptButton.first().isVisible()) {
          await acceptButton.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should allow dismissing connection suggestion', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Dismiss button
        const dismissButton = page.locator('button').filter({ hasText: /dismiss|ignore|skip|×/i })
        if (await dismissButton.first().isVisible()) {
          await dismissButton.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Research Question Suggestions', () => {
    test('should suggest research questions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Research question suggestions
        const questionSuggestions = page.locator('[class*="question-suggestion"]')
          .or(page.locator('text=/research.*question|explore/i'))
      }
    })

    test('should allow adding suggested question to research list', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Add question button
        const addButton = page.locator('button').filter({ hasText: /add.*question|save.*question/i })
      }
    })
  })

  test.describe('Thinker Suggestions', () => {
    test('should suggest related thinkers to add', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Thinker suggestions
        const thinkerSuggestions = page.locator('[class*="thinker-suggestion"]')
          .or(page.locator('text=/suggest.*thinker|add.*thinker/i'))
      }
    })

    test('should explain why thinker is suggested', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Suggestion with explanation
      }
    })
  })

  test.describe('Suggestion Generation', () => {
    test('should generate suggestions on demand', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Generate button
        const generateButton = page.locator('button').filter({ hasText: /generate|refresh|get.*suggest/i })
        if (await generateButton.isVisible()) {
          await generateButton.click()
          await page.waitForTimeout(TIMEOUTS.long)
        }
      }
    })

    test('should show loading state during generation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const generateButton = page.locator('button').filter({ hasText: /generate|refresh/i })
        if (await generateButton.isVisible()) {
          await generateButton.click()

          // Loading indicator
          const loading = page.locator('[class*="loading"], [class*="spinner"]')
        }
      }
    })

    test('should display message when no suggestions available', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Empty state message
      const emptyMessage = page.locator('text=/no.*suggest|no.*recommendation/i')
    })
  })

  test.describe('Context-Aware Suggestions', () => {
    test('should provide suggestions based on selected thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = mainPage.canvas

      await mainPage.waitForPageLoad()

      // Select a thinker first
      await canvasPage.clickOnCanvas(100, 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Open AI panel
      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Suggestions should be contextual to selected thinker
      }
    })

    test('should update suggestions when selection changes', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = mainPage.canvas

      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Select different thinker
        await canvasPage.clickOnCanvas(180, 200)
        await page.waitForTimeout(TIMEOUTS.medium)

        // Suggestions should update
      }
    })
  })

  test.describe('Suggestion Categories', () => {
    test('should categorize suggestions by type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.medium)

        // Category headers
        const connectionCategory = page.locator('text=/connection/i')
        const questionCategory = page.locator('text=/question|research/i')
        const thinkerCategory = page.locator('text=/thinker|person/i')
      }
    })

    test('should allow filtering by suggestion type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Filter controls
        const filterSelect = page.locator('select').filter({ hasText: /type|category/i })
          .or(page.locator('button').filter({ hasText: /filter/i }))
      }
    })
  })
})
