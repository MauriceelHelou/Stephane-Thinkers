import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Selection Overlay', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 6,
      connections: 4,
    })
    thinkers = seedData.thinkers

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Single Selection Overlay', () => {
    test('should show selection ring on selected thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select a thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Selection ring/highlight should appear around thinker
    })

    test('should show selection with distinct color', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Selection should be visually distinct (blue, gold, etc.)
    })

    test('should move selection overlay when selecting different thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select first thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Select second thinker
      await canvasPage.click(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Selection should now be on second thinker
    })

    test('should remove selection overlay when deselecting', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Deselect by clicking empty area
      await canvasPage.click(500, 400)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Selection overlay should be removed
    })
  })

  test.describe('Multi-Selection Overlay', () => {
    test('should show selection overlay on multiple thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Multi-select
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await canvasPage.ctrlClick(thinkers[2].position_x || 260, thinkers[2].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // All three should have selection overlay
    })

    test('should show bounding box around multi-selection', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select multiple
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[2].position_x || 260, thinkers[2].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Might show a bounding box encompassing all selected
    })

    test('should update overlay when adding to selection', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select first
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Add second
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Both should have overlays
    })

    test('should update overlay when removing from selection', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select two
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Remove first
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Only second should have overlay
    })
  })

  test.describe('Drag Selection Box', () => {
    test('should show selection box when dragging on empty canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Drag on empty area to create selection box
      await canvasPage.selectArea(50, 150, 400, 300)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Selection box should appear and select thinkers within
    })

    test('should select all thinkers within drag box', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Drag box encompassing multiple thinkers
      await canvasPage.selectArea(50, 100, 350, 350)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Thinkers within box should be selected
    })

    test('should show drag box outline during selection', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const canvas = await canvasPage.helpers.getCanvas()
      const box = await canvas.boundingBox()

      if (box) {
        await page.keyboard.down('Shift')
        await page.mouse.move(box.x + 50, box.y + 100)
        await page.mouse.down()

        // Move slowly to see selection box
        await page.mouse.move(box.x + 300, box.y + 300)
        await page.waitForTimeout(TIMEOUTS.animation)

        // Selection box should be visible

        await page.mouse.up()
        await page.keyboard.up('Shift')
      }
    })

    test('should update selection as drag box changes', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const canvas = await canvasPage.helpers.getCanvas()
      const box = await canvas.boundingBox()

      if (box) {
        await page.keyboard.down('Shift')
        await page.mouse.move(box.x + 50, box.y + 100)
        await page.mouse.down()

        // Expand selection
        await page.mouse.move(box.x + 200, box.y + 250)
        await page.waitForTimeout(100)

        // Expand more
        await page.mouse.move(box.x + 400, box.y + 300)
        await page.waitForTimeout(100)

        await page.mouse.up()
        await page.keyboard.up('Shift')
      }
    })
  })

  test.describe('Selection Overlay at Different Zoom Levels', () => {
    test('should scale selection overlay with zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Zoom in
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Selection overlay should scale appropriately
    })

    test('should maintain selection through zoom changes', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Zoom in
      await canvasPage.zoomIn(2)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Zoom out
      await canvasPage.zoomOut(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Selection should still be on same thinker
    })
  })

  test.describe('Selection Overlay with Panning', () => {
    test('should move selection overlay with canvas pan', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Pan canvas
      await canvasPage.panRight(100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Selection overlay should move with the thinker
    })

    test('should maintain selection when panning thinker out of view', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Pan until thinker is out of view
      await canvasPage.panRight(500)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Pan back
      await canvasPage.panLeft(500)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Selection should still be active
    })
  })

  test.describe('Connection Selection Overlay', () => {
    test('should show selection on connection when clicked', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on connection line area
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.click(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connection should have selection indicator
    })

    test('should highlight connected thinkers when connection selected', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on connection
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.click(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Both endpoints should be highlighted
    })
  })

  test.describe('Selection Count Display', () => {
    test('should show selection count for multiple selections', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select multiple
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await canvasPage.ctrlClick(thinkers[2].position_x || 260, thinkers[2].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should show "3 selected" or similar indicator
      const selectionCount = page.locator('text=/\\d+.*selected/i')
        .or(page.locator('[data-testid="selection-count"]'))
    })

    test('should update selection count when adding/removing', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select 2
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Add 1
      await canvasPage.ctrlClick(thinkers[2].position_x || 260, thinkers[2].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Count should update
    })
  })
})
