import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: Edit Modals', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()

    const timeline = await api.createTimeline({
      name: 'Test Timeline',
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

    const hegel = await api.createThinker({
      name: 'Georg Hegel',
      birth_year: 1770,
      death_year: 1831,
      field: 'Philosophy',
      timeline_id: timeline.id,
    })

    await api.createConnection({
      source_id: kant.id,
      target_id: hegel.id,
      connection_type: 'influenced',
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test('edit thinker modal', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
    if (await thinker.isVisible()) {
      await thinker.dblclick()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('edit-thinker-modal.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('edit thinker modal with changes', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
    if (await thinker.isVisible()) {
      await thinker.dblclick()
      await page.waitForTimeout(TIMEOUTS.animation)

      const nameInput = page.locator('input[name="name"]').first()
      if (await nameInput.isVisible()) {
        await nameInput.clear()
        await nameInput.fill('Immanuel Kant (Modified)')
        await page.waitForTimeout(TIMEOUTS.animation)

        await expect(page).toHaveScreenshot('edit-thinker-modal-modified.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('edit connection modal', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
    if (await connection.isVisible()) {
      await connection.click({ button: 'right' })
      await page.waitForTimeout(TIMEOUTS.animation)

      const editOption = page.locator('text=/edit/i')
      if (await editOption.isVisible()) {
        await editOption.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        await expect(page).toHaveScreenshot('edit-connection-modal.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('edit timeline modal', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const settingsButton = page.locator('button').filter({ hasText: /settings|edit.*timeline/i })
    if (await settingsButton.isVisible()) {
      await settingsButton.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      await expect(page).toHaveScreenshot('edit-timeline-modal.png', {
        maxDiffPixelRatio: 0.02,
      })
    }
  })

  test('thinker details panel', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const thinker = page.locator('[data-testid*="thinker"], [class*="thinker"]').first()
    if (await thinker.isVisible()) {
      await thinker.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Details panel
      const detailsPanel = page.locator('[class*="details"], [class*="panel"]')
      if (await detailsPanel.isVisible()) {
        await expect(detailsPanel).toHaveScreenshot('thinker-details-panel.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })

  test('connection details panel', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.waitForPageLoad()

    const connection = page.locator('[data-testid*="connection"], [class*="connection-line"]').first()
    if (await connection.isVisible()) {
      await connection.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      const detailsPanel = page.locator('[class*="details"], [class*="panel"]')
      if (await detailsPanel.isVisible()) {
        await expect(detailsPanel).toHaveScreenshot('connection-details-panel.png', {
          maxDiffPixelRatio: 0.02,
        })
      }
    }
  })
})
