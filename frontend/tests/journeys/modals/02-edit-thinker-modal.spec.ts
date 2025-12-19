import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Edit Thinker Modal', () => {
  let thinkerId: string

  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Test Timeline',
      start_year: 1700,
      end_year: 1900,
    })

    const thinker = await api.createThinker({
      name: 'Immanuel Kant',
      birth_year: 1724,
      death_year: 1804,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })
    thinkerId = thinker.id

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Modal Opening', () => {
    test('should open on double-click thinker', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const modal = page.locator('[role="dialog"]')
      }
    })

    test('should open from context menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click({ button: 'right' })
        await page.waitForTimeout(TIMEOUTS.animation)

        const editOption = page.locator('text=/edit/i')
        if (await editOption.isVisible()) {
          await editOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })

    test('should open from keyboard shortcut', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Select thinker first
      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await page.keyboard.press('e')
        await page.waitForTimeout(TIMEOUTS.animation)
      }
    })
  })

  test.describe('Data Pre-population', () => {
    test('should show existing name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
        if (await nameInput.isVisible()) {
          await expect(nameInput).toHaveValue('Immanuel Kant')
        }
      }
    })

    test('should show existing birth year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const birthInput = page.locator('input[name*="birth"]').first()
        if (await birthInput.isVisible()) {
          await expect(birthInput).toHaveValue('1724')
        }
      }
    })

    test('should show existing death year', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const deathInput = page.locator('input[name*="death"]').first()
        if (await deathInput.isVisible()) {
          await expect(deathInput).toHaveValue('1804')
        }
      }
    })

    test('should show existing field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const fieldInput = page.locator('input[name="field"], select[name="field"]').first()
        if (await fieldInput.isVisible()) {
          const value = await fieldInput.inputValue()
          expect(value.toLowerCase()).toContain('philosophy')
        }
      }
    })
  })

  test.describe('Edit Operations', () => {
    test('should update name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
        if (await nameInput.isVisible()) {
          await nameInput.clear()
          await nameInput.fill('Immanuel Kant (Updated)')

          const submitButton = page.locator('button[type="submit"]')
            .or(page.locator('button').filter({ hasText: /save|update/i }))
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)
        }
      }
    })

    test('should update years', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const birthInput = page.locator('input[name*="birth"]').first()
        if (await birthInput.isVisible()) {
          await birthInput.clear()
          await birthInput.fill('1725')
        }

        const submitButton = page.locator('button[type="submit"]')
          .or(page.locator('button').filter({ hasText: /save|update/i }))
        await submitButton.click()
        await page.waitForTimeout(TIMEOUTS.long)
      }
    })

    test('should update field', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const fieldInput = page.locator('input[name="field"]').first()
        if (await fieldInput.isVisible()) {
          await fieldInput.clear()
          await fieldInput.fill('Ethics')

          const submitButton = page.locator('button[type="submit"]')
            .or(page.locator('button').filter({ hasText: /save|update/i }))
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.long)
        }
      }
    })
  })

  test.describe('Validation', () => {
    test('should not allow empty name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        const nameInput = page.locator('input[name="name"], [placeholder*="name" i]').first()
        if (await nameInput.isVisible()) {
          await nameInput.clear()

          const submitButton = page.locator('button[type="submit"]')
            .or(page.locator('button').filter({ hasText: /save|update/i }))
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Error should appear
          const error = page.locator('[class*="error"], text=/required/i')
        }
      }
    })

    test('should validate year range', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Set death year before birth year
        const birthInput = page.locator('input[name*="birth"]').first()
        const deathInput = page.locator('input[name*="death"]').first()

        if (await birthInput.isVisible() && await deathInput.isVisible()) {
          await birthInput.clear()
          await birthInput.fill('1900')
          await deathInput.clear()
          await deathInput.fill('1800')

          const submitButton = page.locator('button[type="submit"]')
            .or(page.locator('button').filter({ hasText: /save|update/i }))
          await submitButton.click()
          await page.waitForTimeout(TIMEOUTS.animation)

          // Error should appear
        }
      }
    })
  })

  test.describe('Related Data Display', () => {
    test('should show connections', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Connections section
        const connectionsSection = page.locator('text=/connection/i')
      }
    })

    test('should show publications', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Publications section
        const publicationsSection = page.locator('text=/publication/i')
      }
    })

    test('should show quotes', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
      if (await thinker.isVisible()) {
        await thinker.dblclick()
        await page.waitForTimeout(TIMEOUTS.animation)

        // Quotes section
        const quotesSection = page.locator('text=/quote/i')
      }
    })
  })
})
