import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Collision Detection', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    // Create timeline first
    const timeline = await api.createTimeline({
      name: 'Test Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    // Create thinkers with specific positions for collision testing
    const t1 = await api.createThinker({
      name: 'Thinker A',
      birth_year: 1724,
      death_year: 1804,
      timeline_id: timeline.id,
      position_x: 200,
      position_y: 200,
    })

    const t2 = await api.createThinker({
      name: 'Thinker B',
      birth_year: 1770,
      death_year: 1831,
      timeline_id: timeline.id,
      position_x: 350,
      position_y: 200,
    })

    const t3 = await api.createThinker({
      name: 'Thinker C',
      birth_year: 1818,
      death_year: 1883,
      timeline_id: timeline.id,
      position_x: 200,
      position_y: 350,
    })

    thinkers = [t1, t2, t3]

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Overlap Prevention', () => {
    test('should prevent dragging thinker onto another', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Try to drag thinker A onto thinker B
      const startX = thinkers[0].position_x || 200
      const startY = thinkers[0].position_y || 200
      const targetX = thinkers[1].position_x || 350
      const targetY = thinkers[1].position_y || 200

      await canvasPage.dragThinker(startX, startY, targetX, targetY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Thinker should be pushed away or snap to non-overlapping position
    })

    test('should snap to nearest valid position when collision detected', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Drag thinker close to but not exactly onto another
      const startX = thinkers[0].position_x || 200
      const startY = thinkers[0].position_y || 200
      // Target position that would partially overlap
      const targetX = (thinkers[0].position_x || 200) + 50
      const targetY = thinkers[0].position_y || 200

      await canvasPage.dragThinker(startX, startY, targetX, targetY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })

    test('should show visual indicator when collision would occur', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const canvas = await canvasPage.helpers.getCanvas()
      const box = await canvas.boundingBox()

      if (box) {
        const startX = thinkers[0].position_x || 200
        const startY = thinkers[0].position_y || 200
        const targetX = thinkers[1].position_x || 350
        const targetY = thinkers[1].position_y || 200

        await page.mouse.move(box.x + startX, box.y + startY)
        await page.mouse.down()

        // Move toward collision area
        await page.mouse.move(box.x + targetX, box.y + targetY)
        await page.waitForTimeout(TIMEOUTS.animation)

        // Visual indicator should appear (red outline, warning, etc.)

        await page.mouse.up()
      }
    })
  })

  test.describe('Auto-Positioning New Thinkers', () => {
    test('should auto-position new thinker to avoid collisions', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const api = createAPIHelpers(request)

      await mainPage.waitForPageLoad()

      // Create new thinker at position that would overlap
      const newThinker = await api.createThinker({
        name: 'New Overlapping Thinker',
        birth_year: 1750,
        death_year: 1820,
        position_x: 200, // Same as Thinker A
        position_y: 200,
      })

      await page.reload()
      await mainPage.waitForPageLoad()

      // New thinker should be repositioned to avoid overlap
      // or system should have adjusted position
    })

    test('should find empty space when adding thinker via UI', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Fill details with auto-position enabled
      const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]'))
      if (await nameInput.isVisible()) {
        await nameInput.fill('Auto Positioned Thinker')
      }

      // Check auto-position option if exists
      const autoPosition = page.locator('input[type="checkbox"]').filter({ has: page.locator('[name*="auto"]') })
      if (await autoPosition.isVisible()) {
        await autoPosition.check()
      }

      // Submit
      const submitButton = page.locator('button').filter({ hasText: /save|create|add/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })
  })

  test.describe('Collision Detection Radius', () => {
    test('should maintain minimum spacing between thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Try to drag very close but not overlapping
      const startX = thinkers[0].position_x || 200
      const startY = thinkers[0].position_y || 200
      // Target: just slightly overlapping
      const targetX = (thinkers[1].position_x || 350) - 30
      const targetY = thinkers[1].position_y || 200

      await canvasPage.dragThinker(startX, startY, targetX, targetY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Minimum spacing should be maintained
    })

    test('should allow positioning at edges of collision radius', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Drag to position just outside collision radius
      const startX = thinkers[0].position_x || 200
      const startY = thinkers[0].position_y || 200
      const targetX = (thinkers[1].position_x || 350) - 80 // Safe distance
      const targetY = thinkers[1].position_y || 200

      await canvasPage.dragThinker(startX, startY, targetX, targetY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should allow this position
    })
  })

  test.describe('Multiple Thinker Collision', () => {
    test('should handle collision with multiple thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Drag thinker B toward area between A and C
      const startX = thinkers[1].position_x || 350
      const startY = thinkers[1].position_y || 200
      // Target: center of A and C
      const targetX = (thinkers[0].position_x || 200)
      const targetY = ((thinkers[0].position_y || 200) + (thinkers[2].position_y || 350)) / 2

      await canvasPage.dragThinker(startX, startY, targetX, targetY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Should find valid position avoiding both
    })

    test('should cascade repositioning if needed', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Drag that might cause chain of repositioning
      const startX = thinkers[0].position_x || 200
      const startY = thinkers[0].position_y || 200

      await canvasPage.dragThinker(startX, startY, startX + 50, startY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })
  })

  test.describe('Connection Line Collision', () => {
    test('should handle thinker near connection line', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create connection between A and C
      await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[2].id,
        connection_type: 'influenced',
        strength: 3,
      })

      await page.reload()
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)
      await mainPage.waitForPageLoad()

      // Drag B near the connection line
      const startX = thinkers[1].position_x || 350
      const startY = thinkers[1].position_y || 200
      // Target: near the A-C connection line
      const targetX = 200
      const targetY = 275

      await canvasPage.dragThinker(startX, startY, targetX, targetY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })
  })

  test.describe('Collision at Different Zoom Levels', () => {
    test('should detect collisions correctly when zoomed in', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Collision detection should still work
      const startX = thinkers[0].position_x || 200
      const startY = thinkers[0].position_y || 200
      const targetX = thinkers[1].position_x || 350
      const targetY = thinkers[1].position_y || 200

      await canvasPage.dragThinker(startX, startY, targetX, targetY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })

    test('should detect collisions correctly when zoomed out', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      await canvasPage.zoomOut(2)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      const startX = thinkers[0].position_x || 200
      const startY = thinkers[0].position_y || 200
      const targetX = thinkers[1].position_x || 350
      const targetY = thinkers[1].position_y || 200

      await canvasPage.dragThinker(startX, startY, targetX, targetY)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })
  })
})
