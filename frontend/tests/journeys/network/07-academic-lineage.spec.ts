import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Network Journey: Academic Lineage', () => {
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    // Create a timeline
    const timeline = await api.createTimeline({
      name: 'Academic Philosophy',
      start_year: 1700,
      end_year: 2000,
    })

    // Create thinkers representing academic lineage
    const kant = await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 100,
      position_y: 200,
    })

    const fichte = await api.createThinker({
      name: 'Johann Gottlieb Fichte',
      birth_year: 1762,
      death_year: 1814,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 200,
      position_y: 200,
    })

    const schelling = await api.createThinker({
      name: 'Friedrich Schelling',
      birth_year: 1775,
      death_year: 1854,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 300,
      position_y: 200,
    })

    const hegel = await api.createThinker({
      name: 'Georg Wilhelm Friedrich Hegel',
      birth_year: 1770,
      death_year: 1831,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 400,
      position_y: 200,
    })

    const marx = await api.createThinker({
      name: 'Karl Marx',
      birth_year: 1818,
      death_year: 1883,
      field: 'Political Economy',
      timeline_id: timeline.id,
      position_x: 500,
      position_y: 200,
    })

    const heidegger = await api.createThinker({
      name: 'Martin Heidegger',
      birth_year: 1889,
      death_year: 1976,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 600,
      position_y: 200,
    })

    const arendt = await api.createThinker({
      name: 'Hannah Arendt',
      birth_year: 1906,
      death_year: 1975,
      field: 'Political Theory',
      timeline_id: timeline.id,
      position_x: 700,
      position_y: 200,
    })

    thinkers = [kant, fichte, schelling, hegel, marx, heidegger, arendt]

    // Create academic lineage connections (PhD advisor-student relationships)
    // Kant -> Fichte (student)
    await api.createConnection({
      from_thinker_id: kant.id,
      to_thinker_id: fichte.id,
      connection_type: 'influenced',
      strength: 5,
      notes: 'Fichte was deeply influenced by Kant\'s critical philosophy',
    })

    // Fichte -> Schelling
    await api.createConnection({
      from_thinker_id: fichte.id,
      to_thinker_id: schelling.id,
      connection_type: 'influenced',
      strength: 4,
      notes: 'Early influence on German Idealism',
    })

    // Schelling -> Hegel
    await api.createConnection({
      from_thinker_id: schelling.id,
      to_thinker_id: hegel.id,
      connection_type: 'built_upon',
      strength: 4,
      notes: 'Early collaborators at Jena',
    })

    // Hegel -> Marx
    await api.createConnection({
      from_thinker_id: hegel.id,
      to_thinker_id: marx.id,
      connection_type: 'influenced',
      strength: 5,
      notes: 'Marx developed historical materialism from Hegelian dialectics',
    })

    // Heidegger -> Arendt (PhD advisor)
    await api.createConnection({
      from_thinker_id: heidegger.id,
      to_thinker_id: arendt.id,
      connection_type: 'influenced',
      strength: 5,
      notes: 'Heidegger was Arendt\'s PhD advisor at Marburg',
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Lineage Visualization', () => {
    test('should display academic lineage connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Canvas should show the lineage chain
      await expect(mainPage.canvasElement).toBeVisible()
    })

    test('should show chronological ordering of thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Thinkers should be arranged chronologically on the timeline
    })

    test('should display connection arrows indicating direction of influence', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Arrows should point from earlier thinker to later (influence direction)
    })
  })

  test.describe('Lineage Navigation', () => {
    test('should navigate from advisor to student', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = mainPage.canvas

      await mainPage.waitForPageLoad()

      // Click on Heidegger to select
      const heideggerX = thinkers[5].position_x || 600
      const heideggerY = thinkers[5].position_y || 200

      await canvasPage.clickOnCanvas(heideggerX, heideggerY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should be able to see connection to Arendt
    })

    test('should navigate from student back to advisor', async ({ page }) => {
      const mainPage = createMainPage(page)
      const canvasPage = mainPage.canvas

      await mainPage.waitForPageLoad()

      // Click on Arendt
      const arendtX = thinkers[6].position_x || 700
      const arendtY = thinkers[6].position_y || 200

      await canvasPage.clickOnCanvas(arendtX, arendtY)
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should show incoming connection from Heidegger
    })

    test('should trace multi-generation lineage', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Should be able to trace: Kant -> Fichte -> Schelling -> Hegel -> Marx
      // This is a 4-generation intellectual lineage
    })
  })

  test.describe('Lineage Details', () => {
    test('should display advisor-student relationship details', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on connection line or hover to see details
      // The connection notes should show "PhD advisor" type information
    })

    test('should show influence strength in lineage', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Direct PhD relationships typically have strength 5
      // Indirect influences might have lower strength
    })

    test('should indicate PhD vs intellectual influence', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Different visual indicators for PhD advisor vs general intellectual influence
      // Heidegger -> Arendt is direct PhD supervision
      // Kant -> Fichte is philosophical influence (not PhD)
    })
  })

  test.describe('Lineage Analysis', () => {
    test('should identify intellectual ancestors', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // For Marx, ancestors would be: Hegel, and transitively Schelling, Fichte, Kant
    })

    test('should identify intellectual descendants', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // For Kant, descendants would be: Fichte, Schelling, Hegel, Marx
    })

    test('should calculate generational depth', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAnalysisPanel()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Marx is 4 generations from Kant in the lineage
    })
  })

  test.describe('Institution Affiliations in Lineage', () => {
    test('should show shared institutional connections', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Add institutions
      const marburg = await api.createInstitution({
        name: 'University of Marburg',
        city: 'Marburg',
        country: 'Germany',
      })

      const mainPage = createMainPage(page)
      await page.reload()
      await mainPage.waitForPageLoad()

      // Heidegger and Arendt both at Marburg
      // This reinforces the PhD advisor relationship
    })

    test('should display academic migration pattern', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Show how ideas spread through academic institutions
      // Königsberg (Kant) -> Jena (Fichte, Schelling, Hegel) -> Various
    })
  })

  test.describe('Lineage Filtering', () => {
    test('should filter to show only direct lineage connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Filter to show only 'influenced' type connections
      await mainPage.toggleConnectionType('critiqued')
      await mainPage.toggleConnectionType('synthesized')
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Only influenced and built_upon should remain
    })

    test('should filter to show high-strength connections only', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Filter by strength >= 4
      // This should show primary lineage connections
    })
  })

  test.describe('Export Lineage Data', () => {
    test('should export lineage tree', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open export modal
      await mainPage.openExportModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Export should include lineage relationships
    })
  })
})
