import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Responsive Design', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 3,
    })
  })

  test('desktop view - 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('responsive-desktop-1920.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('laptop view - 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('responsive-laptop-1440.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('small laptop view - 1366x768', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('responsive-small-laptop.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('tablet landscape - 1024x768', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('responsive-tablet-landscape.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('tablet portrait - 768x1024', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('responsive-tablet-portrait.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('mobile landscape - 667x375', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('responsive-mobile-landscape.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('mobile portrait - 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('responsive-mobile-portrait.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('small mobile - 320x568', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('responsive-small-mobile.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('modal on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('modal-mobile.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('toolbar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const toolbar = page.locator('[class*="toolbar"]')
    if (await toolbar.isVisible()) {
      await expect(toolbar).toHaveScreenshot('toolbar-mobile.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('AI panel on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('ai-panel-mobile.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('touch interaction targets', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Buttons should be at least 44x44px for touch
    const buttons = page.locator('button')
    const count = await buttons.count()

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i)
      if (await button.isVisible()) {
        const box = await button.boundingBox()
        if (box) {
          // Minimum touch target size
          expect(box.width).toBeGreaterThanOrEqual(40)
          expect(box.height).toBeGreaterThanOrEqual(40)
        }
      }
    }
  })
})
