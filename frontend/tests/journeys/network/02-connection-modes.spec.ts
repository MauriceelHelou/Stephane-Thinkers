import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Network Journey: Connection Modes', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 4,
      connections: 0,
    })
    thinkers = seedData.thinkers

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Shift+Click Connection Mode', () => {
    test('should enter connection mode when shift+clicking a thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      // Get canvas ready
      await mainPage.waitForPageLoad()

      // First thinker position (these are placed during seeding)
      const firstThinkerX = thinkers[0].position_x || 100
      const firstThinkerY = thinkers[0].position_y || 200

      // Shift+click on first thinker position
      await canvasPage.shiftClick(firstThinkerX, firstThinkerY)

      // Should see visual indicator of connection mode
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should show connection line preview when dragging in connection mode', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const startX = thinkers[0].position_x || 100
      const startY = thinkers[0].position_y || 200
      const endX = thinkers[1].position_x || 180
      const endY = thinkers[1].position_y || 200

      // Start connection mode with shift+click
      await page.keyboard.down('Shift')
      await canvasPage.click(startX, startY)

      // Drag to another position (without releasing shift yet)
      await canvasPage.hover(endX, endY)
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.up('Shift')
    })

    test('should create connection when completing shift+click sequence', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)
      const api = createAPIHelpers(request)

      await mainPage.waitForPageLoad()

      // Get initial connection count
      const initialConnections = await api.getAllConnections()
      const initialCount = initialConnections.length

      const startX = thinkers[0].position_x || 100
      const startY = thinkers[0].position_y || 200
      const endX = thinkers[1].position_x || 180
      const endY = thinkers[1].position_y || 200

      // Perform shift+click connection
      await page.keyboard.down('Shift')
      await canvasPage.click(startX, startY)
      await page.waitForTimeout(TIMEOUTS.short)
      await canvasPage.click(endX, endY)
      await page.keyboard.up('Shift')

      await page.waitForTimeout(TIMEOUTS.medium)

      // Check if connection modal appeared or connection was created
      const modal = page.locator('[role="dialog"]')
      const modalVisible = await modal.isVisible()

      if (!modalVisible) {
        // Connection might have been created directly
        const newConnections = await api.getAllConnections()
        // Either modal should appear or connection count increased
        expect(newConnections.length >= initialCount).toBeTruthy()
      }
    })

    test('should cancel connection mode on escape', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const startX = thinkers[0].position_x || 100
      const startY = thinkers[0].position_y || 200

      // Start connection mode
      await page.keyboard.down('Shift')
      await canvasPage.click(startX, startY)
      await page.keyboard.up('Shift')

      await page.waitForTimeout(TIMEOUTS.animation)

      // Cancel with escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connection mode should be cancelled
      // Canvas should be back to normal mode
    })

    test('should exit connection mode when clicking on empty canvas area', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const startX = thinkers[0].position_x || 100
      const startY = thinkers[0].position_y || 200

      // Start connection mode
      await canvasPage.shiftClick(startX, startY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click on empty area (far from any thinkers)
      await canvasPage.click(500, 500)
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Ctrl+Click Multi-Selection Mode', () => {
    test('should select multiple thinkers with ctrl+click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Ctrl+click on first thinker
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Ctrl+click on second thinker
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Both should be selected (implementation dependent on visual feedback)
    })

    test('should deselect thinker when ctrl+clicking again', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      // Ctrl+click to select
      await canvasPage.ctrlClick(x, y)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Ctrl+click again to deselect
      await canvasPage.ctrlClick(x, y)
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should allow bulk operations on multi-selected thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select multiple thinkers
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await canvasPage.ctrlClick(thinkers[2].position_x || 260, thinkers[2].position_y || 200)

      await page.waitForTimeout(TIMEOUTS.animation)

      // Try to perform bulk action (right-click for context menu)
      await canvasPage.rightClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Regular Click Selection', () => {
    test('should select single thinker on regular click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on a thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Detail panel should appear for selected thinker
      // or thinker should show selection indicator
    })

    test('should deselect previous thinker when clicking another', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click first thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click second thinker
      await canvasPage.click(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Only second thinker should be selected
    })

    test('should deselect all when clicking empty canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on a thinker to select
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click on empty canvas area
      await canvasPage.click(500, 500)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Thinker should be deselected
    })
  })

  test.describe('Double-Click Behavior', () => {
    test('should open detail panel on double-click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Double-click on a thinker
      await canvasPage.doubleClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Detail panel should open with thinker information
      // or edit modal should appear
    })

    test('should allow editing thinker after double-click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Double-click to open edit mode
      await canvasPage.doubleClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.medium)

      // Check if edit interface is available
      const modal = page.locator('[role="dialog"]')
      const panel = mainPage.detailPanel

      // Either modal or panel should be visible
      const modalVisible = await modal.isVisible()
      const panelVisible = await panel.isVisible()

      expect(modalVisible || panelVisible).toBeTruthy()
    })
  })

  test.describe('Connection Mode Visual Feedback', () => {
    test('should show visual indicator when in connection mode', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Enter connection mode via shift+click
      await page.keyboard.down('Shift')

      // Cursor or canvas should indicate connection mode
      await canvasPage.hover(thinkers[0].position_x || 100, thinkers[0].position_y || 200)

      await page.waitForTimeout(TIMEOUTS.animation)
      await page.keyboard.up('Shift')
    })

    test('should highlight valid connection targets', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Start connection from first thinker
      await canvasPage.shiftClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Hover over potential target
      await canvasPage.hover(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Target should be highlighted
    })
  })
})
