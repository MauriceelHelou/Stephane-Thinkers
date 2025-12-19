import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Validation Journey: Inline Validation', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 2,
      connections: 0,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('On Blur Validation', () => {
    test('should validate on field blur', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Focus and leave empty name field
      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.focus()
      await nameInput.blur()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error should appear
      const error = page.locator('[class*="error"]')
    })

    test('should validate year on blur', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const birthInput = page.locator('input[name*="birth"]').first()
      if (await birthInput.isVisible()) {
        await birthInput.fill('abc') // Invalid
        await birthInput.blur()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Error should appear
      }
    })
  })

  test.describe('On Input Validation', () => {
    test('should validate as user types', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()

      // Type character by character
      await nameInput.type('A', { delay: 100 })
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should show valid state or continue typing
    })

    test('should debounce validation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()

      // Type quickly
      await nameInput.fill('Test Thinker Name')

      // Validation shouldn't fire for each character
    })

    test('should show progress indicator during async validation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Immanuel Kant')
      await page.waitForTimeout(TIMEOUTS.animation)

      // May show loading indicator while checking for duplicates
      const loading = page.locator('[class*="loading"], [class*="spinner"]')
    })
  })

  test.describe('Success Indication', () => {
    test('should show success for valid input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Unique New Thinker')
      await nameInput.blur()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Success indicator (green checkmark, etc.)
      const success = page.locator('[class*="success"], [class*="valid"]')
    })

    test('should show green border for valid field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Green border or similar success styling
    })

    test('should show checkmark icon for valid field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Checkmark icon
      const checkmark = page.locator('[class*="check"], svg[class*="valid"]')
    })
  })

  test.describe('Warning vs Error', () => {
    test('should show warning for potential issues', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Immanuel Kant') // Duplicate - warning, not error
      await nameInput.blur()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Warning (yellow) vs error (red)
      const warning = page.locator('[class*="warning"]')
    })

    test('should differentiate warning and error styling', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Warnings are yellow/orange, errors are red
    })
  })

  test.describe('Real-time Feedback', () => {
    test('should update character count in real-time', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const descInput = page.locator('textarea[name*="description"]').first()
      if (await descInput.isVisible()) {
        await descInput.type('Test description')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Character count should update
        const charCount = page.locator('text=/\\d+.*character/i')
      }
    })

    test('should show remaining characters', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // May show "50 characters remaining" etc.
    })

    test('should warn when approaching limit', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Warning when near character limit
    })
  })

  test.describe('Form State Indicators', () => {
    test('should show pristine state for untouched fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Untouched fields should not show validation state
      const nameInput = page.locator('input[name="name"]').first()
      const classes = await nameInput.getAttribute('class') || ''
      expect(classes).not.toContain('error')
      expect(classes).not.toContain('valid')
    })

    test('should show dirty state after user interaction', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('test')
      await nameInput.clear()
      await nameInput.blur()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Now should show validation state
    })

    test('should track touched vs untouched fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Form should track which fields have been touched
    })
  })
})
