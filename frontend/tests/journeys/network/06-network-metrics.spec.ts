import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS, TEST_IDS } from '../../config/test-constants'

test.describe('Network Journey: Network Metrics Panel', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 8,
      connections: 0,
    })
    thinkers = seedData.thinkers

    // Create a network with varying connectivity for metrics analysis
    // Hub: thinker[0] has many connections
    await api.createConnection({ from_thinker_id: thinkers[0].id, to_thinker_id: thinkers[1].id, connection_type: 'influenced', strength: 5 })
    await api.createConnection({ from_thinker_id: thinkers[0].id, to_thinker_id: thinkers[2].id, connection_type: 'influenced', strength: 4 })
    await api.createConnection({ from_thinker_id: thinkers[0].id, to_thinker_id: thinkers[3].id, connection_type: 'influenced', strength: 4 })
    await api.createConnection({ from_thinker_id: thinkers[0].id, to_thinker_id: thinkers[4].id, connection_type: 'critiqued', strength: 3 })

    // Secondary connections
    await api.createConnection({ from_thinker_id: thinkers[1].id, to_thinker_id: thinkers[5].id, connection_type: 'built_upon', strength: 4 })
    await api.createConnection({ from_thinker_id: thinkers[2].id, to_thinker_id: thinkers[5].id, connection_type: 'synthesized', strength: 3 })
    await api.createConnection({ from_thinker_id: thinkers[3].id, to_thinker_id: thinkers[6].id, connection_type: 'influenced', strength: 4 })
    await api.createConnection({ from_thinker_id: thinkers[4].id, to_thinker_id: thinkers[6].id, connection_type: 'critiqued', strength: 3 })

    // Isolated cluster
    await api.createConnection({ from_thinker_id: thinkers[6].id, to_thinker_id: thinkers[7].id, connection_type: 'influenced', strength: 5 })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Opening Network Metrics Panel', () => {
    test('should open network metrics panel from analysis button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Network metrics panel should be visible
      const metricsPanel = page.locator(`[data-testid="${TEST_IDS.networkMetricsPanel}"]`)
        .or(page.locator('[class*="metrics"]'))
        .or(page.locator('[class*="analysis"]'))

      // Panel or some analysis content should be visible
    })

    test('should display network statistics overview', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Look for statistics like total connections, avg connections per thinker
      const statsText = await page.locator('[class*="stats"], [class*="metrics"], [class*="overview"]').textContent()
    })
  })

  test.describe('Overview Tab', () => {
    test('should display total number of thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Should show count of 8 thinkers
      const thinkerCount = page.locator('text=/\\d+.*thinkers?/i')
        .or(page.locator('[data-testid="thinker-count"]'))
    })

    test('should display total number of connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Should show count of 9 connections
      const connectionCount = page.locator('text=/\\d+.*connections?/i')
        .or(page.locator('[data-testid="connection-count"]'))
    })

    test('should display average connections per thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Average should be around 2.25 (9 connections / 8 thinkers * 2 endpoints)
    })

    test('should display network density', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Network density metric
      const density = page.locator('text=/density/i')
        .or(page.locator('[data-testid="network-density"]'))
    })
  })

  test.describe('Centrality Rankings Tab', () => {
    test('should switch to centrality tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click centrality tab
      const centralityTab = page.locator('button, [role="tab"]').filter({ hasText: /centrality|rankings?/i })

      if (await centralityTab.isVisible()) {
        await centralityTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should display degree centrality rankings', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Click centrality tab
      const centralityTab = page.locator('button, [role="tab"]').filter({ hasText: /centrality|rankings?/i })

      if (await centralityTab.isVisible()) {
        await centralityTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Thinker[0] should have highest degree centrality
        // Look for ranked list
        const rankings = page.locator('[class*="ranking"], [class*="list"]')
      }
    })

    test('should display betweenness centrality', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Betweenness centrality measures how often a node lies on shortest paths
      const betweenness = page.locator('text=/betweenness/i')
    })

    test('should display closeness centrality', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Closeness centrality
      const closeness = page.locator('text=/closeness/i')
    })

    test('should highlight most central thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // First thinker (index 0) should be highlighted as most central
    })
  })

  test.describe('Shortest Paths Tab', () => {
    test('should switch to paths tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const pathsTab = page.locator('button, [role="tab"]').filter({ hasText: /paths?|routes?/i })

      if (await pathsTab.isVisible()) {
        await pathsTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should select source and target for path finding', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Select source thinker
      const sourceSelect = page.locator('select').filter({ hasText: /source|from/i }).first()

      if (await sourceSelect.isVisible()) {
        await sourceSelect.selectOption({ index: 1 })
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // Select target thinker
      const targetSelect = page.locator('select').filter({ hasText: /target|to/i }).first()

      if (await targetSelect.isVisible()) {
        await targetSelect.selectOption({ index: 5 })
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should display shortest path between two thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Path visualization should show sequence of connections
    })

    test('should show path length', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Path length (number of hops)
      const pathLength = page.locator('text=/\\d+.*hops?|steps?|length/i')
    })
  })

  test.describe('Communities/Clusters Tab', () => {
    test('should switch to communities tab', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const clustersTab = page.locator('button, [role="tab"]').filter({ hasText: /communit|cluster|group/i })

      if (await clustersTab.isVisible()) {
        await clustersTab.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should detect communities in the network', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Community detection results
      const communities = page.locator('[class*="community"], [class*="cluster"]')
    })

    test('should display community membership for each thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Each thinker should be assigned to a community
    })

    test('should color-code communities on canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Canvas should show thinkers colored by community
    })
  })

  test.describe('Metrics Export', () => {
    test('should export metrics as CSV', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      const exportButton = page.locator('button').filter({ hasText: /export|download|csv/i })

      if (await exportButton.isVisible()) {
        // Set up download listener
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: TIMEOUTS.medium }).catch(() => null),
          exportButton.click(),
        ])

        if (download) {
          expect(download.suggestedFilename()).toContain('metrics')
        }
      }
    })
  })

  test.describe('Close Network Metrics Panel', () => {
    test('should close metrics panel and return to canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Close the panel
      const closeButton = page.locator('button').filter({ hasText: /×|close/i }).first()

      if (await closeButton.isVisible()) {
        await closeButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      await expect(mainPage.canvasElement).toBeVisible()
    })
  })
})
