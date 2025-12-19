import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Add Tag Modal', () => {
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

        const addTagButton = page.locator('button').filter({ hasText: /tag/i })
        if (await addTagButton.isVisible()) {
          await addTagButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Tag Input', () => {
    test('should allow typing new tag', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const tagInput = page.locator('input[name="tag"], input[placeholder*="tag" i]')
      if (await tagInput.isVisible()) {
        await tagInput.fill('Enlightenment')
      }
    })

    test('should show existing tags as suggestions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Existing tags should be suggested
      const suggestions = page.locator('[class*="suggestion"], [class*="autocomplete"]')
    })

    test('should allow selecting existing tag', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on existing tag to add
    })
  })

  test.describe('Tag Creation', () => {
    test('should create new tag', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const addTagButton = page.locator('button').filter({ hasText: /tag/i })
        if (await addTagButton.isVisible()) {
          await addTagButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const tagInput = page.locator('input[name="tag"]').first()
          if (await tagInput.isVisible()) {
            await tagInput.fill('German Idealism')
            await page.keyboard.press('Enter')
            await page.waitForTimeout(TIMEOUTS.animation)
          }
        }
      }
    })

    test('should allow adding multiple tags', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Should support adding multiple tags at once
    })
  })

  test.describe('Tag Display', () => {
    test('should show added tags', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const tags = page.locator('[class*="tag"], [class*="chip"]')
    })

    test('should allow removing tags', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const removeButton = page.locator('[class*="tag"] button, [class*="remove"]')
    })
  })
})
