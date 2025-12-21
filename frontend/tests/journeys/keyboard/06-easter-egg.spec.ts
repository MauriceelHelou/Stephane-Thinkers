import { test, expect } from '@playwright/test'
import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { TIMEOUTS } from '../../config/test-constants'

test.describe('Easter Egg Journey: Hidden Animation', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 2,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test.describe('Easter Egg Discovery', () => {
    test('should have a hidden trigger in the help modal footer', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open help modal
      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Find the help modal
      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      await expect(helpModal).toBeVisible()

      // Find the secret trigger button (the word "help" at the bottom)
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await expect(secretTrigger).toBeVisible()
    })

    test('should disguise the trigger as normal text', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })

      // Should have text that looks like regular text
      await expect(secretTrigger).toHaveClass(/text-gray-500/)
      await expect(secretTrigger).toHaveClass(/cursor-default/)
    })

    test('should have empty title attribute to avoid spoiling the surprise', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })

      await expect(secretTrigger).toHaveAttribute('title', '')
    })
  })

  test.describe('Easter Egg Activation', () => {
    test('should show easter egg overlay when secret trigger is clicked', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      // Open help modal
      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })

      // Click the secret trigger
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Easter egg overlay should appear with dark background
      const easterEggOverlay = page.locator('.fixed.inset-0.z-\\[100\\]')
      await expect(easterEggOverlay).toBeVisible()
    })

    test('should display pug emoji during animation', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Pug emoji should be visible
      const pugEmoji = page.locator('[role="img"][aria-label="pug"]')
      await expect(pugEmoji).toBeVisible()
    })

    test('should display "I Love You" text', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Wait for animation to progress to text phase
      await page.waitForTimeout(3000)

      // "I Love You" text parts should be present
      await expect(page.locator('text=I').first()).toBeVisible()
      await expect(page.locator('text=Love').first()).toBeVisible()
      await expect(page.locator('text=You').first()).toBeVisible()
    })

    test('should display floating hearts around pug', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Hearts should be visible
      await expect(page.locator('text=💕')).toBeVisible()
      await expect(page.locator('text=💗')).toBeVisible()
    })

    test('should display skip hint text', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Skip hint should be visible
      await expect(page.locator('text=Click anywhere to skip')).toBeVisible()
    })

    test('should display star background elements', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Stars should be rendered (small white dots)
      const stars = page.locator('.w-1.h-1.bg-white.rounded-full')
      await expect(stars.first()).toBeVisible()
      expect(await stars.count()).toBe(50)
    })
  })

  test.describe('Easter Egg Skip Functionality', () => {
    test('should close easter egg when clicking anywhere', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Easter egg should be visible
      const easterEggOverlay = page.locator('.fixed.inset-0.z-\\[100\\]')
      await expect(easterEggOverlay).toBeVisible()

      // Click to skip
      await easterEggOverlay.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Easter egg should be gone
      await expect(easterEggOverlay).not.toBeVisible()
    })

    test('should have cursor-pointer on overlay for skip indication', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Easter egg overlay should have cursor-pointer class
      const easterEggOverlay = page.locator('.fixed.inset-0.z-\\[100\\].cursor-pointer')
      await expect(easterEggOverlay).toBeVisible()
    })
  })

  test.describe('Easter Egg and Help Modal Interaction', () => {
    test('should keep help modal open while easter egg plays', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Help modal should still be present (behind the easter egg)
      // The modal title should still exist in the DOM
      await expect(page.locator('text=Help & Keyboard Shortcuts')).toBeVisible()
    })

    test('should return to help modal after easter egg ends', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Skip the easter egg
      const easterEggOverlay = page.locator('.fixed.inset-0.z-\\[100\\]')
      await easterEggOverlay.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Help modal should be fully visible and interactable again
      await expect(helpModal).toBeVisible()

      // Should be able to find content sections
      await expect(page.locator('text=Navigation')).toBeVisible()
    })

    test('should allow closing help modal after easter egg ends', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Skip the easter egg
      const easterEggOverlay = page.locator('.fixed.inset-0.z-\\[100\\]')
      await easterEggOverlay.click()
      await page.waitForTimeout(TIMEOUTS.animation)

      // Close the help modal with Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(TIMEOUTS.animation)

      // Help modal should be closed
      await expect(helpModal).not.toBeVisible()
    })
  })

  test.describe('Easter Egg Multiple Triggers', () => {
    test('should allow triggering easter egg multiple times', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      const easterEggOverlay = page.locator('.fixed.inset-0.z-\\[100\\]')

      // First trigger
      await secretTrigger.click()
      await expect(easterEggOverlay).toBeVisible()

      // Skip
      await easterEggOverlay.click()
      await page.waitForTimeout(TIMEOUTS.animation)
      await expect(easterEggOverlay).not.toBeVisible()

      // Second trigger - should work again
      await secretTrigger.click()
      await expect(easterEggOverlay).toBeVisible()

      // Skip again
      await easterEggOverlay.click()
      await page.waitForTimeout(TIMEOUTS.animation)
      await expect(easterEggOverlay).not.toBeVisible()

      // Third trigger - should still work
      await secretTrigger.click()
      await expect(easterEggOverlay).toBeVisible()
    })
  })

  test.describe('Easter Egg Auto-Close', () => {
    test('should auto-close after full animation duration (~6.2 seconds)', async ({ page }) => {
      // Increase timeout for this test as it waits for the full animation
      test.setTimeout(15000)

      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      const easterEggOverlay = page.locator('.fixed.inset-0.z-\\[100\\]')
      await expect(easterEggOverlay).toBeVisible()

      // Wait for the full animation to complete (6.2 seconds + buffer)
      await page.waitForTimeout(7000)

      // Easter egg should have auto-closed
      await expect(easterEggOverlay).not.toBeVisible()

      // Help modal should still be visible
      await expect(helpModal).toBeVisible()
    })
  })

  test.describe('Easter Egg Visual Elements', () => {
    test('should have dark purple background', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      const easterEggOverlay = page.locator('.fixed.inset-0.z-\\[100\\]')

      // Check for the dark purple background color
      const backgroundColor = await easterEggOverlay.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor
      })

      // Should be dark purple (#1a0a1a = rgb(26, 10, 26))
      expect(backgroundColor).toBe('rgb(26, 10, 26)')
    })

    test('should have high z-index to appear above everything', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Should have z-index of 100
      const easterEggOverlay = page.locator('.z-\\[100\\]')
      await expect(easterEggOverlay).toBeVisible()
    })

    test('should display sparkles during text zoom phase', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Wait for text-zoom phase to start (2.5 seconds)
      await page.waitForTimeout(3000)

      // Sparkle emojis should be visible
      const sparkles = page.locator('text=✨')
      await expect(sparkles.first()).toBeVisible()
      expect(await sparkles.count()).toBe(20)
    })

    test('should have red heart emojis around Love text', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      // Hearts around "Love" text
      const hearts = page.locator('text=❤️')
      expect(await hearts.count()).toBe(2)
    })
  })

  test.describe('Easter Egg Accessibility', () => {
    test('should have proper aria-label on pug emoji', async ({ page }) => {
      const mainPage = createMainPage(page)
      await mainPage.waitForPageLoad()

      await page.keyboard.press('?')
      await page.waitForTimeout(TIMEOUTS.animation)

      const helpModal = page.locator('[role="dialog"]').filter({ hasText: /Help & Keyboard Shortcuts/i })
      const secretTrigger = helpModal.locator('button').filter({ hasText: /^help$/i })
      await secretTrigger.click()

      const pugEmoji = page.locator('[role="img"][aria-label="pug"]')
      await expect(pugEmoji).toBeVisible()
      await expect(pugEmoji).toHaveAttribute('aria-label', 'pug')
    })
  })
})
