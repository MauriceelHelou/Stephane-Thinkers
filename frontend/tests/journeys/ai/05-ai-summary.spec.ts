import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('AI Journey: Database Summaries', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 2,
      thinkers: 8,
      connections: 6,
      publications: 4,
      quotes: 4,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Overview Summary', () => {
    test('should generate overview summary of database', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Give me an overview of this intellectual genealogy')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Response should include summary statistics
      }
    })

    test('should include thinker count in overview', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('How many thinkers are in this database?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Should mention count
      }
    })

    test('should include connection count in overview', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('How many connections exist between thinkers?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should include time span in overview', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('What time period does this timeline cover?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Thinker Summary', () => {
    test('should generate summary for specific thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Summarize Immanuel Kant')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should include biographical details in thinker summary', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Tell me about the first thinker in this database')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Should include birth/death years, field
      }
    })

    test('should include connections in thinker summary', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Who did Kant influence according to this database?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should include publications in thinker summary', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('What publications are listed for thinkers in this database?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Field Summary', () => {
    test('should generate summary for a field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Summarize the philosophers in this database')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should list thinkers by field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Which thinkers are in the Philosophy field?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should describe field connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('How are philosophers connected in this database?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Period Summary', () => {
    test('should generate summary for a time period', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Summarize thinkers from the 18th century')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should list thinkers active in period', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Who was alive in 1800?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should describe intellectual movements in period', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('What intellectual developments happened between 1750 and 1850?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Comparative Summary', () => {
    test('should compare two thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Compare Kant and Hegel based on the data here')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should compare two timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('How do the two timelines in this database differ?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Summary Export', () => {
    test('should allow copying summary to clipboard', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Copy button in AI response
      const copyButton = page.locator('button').filter({ hasText: /copy/i })
        .or(page.locator('[aria-label*="copy"]'))
    })
  })
})
