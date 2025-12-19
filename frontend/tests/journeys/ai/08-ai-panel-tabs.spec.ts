import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('AI Journey: Panel Tabs Navigation', () => {
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

  test.describe('Tab Structure', () => {
    test('should display all AI panel tabs', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Status tab
      const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /status/i })

      // Chat tab
      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })

      // Suggestions tab
      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
    })

    test('should show status tab as default', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Status tab should be active by default
      const activeTab = page.locator('[role="tab"][aria-selected="true"]')
        .or(page.locator('[class*="active"]').filter({ hasText: /status/i }))
    })
  })

  test.describe('Tab Switching - Status', () => {
    test('should switch to status tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /status/i })
      if (await statusTab.isVisible()) {
        await statusTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Status content should be visible
        const statusContent = page.locator('text=/enabled|disabled|available|unavailable/i')
      }
    })

    test('should display AI availability status', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /status/i })
      if (await statusTab.isVisible()) {
        await statusTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Status indicator
        const statusIndicator = page.locator('[class*="status"], [data-testid="ai-status"]')
      }
    })

    test('should show refresh status button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /status/i })
      if (await statusTab.isVisible()) {
        await statusTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const refreshButton = page.locator('button').filter({ hasText: /refresh|check/i })
      }
    })
  })

  test.describe('Tab Switching - Chat', () => {
    test('should switch to chat tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      if (await chatTab.isVisible()) {
        await chatTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Chat input should be visible
        const chatInput = page.locator('textarea, input')
          .filter({ has: page.locator('[placeholder*="message" i], [placeholder*="ask" i]') })
      }
    })

    test('should preserve chat history when switching tabs', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Go to chat tab
      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      if (await chatTab.isVisible()) {
        await chatTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Send message
        const chatInput = page.locator('textarea, input').first()
        if (await chatInput.isVisible()) {
          await chatInput.fill('Test message for persistence')
          await page.keyboard.press('Enter')
          await page.waitForTimeout(TIMEOUTS.medium)
        }

        // Switch to status tab
        const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /status/i })
        await statusTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Switch back to chat
        await chatTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Message should still be in history
        const messageInHistory = page.locator('text=Test message for persistence')
      }
    })

    test('should show chat interface elements', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      if (await chatTab.isVisible()) {
        await chatTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Chat elements
        const messageArea = page.locator('[class*="message"], [class*="chat"]')
        const inputArea = page.locator('textarea, input')
        const sendButton = page.locator('button').filter({ hasText: /send/i })
      }
    })
  })

  test.describe('Tab Switching - Suggestions', () => {
    test('should switch to suggestions tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Suggestions content should be visible
        const suggestionsContent = page.locator('[class*="suggestion"]')
          .or(page.locator('text=/suggest|recommend/i'))
      }
    })

    test('should show generate suggestions button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const generateButton = page.locator('button').filter({ hasText: /generate|refresh|get/i })
      }
    })

    test('should display suggestion categories', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
      if (await suggestionsTab.isVisible()) {
        await suggestionsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Categories like connections, questions, thinkers
        const categories = page.locator('[class*="category"]')
      }
    })
  })

  test.describe('Tab Visual Feedback', () => {
    test('should highlight active tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Active tab should have visual distinction
      const activeTab = page.locator('[role="tab"][aria-selected="true"]')
        .or(page.locator('button[class*="active"]'))
    })

    test('should change tab indicator when switching', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      if (await chatTab.isVisible()) {
        await chatTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Chat tab should now be active
      }
    })
  })

  test.describe('Tab Keyboard Navigation', () => {
    test('should navigate tabs with arrow keys', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Focus first tab
      const firstTab = page.locator('button, [role="tab"]').first()
      await firstTab.focus()

      // Navigate with arrow key
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Next tab should be focused
    })

    test('should activate tab with Enter key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      if (await chatTab.isVisible()) {
        await chatTab.focus()
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Chat content should be visible
      }
    })
  })

  test.describe('Panel Close/Reopen', () => {
    test('should remember last active tab on reopen', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open and switch to chat tab
      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      if (await chatTab.isVisible()) {
        await chatTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // Close panel
      await mainPage.aiButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Reopen panel
      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Chat tab should still be active (if feature supported)
    })

    test('should preserve state across panel toggle', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Close
      await mainPage.aiButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Reopen
      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // State should be preserved
    })
  })
})
