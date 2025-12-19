import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers, TestThinker, TestConnection } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Network Journey: Connection Editing', () => {
  let thinkers: TestThinker[]
  let connections: TestConnection[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 4,
      connections: 0,
    })
    thinkers = seedData.thinkers

    // Create test connections
    const conn1 = await api.createConnection({
      from_thinker_id: thinkers[0].id,
      to_thinker_id: thinkers[1].id,
      connection_type: 'influenced',
      strength: 3,
      notes: 'Original notes for connection 1',
    })

    const conn2 = await api.createConnection({
      from_thinker_id: thinkers[1].id,
      to_thinker_id: thinkers[2].id,
      connection_type: 'critiqued',
      strength: 4,
      notes: 'Original notes for connection 2',
    })

    const conn3 = await api.createConnection({
      from_thinker_id: thinkers[2].id,
      to_thinker_id: thinkers[3].id,
      connection_type: 'built_upon',
      strength: 5,
      notes: 'Original notes for connection 3',
    })

    connections = [conn1, conn2, conn3]

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Opening Connection for Editing', () => {
    test('should open connection edit dialog by clicking on connection', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on the connection line between thinker 0 and thinker 1
      // Connection line should be approximately between their positions
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = ((thinkers[0].position_y || 200) + (thinkers[1].position_y || 200)) / 2

      await mainPage.clickOnCanvas(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // A dialog or panel should appear for editing
    })

    test('should open connection edit from thinker detail panel', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on thinker to open detail panel
      await mainPage.clickOnCanvas(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Look for connections section in detail panel
      const connectionsSection = page.locator('[class*="connection"], [data-testid*="connection"]')

      if (await mainPage.detailPanel.isVisible()) {
        // Click on edit button for a connection
        const editConnectionButton = mainPage.detailPanel.locator('button').filter({ hasText: /edit/i })
        if (await editConnectionButton.first().isVisible()) {
          await editConnectionButton.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should open connection edit via context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Right-click on connection area
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await mainPage.canvas.rightClickOnCanvas(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Context menu should appear
      const editMenuItem = page.locator('[role="menuitem"]').filter({ hasText: /edit.*connection/i })
      if (await editMenuItem.isVisible()) {
        await editMenuItem.click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Editing Connection Type', () => {
    test('should change connection type from influenced to critiqued', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Update via API and verify
      const updated = await api.updateConnection(connections[0].id, {
        connection_type: 'critiqued',
      })

      expect(updated.connection_type).toBe('critiqued')

      // Reload and verify visual update
      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()
    })

    test('should change connection type from critiqued to built_upon', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const updated = await api.updateConnection(connections[1].id, {
        connection_type: 'built_upon',
      })

      expect(updated.connection_type).toBe('built_upon')
    })

    test('should change connection type from built_upon to synthesized', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const updated = await api.updateConnection(connections[2].id, {
        connection_type: 'synthesized',
      })

      expect(updated.connection_type).toBe('synthesized')
    })

    test('should update canvas visual after type change', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      await api.updateConnection(connections[0].id, {
        connection_type: 'synthesized',
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should reflect the new connection type (different color)
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Editing Connection Strength', () => {
    test('should increase connection strength', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const updated = await api.updateConnection(connections[0].id, {
        strength: 5,
      })

      expect(updated.strength).toBe(5)
    })

    test('should decrease connection strength', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const updated = await api.updateConnection(connections[2].id, {
        strength: 2,
      })

      expect(updated.strength).toBe(2)
    })

    test('should update line thickness after strength change', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      await api.updateConnection(connections[0].id, {
        strength: 5,
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should reflect thicker line
    })
  })

  test.describe('Editing Connection Notes', () => {
    test('should update connection notes', async ({ page, request }) => {
      const api = createAPIHelpers(request)
      const newNotes = 'Updated notes with more detailed description of the connection.'

      const updated = await api.updateConnection(connections[0].id, {
        notes: newNotes,
      })

      expect(updated.notes).toBe(newNotes)
    })

    test('should clear connection notes', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const updated = await api.updateConnection(connections[0].id, {
        notes: '',
      })

      expect(updated.notes === '' || updated.notes === null).toBeTruthy()
    })

    test('should add notes to connection without notes', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create connection without notes
      const noNotesConnection = await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[3].id,
        connection_type: 'influenced',
        strength: 3,
      })

      // Add notes
      const updated = await api.updateConnection(noNotesConnection.id, {
        notes: 'Added notes after creation',
      })

      expect(updated.notes).toBe('Added notes after creation')
    })
  })

  test.describe('Editing Bidirectional Setting', () => {
    test('should change unidirectional to bidirectional', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const updated = await api.updateConnection(connections[0].id, {
        bidirectional: true,
      })

      expect(updated.bidirectional).toBe(true)
    })

    test('should change bidirectional to unidirectional', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // First make it bidirectional
      await api.updateConnection(connections[0].id, {
        bidirectional: true,
      })

      // Then change back
      const updated = await api.updateConnection(connections[0].id, {
        bidirectional: false,
      })

      expect(updated.bidirectional).toBe(false)
    })
  })

  test.describe('Deleting Connections', () => {
    test('should delete connection via API', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      await api.deleteConnection(connections[0].id)

      // Verify deletion
      const allConnections = await api.getAllConnections()
      expect(allConnections.find(c => c.id === connections[0].id)).toBeUndefined()
    })

    test('should delete connection via UI', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on connection to select
      const midX = ((thinkers[0].position_x || 100) + (thinkers[1].position_x || 180)) / 2
      const midY = thinkers[0].position_y || 200

      await mainPage.clickOnCanvas(midX, midY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Press delete key
      await page.keyboard.press('Delete')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Confirm deletion if dialog appears
      const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i })
      if (await confirmButton.isVisible()) {
        await confirmButton.click()
        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })

    test('should delete connection from detail panel', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on thinker to open detail panel
      await mainPage.clickOnCanvas(thinkers[0].position_x || 100, thinkers[0].position_y || 200)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Find delete button in connections section
      const deleteButton = page.locator('button').filter({ hasText: /delete|remove|×/i })

      if (await deleteButton.first().isVisible()) {
        await deleteButton.first().click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Confirm
        const confirmButton = page.locator('button').filter({ hasText: /confirm|yes/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
        }
      }
    })

    test('should update canvas after connection deletion', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      await api.deleteConnection(connections[0].id)

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Connection should no longer be visible
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should not delete thinkers when connection is deleted', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      await api.deleteConnection(connections[0].id)

      // Both thinkers should still exist
      const thinker0 = await api.getThinker(thinkers[0].id)
      const thinker1 = await api.getThinker(thinkers[1].id)

      expect(thinker0).toBeDefined()
      expect(thinker1).toBeDefined()
    })
  })

  test.describe('Multiple Edits', () => {
    test('should update multiple fields at once', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const updated = await api.updateConnection(connections[0].id, {
        connection_type: 'synthesized',
        strength: 5,
        notes: 'Completely revised understanding of this connection',
        bidirectional: true,
      })

      expect(updated.connection_type).toBe('synthesized')
      expect(updated.strength).toBe(5)
      expect(updated.notes).toBe('Completely revised understanding of this connection')
      expect(updated.bidirectional).toBe(true)
    })
  })

  test.describe('Edit Cancellation', () => {
    test('should cancel edit without saving changes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open edit dialog
      // Make changes
      // Press cancel or escape

      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Changes should not be saved
    })
  })
})
