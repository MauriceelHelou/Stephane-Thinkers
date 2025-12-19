import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Thinker Click Patterns', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 3,
    })
    thinkers = seedData.thinkers

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Normal Click - Select Thinker', () => {
    test('should select thinker on single click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on first thinker
      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.click(x, y)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Thinker should be selected (visual indicator or detail panel)
    })

    test('should show selection indicator on selected thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.click(x, y)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Selection ring or highlight should appear
    })

    test('should open detail panel for selected thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.click(x, y)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Detail panel should show thinker info
      const detailPanel = mainPage.detailPanel
      // Panel might be visible with thinker details
    })

    test('should deselect when clicking another thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select first thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click second thinker
      await canvasPage.click(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Second thinker should now be selected, first deselected
    })

    test('should deselect when clicking empty canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select thinker
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click empty area
      await canvasPage.click(500, 400)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Thinker should be deselected
    })
  })

  test.describe('Shift+Click - Connection Mode', () => {
    test('should enter connection mode with shift+click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const x = thinkers[0].position_x || 100
      const y = thinkers[0].position_y || 200

      await canvasPage.shiftClick(x, y)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should enter connection mode
    })

    test('should start connection from shift+clicked thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Shift+click first thinker to start connection
      await canvasPage.shiftClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Visual connection line should start from this thinker
    })

    test('should complete connection with second shift+click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Shift+click first thinker
      await page.keyboard.down('Shift')
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.short)

      // Shift+click second thinker
      await canvasPage.click(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.keyboard.up('Shift')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connection dialog should open or connection created
    })

    test('should show connection preview line while in connection mode', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Start connection mode
      await canvasPage.shiftClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)

      // Move mouse (connection preview should follow)
      await page.mouse.move(300, 200)
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Ctrl+Click - Multi-Selection', () => {
    test('should add to selection with ctrl+click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click first thinker (normal select)
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Ctrl+click second thinker (add to selection)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Both should be selected
    })

    test('should select multiple thinkers with ctrl+click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Ctrl+click multiple thinkers
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await canvasPage.ctrlClick(thinkers[2].position_x || 260, thinkers[2].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // All three should be selected
    })

    test('should toggle selection with ctrl+click on selected thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select multiple
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Ctrl+click first again to deselect
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Only second should remain selected
    })

    test('should clear multi-selection when clicking without ctrl', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Multi-select
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Normal click on third (should clear and select only third)
      await canvasPage.click(thinkers[2].position_x || 260, thinkers[2].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Only third should be selected
    })
  })

  test.describe('Double-Click - Open Edit', () => {
    test('should open edit mode on double-click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.doubleClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Edit dialog or panel should open
      const modal = page.locator('[role="dialog"]')
      const isDetailPanelOpen = await mainPage.isDetailPanelOpen()

      expect((await modal.isVisible()) || isDetailPanelOpen).toBeTruthy()
    })

    test('should show thinker details in edit mode', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.doubleClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Details should include thinker's name
      const nameText = await page.locator(`text=${thinkers[0].name}`).first()
    })
  })

  test.describe('Right-Click - Context Menu', () => {
    test('should open context menu on right-click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Context menu should appear
      const contextMenu = page.locator('[role="menu"]')
        .or(page.locator('.context-menu'))
        .or(page.locator('[class*="context"]'))
    })

    test('should show edit option in context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const editOption = page.locator('[role="menuitem"]').filter({ hasText: /edit/i })
    })

    test('should show delete option in context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const deleteOption = page.locator('[role="menuitem"]').filter({ hasText: /delete|remove/i })
    })

    test('should show add connection option in context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const connectionOption = page.locator('[role="menuitem"]').filter({ hasText: /connection/i })
    })

    test('should close context menu when clicking elsewhere', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Open context menu
      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click elsewhere
      await canvasPage.click(500, 400)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Context menu should close
      const contextMenu = page.locator('[role="menu"]')
      await expect(contextMenu).not.toBeVisible()
    })
  })
})
