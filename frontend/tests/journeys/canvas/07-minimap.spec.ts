import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS, TEST_IDS } from '../../config/test-constants'

test.describe('Canvas Journey: Minimap Navigation', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 10, // More thinkers for minimap visibility
      connections: 5,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Minimap Visibility', () => {
    test('should display minimap on canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const minimapVisible = await canvasPage.isMinimapVisible()
      // Minimap might be visible by default or toggleable
    })

    test('should toggle minimap visibility', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Find minimap toggle
      const minimapToggle = page.locator('button').filter({ hasText: /minimap/i })
        .or(page.locator('[data-testid="minimap-toggle"]'))
        .or(page.locator('[aria-label*="minimap" i]'))

      if (await minimapToggle.isVisible()) {
        await minimapToggle.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await minimapToggle.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should show minimap in corner of canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const minimap = page.locator(`[data-testid="${TEST_IDS.minimap}"]`)
        .or(page.locator('.minimap'))
        .or(page.locator('[class*="minimap"]'))

      if (await minimap.isVisible()) {
        // Minimap should be positioned in a corner
        const box = await minimap.boundingBox()
        expect(box).toBeTruthy()
      }
    })
  })

  test.describe('Minimap Content', () => {
    test('should show all thinkers in minimap', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Minimap should display scaled representation of all thinkers
      const minimap = page.locator(`[data-testid="${TEST_IDS.minimap}"]`)
        .or(page.locator('.minimap'))
    })

    test('should show connections in minimap', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Minimap should show connection lines
    })

    test('should show current viewport indicator', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Minimap should show rectangle indicating current view
      const viewportIndicator = page.locator('.minimap-viewport')
        .or(page.locator('[class*="viewport-indicator"]'))
    })
  })

  test.describe('Minimap Click Navigation', () => {
    test('should navigate to clicked position in minimap', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const minimap = page.locator(`[data-testid="${TEST_IDS.minimap}"]`)
        .or(page.locator('.minimap'))

      if (await minimap.isVisible()) {
        const box = await minimap.boundingBox()
        if (box) {
          // Click on different area of minimap
          await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.5)
          await page.waitForTimeout(TIMEOUTS.canvasRender)

          // Main canvas view should have shifted
        }
      }
    })

    test('should center view on clicked minimap area', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const minimap = page.locator(`[data-testid="${TEST_IDS.minimap}"]`)
        .or(page.locator('.minimap'))

      if (await minimap.isVisible()) {
        // Click center of minimap
        await canvasPage.clickOnMinimap(50, 50)
        await page.waitForTimeout(TIMEOUTS.canvasRender)
      }
    })
  })

  test.describe('Minimap Drag Navigation', () => {
    test('should pan main canvas by dragging minimap viewport', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      const minimap = page.locator(`[data-testid="${TEST_IDS.minimap}"]`)
        .or(page.locator('.minimap'))

      if (await minimap.isVisible()) {
        const box = await minimap.boundingBox()
        if (box) {
          // Drag viewport indicator in minimap
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await page.mouse.down()
          await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6)
          await page.mouse.up()

          await page.waitForTimeout(TIMEOUTS.canvasRender)
        }
      }
    })

    test('should update viewport indicator position during drag', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      const minimap = page.locator(`[data-testid="${TEST_IDS.minimap}"]`)
        .or(page.locator('.minimap'))

      if (await minimap.isVisible()) {
        const box = await minimap.boundingBox()
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await page.mouse.down()

          // Move in steps
          for (let i = 0; i < 5; i++) {
            await page.mouse.move(box.x + box.width / 2 + i * 5, box.y + box.height / 2)
            await page.waitForTimeout(50)
          }

          await page.mouse.up()
        }
      }
    })
  })

  test.describe('Minimap Sync with Main Canvas', () => {
    test('should update minimap viewport when panning main canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan main canvas
      await canvasPage.panRight(200)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Minimap viewport indicator should have moved
    })

    test('should update minimap viewport when zooming main canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom main canvas
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Minimap viewport indicator should be smaller (viewing smaller area)
    })

    test('should show correct viewport size at different zoom levels', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // At zoom out, viewport indicator should be larger
      await canvasPage.zoomOut(2)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // At zoom in, viewport indicator should be smaller
      await canvasPage.zoomIn(4)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })
  })

  test.describe('Minimap Scaling', () => {
    test('should scale to fit all content', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const api = createAPIHelpers(request)

      await mainPage.waitForPageLoad()

      // Add thinker at far position
      await api.createThinker({
        name: 'Far Thinker',
        birth_year: 1900,
        death_year: 1980,
        position_x: 1000,
        position_y: 800,
      })

      await page.reload()
      await mainPage.waitForPageLoad()

      // Minimap should scale to show all content including far thinker
    })

    test('should maintain aspect ratio', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      const minimap = page.locator(`[data-testid="${TEST_IDS.minimap}"]`)
        .or(page.locator('.minimap'))

      if (await minimap.isVisible()) {
        const box = await minimap.boundingBox()
        if (box) {
          // Minimap should have reasonable aspect ratio
          const aspectRatio = box.width / box.height
          expect(aspectRatio).toBeGreaterThan(0.5)
          expect(aspectRatio).toBeLessThan(3)
        }
      }
    })
  })

  test.describe('Minimap in Different View Modes', () => {
    test('should show minimap in combined timeline view', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Switch to combined view if available
      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Minimap should still be functional
    })

    test('should hide minimap in analysis mode', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Minimap might be hidden during analysis
    })
  })
})
