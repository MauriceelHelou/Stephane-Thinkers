import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Error States', () => {
  test('network error state', async ({ page }) => {
    await page.route('**/api/**', route => route.abort())

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await page.waitForTimeout(TIMEOUTS.long)

    await expect(page).toHaveScreenshot('network-error-state.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('server error state', async ({ page }) => {
    await page.route('**/api/**', route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal server error' }) })
    )

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await page.waitForTimeout(TIMEOUTS.long)

    await expect(page).toHaveScreenshot('server-error-state.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('form validation error', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({ timelines: 1, thinkers: 1, connections: 0 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Submit empty form
    const submitButton = page.locator('button[type="submit"]')
      .or(page.locator('button').filter({ hasText: /save|create|add/i }))
    await submitButton.click()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('form-validation-error.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('field error highlight', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({ timelines: 1, thinkers: 1, connections: 0 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    const submitButton = page.locator('button[type="submit"]')
      .or(page.locator('button').filter({ hasText: /save|create|add/i }))
    await submitButton.click()
    await page.waitForTimeout(TIMEOUTS.animation)

    const errorField = page.locator('[aria-invalid="true"], [class*="error"]').first()
    if (await errorField.isVisible()) {
      await expect(errorField).toHaveScreenshot('field-error-highlight.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('API error toast', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({ timelines: 1, thinkers: 2, connections: 0 })

    await page.route('**/api/thinkers', route => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 400,
          body: JSON.stringify({ detail: 'Name already exists' }),
        })
      }
      return route.continue()
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    const nameInput = page.locator('input[name="name"]').first()
    await nameInput.fill('Test Thinker')

    const submitButton = page.locator('button[type="submit"]')
      .or(page.locator('button').filter({ hasText: /save|create|add/i }))
    await submitButton.click()
    await page.waitForTimeout(TIMEOUTS.long)

    const toast = page.locator('[class*="toast"], [class*="snackbar"], [role="alert"]')
    if (await toast.isVisible()) {
      await expect(toast).toHaveScreenshot('api-error-toast.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('404 not found state', async ({ page }) => {
    await page.route('**/api/timelines**', route =>
      route.fulfill({ status: 404, body: JSON.stringify({ detail: 'Not found' }) })
    )

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await page.waitForTimeout(TIMEOUTS.long)

    await expect(page).toHaveScreenshot('not-found-state.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('connection error with retry button', async ({ page }) => {
    await page.route('**/api/**', route => route.abort())

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await page.waitForTimeout(TIMEOUTS.long)

    const retryButton = page.locator('button').filter({ hasText: /retry|try.*again/i })
    if (await retryButton.isVisible()) {
      await expect(retryButton).toHaveScreenshot('retry-button.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('rate limit error', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({ timelines: 1, thinkers: 2, connections: 0 })

    await page.route('**/api/ai/**', route =>
      route.fulfill({ status: 429, body: JSON.stringify({ error: 'Rate limit exceeded' }) })
    )

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const chatTab = page.locator('button, [role="tab"]').filter({ hasText: /chat/i })
    if (await chatTab.isVisible()) {
      await chatTab.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Test')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        await expect(page).toHaveScreenshot('rate-limit-error.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })
})
