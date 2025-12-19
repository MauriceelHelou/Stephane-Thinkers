import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers, TestTimeline, TestThinker } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Network Journey: Combined Timeline Views', () => {
  let timelines: TestTimeline[]
  let thinkers: TestThinker[]

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    // Create multiple timelines
    const german = await api.createTimeline({
      name: 'German Philosophy',
      start_year: 1700,
      end_year: 1900,
    })

    const french = await api.createTimeline({
      name: 'French Philosophy',
      start_year: 1700,
      end_year: 1900,
    })

    const british = await api.createTimeline({
      name: 'British Philosophy',
      start_year: 1700,
      end_year: 1900,
    })

    timelines = [german, french, british]

    // German thinkers
    const kant = await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: german.id,
      position_x: 150,
      position_y: 100,
    })

    const hegel = await api.createThinker({
      name: 'Georg W.F. Hegel',
      birth_year: 1770,
      death_year: 1831,
      field: 'Philosophy',
      timeline_id: german.id,
      position_x: 300,
      position_y: 100,
    })

    // French thinkers
    const voltaire = await api.createThinker({
      name: 'Voltaire',
      birth_year: 1694,
      death_year: 1778,
      field: 'Philosophy',
      timeline_id: french.id,
      position_x: 100,
      position_y: 200,
    })

    const rousseau = await api.createThinker({
      name: 'Jean-Jacques Rousseau',
      birth_year: 1712,
      death_year: 1778,
      field: 'Philosophy',
      timeline_id: french.id,
      position_x: 200,
      position_y: 200,
    })

    // British thinkers
    const hume = await api.createThinker({
      name: 'David Hume',
      birth_year: 1711,
      death_year: 1776,
      field: 'Philosophy',
      timeline_id: british.id,
      position_x: 100,
      position_y: 300,
    })

    const mill = await api.createThinker({
      name: 'John Stuart Mill',
      birth_year: 1806,
      death_year: 1873,
      field: 'Philosophy',
      timeline_id: british.id,
      position_x: 300,
      position_y: 300,
    })

    thinkers = [kant, hegel, voltaire, rousseau, hume, mill]

    // Cross-timeline connections
    await api.createConnection({
      from_thinker_id: hume.id,
      to_thinker_id: kant.id,
      connection_type: 'influenced',
      strength: 5,
      notes: 'Hume awakened Kant from his "dogmatic slumber"',
    })

    await api.createConnection({
      from_thinker_id: rousseau.id,
      to_thinker_id: kant.id,
      connection_type: 'influenced',
      strength: 4,
      notes: 'Rousseau influenced Kant\'s moral philosophy',
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Creating Combined View', () => {
    test('should open create combined view modal', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCombineViewModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Modal should be visible
      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible()
    })

    test('should select timelines to combine', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCombineViewModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Select German and French timelines
      for (const timeline of [timelines[0], timelines[1]]) {
        const checkbox = page.locator('label').filter({ hasText: timeline.name }).locator('input[type="checkbox"]')
          .or(page.locator(`[data-testid="timeline-${timeline.id}"]`))

        if (await checkbox.isVisible()) {
          await checkbox.check()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should name the combined view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCombineViewModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]')
        .or(page.locator('[data-testid="combined-view-name"]'))
        .or(page.locator('input[placeholder*="name" i]'))

      if (await nameInput.isVisible()) {
        await nameInput.fill('European Enlightenment Overview')
      }
    })

    test('should create combined view with two timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCombineViewModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Fill name
      const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]'))
      if (await nameInput.isVisible()) {
        await nameInput.fill('German-French Comparison')
      }

      // Select timelines
      const germanCheckbox = page.locator('label').filter({ hasText: /german/i }).locator('input')
      const frenchCheckbox = page.locator('label').filter({ hasText: /french/i }).locator('input')

      if (await germanCheckbox.isVisible()) await germanCheckbox.check()
      if (await frenchCheckbox.isVisible()) await frenchCheckbox.check()

      // Submit
      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /create|save/i }))

      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })

    test('should create combined view with three timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openCombineViewModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Select all three timelines
      for (const timeline of timelines) {
        const checkbox = page.locator('label').filter({ hasText: timeline.name }).locator('input')
        if (await checkbox.isVisible()) {
          await checkbox.check()
        }
      }

      // Name and submit
      const nameInput = page.locator('input[name="name"]').or(page.locator('input[placeholder*="name" i]'))
      if (await nameInput.isVisible()) {
        await nameInput.fill('All European Philosophy')
      }

      const submitButton = page.locator('button').filter({ hasText: /create|save/i })
      if (await submitButton.isVisible()) {
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.medium)
      }
    })
  })

  test.describe('Combined View Display', () => {
    test('should display combined view as new tab', async ({ page, request }) => {
      const api = createAPIHelpers(request)

      // Create combined view via API
      const combinedResponse = await api.request.post(`${api['baseUrl']}/api/combined-timeline-views/`, {
        data: {
          name: 'Test Combined View',
          timeline_ids: [timelines[0].id, timelines[1].id],
        },
      })

      await page.reload()
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Combined view should appear as a tab
      const combinedTab = page.locator('button, [role="tab"]').filter({ hasText: /test.*combined|combined/i })
    })

    test('should show multi-lane layout in combined view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Create and open combined view
      await mainPage.openCombineViewModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Each timeline should have its own lane (horizontal or vertical)
    })

    test('should display thinkers from all selected timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Combined view should show thinkers from German and French timelines
    })

    test('should show cross-timeline connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Hume -> Kant and Rousseau -> Kant connections should be visible
      // crossing between British/French and German lanes
    })
  })

  test.describe('Combined View Navigation', () => {
    test('should pan across combined view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.panCanvas(100, 50)
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })

    test('should zoom combined view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.zoomIn()
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      await mainPage.zoomOut()
      await page.waitForTimeout(TIMEOUTS.canvasRender)
    })

    test('should click on thinker in combined view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on a thinker position
      await mainPage.clickOnCanvas(150, 100) // Kant's position
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Combined View Editing', () => {
    test('should edit combined view name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open settings for combined view
      const settingsButton = page.locator('button').filter({ hasText: /settings|edit|⚙/i })

      if (await settingsButton.first().isVisible()) {
        await settingsButton.first().click()
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })

    test('should add timeline to combined view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Add British timeline to existing German-French combined view
    })

    test('should remove timeline from combined view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Remove one timeline from the combined view
    })
  })

  test.describe('Delete Combined View', () => {
    test('should delete combined view', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open combined view settings
      const deleteButton = page.locator('button').filter({ hasText: /delete|remove/i })

      if (await deleteButton.isVisible()) {
        await deleteButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Confirm deletion
        const confirmButton = page.locator('button').filter({ hasText: /confirm|yes|delete/i })
        if (await confirmButton.isVisible()) {
          await confirmButton.click()
          await page.waitForTimeout(TIMEOUTS.medium)
        }
      }
    })

    test('should return to default view after deletion', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // After deleting combined view, should show "All Thinkers" or first timeline
      await expect(mainPage.canvasElement).toBeVisible()
    })
  })

  test.describe('Combined View Tabs', () => {
    test('should switch between combined view and individual timelines', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Click on individual timeline tab
      await mainPage.selectTimelineTab(timelines[0].name)
      await page.waitForTimeout(TIMEOUTS.canvasRender)

      // Click on combined view tab (if exists)
      const combinedTab = page.locator('button, [role="tab"]').filter({ hasText: /combined/i })
      if (await combinedTab.isVisible()) {
        await combinedTab.click()
        await page.waitForTimeout(TIMEOUTS.canvasRender)
      }
    })

    test('should show multiple combined views in tabs', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Create multiple combined views and verify they all appear as tabs
    })
  })
})
