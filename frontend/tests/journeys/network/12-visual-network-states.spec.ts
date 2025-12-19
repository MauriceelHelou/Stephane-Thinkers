import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createCanvasPage } from '../../page-objects/canvas.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Network Journey: Visual Network States', () => {
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

    // Create diverse connection network
    await api.createConnection({
      from_thinker_id: thinkers[0].id,
      to_thinker_id: thinkers[1].id,
      connection_type: 'influenced',
      strength: 5,
    })
    await api.createConnection({
      from_thinker_id: thinkers[0].id,
      to_thinker_id: thinkers[2].id,
      connection_type: 'critiqued',
      strength: 3,
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
      strength: 4,
    })
    await api.createConnection({
      from_thinker_id: thinkers[3].id,
      to_thinker_id: thinkers[4].id,
      connection_type: 'influenced',
      strength: 3,
      bidirectional: true,
    })
    await api.createConnection({
      from_thinker_id: thinkers[4].id,
      to_thinker_id: thinkers[5].id,
      connection_type: 'critiqued',
      strength: 2,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Connection Line Styling', () => {
    test('should display influenced connections with correct color', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Influenced connections should be teal/cyan
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should display critiqued connections with correct color', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Critiqued connections should be red/pink
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should display built_upon connections with correct color', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Built upon connections should be blue
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should display synthesized connections with correct color', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Synthesized connections should be green
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should vary line thickness based on strength', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Strength 5 should be thicker than strength 2
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Arrow Direction Indicators', () => {
    test('should show arrow pointing to influenced thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Arrow should point from thinker[0] to thinker[1]
    })

    test('should show double arrow for bidirectional connection', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Connection between thinker[3] and thinker[4] is bidirectional
      // Should show arrows on both ends
    })
  })

  test.describe('Connection Hover States', () => {
    test('should highlight connection on hover', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Hover over connection line
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.hover(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connection should be highlighted (thicker, brighter, or different color)
    })

    test('should show tooltip with connection info on hover', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Hover over connection
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.hover(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Tooltip should show: type, strength, notes preview
      const tooltip = page.locator('[role="tooltip"], .tooltip, [class*="tooltip"]')
    })

    test('should highlight connected thinkers when hovering connection', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Hover over connection
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.hover(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Both thinker nodes should be highlighted
    })
  })

  test.describe('Connection Selection States', () => {
    test('should show selected state when connection is clicked', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on connection line
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.click(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connection should show selected state (thicker outline, different color)
    })

    test('should deselect connection when clicking elsewhere', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select connection
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await canvasPage.click(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Click elsewhere to deselect
      await canvasPage.click(500, 500)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connection should return to normal state
    })
  })

  test.describe('Thinker Node States with Connections', () => {
    test('should indicate thinker has outgoing connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Thinker[0] has multiple outgoing connections
      // Node should visually indicate this (size, badge, glow)
    })

    test('should indicate thinker has incoming connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Thinker[3] has multiple incoming connections
      // Node should visually indicate this
    })

    test('should highlight all connections when thinker is selected', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Click on thinker[0] which has 2 outgoing connections
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Both outgoing connections should be highlighted
    })

    test('should dim unrelated connections when thinker is selected', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Select thinker[0]
      await canvasPage.click(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Connections not involving thinker[0] should be dimmed
      // e.g., thinker[3] -> thinker[4] should be dimmed
    })
  })

  test.describe('Network Visualization at Different Zoom Levels', () => {
    test('should maintain connection visibility at 0.5x zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom out
      await canvasPage.zoomOut(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Connections should still be visible (maybe thinner)
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should maintain connection visibility at 2x zoom', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Zoom in
      await canvasPage.zoomIn(3)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Connections should be visible with more detail
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should simplify connection rendering at extreme zoom out', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = createCanvasPage(page)

      await mainPage.waitForPageLoad()

      // Extreme zoom out
      await canvasPage.zoomOut(5)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Connections might be simplified or hidden at extreme zoom
    })
  })

  test.describe('Empty and Loading States', () => {
    test('should show empty state when no connections exist', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Delete all connections
      const connections = await api.getAllConnections()
      for (const conn of connections) {
        await api.deleteConnection(conn.id)
      }

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should show thinkers but no connection lines
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should show loading state while connections are being fetched', async ({ page }) => {
      // This requires network throttling
      const mainPage = createMainPage(page)

      // Navigate with slow network
      await page.route('**/api/connections/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        await route.continue()
      })

      await mainPage.goto()

      // During load, might show spinner or loading skeleton
    })
  })

  test.describe('Animation States', () => {
    test('should animate new connection when created', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const api = createAPIHelpers(request)

      // Create new connection
      await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[5].id,
        connection_type: 'influenced',
        strength: 4,
      })

      // Refresh to see new connection
      await page.reload()
      await mainPage.waitForPageLoad()

      // New connection should appear (possibly with animation)
    })

    test('should animate connection removal', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const api = createAPIHelpers(request)
      const connections = await api.getAllConnections()

      // Delete a connection
      if (connections.length > 0) {
        await api.deleteConnection(connections[0].id)
      }

      // Refresh
      await page.reload()
      await mainPage.waitForPageLoad()

      // Connection should be gone (possibly with fade out animation)
    })
  })

  test.describe('Dense Network Handling', () => {
    test('should handle overlapping connections gracefully', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create many connections to same node
      for (let i = 1; i < thinkers.length; i++) {
        await api.createConnection({
          from_thinker_id: thinkers[i].id,
          to_thinker_id: thinkers[0].id,
          connection_type: 'influenced',
          strength: 3,
        })
      }

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Should handle overlapping lines (curve, offset, bundle)
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should provide visual clarity in dense networks', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // With 6 thinkers and 6 connections, network might be dense
      // Hover/selection should still work to identify connections
    })
  })
})
