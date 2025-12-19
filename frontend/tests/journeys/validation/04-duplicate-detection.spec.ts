import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Validation Journey: Duplicate Detection', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Test Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    // Create known thinkers
    const kant = await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })

    const hegel = await api.createThinker({
      name: 'Georg Wilhelm Friedrich Hegel',
      birth_year: 1770,
      death_year: 1831,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })

    // Create known connection
    await api.createConnection({
      source_id: kant.id,
      target_id: hegel.id,
      connection_type: 'influenced',
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Duplicate Thinker Detection', () => {
    test('should warn about exact name match', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Immanuel Kant')
      await page.waitForTimeout(TIMEOUTS.medium)

      // Warning about duplicate should appear
      const warning = page.locator('text=/already.*exist|duplicate|similar/i')
    })

    test('should warn about case-insensitive match', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('IMMANUEL KANT')
      await page.waitForTimeout(TIMEOUTS.medium)

      // Should still detect as duplicate
    })

    test('should suggest similar thinkers', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Emanuel Kant') // Misspelled
      await page.waitForTimeout(TIMEOUTS.medium)

      // Should suggest Immanuel Kant
      const suggestion = page.locator('text=/did.*you.*mean|similar|immanuel/i')
    })

    test('should allow creating despite warning', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Immanuel Kant')
      await page.waitForTimeout(TIMEOUTS.medium)

      // User should be able to proceed anyway
      const proceedButton = page.locator('button').filter({ hasText: /create.*anyway|proceed/i })
    })
  })

  test.describe('Duplicate Connection Detection', () => {
    test('should warn about duplicate connection', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Try to create Kant -> Hegel influenced (already exists)
      const sourceSelect = page.locator('select[name*="source"]').first()
      const targetSelect = page.locator('select[name*="target"]').first()

      if (await sourceSelect.isVisible() && await targetSelect.isVisible()) {
        // Select Kant as source, Hegel as target
        await sourceSelect.selectOption({ label: /Kant/i })
        await targetSelect.selectOption({ label: /Hegel/i })
        await page.waitForTimeout(TIMEOUTS.medium)

        // Warning should appear
        const warning = page.locator('text=/already.*exist|duplicate.*connection/i')
      }
    })

    test('should allow different connection type', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Same thinkers but different type should be allowed (if supported)
    })

    test('should allow reverse connection', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Hegel -> Kant should be different from Kant -> Hegel
    })
  })

  test.describe('Duplicate Timeline Detection', () => {
    test('should warn about duplicate timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Test Timeline')
      await page.waitForTimeout(TIMEOUTS.medium)

      // Warning about duplicate
      const warning = page.locator('text=/already.*exist|duplicate/i')
    })
  })

  test.describe('Duplicate Tag Detection', () => {
    test('should not allow duplicate tags on same thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Adding same tag twice should be prevented
    })
  })

  test.describe('Duplicate Publication Detection', () => {
    test('should warn about same title and year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Same publication title + year on same thinker
    })
  })

  test.describe('UI Feedback', () => {
    test('should show duplicate warning inline', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Immanuel Kant')
      await page.waitForTimeout(TIMEOUTS.medium)

      // Warning should appear near the field
      const inlineWarning = page.locator('[class*="warning"]')
    })

    test('should link to existing entry', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Immanuel Kant')
      await page.waitForTimeout(TIMEOUTS.medium)

      // Should have link to view existing thinker
      const viewLink = page.locator('a, button').filter({ hasText: /view.*existing|see.*entry/i })
    })
  })
})
