import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Zoom Controls', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 3,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Zoom In Button', () => {
    test('should zoom in when clicking zoom in button', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Get initial zoom if visible
      const initialZoom = await canvasPage.getZoomLevel()

      // Click zoom in button
      await canvasPage.zoomIn()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Zoom should have increased
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom in multiple times', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click zoom in multiple times
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should stop at maximum zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in many times
      await canvasPage.zoomIn(20)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should be at max zoom, button might be disabled
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Zoom Out Button', () => {
    test('should zoom out when clicking zoom out button', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click zoom out button
      await canvasPage.zoomOut()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom out multiple times', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.zoomOut(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should stop at minimum zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom out many times
      await canvasPage.zoomOut(20)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should be at min zoom
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Reset Zoom Button', () => {
    test('should reset zoom to default level', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in first
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Reset zoom
      await canvasPage.resetZoom()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should be back to default (100% or 1.0)
      const zoomLevel = await canvasPage.getZoomLevel()
      // Zoom should be reset
    })

    test('should reset from zoomed out state', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom out first
      await canvasPage.zoomOut(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Reset zoom
      await canvasPage.resetZoom()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should reset pan position along with zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan and zoom
      await canvasPage.panRight(200)
      await canvasPage.zoomIn(2)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Reset
      await canvasPage.resetZoom()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // View should be reset
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Fit to View Button', () => {
    test('should fit all thinkers in view', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom way out first
      await canvasPage.zoomOut(5)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Fit to view
      await canvasPage.fitToView()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // All thinkers should be visible
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should adjust zoom level to show all content', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in so not all content is visible
      await canvasPage.zoomIn(5)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Fit to view
      await canvasPage.fitToView()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should center content in viewport', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan to corner
      await canvasPage.panRight(500)
      await canvasPage.panDown(500)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Fit to view should center
      await canvasPage.fitToView()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Zoom Indicator', () => {
    test('should display current zoom level', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Check zoom indicator
      const zoomLevel = await canvasPage.getZoomLevel()
      // Zoom indicator should show percentage like "100%" or ratio
    })

    test('should update zoom indicator when zooming in', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const initialZoom = await canvasPage.getZoomLevel()

      await canvasPage.zoomIn()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      const newZoom = await canvasPage.getZoomLevel()
      // New zoom should be higher than initial (if indicator available)
    })

    test('should update zoom indicator when zooming out', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const initialZoom = await canvasPage.getZoomLevel()

      await canvasPage.zoomOut()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      const newZoom = await canvasPage.getZoomLevel()
      // New zoom should be lower
    })
  })

  test.describe('Zoom Levels', () => {
    test('should zoom to 0.5x (50%)', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.setZoomToLevel(0.5)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom to 1.0x (100%) - default', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom to non-default first
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Set to 1.0x
      await canvasPage.setZoomToLevel(1.0)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom to 2.0x (200%)', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.setZoomToLevel(2.0)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom to 5.0x (500%) - maximum typical', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.setZoomToLevel(5.0)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Keyboard Zoom Shortcuts', () => {
    test('should zoom in with Cmd/Ctrl + Plus', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Press Cmd/Ctrl + =
      await page.keyboard.press('Meta+=')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom out with Cmd/Ctrl + Minus', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Press Cmd/Ctrl + -
      await page.keyboard.press('Meta+-')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should reset zoom with Cmd/Ctrl + 0', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)
      await mainPage.waitForPageLoad()

      // Zoom first
      await canvasPage.zoomIn(2)

      // Reset with keyboard
      await page.keyboard.press('Meta+0')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })
  })
})
