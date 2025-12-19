import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Confirm Dialogs', () => {
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

  test('delete thinker confirmation', async ({ page }) => {
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

        await expect(page).toHaveScreenshot('delete-thinker-confirm.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('delete connection confirmation', async ({ page }) => {
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

        await expect(page).toHaveScreenshot('delete-connection-confirm.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('unsaved changes warning', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Enter some data
    const nameInput = page.locator('input[name="name"]').first()
    await nameInput.fill('Test Thinker')

    // Try to close
    await page.keyboard.press('Escape')
    await page.waitForTimeout(TIMEOUTS.animation)

    const warning = page.locator('text=/unsaved|discard/i')
    if (await warning.isVisible()) {
      await expect(page).toHaveScreenshot('unsaved-changes-warning.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('bulk delete confirmation', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Select multiple thinkers
    const thinkers = page.locator('[data-testid*="thinker"], [class*="thinker"]')
    if (await thinkers.count() >= 2) {
      await thinkers.first().click()
      await thinkers.nth(1).click({ modifiers: ['Control'] })
      await page.waitForTimeout(TIMEOUTS.animation)

      // Delete
      await page.keyboard.press('Delete')
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('bulk-delete-confirm.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('confirm dialog with warning icon', async ({ page }) => {
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

        // Warning icon should be visible
        const dialog = page.locator('[role="alertdialog"], [role="dialog"]')
        if (await dialog.isVisible()) {
          await expect(dialog).toHaveScreenshot('confirm-dialog-with-icon.png', {
            maxDiffPixelRatio: 0.02,
          })
        }
      }
    }
  })

  test('confirm buttons hover states', async ({ page }) => {
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

        // Hover over confirm button
        const confirmButton = page.locator('button').filter({ hasText: /delete|yes|confirm/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.hover()
          await page.waitForTimeout(TIMEOUTS.animation)

          await expect(confirmButton).toHaveScreenshot('confirm-button-hover.png', {
            maxDiffPixelRatio: 0.01,
          })
        }
      }
    }
  })

  test('cancel button hover state', async ({ page }) => {
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

        const cancelButton = page.locator('button').filter({ hasText: /cancel|no/i })
        if (await cancelButton.isVisible()) {
          await cancelButton.hover()
          await page.waitForTimeout(TIMEOUTS.animation)

          await expect(cancelButton).toHaveScreenshot('cancel-button-hover.png', {
            maxDiffPixelRatio: 0.01,
          })
        }
      }
    }
  })
})
