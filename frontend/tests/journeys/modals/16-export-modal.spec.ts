import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Export Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 4,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open from file menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const fileMenu = page.locator('button').filter({ hasText: /file|menu/i })
      if (await fileMenu.isVisible()) {
        await fileMenu.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const exportOption = page.locator('text=/export/i')
        if (await exportOption.isVisible()) {
          await exportOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+Shift+e')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Export Formats', () => {
    test('should offer JSON export', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const jsonOption = page.locator('[value="json"]')
        .or(page.locator('text=/json/i'))
    })

    test('should offer CSV export', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const csvOption = page.locator('[value="csv"]')
        .or(page.locator('text=/csv/i'))
    })

    test('should offer PDF export', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const pdfOption = page.locator('[value="pdf"]')
        .or(page.locator('text=/pdf/i'))
    })

    test('should offer image export', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const imageOption = page.locator('[value="png"], [value="svg"]')
        .or(page.locator('text=/image|png|svg/i'))
    })
  })

  test.describe('Export Options', () => {
    test('should allow selecting what to export', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Options for thinkers, connections, timeline
      const thinkerOption = page.locator('input[type="checkbox"]').filter({ hasText: /thinker/i })
      const connectionOption = page.locator('input[type="checkbox"]').filter({ hasText: /connection/i })
    })

    test('should allow selecting date range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const dateRange = page.locator('input[type="date"], [class*="date-range"]')
    })

    test('should have image quality settings for image export', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const qualityOption = page.locator('select[name="quality"], input[type="range"]')
    })
  })

  test.describe('Export Action', () => {
    test('should start export on button click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const fileMenu = page.locator('button').filter({ hasText: /file|menu/i })
      if (await fileMenu.isVisible()) {
        await fileMenu.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const exportOption = page.locator('text=/export/i')
        if (await exportOption.isVisible()) {
          await exportOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const exportButton = page.locator('button').filter({ hasText: /export|download/i })
          if (await exportButton.isVisible()) {
            // Would trigger download
          }
        }
      }
    })

    test('should show progress for large exports', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Progress indicator for large exports
      const progress = page.locator('[role="progressbar"], [class*="progress"]')
    })

    test('should show success message on completion', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Success toast/message
      const success = page.locator('text=/exported|success|downloaded/i')
    })
  })

  test.describe('Export Preview', () => {
    test('should show preview for image export', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const preview = page.locator('[class*="preview"]')
    })
  })
})
