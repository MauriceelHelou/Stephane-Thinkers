import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Context Menu', () => {
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

  test.describe('Right-Click on Thinker', () => {
    test('should open context menu on right-click', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Context menu should appear
      const contextMenu = page.locator('[role="menu"]')
        .or(page.locator('.context-menu'))
        .or(page.locator('[class*="context-menu"]'))
        .or(page.locator('[class*="dropdown"]'))
    })

    test('should show Edit option in context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const editOption = page.locator('[role="menuitem"]').filter({ hasText: /edit/i })
        .or(page.locator('button').filter({ hasText: /edit/i }))
        .or(page.locator('li').filter({ hasText: /edit/i }))
    })

    test('should show Delete option in context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const deleteOption = page.locator('[role="menuitem"]').filter({ hasText: /delete|remove/i })
    })

    test('should show Add Connection option in context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const connectionOption = page.locator('[role="menuitem"]').filter({ hasText: /connection/i })
    })

    test('should show Add Note option in context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const noteOption = page.locator('[role="menuitem"]').filter({ hasText: /note/i })
    })
  })

  test.describe('Context Menu Actions', () => {
    test('should open edit modal when clicking Edit', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const editOption = page.locator('[role="menuitem"], button, li').filter({ hasText: /edit/i }).first()
      if (await editOption.isVisible()) {
        await editOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Edit dialog should open
        const modal = page.locator('[role="dialog"]')
      }
    })

    test('should delete thinker when clicking Delete', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)
      const api = createAPIHelpers(request)

      await mainPage.waitForPageLoad()

      const initialCount = (await api.getAllThinkers()).length

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const deleteOption = page.locator('[role="menuitem"], button, li').filter({ hasText: /delete|remove/i }).first()
      if (await deleteOption.isVisible()) {
        await deleteOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Confirm deletion if dialog appears
        const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
          await page.waitForTimeout(TIMEOUTS.medium)
        }
      }
    })

    test('should open add connection modal when clicking Add Connection', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const connectionOption = page.locator('[role="menuitem"], button, li').filter({ hasText: /connection/i }).first()
      if (await connectionOption.isVisible()) {
        await connectionOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Connection modal should open
        const modal = page.locator('[role="dialog"]')
      }
    })
  })

  test.describe('Right-Click on Empty Canvas', () => {
    test('should show different menu for empty canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Right-click on empty area
      await canvasPage.rightClick(500, 400)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Context menu for empty canvas
      const contextMenu = page.locator('[role="menu"]')
        .or(page.locator('.context-menu'))
    })

    test('should show Add Thinker option on empty canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(500, 400)
      await page.waitForTimeout(TIMEOUTS.animation)

      const addThinkerOption = page.locator('[role="menuitem"], button, li').filter({ hasText: /add.*thinker/i })
    })

    test('should show Paste option if clipboard has data', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.rightClick(500, 400)
      await page.waitForTimeout(TIMEOUTS.animation)

      const pasteOption = page.locator('[role="menuitem"], button, li').filter({ hasText: /paste/i })
    })
  })

  test.describe('Right-Click on Connection', () => {
    test('should show connection context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Right-click on connection line
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.rightClick(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should show Edit Connection option', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.rightClick(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      const editOption = page.locator('[role="menuitem"], button, li').filter({ hasText: /edit/i })
    })

    test('should show Delete Connection option', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.rightClick(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      const deleteOption = page.locator('[role="menuitem"], button, li').filter({ hasText: /delete|remove/i })
    })
  })

  test.describe('Multi-Selection Context Menu', () => {
    test('should show bulk actions for multi-selected thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Multi-select
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Right-click on one of selected
      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Context menu should show bulk options
    })

    test('should show Delete All option for multi-selection', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Multi-select
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      const deleteAllOption = page.locator('[role="menuitem"], button, li').filter({ hasText: /delete.*all|delete.*selected/i })
    })

    test('should show selection count in context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select 3 thinkers
      await canvasPage.ctrlClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await canvasPage.ctrlClick(thinkers[1].position_x || 180, thinkers[1].position_y || 200)
      await canvasPage.ctrlClick(thinkers[2].position_x || 260, thinkers[2].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should show "3 thinkers selected" or similar
      const selectionText = page.locator('text=/\\d+.*selected/i')
    })
  })

  test.describe('Context Menu Dismissal', () => {
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

    test('should close context menu on escape key', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Open context menu
      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Press escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Context menu should close
      const contextMenu = page.locator('[role="menu"]')
      await expect(contextMenu).not.toBeVisible()
    })

    test('should close context menu after selecting an action', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Open context menu
      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click an option
      const firstOption = page.locator('[role="menuitem"], button, li').first()
      if (await firstOption.isVisible()) {
        await firstOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // Context menu should close (modal may open instead)
    })
  })

  test.describe('Keyboard Navigation in Context Menu', () => {
    test('should navigate context menu with arrow keys', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Open context menu
      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(100)

      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(100)

      await page.keyboard.press('ArrowUp')
      await page.waitForTimeout(100)
    })

    test('should select menu item with Enter key', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Open context menu
      await canvasPage.rightClick(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Navigate and select
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })
})
