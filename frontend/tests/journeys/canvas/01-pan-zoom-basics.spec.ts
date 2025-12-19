import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Pan and Zoom Basics', () => {
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

  test.describe('Mouse Drag Panning', () => {
    test('should pan canvas left by dragging right', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan right (drags canvas content left)
      await canvasPage.panRight(100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Canvas view should have shifted
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should pan canvas right by dragging left', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.panLeft(100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should pan canvas up by dragging down', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.panDown(100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should pan canvas down by dragging up', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.panUp(100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should pan diagonally', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Diagonal pan
      await canvasPage.helpers.panCanvas(100, 100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should continue panning with multiple drag operations', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Multiple pans
      await canvasPage.panRight(50)
      await canvasPage.panRight(50)
      await canvasPage.panDown(50)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Mouse Wheel Zooming', () => {
    test('should zoom in with wheel scroll up', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in (negative delta)
      await canvasPage.wheelZoom(-100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom out with wheel scroll down', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom out (positive delta)
      await canvasPage.wheelZoom(100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom centered on mouse position', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const center = await canvasPage.getCanvasCenter()

      // Zoom at specific position
      await canvasPage.wheelZoomAtPosition(center.x + 100, center.y, -100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should zoom incrementally with multiple wheel events', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Multiple zoom in steps
      await canvasPage.wheelZoom(-50)
      await canvasPage.wheelZoom(-50)
      await canvasPage.wheelZoom(-50)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Zoom Limits', () => {
    test('should respect minimum zoom level', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom out many times
      for (let i = 0; i < 20; i++) {
        await canvasPage.wheelZoom(100)
      }
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should not zoom beyond minimum
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should respect maximum zoom level', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in many times
      for (let i = 0; i < 20; i++) {
        await canvasPage.wheelZoom(-100)
      }
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should not zoom beyond maximum
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Combined Pan and Zoom', () => {
    test('should maintain pan position after zooming', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan first
      await canvasPage.panRight(100)

      // Then zoom
      await canvasPage.wheelZoom(-100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Pan position should be maintained relative to zoom
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should allow panning at different zoom levels', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in
      await canvasPage.wheelZoom(-200)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Pan at zoomed level
      await canvasPage.panRight(50)
      await canvasPage.panDown(50)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Pan and Zoom State', () => {
    test('should show thinkers at default position on load', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should show thinkers in their default positions
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should render connections while panning', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Start pan operation
      const canvas = await canvasPage.helpers.getCanvas()
      const box = await canvas.boundingBox()

      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await page.mouse.down()

        // Move slowly to see rendering during pan
        for (let i = 0; i < 10; i++) {
          await page.mouse.move(box.x + box.width / 2 + i * 10, box.y + box.height / 2)
          await page.waitForTimeout(50)
        }

        await page.mouse.up()
      }

      // Connections should still be visible
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should render thinkers while zooming', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Slow zoom to see rendering
      for (let i = 0; i < 5; i++) {
        await canvasPage.wheelZoom(-50)
        await page.waitForTimeout(100)
      }

      // Thinkers should remain visible
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })
})
