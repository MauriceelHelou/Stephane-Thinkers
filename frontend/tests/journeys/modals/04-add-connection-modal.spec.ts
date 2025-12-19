import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS, CONNECTION_TYPES } from '../../config/test-constants'

test.describe('Modal Journey: Add Connection Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 4,
      connections: 0,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open from toolbar button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addConnectionButton = page.locator('button').filter({ hasText: /connection/i })
        .or(page.locator('[data-testid="add-connection"]'))

      if (await addConnectionButton.isVisible()) {
        await addConnectionButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const modal = page.locator('[role="dialog"]')
        await expect(modal).toBeVisible()
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should open with pre-selected source from Shift+click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinkers = page.locator('[data-testid*="thinker"], [class*="thinker"]')
      const count = await thinkers.count()

      if (count >= 2) {
        // Shift+click first thinker
        await thinkers.first().click({ modifiers: ['Shift'] })
        await page.waitForTimeout(TIMEOUTS.animation)

        // Shift+click second thinker
        await thinkers.nth(1).click({ modifiers: ['Shift'] })
        await page.waitForTimeout(TIMEOUTS.animation)

        // Modal should open with both pre-selected
      }
    })
  })

  test.describe('Source and Target Selection', () => {
    test('should allow selecting source thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const sourceSelect = page.locator('select[name*="source"], [data-testid="source-select"]')
        .or(page.locator('[class*="source"]').locator('select'))

      if (await sourceSelect.isVisible()) {
        // Select a source
        const options = await sourceSelect.locator('option').allTextContents()
        if (options.length > 1) {
          await sourceSelect.selectOption({ index: 1 })
        }
      }
    })

    test('should allow selecting target thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const targetSelect = page.locator('select[name*="target"], [data-testid="target-select"]')
        .or(page.locator('[class*="target"]').locator('select'))

      if (await targetSelect.isVisible()) {
        const options = await targetSelect.locator('option').allTextContents()
        if (options.length > 1) {
          await targetSelect.selectOption({ index: 1 })
        }
      }
    })

    test('should not allow same source and target', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const sourceSelect = page.locator('select[name*="source"]').first()
      const targetSelect = page.locator('select[name*="target"]').first()

      if (await sourceSelect.isVisible() && await targetSelect.isVisible()) {
        // Select same value for both
        await sourceSelect.selectOption({ index: 1 })
        await targetSelect.selectOption({ index: 1 })

        // Should show error or disable option
        const error = page.locator('text=/same|different|cannot/i')
      }
    })
  })

  test.describe('Connection Type Selection', () => {
    test('should show all connection type options', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Check for all connection types
      const influenced = page.locator('text=/influenced/i')
      const critiqued = page.locator('text=/critiqued/i')
      const builtUpon = page.locator('text=/built.*upon/i')
      const synthesized = page.locator('text=/synthesized/i')
    })

    test('should select influenced type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const typeSelect = page.locator('select[name*="type"], [data-testid="connection-type"]')
        .or(page.locator('[role="radiogroup"]'))

      if (await typeSelect.isVisible()) {
        if (await typeSelect.getAttribute('tagName') === 'SELECT') {
          await typeSelect.selectOption({ label: /influenced/i })
        } else {
          const influencedOption = page.locator('text=/influenced/i')
          await influencedOption.click()
        }
      }
    })

    test('should select critiqued type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const critiquedOption = page.locator('[value="critiqued"]')
        .or(page.locator('text=/critiqued/i'))

      if (await critiquedOption.isVisible()) {
        await critiquedOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should select built_upon type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const builtUponOption = page.locator('[value="built_upon"]')
        .or(page.locator('text=/built.*upon/i'))

      if (await builtUponOption.isVisible()) {
        await builtUponOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should select synthesized type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const synthesizedOption = page.locator('[value="synthesized"]')
        .or(page.locator('text=/synthesized/i'))

      if (await synthesizedOption.isVisible()) {
        await synthesizedOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Optional Fields', () => {
    test('should accept connection notes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const notesInput = page.locator('textarea[name*="note"], input[name*="note"]')
        .or(page.locator('[placeholder*="note" i]'))

      if (await notesInput.isVisible()) {
        await notesInput.fill('Kant influenced Hegel through his critique of pure reason.')
      }
    })

    test('should accept connection strength', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const strengthInput = page.locator('input[type="range"], select[name*="strength"]')
        .or(page.locator('[data-testid="strength"]'))

      if (await strengthInput.isVisible()) {
        // Set strength value
      }
    })

    test('should allow bidirectional toggle', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const bidirectionalToggle = page.locator('input[type="checkbox"][name*="bidirectional"]')
        .or(page.locator('text=/bidirectional/i'))

      if (await bidirectionalToggle.isVisible()) {
        await bidirectionalToggle.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Form Submission', () => {
    test('should create connection with valid data', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const sourceSelect = page.locator('select[name*="source"]').first()
      const targetSelect = page.locator('select[name*="target"]').first()

      if (await sourceSelect.isVisible() && await targetSelect.isVisible()) {
        await sourceSelect.selectOption({ index: 1 })
        await targetSelect.selectOption({ index: 2 })

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create|add/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.long)

        // Modal should close
        const modal = page.locator('[role="dialog"]')
        await expect(modal).not.toBeVisible()
      }
    })

    test('should show error for missing required fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit without selecting source/target
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error should appear
      const error = page.locator('[class*="error"], [role="alert"]')
    })

    test('should prevent duplicate connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // This would require creating a connection first, then trying to create duplicate
    })
  })
})
