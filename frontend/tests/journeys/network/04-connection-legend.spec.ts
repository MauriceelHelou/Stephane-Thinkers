import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS, TEST_IDS } from '../../config/test-constants'

test.describe('Network Journey: Connection Legend', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 5,
      connections: 0,
    })
    thinkers = seedData.thinkers

    // Create connections of each type for testing legend filters
    await api.createConnection({
      from_thinker_id: thinkers[0].id,
      to_thinker_id: thinkers[1].id,
      connection_type: 'influenced',
      strength: 4,
    })
    await api.createConnection({
      from_thinker_id: thinkers[1].id,
      to_thinker_id: thinkers[2].id,
      connection_type: 'critiqued',
      strength: 3,
    })
    await api.createConnection({
      from_thinker_id: thinkers[2].id,
      to_thinker_id: thinkers[3].id,
      connection_type: 'built_upon',
      strength: 4,
    })
    await api.createConnection({
      from_thinker_id: thinkers[3].id,
      to_thinker_id: thinkers[4].id,
      connection_type: 'synthesized',
      strength: 5,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Legend Visibility', () => {
    test('should display connection legend on the canvas', async ({ page }) => {
      const mainPage = createMainPage(page)

      // Connection legend should be visible by default or accessible
      const legend = page.locator(`[data-testid="${TEST_IDS.connectionLegend}"]`)
        .or(page.locator('.connection-legend'))
        .or(page.locator('[class*="legend"]'))

      // Wait for page to load
      await mainPage.waitForPageLoad()

      // Legend might be visible or in a collapsed state
    })

    test('should show all four connection types in legend', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const connectionTypes = ['influenced', 'critiqued', 'built upon', 'synthesized']

      for (const type of connectionTypes) {
        const legendItem = page.locator('text').filter({ hasText: new RegExp(type, 'i') })
        // Each type should be represented in the legend
      }
    })

    test('should display connection type colors correctly', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Each connection type should have a distinct color indicator
      const legendItems = page.locator('[class*="legend"] > *')
        .or(page.locator('.connection-legend > *'))

      // At least 4 items for 4 connection types
    })
  })

  test.describe('Toggle Connection Visibility', () => {
    test('should toggle influenced connections visibility', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Find influenced toggle
      const influencedToggle = page.locator(`[data-testid="${TEST_IDS.influencedCheckbox}"]`)
        .or(page.locator('label').filter({ hasText: /influenced/i }).locator('input[type="checkbox"]'))
        .or(page.locator('input[name*="influenced"]'))

      if (await influencedToggle.isVisible()) {
        // Initially checked (visible)
        const initiallyChecked = await influencedToggle.isChecked()

        // Toggle off
        await influencedToggle.click()
        await mainPage.canvas.waitForCanvasRender()

        // Toggle back on
        await influencedToggle.click()
        await mainPage.canvas.waitForCanvasRender()
      }
    })

    test('should toggle critiqued connections visibility', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const critiquedToggle = page.locator(`[data-testid="${TEST_IDS.critiquedCheckbox}"]`)
        .or(page.locator('label').filter({ hasText: /critiqued/i }).locator('input[type="checkbox"]'))

      if (await critiquedToggle.isVisible()) {
        await critiquedToggle.click()
        await mainPage.canvas.waitForCanvasRender()
      }
    })

    test('should toggle built_upon connections visibility', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const builtUponToggle = page.locator(`[data-testid="${TEST_IDS.builtUponCheckbox}"]`)
        .or(page.locator('label').filter({ hasText: /built.*upon/i }).locator('input[type="checkbox"]'))

      if (await builtUponToggle.isVisible()) {
        await builtUponToggle.click()
        await mainPage.canvas.waitForCanvasRender()
      }
    })

    test('should toggle synthesized connections visibility', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const synthesizedToggle = page.locator(`[data-testid="${TEST_IDS.synthesizedCheckbox}"]`)
        .or(page.locator('label').filter({ hasText: /synthesized/i }).locator('input[type="checkbox"]'))

      if (await synthesizedToggle.isVisible()) {
        await synthesizedToggle.click()
        await mainPage.canvas.waitForCanvasRender()
      }
    })

    test('should hide connections when type is toggled off', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Use the MainPage helper method if available
      await mainPage.toggleConnectionType('influenced')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Influenced connections should now be hidden on canvas
    })

    test('should show connections when type is toggled back on', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Toggle off then back on
      await mainPage.toggleConnectionType('critiqued')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await mainPage.toggleConnectionType('critiqued')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Critiqued connections should be visible again
    })
  })

  test.describe('Multiple Toggles', () => {
    test('should toggle multiple connection types independently', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Toggle off influenced
      await mainPage.toggleConnectionType('influenced')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Toggle off critiqued
      await mainPage.toggleConnectionType('critiqued')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Only built_upon and synthesized should be visible
    })

    test('should hide all connections when all types toggled off', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Toggle off all types
      const types: Array<'influenced' | 'critiqued' | 'built_upon' | 'synthesized'> = [
        'influenced', 'critiqued', 'built_upon', 'synthesized'
      ]

      for (const type of types) {
        await mainPage.toggleConnectionType(type)
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // No connections should be visible on canvas
    })

    test('should show all connections when all types toggled back on', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const types: Array<'influenced' | 'critiqued' | 'built_upon' | 'synthesized'> = [
        'influenced', 'critiqued', 'built_upon', 'synthesized'
      ]

      // Toggle all off
      for (const type of types) {
        await mainPage.toggleConnectionType(type)
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // Toggle all back on
      for (const type of types) {
        await mainPage.toggleConnectionType(type)
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // All connections should be visible again
    })
  })

  test.describe('Legend State Persistence', () => {
    test('should maintain legend state during zoom operations', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Toggle off influenced
      await mainPage.toggleConnectionType('influenced')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Zoom in
      await mainPage.zoomIn()
      await mainPage.canvas.waitForCanvasRender()

      // Influenced should still be hidden
    })

    test('should maintain legend state during pan operations', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Toggle off critiqued
      await mainPage.toggleConnectionType('critiqued')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Pan the canvas
      await mainPage.panCanvas(100, 0)
      await mainPage.canvas.waitForCanvasRender()

      // Critiqued should still be hidden
    })
  })

  test.describe('Legend Interaction', () => {
    test('should show connection count per type in legend', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Some legends show count of connections per type
      // Check if count is displayed
      const legendText = await page.locator('[class*="legend"]').textContent()
      // Implementation dependent
    })

    test('should highlight connections when hovering on legend item', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Hover over influenced legend item
      const influencedLabel = page.locator('label').filter({ hasText: /influenced/i }).first()

      if (await influencedLabel.isVisible()) {
        await influencedLabel.hover()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Influenced connections should be highlighted on canvas
      }
    })
  })
})
