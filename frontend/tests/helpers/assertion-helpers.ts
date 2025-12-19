import { Page, Locator, expect } from '@playwright/test'
import { TIMEOUTS } from '../config/test-constants'

export class AssertionHelpers {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  // Modal assertions
  async expectModalVisible(testId: string): Promise<void> {
    const modal = this.page.locator(`[data-testid="${testId}"]`)
    await expect(modal).toBeVisible({ timeout: TIMEOUTS.medium })
  }

  async expectModalHidden(testId: string): Promise<void> {
    const modal = this.page.locator(`[data-testid="${testId}"]`)
    await expect(modal).toBeHidden({ timeout: TIMEOUTS.medium })
  }

  async expectAnyModalVisible(): Promise<void> {
    const modal = this.page.locator('[role="dialog"]')
    await expect(modal.first()).toBeVisible({ timeout: TIMEOUTS.medium })
  }

  async expectNoModalVisible(): Promise<void> {
    const modals = this.page.locator('[role="dialog"]')
    const count = await modals.count()
    expect(count).toBe(0)
  }

  // Toast/notification assertions
  async expectToastMessage(message: string | RegExp): Promise<void> {
    const toast = this.page.locator('[role="alert"], .toast, [data-testid="toast"]')
    await expect(toast.first()).toContainText(message, { timeout: TIMEOUTS.medium })
  }

  async expectSuccessToast(): Promise<void> {
    const toast = this.page.locator('[role="alert"].success, .toast.success, [data-testid="toast-success"]')
    await expect(toast.first()).toBeVisible({ timeout: TIMEOUTS.medium })
  }

  async expectErrorToast(): Promise<void> {
    const toast = this.page.locator('[role="alert"].error, .toast.error, [data-testid="toast-error"]')
    await expect(toast.first()).toBeVisible({ timeout: TIMEOUTS.medium })
  }

  // Form assertions
  async expectInputValue(selector: string, value: string): Promise<void> {
    const input = this.page.locator(selector)
    await expect(input).toHaveValue(value)
  }

  async expectInputError(selector: string): Promise<void> {
    const input = this.page.locator(selector)
    await expect(input).toHaveClass(/error|invalid/)
  }

  async expectFormValid(formSelector: string): Promise<void> {
    const form = this.page.locator(formSelector)
    const invalidInputs = form.locator(':invalid')
    const count = await invalidInputs.count()
    expect(count).toBe(0)
  }

  async expectFormInvalid(formSelector: string): Promise<void> {
    const form = this.page.locator(formSelector)
    const invalidInputs = form.locator(':invalid')
    const count = await invalidInputs.count()
    expect(count).toBeGreaterThan(0)
  }

  // Button assertions
  async expectButtonEnabled(selector: string): Promise<void> {
    const button = this.page.locator(selector)
    await expect(button).toBeEnabled()
  }

  async expectButtonDisabled(selector: string): Promise<void> {
    const button = this.page.locator(selector)
    await expect(button).toBeDisabled()
  }

  // Element state assertions
  async expectElementVisible(selector: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element.first()).toBeVisible({ timeout: TIMEOUTS.medium })
  }

  async expectElementHidden(selector: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element).toBeHidden({ timeout: TIMEOUTS.medium })
  }

  async expectElementCount(selector: string, count: number): Promise<void> {
    const elements = this.page.locator(selector)
    await expect(elements).toHaveCount(count)
  }

  async expectElementText(selector: string, text: string | RegExp): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element.first()).toContainText(text)
  }

  // Canvas assertions
  async expectCanvasVisible(): Promise<void> {
    const canvas = this.page.locator('canvas')
    await expect(canvas.first()).toBeVisible()
  }

  // API response assertions
  async expectAPIResponse(
    urlPattern: string | RegExp,
    expectedStatus: number = 200
  ): Promise<void> {
    const response = await this.page.waitForResponse(
      resp => {
        if (typeof urlPattern === 'string') {
          return resp.url().includes(urlPattern)
        }
        return urlPattern.test(resp.url())
      },
      { timeout: TIMEOUTS.apiCall }
    )
    expect(response.status()).toBe(expectedStatus)
  }

  async expectAPIError(urlPattern: string | RegExp): Promise<void> {
    const response = await this.page.waitForResponse(
      resp => {
        if (typeof urlPattern === 'string') {
          return resp.url().includes(urlPattern)
        }
        return urlPattern.test(resp.url())
      },
      { timeout: TIMEOUTS.apiCall }
    )
    expect(response.status()).toBeGreaterThanOrEqual(400)
  }

  // Page state assertions
  async expectURL(urlPattern: string | RegExp): Promise<void> {
    if (typeof urlPattern === 'string') {
      await expect(this.page).toHaveURL(urlPattern)
    } else {
      await expect(this.page).toHaveURL(urlPattern)
    }
  }

  async expectTitle(title: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(title)
  }

  // Loading state assertions
  async expectLoadingVisible(): Promise<void> {
    const loading = this.page.locator('[data-testid="loading"], .loading, [aria-busy="true"]')
    await expect(loading.first()).toBeVisible({ timeout: TIMEOUTS.short })
  }

  async expectLoadingHidden(): Promise<void> {
    const loading = this.page.locator('[data-testid="loading"], .loading, [aria-busy="true"]')
    await expect(loading).toBeHidden({ timeout: TIMEOUTS.long })
  }

  // Accessibility assertions
  async expectAccessibleName(selector: string, name: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element.first()).toHaveAccessibleName(name)
  }

  async expectAccessibleDescription(selector: string, description: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element.first()).toHaveAccessibleDescription(description)
  }

  async expectFocused(selector: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element.first()).toBeFocused()
  }

  // Data state assertions (useful for checking if data loaded)
  async expectThinkerInList(name: string): Promise<void> {
    // Thinkers can appear in lists, panels, or on canvas
    const thinkerElement = this.page.locator(`text="${name}"`)
    await expect(thinkerElement.first()).toBeVisible({ timeout: TIMEOUTS.medium })
  }

  async expectConnectionVisible(fromName: string, toName: string): Promise<void> {
    // Connections appear in connection lists or on canvas
    // This is a higher-level assertion
    const from = this.page.locator(`text="${fromName}"`)
    const to = this.page.locator(`text="${toName}"`)
    await expect(from.first()).toBeVisible()
    await expect(to.first()).toBeVisible()
  }

  async expectTimelineTabVisible(name: string): Promise<void> {
    const tab = this.page.locator(`[data-testid="timeline-tab"]`).filter({ hasText: name })
    await expect(tab).toBeVisible()
  }

  // Detail panel assertions
  async expectDetailPanelOpen(): Promise<void> {
    const panel = this.page.locator('[data-testid="detail-panel"]')
    await expect(panel).toBeVisible()
  }

  async expectDetailPanelClosed(): Promise<void> {
    const panel = this.page.locator('[data-testid="detail-panel"]')
    await expect(panel).toBeHidden()
  }

  async expectDetailPanelContains(text: string): Promise<void> {
    const panel = this.page.locator('[data-testid="detail-panel"]')
    await expect(panel).toContainText(text)
  }
}

// Factory function
export function createAssertionHelpers(page: Page): AssertionHelpers {
  return new AssertionHelpers(page)
}
