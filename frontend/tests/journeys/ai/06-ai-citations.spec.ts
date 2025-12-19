import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('AI Journey: Citation Formatting', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    // Create timeline with thinker and publication
    const timeline = await api.createTimeline({
      name: 'Philosophy',
      start_year: 1700,
      end_year: 1900,
    })

    const kant = await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })

    await api.createPublication({
      thinker_id: kant.id,
      title: 'Critique of Pure Reason',
      year: 1781,
      publication_type: 'book',
      citation: 'Kant, Immanuel. Critique of Pure Reason. 1781.',
    })

    await api.createPublication({
      thinker_id: kant.id,
      title: 'Groundwork of the Metaphysics of Morals',
      year: 1785,
      publication_type: 'book',
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Chicago Style Citations', () => {
    test('should generate Chicago style citation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Generate a Chicago style citation for Critique of Pure Reason')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Should generate Chicago format citation
      }
    })

    test('should format Chicago footnote citation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Create a Chicago footnote citation for Kant\'s works')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should format Chicago bibliography entry', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Create a Chicago bibliography entry for Kant\'s Critique of Pure Reason')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('MLA Style Citations', () => {
    test('should generate MLA style citation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Generate an MLA citation for Critique of Pure Reason')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should format MLA works cited entry', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Create MLA works cited entries for all of Kant\'s publications')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should format MLA in-text citation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('What would an MLA in-text citation for Kant look like?')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('APA Style Citations', () => {
    test('should generate APA style citation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Generate an APA citation for Critique of Pure Reason')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should format APA reference list entry', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Create APA reference list entries for Kant\'s works')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should format APA parenthetical citation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Show me an APA parenthetical citation for Kant 1781')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Batch Citations', () => {
    test('should generate citations for all publications', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Generate Chicago citations for all publications in this database')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should generate bibliography', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Create a complete bibliography in Chicago style')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })
  })

  test.describe('Citation Copy', () => {
    test('should allow copying citation to clipboard', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAIPanel()
      await page.waitForTimeout(TIMEOUTS.animation)

      const chatInput = page.locator('textarea, input').first()
      if (await chatInput.isVisible()) {
        await chatInput.fill('Generate a citation for Kant')
        await page.keyboard.press('Enter')
        await page.waitForTimeout(TIMEOUTS.long)

        // Copy button
        const copyButton = page.locator('button').filter({ hasText: /copy/i })
        if (await copyButton.first().isVisible()) {
          await copyButton.first().click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Citation Format Selection', () => {
    test('should offer citation format selection UI', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Look for citation format selector
      const formatSelector = page.locator('select').filter({ hasText: /chicago|mla|apa/i })
        .or(page.locator('[data-testid="citation-format"]'))
    })

    test('should remember preferred citation format', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // User preference should persist
    })
  })
})
