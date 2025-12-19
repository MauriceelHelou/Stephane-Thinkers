import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Add Modals', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 1,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test('add thinker modal default', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('add-thinker-modal.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('add thinker modal with data', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Fill form
    const nameInput = page.locator('input[name="name"]').first()
    await nameInput.fill('Friedrich Nietzsche')

    const birthInput = page.locator('input[name*="birth"]').first()
    if (await birthInput.isVisible()) {
      await birthInput.fill('1844')
    }

    const deathInput = page.locator('input[name*="death"]').first()
    if (await deathInput.isVisible()) {
      await deathInput.fill('1900')
    }

    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('add-thinker-modal-filled.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('add thinker modal with error', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Submit empty form
    const submitButton = page.locator('button[type="submit"]')
      .or(page.locator('button').filter({ hasText: /save|create|add/i }))
    await submitButton.click()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('add-thinker-modal-error.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('add connection modal default', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await page.keyboard.press('c')
    await page.waitForTimeout(TIMEOUTS.animation)

    const modal = page.locator('[role="dialog"]')
    if (await modal.isVisible()) {
      await expect(page).toHaveScreenshot('add-connection-modal.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('add connection modal with selections', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await page.keyboard.press('c')
    await page.waitForTimeout(TIMEOUTS.animation)

    const sourceSelect = page.locator('select[name*="source"]').first()
    const targetSelect = page.locator('select[name*="target"]').first()

    if (await sourceSelect.isVisible() && await targetSelect.isVisible()) {
      await sourceSelect.selectOption({ index: 1 })
      await targetSelect.selectOption({ index: 2 })
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('add-connection-modal-filled.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('add timeline modal default', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await page.keyboard.press('t')
    await page.waitForTimeout(TIMEOUTS.animation)

    const modal = page.locator('[role="dialog"]')
    if (await modal.isVisible()) {
      await expect(page).toHaveScreenshot('add-timeline-modal.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('add event modal default', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const addEventButton = page.locator('button').filter({ hasText: /event/i })
    if (await addEventButton.isVisible()) {
      await addEventButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('add-event-modal.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('modal backdrop', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Capture full page including backdrop
    await expect(page).toHaveScreenshot('modal-with-backdrop.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('modal close button', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    await mainPage.openAddThinkerModal()
    await page.waitForTimeout(TIMEOUTS.animation)

    const closeButton = page.locator('[role="dialog"] button[aria-label*="close"]')
      .or(page.locator('[role="dialog"] button').filter({ hasText: /×/ }))

    if (await closeButton.isVisible()) {
      await closeButton.hover()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(closeButton).toHaveScreenshot('modal-close-button-hover.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })
})
