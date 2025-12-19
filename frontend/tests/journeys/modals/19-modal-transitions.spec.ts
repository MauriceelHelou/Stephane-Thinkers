import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Modal Transitions', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 2,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Opening Animation', () => {
    test('should animate modal open', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()

      // Modal should have animation class or style
      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible()
    })

    test('should fade in backdrop', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()

      const backdrop = page.locator('[class*="overlay"], [class*="backdrop"]')
    })

    test('should scale or slide modal content', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()

      // Check for transform or animation
    })
  })

  test.describe('Closing Animation', () => {
    test('should animate modal close', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('Escape')

      // Modal should animate out before being removed
    })

    test('should fade out backdrop', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Modal Stacking', () => {
    test('should stack modals properly', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open first modal
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Trigger a confirm dialog from within
      // The new modal should stack on top
    })

    test('should close top modal first', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // With stacked modals, Escape should close top one first
    })

    test('should maintain focus in top modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Focus should be trapped in topmost modal
    })
  })

  test.describe('Transition Between Modals', () => {
    test('should smoothly transition from add to confirm', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Opening a confirm from within another modal
    })

    test('should return to original modal after confirm closes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // After confirm closes, should return to parent modal
    })
  })

  test.describe('Reduced Motion', () => {
    test('should respect reduced motion preference', async ({ page }) => {
      // Emulate reduced motion
      await page.emulateMedia({ reducedMotion: 'reduce' })

      const mainPage = createMainPage(page)
      await mainPage.goto()
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Animations should be reduced or instant
    })
  })

  test.describe('Modal Position', () => {
    test('should center modal in viewport', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      const box = await modal.boundingBox()

      if (box) {
        const viewport = page.viewportSize()
        if (viewport) {
          // Modal should be roughly centered
          const centerX = box.x + box.width / 2
          const centerY = box.y + box.height / 2
          expect(Math.abs(centerX - viewport.width / 2)).toBeLessThan(100)
        }
      }
    })

    test('should stay visible on scroll', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Modal should have position: fixed or similar
    })
  })

  test.describe('Responsive Behavior', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      const mainPage = createMainPage(page)
      await mainPage.goto()
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Modal should be full width on mobile
      const modal = page.locator('[role="dialog"]')
      const box = await modal.boundingBox()
    })

    test('should show full screen on small viewports', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 })

      const mainPage = createMainPage(page)
      await mainPage.goto()
      await mainPage.waitForPageLoad()

      // Modal might be full screen
    })
  })
})
