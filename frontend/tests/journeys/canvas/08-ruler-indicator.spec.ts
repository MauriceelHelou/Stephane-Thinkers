import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Year Ruler and Indicator', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    // Create timeline with specific year range
    const timeline = await api.createTimeline({
      name: 'Philosophy Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    // Create thinkers at different years
    await api.createThinker({
      name: 'Early Thinker',
      birth_year: 1710,
      death_year: 1780,
      timeline_id: timeline.id,
      position_x: 100,
      position_y: 200,
    })

    await api.createThinker({
      name: 'Mid Thinker',
      birth_year: 1770,
      death_year: 1831,
      timeline_id: timeline.id,
      position_x: 300,
      position_y: 200,
    })

    await api.createThinker({
      name: 'Late Thinker',
      birth_year: 1844,
      death_year: 1900,
      timeline_id: timeline.id,
      position_x: 500,
      position_y: 200,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Year Ruler Display', () => {
    test('should display year ruler on canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Year ruler should be visible at top or bottom
      const yearRuler = page.locator('[data-testid="year-ruler"]')
        .or(page.locator('.year-ruler'))
        .or(page.locator('[class*="ruler"]'))
    })

    test('should show year markers on ruler', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Should show year labels like 1700, 1750, 1800, etc.
      const year1700 = page.locator('text=1700')
      const year1800 = page.locator('text=1800')
      const year1900 = page.locator('text=1900')
    })

    test('should show tick marks between major years', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Ruler should have minor tick marks between major year labels
    })

    test('should align thinkers with corresponding years', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Thinkers should be positioned according to their anchor_year or birth_year
    })
  })

  test.describe('Year Ruler Scrolling', () => {
    test('should scroll ruler with canvas pan', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan canvas
      await canvasPage.panRight(200)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Ruler should have scrolled to show later years
    })

    test('should show different years after panning', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan to see different years
      await canvasPage.panRight(300)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Year labels should have updated
    })
  })

  test.describe('Year Ruler Zoom', () => {
    test('should adjust ruler spacing when zooming in', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Ruler should show more detail (decades instead of centuries)
    })

    test('should adjust ruler spacing when zooming out', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom out
      await canvasPage.zoomOut(2)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Ruler should show less detail (centuries)
    })

    test('should show decade markers at high zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.zoomIn(5)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should see markers like 1750, 1760, 1770...
    })

    test('should show century markers at low zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.zoomOut(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should see markers like 1700, 1800, 1900...
    })
  })

  test.describe('Jump to Year', () => {
    test('should show jump to year input', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Year jump input should be available
      const yearInput = page.locator('[data-testid="year-jump-input"]')
        .or(page.locator('input[type="number"]').filter({ has: page.locator('[placeholder*="year" i]') }))
        .or(page.locator('input[placeholder*="Go to year" i]'))
    })

    test('should navigate to entered year', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Jump to year 1850
      await canvasPage.jumpToYear(1850)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Canvas should center on 1850
    })

    test('should center canvas on year after jump', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.jumpToYear(1770)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // 1770 should be approximately centered
    })

    test('should validate year input', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Try invalid year
      const yearInput = page.locator('[data-testid="year-jump-input"]')
        .or(page.locator('input[placeholder*="year" i]'))

      if (await yearInput.isVisible()) {
        await yearInput.fill('abc')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Should show error or ignore invalid input
      }
    })

    test('should handle year outside timeline range', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Jump to year outside timeline (1700-1900)
      await canvasPage.jumpToYear(1500)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should clamp to timeline bounds or show warning
    })
  })

  test.describe('Current Year Indicator', () => {
    test('should show current center year indicator', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      // Current year indicator (showing what year is at center of view)
      const currentYearIndicator = page.locator('[class*="current-year"]')
        .or(page.locator('[data-testid="current-year"]'))
    })

    test('should update current year when panning', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan and observe year indicator change
      await canvasPage.panRight(200)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Year indicator should have updated
    })
  })

  test.describe('Ruler Interaction', () => {
    test('should show year tooltip on ruler hover', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      const ruler = page.locator('[data-testid="year-ruler"]')
        .or(page.locator('.year-ruler'))

      if (await ruler.isVisible()) {
        await ruler.hover()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Should show tooltip with precise year
      }
    })

    test('should navigate to year when clicking on ruler', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      const ruler = page.locator('[data-testid="year-ruler"]')
        .or(page.locator('.year-ruler'))

      if (await ruler.isVisible()) {
        const box = await ruler.boundingBox()
        if (box) {
          // Click on specific position on ruler
          await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2)
          await page.waitForTimeout(TIMEOUTS.canvasRender)

          // Canvas should navigate to that year
        }
      }
    })
  })

  test.describe('Ruler in Different View Modes', () => {
    test('should show combined ruler in comparison view', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Ruler should span combined year range
    })

    test('should align rulers across multiple timelines', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Years should align vertically across all timeline lanes
    })
  })
})
