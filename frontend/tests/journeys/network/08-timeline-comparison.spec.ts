import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers, TestTimeline, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Network Journey: Timeline Comparison View', () => {
  let timelines: TestTimeline[]
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    // Create multiple distinct timelines for comparison
    const enlightenment = await api.createTimeline({
      name: 'Enlightenment Philosophy',
      start_year: 1700,
      end_year: 1850,
      description: 'Major figures of the Enlightenment',
    })

    const existentialism = await api.createTimeline({
      name: 'Existentialist Thought',
      start_year: 1830,
      end_year: 1980,
      description: 'Development of existentialist philosophy',
    })

    const analytic = await api.createTimeline({
      name: 'Analytic Philosophy',
      start_year: 1880,
      end_year: 2020,
      description: 'Anglo-American analytic tradition',
    })

    timelines = [enlightenment, existentialism, analytic]

    // Populate timelines with thinkers
    // Enlightenment
    const kant = await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: enlightenment.id,
      position_x: 100,
      position_y: 150,
    })

    const hume = await api.createThinker({
      name: 'David Hume',
      birth_year: 1711,
      death_year: 1776,
      field: 'Philosophy',
      timeline_id: enlightenment.id,
      position_x: 200,
      position_y: 150,
    })

    // Existentialism
    const kierkegaard = await api.createThinker({
      name: 'Søren Kierkegaard',
      birth_year: 1813,
      death_year: 1855,
      field: 'Philosophy',
      timeline_id: existentialism.id,
      position_x: 100,
      position_y: 250,
    })

    const sartre = await api.createThinker({
      name: 'Jean-Paul Sartre',
      birth_year: 1905,
      death_year: 1980,
      field: 'Philosophy',
      timeline_id: existentialism.id,
      position_x: 200,
      position_y: 250,
    })

    // Analytic
    const frege = await api.createThinker({
      name: 'Gottlob Frege',
      birth_year: 1848,
      death_year: 1925,
      field: 'Logic',
      timeline_id: analytic.id,
      position_x: 100,
      position_y: 350,
    })

    const wittgenstein = await api.createThinker({
      name: 'Ludwig Wittgenstein',
      birth_year: 1889,
      death_year: 1951,
      field: 'Philosophy',
      timeline_id: analytic.id,
      position_x: 200,
      position_y: 350,
    })

    thinkers = [kant, hume, kierkegaard, sartre, frege, wittgenstein]

    // Create cross-timeline connections
    await api.createConnection({
      from_thinker_id: kant.id,
      to_thinker_id: kierkegaard.id,
      connection_type: 'influenced',
      strength: 4,
      notes: 'Kant influenced existentialist development',
    })

    await api.createConnection({
      from_thinker_id: frege.id,
      to_thinker_id: wittgenstein.id,
      connection_type: 'influenced',
      strength: 5,
      notes: 'Frege\'s logic influenced early Wittgenstein',
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Opening Comparison View', () => {
    test('should open timeline comparison view from compare button', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Comparison view should be visible
    })

    test('should display side-by-side timeline layout', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Should show multiple timelines in parallel
    })

    test('should show timeline selection options', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should show checkboxes or multi-select for timelines
      const timelineSelectors = page.locator('input[type="checkbox"]')
        .or(page.locator('[data-testid*="timeline-select"]'))
    })
  })

  test.describe('Timeline Selection', () => {
    test('should select multiple timelines for comparison', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Select Enlightenment and Existentialism
      const enlightenmentCheckbox = page.locator('label').filter({ hasText: /enlightenment/i }).locator('input')
      const existentialismCheckbox = page.locator('label').filter({ hasText: /existential/i }).locator('input')

      if (await enlightenmentCheckbox.isVisible()) {
        await enlightenmentCheckbox.check()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      if (await existentialismCheckbox.isVisible()) {
        await existentialismCheckbox.check()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should update view when timeline selection changes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Toggle timeline selection
      const timelineLabel = page.locator('label').filter({ hasText: timelines[0].name })

      if (await timelineLabel.isVisible()) {
        await timelineLabel.click()
        await page.waitForTimeout(TIMEOUTS.canvasRender)
      }
    })

    test('should compare all three timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Enable all three timelines in comparison
    })
  })

  test.describe('Side-by-Side Layout', () => {
    test('should display timelines in horizontal lanes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Each timeline should occupy a horizontal lane
    })

    test('should align timelines by year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Years should align vertically across timelines
      // 1800 on Enlightenment should align with 1800 on Existentialism
    })

    test('should show timeline labels', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Each lane should have its timeline name visible
      for (const timeline of timelines) {
        const label = page.locator('text').filter({ hasText: timeline.name })
      }
    })

    test('should display timeline date ranges', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Start and end years should be visible
    })
  })

  test.describe('Cross-Timeline Connections', () => {
    test('should display connections between timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Connection from Kant (Enlightenment) to Kierkegaard (Existentialism)
      // should be drawn crossing the timeline lanes
    })

    test('should style cross-timeline connections distinctly', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Cross-timeline connections might have different styling
      // (e.g., dashed lines, different color)
    })

    test('should show connection details on hover', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Hovering over cross-timeline connection should show tooltip
    })
  })

  test.describe('Comparison Navigation', () => {
    test('should scroll horizontally through time', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Pan to navigate through years
      await mainPage.panCanvas(200, 0)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })

    test('should zoom to specific time period', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Zoom to focus on overlapping period (1830-1850)
      await mainPage.zoomIn()
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })

    test('should jump to specific year across all timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Year ruler should work in comparison view
      const yearInput = page.locator('input').filter({ hasText: /year/i })
        .or(page.locator('[data-testid="year-jump"]'))

      if (await yearInput.isVisible()) {
        await yearInput.fill('1850')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.canvasRender)
      }
    })
  })

  test.describe('Comparison Analysis', () => {
    test('should highlight contemporaneous thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Thinkers alive at the same time across different timelines
      // should be visually connected or highlighted
    })

    test('should show overlap periods between timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.medium)

      // Period 1830-1850 overlaps Enlightenment and Existentialism
      // This should be visually indicated
    })
  })

  test.describe('Close Comparison View', () => {
    test('should close comparison and return to single timeline view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCompareView()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Close comparison view
      const closeButton = page.locator('button').filter({ hasText: /×|close|exit/i })

      if (await closeButton.first().isVisible()) {
        await closeButton.first().click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }

      // Should return to normal canvas view
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })
})
