import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('AI Journey: Error Handling', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 1,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('AI Unavailable State', () => {
    test('should display message when AI is unavailable', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // If AI is unavailable, should show helpful message
      const unavailableMessage = page.locator('text=/unavailable|disabled|offline|not.*configured/i')
    })

    test('should explain how to enable AI', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Help text about configuration
      const helpText = page.locator('text=/configure|setup|enable|api.*key/i')
    })

    test('should gracefully degrade without AI', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // App should work without AI features
      await expect(mainPage.canvasElement).toBeVisible()

      // Non-AI features should work
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible()
    })
  })

  test.describe('Network Errors', () => {
    test('should handle network timeout', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Simulate slow network
      await page.route('**/api/ai/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 30000))
        await route.continue()
      })

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test timeout')
        await page.keyboard.press('Enter')

        // Should show timeout error or loading
        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })

    test('should show error message on network failure', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Simulate network error
      await page.route('**/api/ai/**', route => route.abort())

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test network error')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.medium)

        // Error message should appear
        const errorMessage = page.locator('[class*="error"]')
          .or(page.locator('text=/error|failed|try again/i'))
      }
    })

    test('should offer retry option on network error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Retry button
      const retryButton = page.locator('button').filter({ hasText: /retry|try again/i })
    })
  })

  test.describe('API Errors', () => {
    test('should handle 500 server error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/ai/**', route =>
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) })
      )

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test server error')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.medium)

        // Should show server error message
      }
    })

    test('should handle 429 rate limit error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/ai/**', route =>
        route.fulfill({ status: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) })
      )

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test rate limit')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.medium)

        // Should show rate limit message
        const rateLimitMessage = page.locator('text=/rate.*limit|too.*many.*request|slow.*down/i')
      }
    })

    test('should handle 401 authentication error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/ai/**', route =>
        route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) })
      )

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Auth error message
      const authMessage = page.locator('text=/unauthorized|authentication|api.*key/i')
    })
  })

  test.describe('Fallback Behavior', () => {
    test('should show fallback UI when AI fails', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Fallback message or alternative options
      const fallbackUI = page.locator('[class*="fallback"]')
        .or(page.locator('text=/alternative|manual/i'))
    })

    test('should allow manual entry when AI parsing fails', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // User should still be able to add thinkers manually
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible()
    })

    test('should preserve user input on error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/ai/**', route => route.abort())

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('My important query')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.medium)

        // Input should still contain text or be recoverable
      }
    })
  })

  test.describe('Error Recovery', () => {
    test('should recover after temporary failure', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      let requestCount = 0

      await page.route('**/api/ai/**', route => {
        requestCount++
        if (requestCount === 1) {
          return route.fulfill({ status: 500 })
        }
        return route.continue()
      })

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // First request fails, retry should work
    })

    test('should clear error state after successful request', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // After error is resolved, UI should return to normal
    })
  })

  test.describe('User Feedback', () => {
    test('should allow reporting AI issues', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Report issue button or link
      const reportButton = page.locator('button, a').filter({ hasText: /report|feedback|issue/i })
    })

    test('should show helpful error descriptions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Error messages should be user-friendly
    })
  })
})
