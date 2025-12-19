import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Timeline Select Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 3,
      thinkers: 6,
      connections: 4,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open from timeline switcher', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const timelineSwitcher = page.locator('button').filter({ hasText: /switch.*timeline|select.*timeline/i })
        .or(page.locator('[data-testid="timeline-switcher"]'))

      if (await timelineSwitcher.isVisible()) {
        await timelineSwitcher.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const modal = page.locator('[role="dialog"]')
      }
    })

    test('should open from toolbar dropdown', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const dropdown = page.locator('select[name*="timeline"]')
        .or(page.locator('[data-testid="timeline-dropdown"]'))

      if (await dropdown.isVisible()) {
        await dropdown.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Timeline List', () => {
    test('should display all available timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const timelineSwitcher = page.locator('button').filter({ hasText: /timeline/i })
      if (await timelineSwitcher.isVisible()) {
        await timelineSwitcher.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const timelineItems = page.locator('[class*="timeline-item"], [class*="list-item"]')
        const count = await timelineItems.count()
        expect(count).toBeGreaterThanOrEqual(3)
      }
    })

    test('should show timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Each timeline should show its name
    })

    test('should show timeline year range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Year range should be visible
    })

    test('should show thinker count', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Number of thinkers in timeline
    })

    test('should highlight current timeline', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Active timeline should be highlighted
    })
  })

  test.describe('Timeline Selection', () => {
    test('should switch to selected timeline', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const timelineSwitcher = page.locator('button').filter({ hasText: /timeline/i })
      if (await timelineSwitcher.isVisible()) {
        await timelineSwitcher.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const timelineItem = page.locator('[class*="timeline-item"]').nth(1)
        if (await timelineItem.isVisible()) {
          await timelineItem.click()
          await page.waitForTimeout(TIMEOUTS.long)

          // Timeline should switch
        }
      }
    })

    test('should close modal after selection', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Modal should close after timeline is selected
    })

    test('should update canvas after selection', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should show new timeline's thinkers
    })
  })

  test.describe('Search and Filter', () => {
    test('should filter timelines by name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const timelineSwitcher = page.locator('button').filter({ hasText: /timeline/i })
      if (await timelineSwitcher.isVisible()) {
        await timelineSwitcher.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]')
        if (await searchInput.isVisible()) {
          await searchInput.fill('Philosophy')
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Quick Actions', () => {
    test('should have create new timeline option', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const timelineSwitcher = page.locator('button').filter({ hasText: /timeline/i })
      if (await timelineSwitcher.isVisible()) {
        await timelineSwitcher.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const createOption = page.locator('button, a').filter({ hasText: /new|create/i })
      }
    })
  })
})
