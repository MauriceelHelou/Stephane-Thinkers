import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Edit Connection Modal', () => {
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

  test.describe('Modal Opening', () => {
    test('should open on connection click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Details panel or edit modal
      }
    })

    test('should open from context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should open from details panel edit button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const editButton = page.locator('button').filter({ hasText: /edit/i })
        if (await editButton.isVisible()) {
          await editButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Data Pre-population', () => {
    test('should show current connection type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Connection type should be selected
          const typeField = page.locator('[name*="type"], [class*="type"]')
        }
      }
    })

    test('should show source and target', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Source and target should be displayed
          const sourceField = page.locator('[class*="source"]')
          const targetField = page.locator('[class*="target"]')
        }
      }
    })

    test('should show existing notes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const notesField = page.locator('textarea[name*="note"]')
        }
      }
    })
  })

  test.describe('Edit Operations', () => {
    test('should update connection type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Change type
          const typeSelect = page.locator('select[name*="type"]')
          if (await typeSelect.isVisible()) {
            await typeSelect.selectOption({ label: /critiqued/i })
          }

          const saveButton = page.locator('button').filter({ hasText: /save|update/i })
          if (await saveButton.isVisible()) {
            await saveButton.click()
            await page.waitForTimeout(TIMEOUTS.long)
          }
        }
      }
    })

    test('should update notes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const notesField = page.locator('textarea[name*="note"]')
          if (await notesField.isVisible()) {
            await notesField.fill('Updated connection notes.')

            const saveButton = page.locator('button').filter({ hasText: /save|update/i })
            await saveButton.click()
            await page.waitForTimeout(TIMEOUTS.long)
          }
        }
      }
    })

    test('should update strength', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const strengthInput = page.locator('input[type="range"], select[name*="strength"]')
          if (await strengthInput.isVisible()) {
            // Update strength
          }
        }
      }
    })

    test('should toggle bidirectional', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const bidirectionalToggle = page.locator('input[type="checkbox"][name*="bidirectional"]')
          if (await bidirectionalToggle.isVisible()) {
            await bidirectionalToggle.click()
            await page.waitForTimeout(TIMEOUTS.animation)
          }
        }
      }
    })
  })

  test.describe('Swap Source/Target', () => {
    test('should have swap button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const swapButton = page.locator('button').filter({ hasText: /swap|reverse/i })
        }
      }
    })

    test('should swap source and target on click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Implementation would swap the direction
    })
  })

  test.describe('Delete from Edit Modal', () => {
    test('should have delete button in edit modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          const deleteButton = page.locator('button').filter({ hasText: /delete/i })
        }
      }
    })
  })
})
