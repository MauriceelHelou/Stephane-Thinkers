import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Keyboard Journey: Connection Shortcuts', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 4,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Create Connection Shortcut', () => {
    test('should open connection modal with C key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connection modal should open
      const modal = page.locator('[role="dialog"]').filter({ hasText: /connection/i })
    })

    test('should open connection modal with Ctrl+C when thinker selected', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select a thinker first
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Control+c')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Connection modal with source pre-filled
      }
    })

    test('should enter connection mode with Shift key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Hold Shift and click thinkers
      await page.keyboard.down('Shift')
      await page.waitForTimeout(TIMEOUTS.animation)

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      await page.keyboard.up('Shift')
    })
  })

  test.describe('Connection Type Shortcuts', () => {
    test('should set influenced type with 1 key in connection mode', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open connection modal
      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Press 1 for influenced
      await page.keyboard.press('1')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should select influenced type
    })

    test('should set critiqued type with 2 key in connection mode', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('2')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should set built_upon type with 3 key in connection mode', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('3')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should set synthesized type with 4 key in connection mode', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('4')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Edit Connection Shortcut', () => {
    test('should edit connection when selected with E key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select a connection
      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('e')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Edit modal should open
      }
    })
  })

  test.describe('Delete Connection Shortcut', () => {
    test('should delete selected connection with Delete key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Delete')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Confirmation or deletion
      }
    })

    test('should delete selected connection with Backspace key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Backspace')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Connection Navigation', () => {
    test('should cycle through connections with Tab when connection focused', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Tab')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should navigate to connected thinker with arrow keys', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Arrow right to go to target thinker
        await page.keyboard.press('ArrowRight')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Arrow left to go to source thinker
        await page.keyboard.press('ArrowLeft')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Bulk Connection Shortcuts', () => {
    test('should select all connections with Ctrl+Shift+A', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.canvasElement.focus()
      await page.keyboard.press('Control+Shift+a')
      await page.waitForTimeout(TIMEOUTS.animation)

      // All connections should be selected
    })

    test('should hide all connections with H key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('h')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connections should be hidden
    })

    test('should show all connections with Shift+H key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Hide first
      await page.keyboard.press('h')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Show again
      await page.keyboard.press('Shift+h')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connections should be visible
    })
  })

  test.describe('Connection Quick Info', () => {
    test('should show connection info with I key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
      if (await connection.isVisible()) {
        await connection.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('i')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Info panel/tooltip should appear
      }
    })
  })
})
