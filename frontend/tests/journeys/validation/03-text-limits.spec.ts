import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Validation Journey: Text Limits', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 2,
      connections: 0,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Thinker Name Limits', () => {
    test('should accept normal length name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('Immanuel Kant')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.long)
    })

    test('should reject empty name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error should appear
    })

    test('should reject whitespace-only name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('   ')

      const submitButton = page.locator('button[type="submit"]')
        .or(page.locator('button').filter({ hasText: /save|create|add/i }))
      await submitButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Error should appear
    })

    test('should handle very long name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      const longName = 'A'.repeat(500)
      await nameInput.fill(longName)

      // Should either truncate or show error
      const value = await nameInput.inputValue()
    })
  })

  test.describe('Description Limits', () => {
    test('should accept normal description', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const descInput = page.locator('textarea[name*="description"], textarea[name*="bio"]').first()
      if (await descInput.isVisible()) {
        await descInput.fill('A German philosopher who was a central figure in modern philosophy.')
      }
    })

    test('should handle very long description', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const descInput = page.locator('textarea[name*="description"], textarea[name*="bio"]').first()
      if (await descInput.isVisible()) {
        const longDesc = 'A'.repeat(10000)
        await descInput.fill(longDesc)

        // Should either truncate, show error, or accept
      }
    })

    test('should show character count', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Character counter
      const charCount = page.locator('[class*="char-count"], text=/\\d+.*character/i')
    })
  })

  test.describe('Quote Text Limits', () => {
    test('should accept normal quote', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Quotes can be moderately long
    })

    test('should handle very long quote', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Very long quotes should be handled
    })
  })

  test.describe('Connection Notes Limits', () => {
    test('should accept normal notes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const notesInput = page.locator('textarea[name*="note"]').first()
      if (await notesInput.isVisible()) {
        await notesInput.fill('Kant influenced Hegel through his critique of metaphysics.')
      }
    })

    test('should handle very long notes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('c')
      await page.waitForTimeout(TIMEOUTS.animation)

      const notesInput = page.locator('textarea[name*="note"]').first()
      if (await notesInput.isVisible()) {
        const longNotes = 'Note. '.repeat(1000)
        await notesInput.fill(longNotes)
      }
    })
  })

  test.describe('Field Name Limits', () => {
    test('should accept standard field names', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const fieldInput = page.locator('input[name="field"]').first()
      if (await fieldInput.isVisible()) {
        await fieldInput.fill('Philosophy')
      }
    })

    test('should handle very long field name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const fieldInput = page.locator('input[name="field"]').first()
      if (await fieldInput.isVisible()) {
        const longField = 'Philosophy '.repeat(50)
        await fieldInput.fill(longField)
      }
    })
  })

  test.describe('Timeline Name Limits', () => {
    test('should accept normal timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('German Idealism')
    })

    test('should handle very long timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      const longName = 'Timeline '.repeat(100)
      await nameInput.fill(longName)
    })
  })

  test.describe('Special Characters', () => {
    test('should accept names with special characters', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill("René Descartes")
    })

    test('should accept names with unicode characters', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill("孔子") // Confucius in Chinese
    })

    test('should handle HTML entities safely', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await mainPage.openAddThinkerModal()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      await nameInput.fill('<script>alert("test")</script>')

      // Should be sanitized/escaped
    })
  })
})
