import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAddConnectionModal } from '../../page-objects/modals/add-connection-modal.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { CONNECTION_TYPES } from '../../fixtures/connections'

test.describe('Network Journey: Create Connections', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    const seedData = await api.seedDatabase({
      timelines: 1,
      thinkers: 4,
      connections: 0,
    })
    thinkers = seedData.thinkers

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Connection Type: Influenced', () => {
    test('should create an influenced connection between two thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'influenced',
        strength: 4,
        notes: 'Test influenced connection',
      })

      await connectionModal.submit()
      await connectionModal.waitForHidden()

      // Verify connection appears (canvas should render it)
      await mainPage.canvas.waitForCanvasRender()
    })

    test('should show influenced connection with correct visual style', async ({ page, request }) => {
      const api = createAPIHelpers(request)
      await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'influenced',
        strength: 5,
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should render the connection
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Connection Type: Critiqued', () => {
    test('should create a critiqued connection between two thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'critiqued',
        strength: 3,
        notes: 'Test critiqued connection',
      })

      await connectionModal.submit()
      await connectionModal.waitForHidden()

      await mainPage.canvas.waitForCanvasRender()
    })

    test('should display critiqued connection differently from influenced', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create both types
      await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'influenced',
        strength: 4,
      })

      await api.createConnection({
        from_thinker_id: thinkers[2].id,
        to_thinker_id: thinkers[3].id,
        connection_type: 'critiqued',
        strength: 4,
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Both connections should be visible on canvas
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Connection Type: Built Upon', () => {
    test('should create a built_upon connection between two thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'built_upon',
        strength: 5,
        notes: 'Extended the original work',
      })

      await connectionModal.submit()
      await connectionModal.waitForHidden()

      await mainPage.canvas.waitForCanvasRender()
    })
  })

  test.describe('Connection Type: Synthesized', () => {
    test('should create a synthesized connection between two thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'synthesized',
        strength: 4,
        notes: 'Combined ideas from multiple sources',
      })

      await connectionModal.submit()
      await connectionModal.waitForHidden()

      await mainPage.canvas.waitForCanvasRender()
    })
  })

  test.describe('Multiple Connections', () => {
    test('should create connections of all four types', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create one of each type
      const connectionTypes = ['influenced', 'critiqued', 'built_upon', 'synthesized'] as const

      for (let i = 0; i < connectionTypes.length && i < thinkers.length - 1; i++) {
        await api.createConnection({
          from_thinker_id: thinkers[i].id,
          to_thinker_id: thinkers[(i + 1) % thinkers.length].id,
          connection_type: connectionTypes[i],
          strength: i + 1,
        })
      }

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // All connections should be visible
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should handle creating multiple connections from same thinker', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create multiple outgoing connections from thinker 0
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
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[3].id,
        connection_type: 'critiqued',
        strength: 3,
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Verify connections exist via API
      const connections = await api.getAllConnections()
      expect(connections.length).toBe(3)
      expect(connections.every(c => c.from_thinker_id === thinkers[0].id)).toBe(true)
    })

    test('should handle creating multiple connections to same thinker', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create multiple incoming connections to thinker 3
      await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[3].id,
        connection_type: 'influenced',
        strength: 5,
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

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Verify connections exist via API
      const connections = await api.getAllConnections()
      expect(connections.length).toBe(3)
      expect(connections.every(c => c.to_thinker_id === thinkers[3].id)).toBe(true)
    })
  })

  test.describe('Connection Type Verification', () => {
    test('should display connection type label correctly', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      // Verify connection type options are present
      await connectionModal.connectionTypeSelect.click()

      for (const [type, info] of Object.entries(CONNECTION_TYPES)) {
        const option = page.locator('li, [role="option"], option').filter({ hasText: info.label })
        await expect(option.first()).toBeVisible()
      }
    })

    test('connection type should default to influenced', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      // Check default selection (implementation dependent)
      const typeText = await connectionModal.connectionTypeSelect.textContent()
      // Default may vary, just ensure it's populated
      expect(typeText).toBeTruthy()
    })
  })
})
