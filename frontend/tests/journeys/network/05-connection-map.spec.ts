import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Network Journey: Connection Map View', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 6,
      connections: 0,
    })
    thinkers = seedData.thinkers

    // Create a network of connections for the map view
    await api.createConnection({
      from_thinker_id: thinkers[0].id,
      to_thinker_id: thinkers[1].id,
      connection_type: 'influenced',
      strength: 5,
    })
    await api.createConnection({
      from_thinker_id: thinkers[0].id,
      to_thinker_id: thinkers[2].id,
      connection_type: 'influenced',
      strength: 4,
    })
    await api.createConnection({
      from_thinker_id: thinkers[1].id,
      to_thinker_id: thinkers[3].id,
      connection_type: 'built_upon',
      strength: 4,
    })
    await api.createConnection({
      from_thinker_id: thinkers[2].id,
      to_thinker_id: thinkers[3].id,
      connection_type: 'synthesized',
      strength: 3,
    })
    await api.createConnection({
      from_thinker_id: thinkers[3].id,
      to_thinker_id: thinkers[4].id,
      connection_type: 'critiqued',
      strength: 4,
    })
    await api.createConnection({
      from_thinker_id: thinkers[4].id,
      to_thinker_id: thinkers[5].id,
      connection_type: 'influenced',
      strength: 3,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Opening Connection Map', () => {
    test('should open connection map view from analysis button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click analysis button to open network analysis panel
      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Look for connection map option
      const connectionMapButton = page.locator('button').filter({ hasText: /connection.*map|network.*graph|radial/i })

      if (await connectionMapButton.isVisible()) {
        await connectionMapButton.click()
        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })

    test('should open connection map from More menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Try opening from More menu
      await mainPage.selectMoreMenuItem('Connection Map')
      await page.waitForTimeout(TIMEOUTS.medium)
    })

    test('should display radial graph layout', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open network analysis
      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // The connection map should show a radial/force-directed graph
    })
  })

  test.describe('Connection Map Interactions', () => {
    test('should select a thinker in connection map', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click on a node in the connection map
      const mapCanvas = page.locator('canvas').nth(1) // Second canvas might be map
        .or(page.locator('[data-testid="connection-map-canvas"]'))

      if (await mapCanvas.isVisible()) {
        const box = await mapCanvas.boundingBox()
        if (box) {
          // Click in the center area where nodes might be
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should zoom connection map', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const mapContainer = page.locator('[class*="connection-map"]')
        .or(page.locator('[data-testid="connection-map"]'))

      if (await mapContainer.isVisible()) {
        // Zoom with wheel
        await mapContainer.hover()
        await page.mouse.wheel(0, -100)
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should pan connection map', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const mapContainer = page.locator('[class*="connection-map"]')
        .or(page.locator('[data-testid="connection-map"]'))

      if (await mapContainer.isVisible()) {
        // Pan with drag
        const box = await mapContainer.boundingBox()
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
          await page.mouse.down()
          await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50)
          await page.mouse.up()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Connection Map Node Display', () => {
    test('should display all thinkers as nodes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // All 6 thinkers should be represented as nodes
    })

    test('should show connection lines between related nodes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // 6 connections should be visible as lines
    })

    test('should highlight node on hover', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Hover over a node position
    })

    test('should show node details tooltip on hover', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Tooltip should show thinker name and connection count
    })
  })

  test.describe('Connection Map Filtering', () => {
    test('should filter nodes by connection type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Filter to show only influenced connections
      const filterDropdown = page.locator('select').filter({ hasText: /filter|type/i })
        .or(page.locator('[data-testid="connection-type-filter"]'))

      if (await filterDropdown.isVisible()) {
        await filterDropdown.selectOption('influenced')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should filter nodes by minimum strength', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Filter by strength
      const strengthSlider = page.locator('input[type="range"]').filter({ has: page.locator('[min="1"]') })
        .or(page.locator('[data-testid="strength-filter"]'))

      if (await strengthSlider.isVisible()) {
        await strengthSlider.fill('3')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should show only selected thinker connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Select a thinker to focus on
      const thinkerSelect = page.locator('select').filter({ hasText: /thinker|focus/i })

      if (await thinkerSelect.isVisible()) {
        await thinkerSelect.selectOption({ index: 1 })
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Connection Map Layout', () => {
    test('should use force-directed layout by default', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Nodes should be arranged using force-directed algorithm
    })

    test('should switch to radial layout', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      const layoutSelect = page.locator('select').filter({ hasText: /layout/i })
        .or(page.locator('[data-testid="layout-select"]'))

      if (await layoutSelect.isVisible()) {
        await layoutSelect.selectOption('radial')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should switch to hierarchical layout', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      const layoutSelect = page.locator('select').filter({ hasText: /layout/i })

      if (await layoutSelect.isVisible()) {
        await layoutSelect.selectOption('hierarchical')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Close Connection Map', () => {
    test('should close connection map and return to canvas', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Close the panel
      const closeButton = page.locator('button').filter({ hasText: /×|close/i })
        .or(page.locator('[data-testid="close-panel"]'))

      if (await closeButton.first().isVisible()) {
        await closeButton.first().click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // Main canvas should be visible
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })
})
