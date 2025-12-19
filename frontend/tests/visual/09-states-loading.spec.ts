import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Loading States', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 1,
    })
  })

  test('initial page loading', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      return route.continue()
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()

    // Capture loading state before data loads
    await expect(page).toHaveScreenshot('page-loading.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('loading spinner', async ({ page }) => {
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000))
      return route.continue()
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()

    const spinner = page.locator('[class*="loading"], [class*="spinner"]')
    if (await spinner.isVisible()) {
      await expect(spinner).toHaveScreenshot('loading-spinner.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('skeleton loading', async ({ page }) => {
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000))
      return route.continue()
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()

    const skeleton = page.locator('[class*="skeleton"]')
    if (await skeleton.count() > 0) {
      await expect(page).toHaveScreenshot('skeleton-loading.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('modal submit loading', async ({ page }) => {
    const api = createAPIHelpers(page.request)
    await api.resetDatabase()
    await api.seedDatabase({ timelines: 1, thinkers: 1, connections: 0 })

    await page.route('**/api/thinkers', async route => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 3000))
        return route.continue()
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

    // Capture loading state
    await expect(page).toHaveScreenshot('modal-submit-loading.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('AI response loading', async ({ page }) => {
    const api = createAPIHelpers(page.request)
    await api.resetDatabase()
    await api.seedDatabase({ timelines: 1, thinkers: 3, connections: 1 })

    await page.route('**/api/ai/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000))
      return route.continue()
    })

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
        await chatInput.fill('Test message')
        await page.keyboard.press('Enter')

        // Capture AI loading state
        await expect(page.locator('[class*="ai-panel"]')).toHaveScreenshot('ai-response-loading.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('export loading', async ({ page }) => {
    const api = createAPIHelpers(page.request)
    await api.resetDatabase()
    await api.seedDatabase({ timelines: 1, thinkers: 3, connections: 1 })

    await page.route('**/api/export**', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000))
      return route.continue()
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    const fileMenu = page.locator('button').filter({ hasText: /file|menu/i })
    if (await fileMenu.isVisible()) {
      await fileMenu.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const exportOption = page.locator('text=/export/i')
      if (await exportOption.isVisible()) {
        await exportOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const exportButton = page.locator('button').filter({ hasText: /export|download/i })
        if (await exportButton.isVisible()) {
          await exportButton.click()

          // Capture export loading state
          await expect(page).toHaveScreenshot('export-loading.png', {
            maxDiffPixelRatio: 0.02,
          })
        }
      }
    }
  })
})
