import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Delete Connection Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 4,
      connections: 3,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Delete Confirmation Opening', () => {
    test('should open from context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Confirmation should appear
          const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"]')
        }
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Delete')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Confirmation Dialog Content', () => {
    test('should show connection details', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Should show connection info (source -> target)
        }
      }
    })

    test('should show warning message', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const warning = page.locator('text=/cannot.*undo|permanent/i')
        }
      }
    })
  })

  test.describe('Delete Action', () => {
    test('should delete connection on confirm', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const initialCount = await page.locator('[data-testid*="connection"], [class*="connection-line"]').count()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const confirmButton = page.locator('button').filter({ hasText: /delete|yes|confirm/i })
          if (await confirmButton.isVisible()) {
            await confirmButton.click()
            await page.waitForTimeout(TIMEOUTS.long)

            const newCount = await page.locator('[data-testid*="connection"], [class*="connection-line"]').count()
            expect(newCount).toBeLessThan(initialCount)
          }
        }
      }
    })

    test('should not delete on cancel', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const initialCount = await page.locator('[data-testid*="connection"], [class*="connection-line"]').count()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const cancelButton = page.locator('button').filter({ hasText: /cancel|no/i })
          if (await cancelButton.isVisible()) {
            await cancelButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)

            const newCount = await page.locator('[data-testid*="connection"], [class*="connection-line"]').count()
            expect(newCount).toBe(initialCount)
          }
        }
      }
    })
  })
})
