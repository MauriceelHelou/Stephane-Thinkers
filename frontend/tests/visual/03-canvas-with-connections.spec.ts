import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Canvas with Connections', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Philosophy Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    const kant = await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 100,
      position_y: 200,
    })

    const hegel = await api.createThinker({
      name: 'Georg Hegel',
      birth_year: 1770,
      death_year: 1831,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 300,
      position_y: 200,
    })

    const marx = await api.createThinker({
      name: 'Karl Marx',
      birth_year: 1818,
      death_year: 1883,
      field: 'Economics',
      timeline_id: timeline.id,
      position_x: 500,
      position_y: 200,
    })

    const fichte = await api.createThinker({
      name: 'Johann Fichte',
      birth_year: 1762,
      death_year: 1814,
      field: 'Philosophy',
      timeline_id: timeline.id,
      position_x: 200,
      position_y: 350,
    })

    // Create different connection types
    await api.createConnection({
      source_id: kant.id,
      target_id: hegel.id,
      connection_type: 'influenced',
    })

    await api.createConnection({
      source_id: hegel.id,
      target_id: marx.id,
      connection_type: 'critiqued',
    })

    await api.createConnection({
      source_id: kant.id,
      target_id: fichte.id,
      connection_type: 'built_upon',
    })

    await api.createConnection({
      source_id: fichte.id,
      target_id: hegel.id,
      connection_type: 'synthesized',
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test('canvas with all connection types', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('canvas-all-connection-types.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('influenced connection line', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    // Capture influenced connection (first one)
    const connection = page.locator('[data-testid*="connection"][data-type="influenced"]')
      .or(page.locator('[class*="connection-influenced"]'))
      .first()

    if (await connection.isVisible()) {
      await expect(connection).toHaveScreenshot('connection-influenced.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('critiqued connection line', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const connection = page.locator('[data-testid*="connection"][data-type="critiqued"]')
      .or(page.locator('[class*="connection-critiqued"]'))
      .first()

    if (await connection.isVisible()) {
      await expect(connection).toHaveScreenshot('connection-critiqued.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('built_upon connection line', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const connection = page.locator('[data-testid*="connection"][data-type="built_upon"]')
      .or(page.locator('[class*="connection-built"]'))
      .first()

    if (await connection.isVisible()) {
      await expect(connection).toHaveScreenshot('connection-built-upon.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('synthesized connection line', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const connection = page.locator('[data-testid*="connection"][data-type="synthesized"]')
      .or(page.locator('[class*="connection-synthesized"]'))
      .first()

    if (await connection.isVisible()) {
      await expect(connection).toHaveScreenshot('connection-synthesized.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('connection hover state', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
    if (await connection.isVisible()) {
      await connection.hover()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(connection).toHaveScreenshot('connection-hover.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('connection selected state', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
    if (await connection.isVisible()) {
      await connection.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(connection).toHaveScreenshot('connection-selected.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('connection legend', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    const legend = page.locator('[class*="legend"]')
      .or(page.locator('[data-testid="connection-legend"]'))

    if (await legend.isVisible()) {
      await expect(legend).toHaveScreenshot('connection-legend.png', {
        maxDiffPixelRatio: 0.01,
      })
    }
  })

  test('connections hidden state', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Toggle connections off
    await page.keyboard.press('h')
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('connections-hidden.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('filtered connections', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    // Filter to show only influenced connections
    const filterButton = page.locator('button').filter({ hasText: /influenced/i })
    if (await filterButton.isVisible()) {
      await filterButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('connections-filtered.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })
})
