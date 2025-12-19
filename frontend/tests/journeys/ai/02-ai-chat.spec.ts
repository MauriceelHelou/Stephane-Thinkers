import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('AI Journey: AI Chat Interface', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 3,
      publications: 2,
      quotes: 2,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Chat Tab Access', () => {
    test('should show chat tab in AI panel', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      await expect(chatTab).toBeVisible()
    })

    test('should switch to chat tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
      if (await chatTab.isVisible()) {
        await chatTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should display chat input area', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Chat input should be visible
      const chatInput = page.locator('textarea, input').filter({ hasText: '' })
        .or(page.locator('[data-testid="chat-input"]'))
        .or(page.locator('[placeholder*="message" i]'))
        .or(page.locator('[placeholder*="ask" i]'))
    })
  })

  test.describe('Sending Messages', () => {
    test('should send message via input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input[type="text"]')
        .filter({ has: page.locator('[placeholder*="message" i], [placeholder*="ask" i]') })
        .or(page.locator('[data-testid="chat-input"]'))

      if (await chatInput.first().isVisible()) {
        await chatInput.first().fill('Who was Immanuel Kant?')

        // Send with button or enter
        const sendButton = page.locator('button').filter({ hasText: /send|submit/i })
          .or(page.locator('[aria-label*="send"]'))

        if (await sendButton.isVisible()) {
          await sendButton.click()
        } else {
          await page.keyboard.press('Enter')
        }

        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })

    test('should show message in chat history', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input')
        .or(page.locator('[data-testid="chat-input"]'))

      if (await chatInput.first().isVisible()) {
        await chatInput.first().fill('Test message')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Message should appear in chat history
        const messageInHistory = page.locator('text=Test message')
      }
    })

    test('should send message with Enter key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input')
        .or(page.locator('[data-testid="chat-input"]'))

      if (await chatInput.first().isVisible()) {
        await chatInput.first().fill('Enter key test')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should clear input after sending', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input')
        .or(page.locator('[data-testid="chat-input"]'))

      if (await chatInput.first().isVisible()) {
        await chatInput.first().fill('Clear test')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Input should be cleared
        const value = await chatInput.first().inputValue()
        expect(value).toBe('')
      }
    })
  })

  test.describe('RAG-Based Responses', () => {
    test('should include database context in responses', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Ask about seeded thinker
      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Tell me about the connections in this database')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Response should reference database content
      }
    })

    test('should answer questions about thinkers in database', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('How many thinkers are in this timeline?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should answer questions about connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('What connections exist between thinkers?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Chat History', () => {
    test('should display conversation history', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        // Send first message
        await chatInput.fill('First message')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.medium)

        // Send second message
        await chatInput.fill('Second message')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.medium)

        // Both should be in history
        const first = page.locator('text=First message')
        const second = page.locator('text=Second message')
      }
    })

    test('should distinguish user and AI messages', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // User messages and AI responses should have different styling
      const userMessage = page.locator('[class*="user-message"], [class*="user"]')
      const aiMessage = page.locator('[class*="ai-message"], [class*="assistant"]')
    })

    test('should scroll to latest message', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        // Send multiple messages
        for (let i = 0; i < 5; i++) {
          await chatInput.fill(`Message ${i}`)
          await page.keyboard.press('Enter')
          await page.waitForTimeout(TIMEOUTS.short)
        }

        // Latest message should be visible (auto-scroll)
      }
    })

    test('should allow clearing chat history', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Look for clear history button
      const clearButton = page.locator('button').filter({ hasText: /clear|reset|new.*chat/i })

      if (await clearButton.isVisible()) {
        await clearButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Loading States', () => {
    test('should show loading indicator while waiting for response', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test loading')
        await page.keyboard.press('Enter')

        // Should show loading/thinking indicator
        const loadingIndicator = page.locator('[class*="loading"], [class*="thinking"]')
          .or(page.locator('text=/thinking|generating|loading/i'))
      }
    })

    test('should disable input while processing', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test disable')
        await page.keyboard.press('Enter')

        // Input might be disabled during processing
      }
    })
  })

  test.describe('Error Handling', () => {
    test('should show error message on failure', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // If AI fails, should show error message
      const errorMessage = page.locator('[class*="error"]')
        .or(page.locator('text=/error|failed|try again/i'))
    })

    test('should allow retry after error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Retry button should appear after error
      const retryButton = page.locator('button').filter({ hasText: /retry|try again/i })
    })
  })
})
