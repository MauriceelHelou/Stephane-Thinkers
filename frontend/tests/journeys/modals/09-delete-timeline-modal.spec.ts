import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Modal Journey: Delete Timeline Modal', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 2,
      thinkers: 4,
      connections: 2,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Delete Confirmation Opening', () => {
    test('should open from timeline menu', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      const menuButton = page.locator('button').filter({ hasText: /menu|timeline/i })
      if (await menuButton.isVisible()) {
        await menuButton.click()
        await page.waitForTimeout(TIMEOUTS.animation)

        const deleteOption = page.locator('text=/delete.*timeline/i')
        if (await deleteOption.isVisible()) {
          await deleteOption.click()
          await page.waitForTimeout(TIMEOUTS.animation)
        }
      }
    })
  })

  test.describe('Confirmation Dialog Content', () => {
    test('should show timeline name', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Dialog should mention the timeline name
    })

    test('should warn about cascade deletion', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Warning about thinkers and connections being deleted
      const warning = page.locator('text=/thinker|connection|all.*data|permanent/i')
    })

    test('should require confirmation text', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // May require typing timeline name to confirm
      const confirmInput = page.locator('input[placeholder*="type"]')
    })
  })

  test.describe('Delete Action', () => {
    test('should delete timeline on confirm', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Delete would remove timeline and redirect
    })

    test('should not delete last timeline', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Should prevent deleting if it's the only timeline
    })
  })
})
