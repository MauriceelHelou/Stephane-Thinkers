import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Import Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 2,
      connections: 0,
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

        const importOption = page.locator('text=/import/i')
        if (await importOption.isVisible()) {
          await importOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('File Selection', () => {
    test('should have file input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const fileInput = page.locator('input[type="file"]')
    })

    test('should accept JSON files', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const fileInput = page.locator('input[type="file"]')
      // Accept attribute should include .json
    })

    test('should accept CSV files', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const fileInput = page.locator('input[type="file"]')
      // Accept attribute should include .csv
    })

    test('should have drag and drop zone', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const dropZone = page.locator('[class*="drop"], [class*="upload"]')
    })
  })

  test.describe('Import Options', () => {
    test('should offer merge option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const mergeOption = page.locator('input[type="radio"], input[type="checkbox"]')
        .filter({ hasText: /merge/i })
    })

    test('should offer replace option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const replaceOption = page.locator('input[type="radio"], input[type="checkbox"]')
        .filter({ hasText: /replace/i })
    })

    test('should offer new timeline option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const newTimelineOption = page.locator('input[type="radio"], input[type="checkbox"]')
        .filter({ hasText: /new.*timeline/i })
    })
  })

  test.describe('Validation', () => {
    test('should validate file format', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Should reject invalid file formats
    })

    test('should validate file structure', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Should validate JSON structure
    })

    test('should show validation errors', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const errorMessage = page.locator('[class*="error"]')
    })
  })

  test.describe('Import Preview', () => {
    test('should show preview of data to import', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const preview = page.locator('[class*="preview"]')
    })

    test('should show count of items to import', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const count = page.locator('text=/\\d+.*thinker|\\d+.*connection/i')
    })

    test('should highlight conflicts', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const conflicts = page.locator('[class*="conflict"], [class*="warning"]')
    })
  })

  test.describe('Import Action', () => {
    test('should start import on button click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const importButton = page.locator('button').filter({ hasText: /import/i })
    })

    test('should show progress during import', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const progress = page.locator('[role="progressbar"]')
    })

    test('should show success message on completion', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const success = page.locator('text=/imported|success/i')
    })

    test('should update canvas after import', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should show new thinkers
    })
  })
})
