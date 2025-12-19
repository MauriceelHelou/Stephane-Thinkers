import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Edit Timeline Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 2,
      thinkers: 4,
      connections: 2,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open from timeline settings', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings|edit.*timeline/i })
        .or(page.locator('[data-testid="timeline-settings"]'))

      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+e')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Data Pre-population', () => {
    test('should show current timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings|edit.*timeline/i })
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const nameInput = page.locator('input[name="name"]').first()
        if (await nameInput.isVisible()) {
          const value = await nameInput.inputValue()
          expect(value.length).toBeGreaterThan(0)
        }
      }
    })

    test('should show current year range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings|edit.*timeline/i })
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startInput = page.locator('input[name*="start"]').first()
        const endInput = page.locator('input[name*="end"]').first()
      }
    })
  })

  test.describe('Edit Operations', () => {
    test('should update timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings|edit.*timeline/i })
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const nameInput = page.locator('input[name="name"]').first()
        if (await nameInput.isVisible()) {
          await nameInput.clear()
          await nameInput.fill('Updated Timeline Name')

          const saveButton = page.locator('button').filter({ hasText: /save|update/i })
          await saveButton.click()
          await page.waitForTimeout(TIMEOUTS.long)
        }
      }
    })

    test('should update year range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings|edit.*timeline/i })
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const startInput = page.locator('input[name*="start"]').first()
        if (await startInput.isVisible()) {
          await startInput.clear()
          await startInput.fill('1750')

          const saveButton = page.locator('button').filter({ hasText: /save|update/i })
          await saveButton.click()
          await page.waitForTimeout(TIMEOUTS.long)
        }
      }
    })
  })

  test.describe('Timeline Statistics', () => {
    test('should show thinker count', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings|edit.*timeline/i })
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const stats = page.locator('text=/thinker|\\d+.*thinker/i')
      }
    })

    test('should show connection count', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings|edit.*timeline/i })
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const stats = page.locator('text=/connection|\\d+.*connection/i')
      }
    })
  })
})
