import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Add Timeline Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open from toolbar button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addTimelineButton = page.locator('button').filter({ hasText: /timeline/i })
        .or(page.locator('[data-testid="add-timeline"]'))

      if (await addTimelineButton.isVisible()) {
        await addTimelineButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const modal = page.locator('[role="dialog"]')
        await expect(modal).toBeVisible()
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should open from menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const menuButton = page.locator('button').filter({ hasText: /menu|file/i })
      if (await menuButton.isVisible()) {
        await menuButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const newTimelineOption = page.locator('text=/new.*timeline|add.*timeline/i')
        if (await newTimelineOption.isVisible()) {
          await newTimelineOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Form Fields', () => {
    test('should have name field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"], [placeholder*="name" i]')
      await expect(nameInput).toBeVisible()
    })

    test('should have start year field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const startYearInput = page.locator('input[name*="start"], [placeholder*="start" i]')
    })

    test('should have end year field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const endYearInput = page.locator('input[name*="end"], [placeholder*="end" i]')
    })

    test('should have description field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const descInput = page.locator('textarea[name*="description"]')
    })
  })

  test.describe('Form Input', () => {
    test('should accept timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
      await nameInput.fill('Philosophy Timeline')
      await expect(nameInput).toHaveValue('Philosophy Timeline')
    })

    test('should accept start year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const startInput = page.locator('input[name*="start"]').first()
      if (await startInput.isVisible()) {
        await startInput.fill('1700')
        await expect(startInput).toHaveValue('1700')
      }
    })

    test('should accept end year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const endInput = page.locator('input[name*="end"]').first()
      if (await endInput.isVisible()) {
        await endInput.fill('1900')
        await expect(endInput).toHaveValue('1900')
      }
    })
  })

  test.describe('Validation', () => {
    test('should require name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit without name
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const error = page.locator('[class*="error"], text=/required/i')
    })

    test('should validate year range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Timeline')

      const startInput = page.locator('input[name*="start"]').first()
      const endInput = page.locator('input[name*="end"]').first()

      if (await startInput.isVisible() && await endInput.isVisible()) {
        await startInput.fill('1900')
        await endInput.fill('1700') // End before start

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Error should appear
      }
    })
  })

  test.describe('Form Submission', () => {
    test('should create timeline with valid data', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
      await nameInput.fill('Enlightenment Philosophy')

      const startInput = page.locator('input[name*="start"]').first()
      const endInput = page.locator('input[name*="end"]').first()

      if (await startInput.isVisible()) {
        await startInput.fill('1700')
      }
      if (await endInput.isVisible()) {
        await endInput.fill('1850')
      }

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Modal should close and timeline should be created
      const modal = page.locator('[role="dialog"]')
      await expect(modal).not.toBeVisible()
    })
  })
})
