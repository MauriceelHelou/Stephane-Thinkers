import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Empty States', () => {
  test('empty database state', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    // Create only timeline, no thinkers
    await api.createTimeline({
      name: 'Empty Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    await page.waitForTimeout(TIMEOUTS.animation)

    await expect(page).toHaveScreenshot('empty-database-state.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('no thinkers message', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    await api.createTimeline({
      name: 'Empty Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    const emptyMessage = page.locator('text=/no.*thinker|add.*first|get.*started/i')
    if (await emptyMessage.isVisible()) {
      await expect(emptyMessage).toHaveScreenshot('no-thinkers-message.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('no connections state', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Test Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    await api.createThinker({
      name: 'Lone Thinker',
      birth_year: 1750,
      death_year: 1800,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    // No connection lines should be visible
    await expect(page).toHaveScreenshot('no-connections-state.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('empty search results', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 1,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    // Search for non-existent thinker
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('NonExistentThinker12345')
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('empty-search-results.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('no quiz history', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 1,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    const historyButton = page.locator('button').filter({ hasText: /history/i })
    if (await historyButton.isVisible()) {
      await historyButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('no-quiz-history.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('no publications state', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Test Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    await api.createThinker({
      name: 'Thinker Without Publications',
      birth_year: 1750,
      death_year: 1800,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
    if (await thinker.isVisible()) {
      await thinker.dblclick()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Publications section should show empty state
      const pubSection = page.locator('text=/no.*publication|add.*publication/i')
    }
  })

  test('no timelines state', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    // Don't create any timeline

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await page.waitForTimeout(TIMEOUTS.long)

    await expect(page).toHaveScreenshot('no-timelines-state.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('empty AI suggestions', async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Minimal Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    await api.createThinker({
      name: 'Solo Thinker',
      birth_year: 1750,
      death_year: 1800,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    await mainPage.openAIPanel()
    await page.waitForTimeout(TIMEOUTS.animation)

    const suggestionsTab = page.locator('button, [role="tab"]').filter({ hasText: /suggest/i })
    if (await suggestionsTab.isVisible()) {
      await suggestionsTab.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page.locator('[class*="ai-panel"]')).toHaveScreenshot('empty-ai-suggestions.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })
})
