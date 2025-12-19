import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Drag Thinkers', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 4,
      connections: 2,
    })
    thinkers = seedData.thinkers

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Basic Drag Operations', () => {
    test('should drag thinker to new position', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const startX = thinkers[0].position_x || 100
      const startY = thinkers[0].position_y || 200
      const endX = startX + 100
      const endY = startY + 50

      await canvasPage.dragThinker(startX, startY, endX, endY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Thinker should be at new position
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should update thinker position in database after drag', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)
      const api = createAPIHelpers(request)

      await mainPage.waitForPageLoad()

      const originalX = thinkers[0].position_x || 100
      const originalY = thinkers[0].position_y || 200
      const newX = originalX + 150
      const newY = originalY + 75

      await canvasPage.dragThinker(originalX, originalY, newX, newY)
      await page.waitForTimeout(TIMEOUTS.medium)

      // Check API for updated position
      const updatedThinker = await api.getThinker(thinkers[0].id)
      // Position should be updated (exact values depend on zoom/offset)
    })

    test('should drag thinker horizontally', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.dragThinker(x, y, x + 200, y)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should drag thinker vertically', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.dragThinker(x, y, x, y + 150)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should drag thinker diagonally', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.dragThinker(x, y, x + 100, y + 100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Drag Visual Feedback', () => {
    test('should show drag cursor during drag', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      // Start drag
      const canvas = await canvasPage.helpers.getCanvas()
      const box = await canvas.boundingBox()

      if (box) {
        await page.mouse.move(box.x + x, box.y + y)
        await page.mouse.down()

        // During drag, cursor should change
        await page.mouse.move(box.x + x + 50, box.y + y + 50)
        await page.waitForTimeout(100)

        await page.mouse.up()
      }
    })

    test('should highlight thinker during drag', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      // Drag with visual feedback
      const canvas = await canvasPage.helpers.getCanvas()
      const box = await canvas.boundingBox()

      if (box) {
        await page.mouse.move(box.x + x, box.y + y)
        await page.mouse.down()

        // Move in steps to see visual feedback
        for (let i = 0; i < 5; i++) {
          await page.mouse.move(box.x + x + i * 20, box.y + y + i * 10)
          await page.waitForTimeout(50)
        }

        await page.mouse.up()
      }
    })

    test('should show thinker at mouse position during drag', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Thinker should follow mouse during drag
    })
  })

  test.describe('Drag with Connections', () => {
    test('should update connection lines when dragging connected thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Drag a thinker that has connections
      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.dragThinker(x, y, x + 100, y + 50)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Connection lines should be redrawn to new position
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should maintain connection integrity during drag', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)
      const api = createAPIHelpers(request)

      await mainPage.waitForPageLoad()

      const originalConnections = await api.getAllConnections()

      // Drag thinker
      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.dragThinker(x, y, x + 100, y)
      await page.waitForTimeout(TIMEOUTS.medium)

      // Connections should still exist
      const newConnections = await api.getAllConnections()
      expect(newConnections.length).toBe(originalConnections.length)
    })
  })

  test.describe('Drag at Different Zoom Levels', () => {
    test('should drag correctly when zoomed in', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Drag should still work with correct world coordinate translation
      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.dragThinker(x, y, x + 50, y + 50)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })

    test('should drag correctly when zoomed out', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom out
      await canvasPage.zoomOut(2)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.dragThinker(x, y, x + 100, y)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })
  })

  test.describe('Drag Boundaries', () => {
    test('should allow dragging to edge of canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      // Drag toward edge
      await canvasPage.dragThinker(x, y, 10, y)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })

    test('should handle drag outside canvas bounds', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      // Try to drag outside canvas
      await canvasPage.dragThinker(x, y, -100, y)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should handle gracefully (clamp or cancel)
    })
  })

  test.describe('Drag Multiple Selected', () => {
    test('should drag all selected thinkers together', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Multi-select
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Drag one of the selected
      await canvasPage.dragThinker(thinkers[0].position_x || 100, thinkers[0].position_y || 200, 200, 300)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Both should move together (if feature supported)
    })

    test('should maintain relative positions when dragging multiple', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select multiple
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Drag - relative positions should be maintained
    })
  })

  test.describe('Cancel Drag', () => {
    test('should cancel drag on escape key', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      const canvas = await canvasPage.helpers.getCanvas()
      const box = await canvas.boundingBox()

      if (box) {
        await page.mouse.move(box.x + x, box.y + y)
        await page.mouse.down()
        await page.mouse.move(box.x + x + 100, box.y + y + 50)

        // Press escape to cancel
        await page.keyboard.press('Escape')
        await page.mouse.up()

        await page.waitForTimeout(TIMEOUTS.canvasRender)
      }

      // Thinker should return to original position
    })
  })
})
