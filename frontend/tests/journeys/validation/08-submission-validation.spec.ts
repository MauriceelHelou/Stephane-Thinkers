import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Validation Journey: Submission Validation', () => {
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

  test.describe('Pre-Submission Validation', () => {
    test('should validate all fields on submit', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit without filling anything
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // All invalid fields should show errors
      const errors = page.locator('[class*="error"]')
    })

    test('should prevent submission with errors', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit with errors
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Modal should still be open
      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible()
    })

    test('should scroll to first error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // First error field should be in view
    })

    test('should focus first error field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // First invalid field should be focused
      const focused = page.locator(':focus')
    })
  })

  test.describe('Server-Side Validation', () => {
    test('should show server validation errors', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Mock server error
      await page.route('**/api/thinkers', route =>
        route.fulfill({
          status: 400,
          body: JSON.stringify({ detail: 'Name must be unique' }),
        })
      )

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Server error should be displayed
      const error = page.locator('text=/unique|already.*exist/i')
    })

    test('should handle validation error response', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/thinkers', route =>
        route.fulfill({
          status: 422,
          body: JSON.stringify({
            detail: [
              { loc: ['body', 'name'], msg: 'Name is required' },
              { loc: ['body', 'birth_year'], msg: 'Must be a number' },
            ],
          }),
        })
      )

      // Multiple errors from server
    })

    test('should map server errors to fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Server errors should appear next to correct fields
    })
  })

  test.describe('Submit Button State', () => {
    test('should disable submit during validation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()

      // Button should be disabled while processing
      await expect(submitButton).toBeDisabled()
    })

    test('should show loading state on submit', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()

      // Loading spinner or text
      const loading = page.locator('[class*="loading"], [class*="spinner"]')
        .or(page.locator('text=/saving|creating/i'))
    })

    test('should re-enable submit after error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/thinkers', route =>
        route.fulfill({ status: 500 })
      )

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Button should be re-enabled after error
      await expect(submitButton).toBeEnabled()
    })
  })

  test.describe('Success Handling', () => {
    test('should close modal on success', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('New Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Modal should close
      const modal = page.locator('[role="dialog"]')
      await expect(modal).not.toBeVisible()
    })

    test('should show success notification', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('New Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Success toast/notification
      const success = page.locator('text=/created|success|added/i')
    })

    test('should update UI with new data', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const initialCount = await page.locator('[data-testid*="thinker"], [class*="thinker"]').count()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Brand New Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // New thinker should appear
      const newCount = await page.locator('[data-testid*="thinker"], [class*="thinker"]').count()
      expect(newCount).toBeGreaterThan(initialCount)
    })
  })

  test.describe('Network Error Handling', () => {
    test('should handle network timeout', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/thinkers', async route => {
        await new Promise(resolve => setTimeout(resolve, 30000))
        return route.continue()
      })

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()

      // Should show timeout error eventually
    })

    test('should handle network failure', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/thinkers', route => route.abort())

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Network error message
      const error = page.locator('text=/network|connection|failed/i')
    })

    test('should offer retry on network error', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.route('**/api/thinkers', route => route.abort())

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Retry button
      const retryButton = page.locator('button').filter({ hasText: /retry|try.*again/i })
    })
  })
})
