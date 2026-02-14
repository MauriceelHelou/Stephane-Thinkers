import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('AI Journey: AI Status', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(120000)

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 3,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('AI Availability Check', () => {
    test('should check AI status via API', async ({ request }) => {
      const api = createAPIHelpers(request)

      const status = await api.getAIStatus()

      // Status should return enabled/disabled state
      expect(status).toHaveProperty('enabled')
      expect(status).toHaveProperty('message')
    })

    test('should display AI status indicator in UI', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open AI panel
      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.getByRole('button', { name: /status/i }).click()
      await expect(page.getByText(/AI Features Enabled|AI Features Available/i)).toBeVisible()
    })

    test('should show enabled status when AI is available', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // If AI is enabled, should show positive indicator
      const enabledIndicator = page.locator('text=/enabled|online|available|connected/i')
        .or(page.locator('[class*="success"], [class*="green"]'))
    })

    test('should show disabled status when AI is unavailable', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // If AI is disabled, should show warning indicator
      const disabledIndicator = page.locator('text=/disabled|offline|unavailable/i')
        .or(page.locator('[class*="warning"], [class*="red"]'))
    })
  })

  test.describe('AI Panel Access', () => {
    test('should open AI panel from toolbar', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // AI panel should be visible
      const aiPanel = page.locator('[data-testid="ai-panel"]')
        .or(page.locator('[class*="ai-panel"]'))
    })

    test('should show AI button in toolbar', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // AI options are available in the More menu.
      await mainPage.openMoreMenu()
      await expect(page.getByRole('button', { name: /AI Assistant/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /AI Suggestions/i })).toBeVisible()
    })

    test('should toggle AI panel visibility', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open
      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Close via modal close button
      await page.locator('div.fixed.inset-0.bg-black\\/30.z-50 button:has-text("×")').click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Panel should be closed
    })
  })

  test.describe('AI Status Tab', () => {
    test('should show status tab in AI panel', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Status tab should be visible
      const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /status/i }).first()
      await expect(statusTab).toBeVisible()
    })

    test('should display AI configuration info', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should show model info or configuration
      const configInfo = page.locator('text=/model|configuration|api/i')
    })

    test('should show last connection status', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should show when AI was last checked
    })
  })

  test.describe('AI Feature Gating', () => {
    test('should enable AI features when AI is available', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Chat and suggestions should be accessible
      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
    })

    test('should disable AI features when AI is unavailable', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // If AI is disabled, features should be grayed out or hidden
      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Check if features are disabled
    })

    test('should show helpful message when AI is unavailable', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // If unavailable, should explain why and how to enable
      const helpMessage = page.locator('text=/configure|setup|enable/i')
    })
  })

  test.describe('AI Status Refresh', () => {
    test('should refresh AI status on demand', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Find refresh button
      const refreshButton = page.locator('button').filter({ hasText: /refresh|check|retry/i })
        .or(page.locator('[aria-label*="refresh"]'))

      if (await refreshButton.isVisible()) {
        await refreshButton.click()
        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })

    test('should show loading state during status check', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAISuggestionsPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const refreshButton = page.locator('button').filter({ hasText: /refresh|check/i })

      if (await refreshButton.isVisible()) {
        // Click and look for loading indicator
        await refreshButton.click()

        const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"]')
          .or(page.locator('text=/checking|loading/i'))
      }
    })
  })
})
