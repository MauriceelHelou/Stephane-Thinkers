import { test, expect } from '@playwright/test'
import { primeAuthenticatedSession } from './helpers/auth-helpers'

test.describe('Connections', () => {
  test.beforeEach(async ({ page }) => {
    await primeAuthenticatedSession(page)
    await page.goto('/')
  })

  test('should open add connection modal with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('heading', { name: 'Add Connection' })).toBeVisible()
  })

  test('should show connection type options', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('heading', { name: 'Add Connection' })).toBeVisible()

    // Check connection type select exists with options
    const typeSelect = page.locator('select').filter({ hasText: 'Influenced' })
    await expect(typeSelect).toBeVisible()

    // Verify options exist in the select (native select options)
    await expect(typeSelect.locator('option', { hasText: 'Influenced' })).toBeAttached()
    await expect(typeSelect.locator('option', { hasText: 'Critiqued' })).toBeAttached()
    await expect(typeSelect.locator('option', { hasText: 'Built Upon' })).toBeAttached()
    await expect(typeSelect.locator('option', { hasText: 'Synthesized' })).toBeAttached()
  })

  test('should show validation error when thinkers not selected', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('heading', { name: 'Add Connection' })).toBeVisible()

    // Try to submit without selecting thinkers
    await page.getByRole('button', { name: 'Add Connection' }).click()

    // Should show validation error
    await expect(page.getByText(/please select both thinkers/i)).toBeVisible()
  })

  test('should show bidirectional checkbox', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByLabel(/bidirectional/i)).toBeVisible()
  })

  test('should show optional fields', async ({ page }) => {
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog', { name: 'Add Connection' })
    await expect(dialog.getByText('Connection Name (optional)')).toBeVisible()
    await expect(dialog.locator('label', { hasText: 'Notes' })).toBeVisible()
    await expect(dialog.getByText('Strength (1-5, optional)')).toBeVisible()
  })

  test('should cancel adding a connection', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('heading', { name: 'Add Connection' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: 'Add Connection' })).not.toBeVisible()
  })
})
