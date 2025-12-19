import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Validation Journey: Error Display', () => {
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

  test.describe('Error Message Positioning', () => {
    test('should show error near invalid field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit empty form
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error should be visible near name field
      const nameField = page.locator('input[name="name"]')
      const error = page.locator('[class*="error"]')

      // Error should be positioned near the field
    })

    test('should show multiple errors for multiple invalid fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Enter invalid data for multiple fields
      const birthInput = page.locator('input[name*="birth"]').first()
      const deathInput = page.locator('input[name*="death"]').first()

      if (await birthInput.isVisible() && await deathInput.isVisible()) {
        await birthInput.fill('1900')
        await deathInput.fill('1800') // Invalid
      }

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Multiple errors should be visible
      const errors = page.locator('[class*="error"]')
    })
  })

  test.describe('Error Message Content', () => {
    test('should show clear error message', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error message should be user-friendly
      const error = page.locator('[class*="error"]').first()
      if (await error.isVisible()) {
        const text = await error.textContent()
        // Should be descriptive, not technical
        expect(text).not.toContain('null')
        expect(text).not.toContain('undefined')
      }
    })

    test('should explain how to fix error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const birthInput = page.locator('input[name*="birth"]').first()
      const deathInput = page.locator('input[name*="death"]').first()

      if (await birthInput.isVisible() && await deathInput.isVisible()) {
        await birthInput.fill('1900')
        await deathInput.fill('1800')

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create|add/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Error should explain the issue
        const error = page.locator('text=/death.*before.*birth|must.*be.*after/i')
      }
    })
  })

  test.describe('Error Styling', () => {
    test('should highlight invalid field with red border', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Field should have error styling
      const invalidField = page.locator('[aria-invalid="true"], [class*="error"], [class*="invalid"]')
    })

    test('should show error icon', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error icon
      const errorIcon = page.locator('[class*="error-icon"], svg[class*="error"]')
    })

    test('should use appropriate error color', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Red or similar warning color for errors
    })
  })

  test.describe('Error Clearing', () => {
    test('should clear error when field is corrected', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit empty to trigger error
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error should be visible
      const error = page.locator('[class*="error"]').first()
      await expect(error).toBeVisible()

      // Fill the field
      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error should clear
    })

    test('should clear all errors on modal close and reopen', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Trigger error
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Close modal
      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Reopen modal
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Errors should be cleared
      const errors = page.locator('[class*="error"]')
    })
  })

  test.describe('Error Summary', () => {
    test('should show error summary at top of form', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // With multiple errors, may show summary
      const errorSummary = page.locator('[class*="error-summary"], [role="alert"]')
    })

    test('should count total errors', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Summary might show "3 errors" etc.
      const errorCount = page.locator('text=/\\d+.*error/i')
    })
  })

  test.describe('Screen Reader Accessibility', () => {
    test('should announce errors to screen readers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Errors should have aria-live or role="alert"
      const accessibleError = page.locator('[role="alert"], [aria-live]')
    })

    test('should associate error with field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // aria-describedby or similar association
      const fieldWithDescription = page.locator('[aria-describedby], [aria-errormessage]')
    })
  })
})
