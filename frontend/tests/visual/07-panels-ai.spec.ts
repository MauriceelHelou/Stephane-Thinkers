import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: AI Panel', () => {
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

  test('AI panel closed state', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    // AI button in toolbar
    const aiButton = mainPage.aiButton
    if (await aiButton.isVisible()) {
      await expect(aiButton).toHaveScreenshot('ai-button-closed.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('AI panel open default', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const aiPanel = page.locator('[class*="ai-panel"], [data-testid="ai-panel"]')
    if (await aiPanel.isVisible()) {
      await expect(aiPanel).toHaveScreenshot('ai-panel-open.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('AI panel status tab', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /status/i })
    if (await statusTab.isVisible()) {
      await statusTab.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page.locator('[class*="ai-panel"]')).toHaveScreenshot('ai-panel-status.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('AI panel chat tab', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
    if (await chatTab.isVisible()) {
      await chatTab.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page.locator('[class*="ai-panel"]')).toHaveScreenshot('ai-panel-chat.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('AI panel suggestions tab', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
    if (await suggestionsTab.isVisible()) {
      await suggestionsTab.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page.locator('[class*="ai-panel"]')).toHaveScreenshot('ai-panel-suggestions.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('AI chat input area', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
    if (await chatTab.isVisible()) {
      await chatTab.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await expect(chatInput).toHaveScreenshot('ai-chat-input.png', {
          maxDiffPixelRatio: 0.01,
        })
      }
    }
  })

  test('AI chat with message', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
    if (await chatTab.isVisible()) {
      await chatTab.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('What thinkers are in this database?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        await expect(page.locator('[class*="ai-panel"]')).toHaveScreenshot('ai-chat-with-message.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('AI unavailable state', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Mock AI unavailable
    await page.route('**/api/ai/**', route =>
      route.fulfill({ status: 503, body: JSON.stringify({ error: 'AI unavailable' }) })
    )

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const unavailableMessage = page.locator('text=/unavailable|disabled|offline/i')
    if (await unavailableMessage.isVisible()) {
      await expect(page.locator('[class*="ai-panel"]')).toHaveScreenshot('ai-panel-unavailable.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })
})
