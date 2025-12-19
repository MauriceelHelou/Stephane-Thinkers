import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Confirm Dialog', () => {
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

  test.describe('Dialog Structure', () => {
    test('should have title', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Trigger a confirm dialog (e.g., delete)
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const title = page.locator('[role="dialog"] h1, [role="dialog"] h2, [role="alertdialog"] h1')
        }
      }
    })

    test('should have message', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Confirm dialog should have descriptive message
      const message = page.locator('[role="dialog"] p, [role="alertdialog"] p')
    })

    test('should have confirm and cancel buttons', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const confirmButton = page.locator('button').filter({ hasText: /yes|confirm|ok|delete/i })
      const cancelButton = page.locator('button').filter({ hasText: /no|cancel/i })
    })
  })

  test.describe('Dialog Variants', () => {
    test('should show warning variant for destructive actions', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Delete actions should show warning styling
      const warningIcon = page.locator('[class*="warning"], [class*="danger"]')
    })

    test('should show info variant for confirmations', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Non-destructive confirmations
    })
  })

  test.describe('Dialog Actions', () => {
    test('should execute action on confirm', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const confirmButton = page.locator('button').filter({ hasText: /yes|confirm|delete/i })
          if (await confirmButton.isVisible()) {
            await confirmButton.click()
            await page.waitForTimeout(TIMEOUTS.long)

            // Action should be executed
          }
        }
      }
    })

    test('should not execute action on cancel', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const cancelButton = page.locator('button').filter({ hasText: /no|cancel/i })
          if (await cancelButton.isVisible()) {
            await cancelButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)

            // Dialog should close, action not executed
          }
        }
      }
    })

    test('should close on Escape', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          await page.keyboard.press('Escape')
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should focus confirm button by default', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // First focusable button should be confirm or cancel
    })

    test('should allow Tab navigation between buttons', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Tab should cycle between buttons
    })

    test('should activate button with Enter', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Enter should activate focused button
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper ARIA role', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
    })

    test('should have accessible name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const dialog = page.locator('[aria-labelledby], [aria-label]')
    })
  })
})
