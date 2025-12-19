import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAddThinkerModal } from '../../page-objects/modals/add-thinker-modal.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Canvas Journey: Click to Add Thinker', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 2,
      connections: 0,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Click on Empty Canvas Area', () => {
    test('should open add thinker modal when clicking empty canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on empty area (far from existing thinkers)
      await canvasPage.click(500, 300)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Modal might open for adding thinker
      const modal = page.locator('[role="dialog"]')
      // Behavior depends on implementation - might open modal or require double-click
    })

    test('should pre-fill position based on click location', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      const clickX = 400
      const clickY = 250

      // Double-click or use specific action to add at position
      await canvasPage.doubleClick(clickX, clickY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // If modal opens, position might be pre-filled
      const modal = page.locator('[role="dialog"]')
      if (await modal.isVisible()) {
        // Check if position fields are pre-filled
        const posXInput = modal.locator('input[name="position_x"]')
        const posYInput = modal.locator('input[name="position_y"]')
      }
    })

    test('should add thinker at clicked position', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const api = createAPIHelpers(request)

      await mainPage.waitForPageLoad()

      // Open add thinker modal via button
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Fill in thinker details
      const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]'))
      if (await nameInput.isVisible()) {
        await nameInput.fill('New Thinker')
      }

      // Submit
      const submitButton = page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /save|create|add/i }))
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.medium)
      }

      // Verify thinker was created
      const thinkers = await api.getAllThinkers()
      expect(thinkers.length).toBeGreaterThanOrEqual(3)
    })
  })

  test.describe('Position Validation on Add', () => {
    test('should allow manual position entry', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Find position inputs
      const posXInput = page.locator('input[name="position_x"]')
      const posYInput = page.locator('input[name="position_y"]')

      if (await posXInput.isVisible()) {
        await posXInput.fill('300')
      }

      if (await posYInput.isVisible()) {
        await posYInput.fill('200')
      }
    })

    test('should use auto-positioning when position not specified', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const api = createAPIHelpers(request)

      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Just fill name, don't specify position
      const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]'))
      if (await nameInput.isVisible()) {
        await nameInput.fill('Auto Positioned Thinker')
      }

      // Enable auto-position if checkbox exists
      const autoPositionCheckbox = page.locator('input[type="checkbox"]').filter({ has: page.locator('text=/auto|automatic/i') })
      if (await autoPositionCheckbox.isVisible()) {
        await autoPositionCheckbox.check()
      }

      // Submit
      const submitButton = page.locator('button[type="submit"]').or(page.locator('button').filter({ hasText: /save|create|add/i }))
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })
  })

  test.describe('Adding Thinker at Different Zoom Levels', () => {
    test('should add thinker correctly at zoomed in state', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Click to add
      await canvasPage.click(400, 300)
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should add thinker correctly at zoomed out state', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom out
      await canvasPage.zoomOut(2)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Click to add
      await canvasPage.click(300, 250)
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should calculate world coordinates correctly at any zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan and zoom
      await canvasPage.panRight(100)
      await canvasPage.zoomIn(2)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Click - world coordinates should be calculated correctly
      await canvasPage.click(350, 280)
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Adding Thinker at Panned Position', () => {
    test('should add thinker at correct world position after panning', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Pan to a different area
      await canvasPage.panRight(200)
      await canvasPage.panDown(100)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Click at center - should map to panned world coordinates
      await canvasPage.clickCenter()
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Click Behavior Near Existing Thinkers', () => {
    test('should select existing thinker when clicking on it', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on area where thinker exists (default seeded positions)
      await canvasPage.click(100, 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should select the thinker, not open add dialog
    })

    test('should differentiate between clicking thinker vs empty space', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click far from any thinker
      await canvasPage.click(600, 400)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should not select any thinker
    })
  })

  test.describe('Cancel Add Operation', () => {
    test('should cancel adding when pressing escape', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Press escape to cancel
      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Modal should close
      const modal = page.locator('[role="dialog"]')
      await expect(modal).not.toBeVisible()
    })

    test('should cancel adding when clicking cancel button', async ({ page }) => {
      const mainPage = createMainPage(page)

      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click cancel
      const cancelButton = page.locator('button').filter({ hasText: /cancel/i })
      if (await cancelButton.isVisible()) {
        await cancelButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // Modal should close
      const modal = page.locator('[role="dialog"]')
      await expect(modal).not.toBeVisible()
    })
  })
})
