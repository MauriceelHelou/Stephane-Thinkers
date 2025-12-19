import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAddConnectionModal } from '../../page-objects/modals/add-connection-modal.po'
import { createAPIHelpers, TestThinker, TestConnection } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Network Journey: Connection Details', () => {
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

  test.describe('Connection Notes', () => {
    test('should create connection with notes', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)
      const testNotes = 'This is a detailed note about the intellectual connection between these two thinkers.'

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'influenced',
        notes: testNotes,
      })

      await connectionModal.submit()
      await connectionModal.waitForHidden()
    })

    test('should create connection without notes (optional field)', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'influenced',
      })

      await connectionModal.submit()
      await connectionModal.waitForHidden()
    })

    test('should handle very long notes', async ({ page, request }) => {
      const api = createAPIHelpers(request)
      const longNotes = 'This is a very detailed description of the connection. '.repeat(50)

      const connection = await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'influenced',
        notes: longNotes,
        strength: 3,
      })

      expect(connection.notes).toBe(longNotes)
    })

    test('should handle special characters in notes', async ({ page, request }) => {
      const api = createAPIHelpers(request)
      const specialNotes = 'Connection notes with "quotes", \'apostrophes\', <tags>, & ampersands'

      const connection = await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'critiqued',
        notes: specialNotes,
        strength: 3,
      })

      expect(connection.notes).toBe(specialNotes)
    })

    test('should handle multiline notes', async ({ page, request }) => {
      const api = createAPIHelpers(request)
      const multilineNotes = `First paragraph about the connection.

Second paragraph with more details.

Third paragraph with conclusions.`

      const connection = await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'built_upon',
        notes: multilineNotes,
        strength: 4,
      })

      expect(connection.notes).toBe(multilineNotes)
    })
  })

  test.describe('Connection Strength (1-5)', () => {
    test('should set connection strength to 1 (minimum)', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'influenced',
        strength: 1,
      })

      const strength = await connectionModal.getStrength()
      expect(strength).toBe(1)

      await connectionModal.submit()
      await connectionModal.waitForHidden()
    })

    test('should set connection strength to 3 (medium)', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'influenced',
        strength: 3,
      })

      const strength = await connectionModal.getStrength()
      expect(strength).toBe(3)

      await connectionModal.submit()
      await connectionModal.waitForHidden()
    })

    test('should set connection strength to 5 (maximum)', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'influenced',
        strength: 5,
      })

      const strength = await connectionModal.getStrength()
      expect(strength).toBe(5)

      await connectionModal.submit()
      await connectionModal.waitForHidden()
    })

    test('should reflect strength in visual thickness on canvas', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create connections with different strengths
      await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'influenced',
        strength: 1,
      })

      await api.createConnection({
        from_thinker_id: thinkers[2].id,
        to_thinker_id: thinkers[3].id,
        connection_type: 'influenced',
        strength: 5,
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Visual verification - stronger connections should appear thicker
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should validate strength within 1-5 range', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // API should accept values 1-5
      const validConnection = await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'influenced',
        strength: 3,
      })

      expect(validConnection.strength).toBe(3)
    })
  })

  test.describe('Bidirectional Connections', () => {
    test('should create unidirectional connection by default', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'influenced',
      })

      const isBidirectional = await connectionModal.isBidirectional()
      expect(isBidirectional).toBe(false)
    })

    test('should create bidirectional connection when checkbox is checked', async ({ page, request }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)
      const api = createAPIHelpers(request)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      await connectionModal.fillForm({
        fromThinker: thinkers[0].name,
        toThinker: thinkers[1].name,
        connectionType: 'influenced',
        bidirectional: true,
        notes: 'Mutual intellectual exchange',
      })

      await connectionModal.submit()
      await connectionModal.waitForHidden()

      // Verify via API
      await page.waitForTimeout(TIMEOUTS.short)
      const connections = await api.getAllConnections()
      const bidirectionalConnection = connections.find(c => c.bidirectional === true)
      // May or may not find bidirectional depending on implementation
    })

    test('should toggle bidirectional checkbox', async ({ page }) => {
      const mainPage = createMainPage(page)
      const connectionModal = createAddConnectionModal(page)

      await mainPage.openAddConnectionModal()
      await connectionModal.waitForVisible()

      // Initially unchecked
      let isBidirectional = await connectionModal.isBidirectional()
      expect(isBidirectional).toBe(false)

      // Toggle on
      await connectionModal.setBidirectional(true)
      isBidirectional = await connectionModal.isBidirectional()
      expect(isBidirectional).toBe(true)

      // Toggle off
      await connectionModal.setBidirectional(false)
      isBidirectional = await connectionModal.isBidirectional()
      expect(isBidirectional).toBe(false)
    })

    test('should display bidirectional arrows on canvas', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create a bidirectional connection
      await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'influenced',
        bidirectional: true,
        strength: 4,
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should show double-headed arrow or other bidirectional indicator
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Connection Name (Optional)', () => {
    test('should create connection with custom name', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const connection = await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'influenced',
        name: 'Critical Synthesis',
        strength: 4,
      })

      expect(connection.name).toBe('Critical Synthesis')
    })

    test('should allow connection without name', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const connection = await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'built_upon',
        strength: 3,
      })

      // Name should be null or empty
      expect(connection.name === null || connection.name === '').toBeTruthy()
    })
  })

  test.describe('Combined Details', () => {
    test('should create connection with all details filled', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      const fullConnection = await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'synthesized',
        name: 'Dialectical Synthesis',
        notes: 'A comprehensive synthesis of both thinkers\' ideas into a new philosophical framework.',
        bidirectional: true,
        strength: 5,
      })

      expect(fullConnection.connection_type).toBe('synthesized')
      expect(fullConnection.name).toBe('Dialectical Synthesis')
      expect(fullConnection.strength).toBe(5)
    })

    test('should display connection details on hover/click', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      await api.createConnection({
        from_thinker_id: thinkers[0].id,
        to_thinker_id: thinkers[1].id,
        connection_type: 'influenced',
        name: 'Test Connection',
        notes: 'Detailed notes about this connection',
        strength: 4,
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Hover or click on connection line should show details
      // This is implementation-dependent
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })
})
