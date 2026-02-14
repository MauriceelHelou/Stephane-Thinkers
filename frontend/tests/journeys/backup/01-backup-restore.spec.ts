import { test, expect, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

import { createMainPage } from '../../page-objects/main-page.po'
import { createAPIHelpers } from '../../helpers/api-helpers'
import { API_URL, TIMEOUTS } from '../../config/test-constants'

async function openSettingsDataTab(page: Page) {
  const mainPage = createMainPage(page)
  await mainPage.waitForPageLoad()
  await mainPage.openMoreMenu()
  await page.getByRole('button', { name: /^Settings$/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /^Data$/i }).click()
  await expect(page.getByText('Database Backup & Restore')).toBeVisible()
}

test.describe('Journey: Backup & Restore', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: 1,
      thinkers: 3,
      connections: 2,
      notes: 1,
    })

    const mainPage = createMainPage(page)
    await mainPage.goto()
  })

  test('exports database backup as a JSON file', async ({ page }) => {
    await openSettingsDataTab(page)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download Database Backup/i }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/^database-backup-.*\.json$/)
    await expect(page.getByText(/Last export:/i)).toBeVisible()
  })

  test('previews and restores a valid backup', async ({ page, request }, testInfo) => {
    await openSettingsDataTab(page)

    const exportResponse = await request.get(`${API_URL}/api/backup/export`)
    expect(exportResponse.ok()).toBeTruthy()

    const backupPath = testInfo.outputPath('roundtrip-backup.json')
    await writeFile(backupPath, Buffer.from(await exportResponse.body()))

    await page.locator('input[type="file"][accept=".json"]').setInputFiles(backupPath)

    await expect(page.getByText('Backup Preview')).toBeVisible({ timeout: TIMEOUTS.long })
    await expect(page.getByRole('checkbox')).not.toBeChecked()

    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /Restore Database/i }).click()

    await expect(page.getByText(/Successfully imported database/i)).toBeVisible({ timeout: TIMEOUTS.long })
  })

  test('shows a clear error for invalid backup json', async ({ page }, testInfo) => {
    await openSettingsDataTab(page)

    const invalidBackupPath = testInfo.outputPath('invalid-backup.json')
    await writeFile(invalidBackupPath, '{ not valid json')

    await page.locator('input[type="file"][accept=".json"]').setInputFiles(invalidBackupPath)

    await expect(page.getByText(/Invalid JSON format/i)).toBeVisible({ timeout: TIMEOUTS.long })
    await expect(page.getByRole('button', { name: /Restore Database/i })).toBeHidden()
  })
})
