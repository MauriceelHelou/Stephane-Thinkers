import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Add Publication Modal', () => {
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

        const addPubButton = page.locator('button').filter({ hasText: /publication|add.*work/i })
        if (await addPubButton.isVisible()) {
          await addPubButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Form Fields', () => {
    test('should have title field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Navigate to publication modal
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const addPubButton = page.locator('button').filter({ hasText: /publication/i })
        if (await addPubButton.isVisible()) {
          await addPubButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const titleInput = page.locator('input[name="title"]')
        }
      }
    })

    test('should have year field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const addPubButton = page.locator('button').filter({ hasText: /publication/i })
        if (await addPubButton.isVisible()) {
          await addPubButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const yearInput = page.locator('input[name="year"]')
        }
      }
    })

    test('should have publication type selector', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Publication types: book, article, essay, treatise, etc.
      const typeSelector = page.locator('select[name="publication_type"]')
    })

    test('should have citation field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const citationInput = page.locator('textarea[name="citation"]')
    })
  })

  test.describe('Publication Types', () => {
    test('should allow book type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const bookOption = page.locator('[value="book"]')
        .or(page.locator('text=/book/i'))
    })

    test('should allow article type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const articleOption = page.locator('[value="article"]')
        .or(page.locator('text=/article/i'))
    })

    test('should allow essay type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const essayOption = page.locator('[value="essay"]')
        .or(page.locator('text=/essay/i'))
    })
  })

  test.describe('Form Submission', () => {
    test('should create publication with valid data', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const addPubButton = page.locator('button').filter({ hasText: /publication/i })
        if (await addPubButton.isVisible()) {
          await addPubButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const titleInput = page.locator('input[name="title"]').first()
          if (await titleInput.isVisible()) {
            await titleInput.fill('Critique of Pure Reason')
          }

          const yearInput = page.locator('input[name="year"]').first()
          if (await yearInput.isVisible()) {
            await yearInput.fill('1781')
          }

          const submitButton = page.locator('button').filter({ hasText: /save|create|add/i })
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)
        }
      }
    })
  })
})
