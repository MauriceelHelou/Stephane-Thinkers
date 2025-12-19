import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Empty Canvas', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    // Create timeline with no thinkers
    await api.createTimeline({
      name: 'Empty Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test('empty canvas default state', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('empty-canvas-default.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('empty canvas with toolbar visible', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Focus on toolbar area
    const toolbar = page.locator('[class*="toolbar"], [data-testid="toolbar"]')
    await expect(toolbar).toHaveScreenshot('toolbar-default.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('empty canvas with ruler', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Capture ruler/timeline area
    const ruler = page.locator('[class*="ruler"], [class*="timeline-ruler"]')
    if (await ruler.isVisible()) {
      await expect(ruler).toHaveScreenshot('ruler-default.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('empty canvas zoomed out', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Zoom out
    await page.keyboard.press('-')
    await page.keyboard.press('-')
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('empty-canvas-zoomed-out.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('empty canvas zoomed in', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Zoom in
    await page.keyboard.press('=')
    await page.keyboard.press('=')
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('empty-canvas-zoomed-in.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('empty canvas with grid visible', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // If grid can be toggled on
    const gridToggle = page.locator('button').filter({ hasText: /grid/i })
    if (await gridToggle.isVisible()) {
      await gridToggle.click()
      await page.waitForTimeout(TIMEOUTS.animation)
    }

    await expect(page).toHaveScreenshot('empty-canvas-with-grid.png', {
      maxDiffPixelRatio: 0.01,
    })
  })

  test('empty canvas dark mode', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Toggle dark mode
    const darkModeToggle = page.locator('button').filter({ hasText: /dark|theme/i })
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('empty-canvas-dark-mode.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('empty canvas with empty state message', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Empty state message/placeholder
    const emptyState = page.locator('[class*="empty-state"], text=/no.*thinker|add.*first/i')
    if (await emptyState.isVisible()) {
      await expect(emptyState).toHaveScreenshot('empty-state-message.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })
})
