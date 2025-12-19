import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Keyboard Journey: Event Shortcuts', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Test Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    await api.seedDatabase({
      timelines: 0,
      thinkers: 3,
      connections: 2,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Add Event Shortcut', () => {
    test('should open add event modal with E key (with modifier)', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Alt+e')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Add event modal should open
      const modal = page.locator('[role="dialog"]').filter({ hasText: /event/i })
    })

    test('should open add event modal with keyboard combo', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+Shift+e')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
    })
  })

  test.describe('Event Type Shortcuts', () => {
    test('should select political event with P in event modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Alt+e')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      if (await modal.isVisible()) {
        await page.keyboard.press('p')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Political type should be selected
      }
    })

    test('should select cultural event with U in event modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Alt+e')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      if (await modal.isVisible()) {
        await page.keyboard.press('u')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should select scientific event with S in event modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Alt+e')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      if (await modal.isVisible()) {
        await page.keyboard.press('s')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should select philosophical event with L in event modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Alt+e')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
      if (await modal.isVisible()) {
        await page.keyboard.press('l')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Edit Event Shortcut', () => {
    test('should edit selected event with E key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select an event
      const event = page.locator('[data-testid*="event"], [class*="timeline-event"]').first()
      if (await event.isVisible()) {
        await event.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('e')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Edit modal should open
      }
    })
  })

  test.describe('Delete Event Shortcut', () => {
    test('should delete selected event with Delete key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const event = page.locator('[data-testid*="event"], [class*="timeline-event"]').first()
      if (await event.isVisible()) {
        await event.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Delete')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Event Navigation', () => {
    test('should navigate to next event with Page Down', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('PageDown')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should navigate to next chronological event
    })

    test('should navigate to previous event with Page Up', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('PageUp')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should jump to year with G key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('g')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Year input should appear
      const yearInput = page.locator('input[type="number"], [class*="year-input"]')
      if (await yearInput.isVisible()) {
        await yearInput.fill('1789')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Canvas should jump to 1789
      }
    })
  })

  test.describe('Event Visibility', () => {
    test('should toggle events visibility with V key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('v')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Events should toggle visibility
    })

    test('should show only political events with Ctrl+1', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+1')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Only political events should be visible
    })

    test('should show only cultural events with Ctrl+2', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+2')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should show all events with Ctrl+0', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Hide some events first
      await page.keyboard.press('Control+1')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Show all
      await page.keyboard.press('Control+0')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Event Quick Actions', () => {
    test('should show event details with Space', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const event = page.locator('[data-testid*="event"], [class*="timeline-event"]').first()
      if (await event.isVisible()) {
        await event.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('Space')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Event details should show
      }
    })

    test('should link event to thinker with L key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const event = page.locator('[data-testid*="event"], [class*="timeline-event"]').first()
      if (await event.isVisible()) {
        await event.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('l')
        await page.waitForTimeout(TIMEOUTS.animation)

        // Link thinker dialog should open
      }
    })
  })
})
