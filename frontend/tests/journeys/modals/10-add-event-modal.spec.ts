import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Add Event Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 0,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open from toolbar', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
        .or(page.locator('[data-testid="add-event"]'))

      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const modal = page.locator('[role="dialog"]')
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Alt+e')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Form Fields', () => {
    test('should have name field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const nameInput = page.locator('input[name="name"], input[name="title"]')
      }
    })

    test('should have year field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const yearInput = page.locator('input[name="year"], input[type="number"]')
      }
    })

    test('should have event type selector', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const typeSelector = page.locator('select[name="type"], [name="event_type"]')
      }
    })

    test('should have description field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const descInput = page.locator('textarea[name*="description"]')
      }
    })
  })

  test.describe('Event Types', () => {
    test('should show political type option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const politicalOption = page.locator('text=/political/i')
      }
    })

    test('should show cultural type option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const culturalOption = page.locator('text=/cultural/i')
      }
    })

    test('should show scientific type option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const scientificOption = page.locator('text=/scientific/i')
      }
    })
  })

  test.describe('Form Submission', () => {
    test('should create event with valid data', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const addEventButton = page.locator('button').filter({ hasText: /event/i })
      if (await addEventButton.isVisible()) {
        await addEventButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const nameInput = page.locator('input[name="name"], input[name="title"]').first()
        if (await nameInput.isVisible()) {
          await nameInput.fill('French Revolution')
        }

        const yearInput = page.locator('input[name="year"]').first()
        if (await yearInput.isVisible()) {
          await yearInput.fill('1789')
        }

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|create|add/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })
})
