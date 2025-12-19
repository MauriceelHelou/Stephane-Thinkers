import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Network Panel', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 6,
      connections: 8,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test('network metrics panel', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const metricsButton = page.locator('button').filter({ hasText: /metrics|network|analytics/i })
    if (await metricsButton.isVisible()) {
      await metricsButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const panel = page.locator('[class*="metrics"], [class*="network-panel"]')
      if (await panel.isVisible()) {
        await expect(panel).toHaveScreenshot('network-metrics-panel.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('connection map view', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const mapButton = page.locator('button').filter({ hasText: /map|graph|radial/i })
    if (await mapButton.isVisible()) {
      await mapButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('connection-map-view.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('centrality metrics display', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const metricsButton = page.locator('button').filter({ hasText: /metrics/i })
    if (await metricsButton.isVisible()) {
      await metricsButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const centralityTab = page.locator('button, [role="tab"]').filter({ hasText: /central/i })
      if (await centralityTab.isVisible()) {
        await centralityTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await expect(page.locator('[class*="metrics"]')).toHaveScreenshot('centrality-metrics.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('communities display', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const metricsButton = page.locator('button').filter({ hasText: /metrics/i })
    if (await metricsButton.isVisible()) {
      await metricsButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const communitiesTab = page.locator('button, [role="tab"]').filter({ hasText: /communit/i })
      if (await communitiesTab.isVisible()) {
        await communitiesTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await expect(page.locator('[class*="metrics"]')).toHaveScreenshot('communities-display.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('academic lineage panel', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const lineageButton = page.locator('button').filter({ hasText: /lineage|genealogy/i })
    if (await lineageButton.isVisible()) {
      await lineageButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('academic-lineage-panel.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('timeline comparison view', async ({ page, request }) => {
    const api = createAPIHelpers(request)

    // Create second timeline for comparison
    await api.createTimeline({
      name: 'Second Timeline',
      start_year: 1800,
      end_year: 2000,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    const compareButton = page.locator('button').filter({ hasText: /compare|comparison/i })
    if (await compareButton.isVisible()) {
      await compareButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('timeline-comparison.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('combined timeline view', async ({ page, request }) => {
    const api = createAPIHelpers(request)

    await api.createTimeline({
      name: 'Second Timeline',
      start_year: 1800,
      end_year: 2000,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    // Toggle combined view
    await page.keyboard.press('m')
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('combined-timeline-view.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
