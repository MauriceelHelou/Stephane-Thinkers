import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Canvas with Thinkers', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Philosophy Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    // Create multiple thinkers with different positions
    await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 100,
      position_y: 200,
    })

    await api.createThinker({
      name: 'Georg Hegel',
      birth_year: 1770,
      death_year: 1831,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 300,
      position_y: 200,
    })

    await api.createThinker({
      name: 'Karl Marx',
      birth_year: 1818,
      death_year: 1883,
      field: 'Economics',
      timeline_id: timeline.id,
      position_x: 500,
      position_y: 200,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test('canvas with multiple thinkers', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('canvas-with-thinkers.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('thinker node default appearance', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
    if (await thinker.isVisible()) {
      await expect(thinker).toHaveScreenshot('thinker-node-default.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('thinker node hover state', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
    if (await thinker.isVisible()) {
      await thinker.hover()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(thinker).toHaveScreenshot('thinker-node-hover.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('thinker node selected state', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
    if (await thinker.isVisible()) {
      await thinker.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(thinker).toHaveScreenshot('thinker-node-selected.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('multiple thinkers selected', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const thinkers = page.locator('[data-testid*="thinker"], [class*="thinker"]')
    const count = await thinkers.count()

    if (count >= 2) {
      await thinkers.first().click()
      await thinkers.nth(1).click({ modifiers: ['Control'] })
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('multiple-thinkers-selected.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('thinker labels visible', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Capture canvas area with labels
    await expect(mainPage.canvasElement).toHaveScreenshot('canvas-thinker-labels.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('thinker tooltip on hover', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
    if (await thinker.isVisible()) {
      await thinker.hover()
      await page.waitForTimeout(500) // Wait for tooltip

      const tooltip = page.locator('[role="tooltip"], [class*="tooltip"]')
      if (await tooltip.isVisible()) {
        await expect(tooltip).toHaveScreenshot('thinker-tooltip.png', {
          maxDiffPixelRatio: 0.01,
        })
      }
    }
  })

  test('thinkers by field color coding', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Different fields should have different colors
    await expect(page).toHaveScreenshot('thinkers-color-coded.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('canvas panned with thinkers', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Pan the canvas
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('canvas-panned-thinkers.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('canvas fit to view', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Fit all thinkers in view
    await page.keyboard.press('f')
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('canvas-fit-to-view.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
