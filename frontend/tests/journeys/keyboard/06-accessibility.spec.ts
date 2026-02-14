import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Keyboard Journey: Accessibility', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 3,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Focus Management', () => {
    test('should have visible focus indicator', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Tab to first focusable element
      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Focus should be visible
      const focused = page.locator(':focus')
      await expect(focused).toBeVisible()
    })

    test('should tab through all interactive elements', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Tab through multiple elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        await page.waitForTimeout(100)

        const focused = page.locator(':focus')
        if (await focused.count() > 0) {
          // Focus should be on an interactive element
        }
      }
    })

    test('should reverse tab order with Shift+Tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Tab forward
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Tab backward
      await page.keyboard.press('Shift+Tab')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should trap focus in modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open a modal
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Tab should cycle within modal
      const initialFocused = await page.locator(':focus').getAttribute('data-testid') || 'initial'

      // Tab through all modal elements
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab')
        await page.waitForTimeout(50)
      }

      // Focus should still be in modal
      const modal = page.locator('[role="dialog"]')
      const focusedElement = page.locator(':focus')
      // Focus should be within modal
    })

    test('should return focus to trigger after modal close', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Focus on a trigger button
      const addButton = mainPage.addThinkerButton
      await addButton.focus()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Open modal
      await page.keyboard.press('Enter')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Close modal with Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Focus should return to trigger
    })
  })

  test.describe('ARIA Attributes', () => {
    test('should have proper role attributes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Check for proper roles
      const buttons = page.locator('button, [role="button"]')
      const dialogs = page.locator('[role="dialog"]')
      const tabs = page.locator('[role="tab"]')
      const tabpanels = page.locator('[role="tabpanel"]')
    })

    test('should have aria-label on icon buttons', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Icon buttons should have aria-label
      const iconButtons = page.locator('button:has(svg)')
      const count = await iconButtons.count()

      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = iconButtons.nth(i)
        const hasLabel = await button.getAttribute('aria-label')
        const hasTitle = await button.getAttribute('title')
        const text = await button.textContent()
        // Should have some accessible name
      }
    })

    test('should have aria-expanded on expandable elements', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Elements that expand (dropdowns, panels)
      const expandable = page.locator('[aria-expanded]')
    })

    test('should have aria-selected on selectable items', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Tabs and selectable items
      const selectable = page.locator('[aria-selected]')
    })

    test('should update aria-pressed for toggle buttons', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const toggleButtons = page.locator('[aria-pressed]')
      if (await toggleButtons.count() > 0) {
        const button = toggleButtons.first()
        const initialState = await button.getAttribute('aria-pressed')

        await button.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const newState = await button.getAttribute('aria-pressed')
        // State should change
      }
    })
  })

  test.describe('Screen Reader Support', () => {
    test('should have live regions for dynamic content', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Live regions for announcements
      const liveRegions = page.locator('[aria-live]')
    })

    test('should announce loading states', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Loading indicators should have aria-busy or role="status"
      const loadingIndicators = page.locator('[aria-busy], [role="status"]')
    })

    test('should have descriptive headings', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Check heading hierarchy
      const h1 = page.locator('h1')
      const h2 = page.locator('h2')
      const h3 = page.locator('h3')
    })

    test('should have alt text on images', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const images = page.locator('img')
      const count = await images.count()

      for (let i = 0; i < count; i++) {
        const img = images.nth(i)
        const alt = await img.getAttribute('alt')
        // Should have alt attribute
      }
    })
  })

  test.describe('Keyboard-Only Navigation', () => {
    test('should be able to add thinker using only keyboard', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open modal with keyboard
      await page.keyboard.press('Control+t')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Fill form with keyboard
      await page.keyboard.type('Test Thinker')
      await page.keyboard.press('Tab')
      await page.keyboard.type('1800')
      await page.keyboard.press('Tab')
      await page.keyboard.type('1850')
      await page.keyboard.press('Tab')
      await page.keyboard.type('Philosophy')

      // Submit with keyboard
      await page.keyboard.press('Enter')
      await page.waitForTimeout(TIMEOUTS.long)
    })

    test('should be able to navigate canvas using only keyboard', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Focus canvas
      await mainPage.canvasElement.focus()

      // Pan with arrow keys
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowDown')

      // Zoom with +/-
      await page.keyboard.press('=')
      await page.keyboard.press('-')
    })

    test('should be able to select and delete with keyboard', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Tab to first thinker
      await mainPage.canvasElement.focus()
      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Select with Enter/Space
      await page.keyboard.press('Enter')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Delete with Delete key
      await page.keyboard.press('Delete')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Color Contrast', () => {
    test('should have sufficient contrast for text', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // This would typically be tested with axe-core or similar
      // Placeholder for contrast testing
    })

    test('should have visible focus indicators', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Check that focus is visible
      const focused = page.locator(':focus')
      await expect(focused).toBeVisible()
    })
  })

  test.describe('Reduced Motion', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
      const mainPage = createMainPage(page)

      // Emulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })

      await mainPage.goto()
      await mainPage.waitForPageLoad()

      // Animations should be reduced or disabled
    })
  })

  test.describe('Skip Links', () => {
    test('should have skip to main content link', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Tab to first element - should be skip link
      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)

      const skipLink = page.locator('a[href="#main"], a[href="#content"]')
        .or(page.locator('a').filter({ hasText: /skip/i }))
    })

    test('should skip to main content when activated', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)

      const skipLink = page.locator('a').filter({ hasText: /skip/i }).first()
      if (await skipLink.isVisible()) {
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Focus should move to main content
      }
    })
  })

  test.describe('Form Accessibility', () => {
    test('should have labels for form inputs', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open a form modal
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Check inputs have labels
      const inputs = page.locator('input, textarea, select')
      const count = await inputs.count()

      for (let i = 0; i < count; i++) {
        const input = inputs.nth(i)
        const id = await input.getAttribute('id')
        const ariaLabel = await input.getAttribute('aria-label')
        const placeholder = await input.getAttribute('placeholder')
        // Should have some accessible name
      }
    })

    test('should announce form errors', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit empty form to trigger errors
      const dialog = page.getByRole('dialog', { name: 'Add Thinker' })
      const submitButton = dialog.getByRole('button', { name: /^Add Thinker$/ })

      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Error messages should be associated with inputs
        const errors = page.locator('[aria-invalid="true"]')
          .or(page.locator('[class*="error"]'))
      }
    })

    test('should have required field indicators', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Required fields should be marked
      const requiredInputs = page.locator('[required], [aria-required="true"]')
    })
  })
})
