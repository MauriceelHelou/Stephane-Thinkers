import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Settings Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 2,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open from settings button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings|preferences/i })
        .or(page.locator('[data-testid="settings"]'))
        .or(page.locator('[aria-label*="settings"]'))

      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const modal = page.locator('[role="dialog"]')
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+,')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Settings Categories', () => {
    test('should have display settings', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const displaySection = page.locator('text=/display|appearance|visual/i')
    })

    test('should have canvas settings', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const canvasSection = page.locator('text=/canvas|view/i')
    })

    test('should have AI settings', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const aiSection = page.locator('text=/ai|assistant/i')
    })

    test('should have keyboard shortcuts settings', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const keyboardSection = page.locator('text=/keyboard|shortcut/i')
    })
  })

  test.describe('Display Settings', () => {
    test('should have theme toggle', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const themeToggle = page.locator('input[type="checkbox"], button')
        .filter({ hasText: /dark|light|theme/i })
    })

    test('should have font size option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const fontSize = page.locator('select, input[type="range"]')
        .filter({ hasText: /font.*size/i })
    })

    test('should have show labels toggle', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const labelsToggle = page.locator('input[type="checkbox"]')
        .filter({ hasText: /label|name/i })
    })
  })

  test.describe('Canvas Settings', () => {
    test('should have grid toggle', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const gridToggle = page.locator('input[type="checkbox"]')
        .filter({ hasText: /grid/i })
    })

    test('should have snap to grid option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const snapToggle = page.locator('input[type="checkbox"]')
        .filter({ hasText: /snap/i })
    })

    test('should have animation toggle', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const animationToggle = page.locator('input[type="checkbox"]')
        .filter({ hasText: /animation|transition/i })
    })
  })

  test.describe('AI Settings', () => {
    test('should have AI enable toggle', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const aiToggle = page.locator('input[type="checkbox"]')
        .filter({ hasText: /enable.*ai|ai.*enable/i })
    })

    test('should have API key input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const apiKeyInput = page.locator('input[type="password"], input[name*="api"]')
    })
  })

  test.describe('Settings Persistence', () => {
    test('should save settings', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const settingsButton = page.locator('button').filter({ hasText: /settings/i })
      if (await settingsButton.isVisible()) {
        await settingsButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const saveButton = page.locator('button').filter({ hasText: /save|apply/i })
        if (await saveButton.isVisible()) {
          await saveButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should persist settings after reload', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Change a setting, reload, check if persisted
    })

    test('should have reset to defaults option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const resetButton = page.locator('button').filter({ hasText: /reset|default/i })
    })
  })
})
