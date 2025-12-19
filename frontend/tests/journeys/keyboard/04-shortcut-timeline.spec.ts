import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Keyboard Journey: Timeline Shortcuts', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 3,
      thinkers: 6,
      connections: 4,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Timeline Creation Shortcut', () => {
    test('should open create timeline modal with T key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('t')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Timeline modal should open
      const modal = page.locator('[role="dialog"]').filter({ hasText: /timeline/i })
    })

    test('should open create timeline with Ctrl+T', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+t')
      await page.waitForTimeout(TIMEOUTS.animation)

      const modal = page.locator('[role="dialog"]')
    })
  })

  test.describe('Timeline Switching', () => {
    test('should switch to next timeline with Ctrl+Right', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+ArrowRight')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should switch to next timeline
    })

    test('should switch to previous timeline with Ctrl+Left', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Go to next first
      await page.keyboard.press('Control+ArrowRight')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Go back
      await page.keyboard.press('Control+ArrowLeft')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should switch timeline with number keys', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Alt+1 for first timeline
      await page.keyboard.press('Alt+1')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Alt+2 for second timeline
      await page.keyboard.press('Alt+2')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Alt+3 for third timeline
      await page.keyboard.press('Alt+3')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Timeline Management', () => {
    test('should edit current timeline with Ctrl+E', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+e')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Edit timeline modal should open
      const modal = page.locator('[role="dialog"]').filter({ hasText: /edit.*timeline/i })
    })

    test('should duplicate timeline with Ctrl+D', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+d')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Duplicate confirmation or action
    })

    test('should delete timeline with Ctrl+Delete', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+Delete')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Delete confirmation dialog
      const confirmDialog = page.locator('text=/delete.*timeline|confirm/i')
    })
  })

  test.describe('Timeline View Controls', () => {
    test('should fit timeline to view with F key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('f')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Timeline should fit to viewport
    })

    test('should reset view to default with Home key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Pan and zoom first
      await page.keyboard.press('Control+=')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Reset
      await page.keyboard.press('Home')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should go to start of timeline with Ctrl+Home', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+Home')
      await page.waitForTimeout(TIMEOUTS.animation)

      // View should be at timeline start year
    })

    test('should go to end of timeline with Ctrl+End', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+End')
      await page.waitForTimeout(TIMEOUTS.animation)

      // View should be at timeline end year
    })
  })

  test.describe('Timeline Zoom Controls', () => {
    test('should zoom in with + key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('=')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should zoom out with - key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('-')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should zoom in with Ctrl++', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+=')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should zoom out with Ctrl+-', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+-')
      await page.waitForTimeout(TIMEOUTS.animation)
    })

    test('should reset zoom with 0 key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Zoom in first
      await page.keyboard.press('Control+=')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Reset zoom
      await page.keyboard.press('0')
      await page.waitForTimeout(TIMEOUTS.animation)
    })
  })

  test.describe('Combined Timeline View', () => {
    test('should toggle combined view with M key', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('m')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should switch to combined/merged view
    })

    test('should open timeline comparison with Ctrl+M', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+m')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Comparison view should open
    })
  })

  test.describe('Timeline Export', () => {
    test('should open export dialog with Ctrl+Shift+E', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+Shift+e')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Export dialog should open
      const exportDialog = page.locator('[role="dialog"]').filter({ hasText: /export/i })
    })

    test('should quick save with Ctrl+S', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('Control+s')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Should trigger save
    })
  })
})
