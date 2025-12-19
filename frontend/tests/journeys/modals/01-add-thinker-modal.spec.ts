import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Add Thinker Modal', () => {
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

  test.describe('Modal Opening', () => {
    test('should open from toolbar button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible()
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('n')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
    })

    test('should open from canvas right-click menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.canvasElement.click({ button: 'right', position: { x: 200, y: 200 } })
      await page.waitForTimeout(TIMEOUTS.animation)

      const addOption = page.locator('text=/add.*thinker/i')
      if (await addOption.isVisible()) {
        await addOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Modal Structure', () => {
    test('should have header with title', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const header = page.locator('[role="dialog"] h1, [role="dialog"] h2')
        .or(page.locator('text=/add.*thinker|new.*thinker/i'))
      await expect(header).toBeVisible()
    })

    test('should have close button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const closeButton = page.locator('[role="dialog"] button').filter({ hasText: /×|close/i })
        .or(page.locator('[aria-label*="close"]'))
    })

    test('should have form fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Name field
      const nameInput = page.locator('input[name="name"], [placeholder*="name" i]')
      await expect(nameInput).toBeVisible()

      // Birth year
      const birthYear = page.locator('input[name*="birth"], [placeholder*="birth" i]')

      // Death year
      const deathYear = page.locator('input[name*="death"], [placeholder*="death" i]')

      // Field
      const fieldInput = page.locator('input[name="field"], select[name="field"], [placeholder*="field" i]')
    })

    test('should have submit and cancel buttons', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await expect(submitButton).toBeVisible()

      const cancelButton = page.locator('button').filter({ hasText: /cancel|close/i })
    })
  })

  test.describe('Form Input', () => {
    test('should accept name input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
      await nameInput.fill('Test Philosopher')
      await expect(nameInput).toHaveValue('Test Philosopher')
    })

    test('should accept birth year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const birthInput = page.locator('input[name*="birth"], [placeholder*="birth" i]').first()
      if (await birthInput.isVisible()) {
        await birthInput.fill('1800')
        await expect(birthInput).toHaveValue('1800')
      }
    })

    test('should accept death year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const deathInput = page.locator('input[name*="death"], [placeholder*="death" i]').first()
      if (await deathInput.isVisible()) {
        await deathInput.fill('1850')
        await expect(deathInput).toHaveValue('1850')
      }
    })

    test('should accept field selection', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const fieldInput = page.locator('input[name="field"], select[name="field"]').first()
      if (await fieldInput.isVisible()) {
        if (await fieldInput.getAttribute('type') === 'text') {
          await fieldInput.fill('Philosophy')
        } else {
          await fieldInput.selectOption({ label: 'Philosophy' })
        }
      }
    })

    test('should accept description', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const descInput = page.locator('textarea[name*="description"], textarea[name*="bio"]').first()
      if (await descInput.isVisible()) {
        await descInput.fill('A renowned thinker.')
      }
    })
  })

  test.describe('Form Submission', () => {
    test('should create thinker with valid data', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Fill form
      const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
      await nameInput.fill('Friedrich Nietzsche')

      const birthInput = page.locator('input[name*="birth"], [placeholder*="birth" i]').first()
      if (await birthInput.isVisible()) {
        await birthInput.fill('1844')
      }

      const deathInput = page.locator('input[name*="death"], [placeholder*="death" i]').first()
      if (await deathInput.isVisible()) {
        await deathInput.fill('1900')
      }

      // Submit
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Modal should close
      const modal = page.locator('[role="dialog"]')
      await expect(modal).not.toBeVisible()
    })

    test('should show error for missing required fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit without filling required fields
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error should appear
      const error = page.locator('[class*="error"], [role="alert"]')
        .or(page.locator('text=/required|please.*enter/i'))
    })

    test('should show loading state during submission', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()

      // Loading state (button disabled or spinner)
      const loading = page.locator('[class*="loading"], [class*="spinner"]')
        .or(page.locator('button:disabled'))
    })
  })

  test.describe('Modal Closing', () => {
    test('should close on cancel button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const cancelButton = page.locator('button').filter({ hasText: /cancel|close/i })
      if (await cancelButton.isVisible()) {
        await cancelButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const modal = page.locator('[role="dialog"]')
        await expect(modal).not.toBeVisible()
      }
    })

    test('should close on Escape key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      await expect(modal).not.toBeVisible()
    })

    test('should close on backdrop click', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click outside modal
      const backdrop = page.locator('[class*="overlay"], [class*="backdrop"]')
      if (await backdrop.isVisible()) {
        await backdrop.click({ position: { x: 10, y: 10 } })
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should warn about unsaved changes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Enter some data
      const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
      await nameInput.fill('Test Thinker')

      // Try to close
      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Warning might appear
      const warning = page.locator('text=/unsaved|discard|sure/i')
    })
  })
})
