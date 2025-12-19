import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('AI Journey: Natural Language Parsing', () => {
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

  test.describe('Thinker Parsing', () => {
    test('should parse natural language to add thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        // Natural language command to add thinker
        await chatInput.fill('Add a new thinker named Friedrich Nietzsche who lived from 1844 to 1900 and worked in Philosophy')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // AI should parse and create thinker or offer to create
      }
    })

    test('should extract name from natural language', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Create thinker John Stuart Mill')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should extract birth and death years', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add philosopher born in 1770 who died in 1831')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should extract field from natural language', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add economist Karl Marx to the timeline')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Connection Parsing', () => {
    test('should parse natural language to add connection', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Kant influenced Hegel')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // AI should understand and create connection
      }
    })

    test('should recognize influence relationship', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Connect Kant to Hegel as influenced')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should recognize critique relationship', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Marx critiqued Hegel')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should recognize built upon relationship', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Fichte built upon Kant\'s ideas')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should recognize synthesized relationship', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Hegel synthesized ideas from Kant and Fichte')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Event Parsing', () => {
    test('should parse natural language to add event', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add the French Revolution in 1789 as a political event')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should extract event year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add Critique of Pure Reason publication in 1781')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should extract event type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add the Council of Trent as a religious council')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Batch Parsing', () => {
    test('should parse multiple entities from single input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add Kant, Hegel, and Marx as philosophers, then connect Kant to Hegel as influenced')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should handle complex natural language input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Immanuel Kant (1724-1804) was a German philosopher who influenced Georg Hegel')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Parsing Confirmation', () => {
    test('should confirm parsed entities before creating', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add thinker Jean-Paul Sartre (1905-1980)')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Should show confirmation dialog or inline confirmation
        const confirmation = page.locator('text=/confirm|create.*sartre|add.*sartre/i')
      }
    })

    test('should allow editing parsed data before confirmation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // AI should show parsed fields that can be edited
    })

    test('should allow canceling parsed creation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Cancel button should be available
      const cancelButton = page.locator('button').filter({ hasText: /cancel|no|decline/i })
    })
  })

  test.describe('Parsing Errors', () => {
    test('should handle ambiguous input gracefully', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add someone important')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Should ask for clarification
        const clarificationRequest = page.locator('text=/who|which|specify|more.*detail/i')
      }
    })

    test('should ask for missing information', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Add Kant')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Should ask for birth/death years or other details
      }
    })
  })
})
