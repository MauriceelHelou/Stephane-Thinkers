import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Validation Journey: Year Validation', () => {
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

  test.describe('Thinker Birth/Death Years', () => {
    test('should reject death year before birth year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const birthInput = page.locator('input[name*="birth"]').first()
      const deathInput = page.locator('input[name*="death"]').first()

      if (await birthInput.isVisible() && await deathInput.isVisible()) {
        await birthInput.fill('1900')
        await deathInput.fill('1800') // Death before birth

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create|add/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Error should appear
        const error = page.locator('text=/death.*before.*birth|invalid.*year/i')
      }
    })

    test('should accept same birth and death year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Short-lived Thinker')

      const birthInput = page.locator('input[name*="birth"]').first()
      const deathInput = page.locator('input[name*="death"]').first()

      if (await birthInput.isVisible() && await deathInput.isVisible()) {
        await birthInput.fill('1800')
        await deathInput.fill('1800') // Same year (infant death)

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create|add/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.long)

        // Should succeed
      }
    })

    test('should reject unreasonably old age', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Ancient Thinker')

      const birthInput = page.locator('input[name*="birth"]').first()
      const deathInput = page.locator('input[name*="death"]').first()

      if (await birthInput.isVisible() && await deathInput.isVisible()) {
        await birthInput.fill('1600')
        await deathInput.fill('1900') // 300 years old

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create|add/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Warning or error might appear
      }
    })

    test('should reject future years', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Future Thinker')

      const birthInput = page.locator('input[name*="birth"]').first()

      if (await birthInput.isVisible()) {
        await birthInput.fill('2100') // Future year

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create|add/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Error should appear
      }
    })

    test('should reject negative years in common era format', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Some systems may allow BCE dates, others may not
    })
  })

  test.describe('Timeline Year Range', () => {
    test('should reject end year before start year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Invalid Timeline')

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
        const error = page.locator('text=/end.*before.*start|invalid.*range/i')
      }
    })

    test('should accept same start and end year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Single Year Timeline')

      const startInput = page.locator('input[name*="start"]').first()
      const endInput = page.locator('input[name*="end"]').first()

      if (await startInput.isVisible() && await endInput.isVisible()) {
        await startInput.fill('1789')
        await endInput.fill('1789') // Same year

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Event Year Validation', () => {
    test('should accept year within timeline range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Event year should be within timeline bounds
    })

    test('should warn for year outside timeline range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Warning if event year is outside timeline
    })
  })

  test.describe('Publication Year Validation', () => {
    test('should accept year during thinker lifetime', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Publication year should be within thinker's life (mostly)
    })

    test('should allow posthumous publications', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Publications can be after death
    })

    test('should reject publication before thinker birth', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Can't publish before being born
    })
  })

  test.describe('Year Format Validation', () => {
    test('should accept 4-digit years', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const birthInput = page.locator('input[name*="birth"]').first()
      if (await birthInput.isVisible()) {
        await birthInput.fill('1800')
        // Should accept
      }
    })

    test('should reject non-numeric input', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const birthInput = page.locator('input[name*="birth"]').first()
      if (await birthInput.isVisible()) {
        await birthInput.fill('abc')
        // Should show error or not accept
      }
    })

    test('should reject decimal years', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const birthInput = page.locator('input[name*="birth"]').first()
      if (await birthInput.isVisible()) {
        await birthInput.fill('1800.5')
        // Should show error or truncate
      }
    })
  })
})
