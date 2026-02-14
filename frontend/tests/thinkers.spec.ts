import { test, expect } from '@playwright/test'
import { primeAuthenticatedSession } from './helpers/auth-helpers'

test.describe('Thinkers', () => {
  test.beforeEach(async ({ page }) => {
    await primeAuthenticatedSession(page)
    await page.goto('/')
  })

  test('should show the main page', async ({ page }) => {
    await expect(page).toHaveTitle(/Intellectual Genealogy/)
  })

  test('should open add thinker modal with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Control+t')
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).toBeVisible()
  })

  test('should create a new thinker', async ({ page }) => {
    // Open the add thinker modal
    await page.keyboard.press('Control+t')
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).toBeVisible()

    // Fill in the form using placeholder text as selector
    await page.getByPlaceholder('e.g., Michel Foucault').fill('Test Philosopher')

    // Submit the form
    await page.getByRole('button', { name: 'Add Thinker' }).click()

    // Modal should close (may take a moment for mutation)
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).not.toBeVisible({ timeout: 10000 })
  })

  test('should show validation error for empty name', async ({ page }) => {
    // Open the add thinker modal
    await page.keyboard.press('Control+t')
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).toBeVisible()

    // Try to submit empty form
    await page.getByRole('button', { name: 'Add Thinker' }).click()

    // Should show validation error
    await expect(page.getByText(/name is required/i)).toBeVisible()
  })

  test('should show validation error for birth year after death year', async ({ page }) => {
    // Open the add thinker modal
    await page.keyboard.press('Control+t')
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).toBeVisible()

    // Fill in name and invalid years
    await page.getByPlaceholder('e.g., Michel Foucault').fill('Test Philosopher')

    // Find birth/death year inputs by their position in the form
    const yearInputs = page.locator('input[type="number"]')
    await yearInputs.first().fill('-400')  // Birth year
    await yearInputs.nth(1).fill('-500')   // Death year (before birth)

    // Submit
    await page.getByRole('button', { name: 'Add Thinker' }).click()

    // Should show validation error
    await expect(page.getByText(/birth year must be before/i)).toBeVisible()
  })

  test('should cancel adding a thinker', async ({ page }) => {
    // Open the add thinker modal
    await page.keyboard.press('Control+t')
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).toBeVisible()

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Modal should close
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).not.toBeVisible()
  })

  test('should close modal by clicking outside', async ({ page }) => {
    // Open the add thinker modal
    await page.keyboard.press('Control+t')
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).toBeVisible()

    // Click outside the modal (on the backdrop)
    await page.locator('.bg-black.bg-opacity-30').click({ position: { x: 10, y: 10 } })

    // Modal should close
    await expect(page.getByRole('heading', { name: 'Add Thinker' })).not.toBeVisible()
  })
})
