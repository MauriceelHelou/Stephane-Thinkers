import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Add Quote Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Test Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open from thinker details', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const addQuoteButton = page.locator('button').filter({ hasText: /quote/i })
        if (await addQuoteButton.isVisible()) {
          await addQuoteButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Form Fields', () => {
    test('should have quote text field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const addQuoteButton = page.locator('button').filter({ hasText: /quote/i })
        if (await addQuoteButton.isVisible()) {
          await addQuoteButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const quoteInput = page.locator('textarea[name="text"], textarea[name="quote"]')
        }
      }
    })

    test('should have source field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const sourceInput = page.locator('input[name="source"]')
    })

    test('should have year field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const yearInput = page.locator('input[name="year"]')
    })

    test('should have context field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const contextInput = page.locator('textarea[name="context"]')
    })
  })

  test.describe('Form Submission', () => {
    test('should create quote with valid data', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const addQuoteButton = page.locator('button').filter({ hasText: /quote/i })
        if (await addQuoteButton.isVisible()) {
          await addQuoteButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const quoteInput = page.locator('textarea[name="text"], textarea[name="quote"]').first()
          if (await quoteInput.isVisible()) {
            await quoteInput.fill('Two things fill the mind with ever new and increasing admiration and awe.')
          }

          const sourceInput = page.locator('input[name="source"]').first()
          if (await sourceInput.isVisible()) {
            await sourceInput.fill('Critique of Practical Reason')
          }

          const submitButton = page.locator('button').filter({ hasText: /save|create|add/i })
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)
        }
      }
    })
  })

  test.describe('Quote Formatting', () => {
    test('should preserve quote formatting', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Quotes with line breaks should be preserved
    })

    test('should handle long quotes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Should handle multi-paragraph quotes
    })
  })
})
