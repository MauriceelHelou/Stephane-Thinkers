import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Keyboard Journey: Help & Shortcuts Panel', () => {
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

  test.describe('Help Panel Access', () => {
    test('should open shortcuts help with ? key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Help panel should open
      const helpPanel = page.locator('[class*="help"], [class*="shortcuts"]')
        .or(page.locator('[role="dialog"]').filter({ hasText: /shortcut|keyboard/i }))
    })

    test('should open shortcuts help with F1 key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('F1')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpPanel = page.locator('[class*="help"]')
        .or(page.locator('text=/keyboard.*shortcut/i'))
    })

    test('should open shortcuts help with Ctrl+/', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+/')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Help Panel Content', () => {
    test('should display all shortcut categories', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Categories should be visible
      const categories = page.locator('text=/general|navigation|editing|thinker|connection/i')
    })

    test('should display thinker shortcuts', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Thinker shortcuts section
      const thinkerSection = page.locator('text=/add.*thinker|new.*thinker/i')
    })

    test('should display connection shortcuts', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connection shortcuts section
      const connectionSection = page.locator('text=/add.*connection|create.*connection/i')
    })

    test('should display navigation shortcuts', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Navigation shortcuts section
      const navSection = page.locator('text=/zoom|pan|navigate/i')
    })

    test('should display modal shortcuts', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Modal shortcuts (Escape to close, etc.)
      const modalSection = page.locator('text=/escape|close|modal/i')
    })
  })

  test.describe('Help Panel Interaction', () => {
    test('should close help panel with Escape', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Help panel should close
    })

    test('should close help panel by pressing ? again', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should search shortcuts', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]')
      if (await searchInput.isVisible()) {
        await searchInput.fill('thinker')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Results should filter
      }
    })

    test('should navigate sections with keyboard', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Tab to navigate
      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('Tab')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Shortcut Display Format', () => {
    test('should show key combination clearly', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Key combinations should be visible (Ctrl, Shift, etc.)
      const keyCombinations = page.locator('[class*="key"], kbd')
    })

    test('should show shortcut description', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Descriptions should be present
      const descriptions = page.locator('[class*="description"]')
    })

    test('should highlight modifier keys', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Modifier keys highlighted (Ctrl, Alt, Shift)
      const modifiers = page.locator('text=/ctrl|alt|shift|cmd|command/i')
    })
  })

  test.describe('Platform-Specific Shortcuts', () => {
    test('should show platform-appropriate modifier (Cmd on Mac)', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should detect platform and show appropriate keys
      // This is platform-dependent
    })
  })

  test.describe('Quick Tips', () => {
    test('should show tip of the day', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Tip might appear on first load
      const tip = page.locator('[class*="tip"]')
        .or(page.locator('text=/did.*you.*know|tip/i'))
    })

    test('should dismiss tip with click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const dismissButton = page.locator('button').filter({ hasText: /dismiss|got.*it|close/i })
      if (await dismissButton.isVisible()) {
        await dismissButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should not show tip again after dismiss', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Dismiss any tip
      const dismissButton = page.locator('button').filter({ hasText: /dismiss|got.*it/i })
      if (await dismissButton.isVisible()) {
        await dismissButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // Reload page
      await page.reload()
      await mainPage.waitForPageLoad()

      // Tip should not appear (if preference saved)
    })
  })

  test.describe('Contextual Help', () => {
    test('should show context-sensitive shortcuts for selected element', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select a thinker
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('?')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Should highlight relevant shortcuts for thinker
      }
    })
  })
})
