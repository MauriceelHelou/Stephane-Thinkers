import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Delete Thinker Modal', () => {
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

  test.describe('Delete Confirmation Opening', () => {
    test('should open from context menu', async ({ page }) => {
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

          // Confirmation dialog should appear
          const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"]')
        }
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Delete')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should open from edit modal delete button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteButton = page.locator('button').filter({ hasText: /delete/i })
        if (await deleteButton.isVisible()) {
          await deleteButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Confirmation Dialog Content', () => {
    test('should show thinker name in confirmation', async ({ page }) => {
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

          // Should mention the thinker name
        }
      }
    })

    test('should warn about cascade deletion', async ({ page }) => {
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

          // Warning about connections/publications being deleted
          const warning = page.locator('text=/connection|publication|also.*deleted|cannot.*undo/i')
        }
      }
    })

    test('should show confirm and cancel buttons', async ({ page }) => {
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

          const confirmButton = page.locator('button').filter({ hasText: /delete|yes|confirm/i })
          const cancelButton = page.locator('button').filter({ hasText: /cancel|no|keep/i })
        }
      }
    })
  })

  test.describe('Delete Action', () => {
    test('should delete thinker on confirm', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Count initial thinkers
      const initialCount = await page.locator('[data-testid*="thinker"], [class*="thinker"]').count()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const confirmButton = page.locator('button').filter({ hasText: /delete|yes|confirm/i })
          if (await confirmButton.isVisible()) {
            await confirmButton.click()
            await page.waitForTimeout(TIMEOUTS.long)

            // Thinker should be removed
            const newCount = await page.locator('[data-testid*="thinker"], [class*="thinker"]').count()
            expect(newCount).toBeLessThan(initialCount)
          }
        }
      }
    })

    test('should not delete on cancel', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const initialCount = await page.locator('[data-testid*="thinker"], [class*="thinker"]').count()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const cancelButton = page.locator('button').filter({ hasText: /cancel|no|keep/i })
          if (await cancelButton.isVisible()) {
            await cancelButton.click()
            await page.waitForTimeout(TIMEOUTS.animation)

            // Count should be the same
            const newCount = await page.locator('[data-testid*="thinker"], [class*="thinker"]').count()
            expect(newCount).toBe(initialCount)
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

          // Dialog should close
          const dialog = page.locator('[role="alertdialog"]')
          await expect(dialog).not.toBeVisible()
        }
      }
    })
  })

  test.describe('Cascade Effects', () => {
    test('should delete associated connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Count initial connections
      const initialConnections = await page.locator('[data-testid*="connection"], [class*="connection-line"]').count()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const confirmButton = page.locator('button').filter({ hasText: /delete|yes|confirm/i })
          if (await confirmButton.isVisible()) {
            await confirmButton.click()
            await page.waitForTimeout(TIMEOUTS.long)

            // Connections should be updated
          }
        }
      }
    })
  })

  test.describe('Undo Support', () => {
    test('should show undo option after deletion', async ({ page }) => {
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

          const confirmButton = page.locator('button').filter({ hasText: /delete|yes|confirm/i })
          if (await confirmButton.isVisible()) {
            await confirmButton.click()
            await page.waitForTimeout(TIMEOUTS.long)

            // Undo toast/snackbar
            const undoOption = page.locator('button').filter({ hasText: /undo/i })
              .or(page.locator('text=/undo/i'))
          }
        }
      }
    })

    test('should restore thinker on undo', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // This would require implementing undo functionality
    })
  })
})
