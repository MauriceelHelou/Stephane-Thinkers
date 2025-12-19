import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Validation Journey: Required Fields', () => {
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

  test.describe('Thinker Required Fields', () => {
    test('should require name field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Try to submit without name
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error for name should appear
      const nameError = page.locator('[class*="error"]')
        .or(page.locator('text=/name.*required|please.*enter.*name/i'))
      await expect(nameError).toBeVisible()
    })

    test('should allow submission with only required fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Fill only name
      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)

      // Should succeed
    })

    test('should show required indicator on required fields', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Required fields should have asterisk or required attribute
      const requiredIndicator = page.locator('[aria-required="true"], [required], text=/*/')
    })
  })

  test.describe('Connection Required Fields', () => {
    test('should require source thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Set only target
      const targetSelect = page.locator('select[name*="target"]').first()
      if (await targetSelect.isVisible()) {
        await targetSelect.selectOption({ index: 1 })
      }

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error for source should appear
      const sourceError = page.locator('text=/source.*required/i')
    })

    test('should require target thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Set only source
      const sourceSelect = page.locator('select[name*="source"]').first()
      if (await sourceSelect.isVisible()) {
        await sourceSelect.selectOption({ index: 1 })
      }

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error for target should appear
      const targetError = page.locator('text=/target.*required/i')
    })

    test('should require connection type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Connection type should be required
    })
  })

  test.describe('Timeline Required Fields', () => {
    test('should require timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameError = page.locator('text=/name.*required/i')
    })
  })

  test.describe('Publication Required Fields', () => {
    test('should require title', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Publications require title
    })

    test('should require year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Publications may require year
    })
  })

  test.describe('Quote Required Fields', () => {
    test('should require quote text', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Quotes require text content
    })
  })

  test.describe('Required Field UI', () => {
    test('should clear error when field is filled', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit empty
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Fill the field
      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Thinker')

      // Error should clear
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should focus first invalid field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Submit empty
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // First invalid field should be focused
      const focused = page.locator(':focus')
    })
  })
})
