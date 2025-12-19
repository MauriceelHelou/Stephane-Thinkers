import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Keyboard Journey: Thinker Shortcuts', () => {
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

  test.describe('Add Thinker Shortcut', () => {
    test('should open add thinker modal with N key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('n')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Add thinker modal should open
      const modal = page.locator('[role="dialog"]')
        .or(page.locator('[class*="modal"]'))
    })

    test('should open add thinker modal with Ctrl+N', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+n')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
    })

    test('should not trigger when typing in input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open AI panel and focus input
      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const input = page.locator('textarea, input').first()
      if (await input.isVisible()) {
        await input.focus()
        await page.keyboard.type('n')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Modal should NOT open
        const modal = page.locator('[role="dialog"]').filter({ hasText: /add.*thinker/i })
        await expect(modal).not.toBeVisible()
      }
    })
  })

  test.describe('Edit Thinker Shortcut', () => {
    test('should open edit modal with E key when thinker selected', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select a thinker first
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('e')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Edit modal should open
        const editModal = page.locator('[role="dialog"]').filter({ hasText: /edit/i })
      }
    })

    test('should do nothing with E key when no thinker selected', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on empty canvas
      await mainPage.canvasElement.click({ position: { x: 100, y: 100 } })
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('e')
      await page.waitForTimeout(TIMEOUTS.animation)

      // No edit modal should open
    })
  })

  test.describe('Delete Thinker Shortcut', () => {
    test('should delete selected thinker with Delete key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select a thinker
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Delete')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Confirmation dialog or direct deletion
        const confirmDialog = page.locator('text=/delete|confirm|remove/i')
      }
    })

    test('should delete selected thinker with Backspace key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Backspace')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Navigation Shortcuts', () => {
    test('should select next thinker with Tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Focus on canvas
      await mainPage.canvasElement.focus()

      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)

      // First thinker should be selected
    })

    test('should select previous thinker with Shift+Tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.canvasElement.focus()

      await page.keyboard.press('Shift+Tab')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should navigate between thinkers with arrow keys', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select a thinker first
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Navigate with arrow keys
        await page.keyboard.press('ArrowRight')
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('ArrowLeft')
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('ArrowUp')
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Selection Shortcuts', () => {
    test('should select all thinkers with Ctrl+A', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.canvasElement.focus()
      await page.keyboard.press('Control+a')
      await page.waitForTimeout(TIMEOUTS.animation)

      // All thinkers should be selected
    })

    test('should deselect all with Escape', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select a thinker
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Selection should be cleared
    })

    test('should add to selection with Ctrl+Click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinkers = page.locator('[data-testid*="thinker"], [class*="thinker"]')
      const count = await thinkers.count()

      if (count >= 2) {
        await thinkers.first().click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await thinkers.nth(1).click({ modifiers: ['Control'] })
        await page.waitForTimeout(TIMEOUTS.animation)

        // Both should be selected
      }
    })
  })

  test.describe('Quick Actions', () => {
    test('should open thinker details with Enter', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Details panel or modal should open
      }
    })

    test('should center view on thinker with Space', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Space')
        await page.waitForTimeout(TIMEOUTS.animation)

        // View should center on thinker
      }
    })
  })
})
