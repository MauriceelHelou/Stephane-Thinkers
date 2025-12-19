import { Page, Locator } from '@playwright/test'
import { TIMEOUTS } from '../../config/test-constants'

export class AddConnectionModal {
  readonly page: Page
  readonly modal: Locator

  // Form fields
  readonly fromThinkerSelect: Locator
  readonly toThinkerSelect: Locator
  readonly connectionTypeSelect: Locator
  readonly strengthSlider: Locator
  readonly strengthInput: Locator
  readonly bidirectionalCheckbox: Locator
  readonly nameInput: Locator
  readonly notesTextarea: Locator

  // Buttons
  readonly submitButton: Locator
  readonly cancelButton: Locator
  readonly closeButton: Locator

  // Error messages
  readonly errorMessages: Locator

  constructor(page: Page) {
    this.page = page
    this.modal = page.locator('[role="dialog"]').filter({ has: page.locator('text=/add.*connection/i') })

    // Form fields
    this.fromThinkerSelect = this.modal.locator('[data-testid="from-thinker-select"]')
      .or(this.modal.locator('select[name="from_thinker_id"]'))
      .or(this.modal.locator('button').filter({ hasText: /from.*thinker|select.*from/i }).first())
    this.toThinkerSelect = this.modal.locator('[data-testid="to-thinker-select"]')
      .or(this.modal.locator('select[name="to_thinker_id"]'))
      .or(this.modal.locator('button').filter({ hasText: /to.*thinker|select.*to/i }).first())
    this.connectionTypeSelect = this.modal.locator('select[name="connection_type"]')
      .or(this.modal.locator('[data-testid="connection-type-select"]'))
      .or(this.modal.locator('button').filter({ hasText: /connection.*type|select.*type/i }).first())
    this.strengthSlider = this.modal.locator('input[type="range"][name="strength"]')
    this.strengthInput = this.modal.locator('input[name="strength"]').filter({ has: page.locator('[type="number"]') })
    this.bidirectionalCheckbox = this.modal.locator('input[type="checkbox"][name="bidirectional"]')
      .or(this.modal.locator('label').filter({ hasText: /bidirectional/i }).locator('input'))
    this.nameInput = this.modal.locator('input[name="name"]')
      .or(this.modal.locator('input[placeholder*="name" i]'))
    this.notesTextarea = this.modal.locator('textarea[name="notes"]')
      .or(this.modal.locator('textarea'))

    // Buttons
    this.submitButton = this.modal.locator('button[type="submit"]')
      .or(this.modal.locator('button').filter({ hasText: /save|create|add/i }).first())
    this.cancelButton = this.modal.locator('button').filter({ hasText: /cancel/i })
    this.closeButton = this.modal.locator('button').filter({ hasText: /×|close/i })

    // Error messages
    this.errorMessages = this.modal.locator('.error, [role="alert"], .text-red-500')
  }

  // Visibility
  async isVisible(): Promise<boolean> {
    return this.modal.isVisible()
  }

  async waitForVisible(): Promise<void> {
    await this.modal.waitFor({ state: 'visible', timeout: TIMEOUTS.medium })
  }

  async waitForHidden(): Promise<void> {
    await this.modal.waitFor({ state: 'hidden', timeout: TIMEOUTS.medium })
  }

  // Thinker selection
  async selectFromThinker(thinkerName: string): Promise<void> {
    await this.fromThinkerSelect.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
    // Search if available
    const searchInput = this.page.locator('input[placeholder*="search" i]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill(thinkerName)
      await this.page.waitForTimeout(TIMEOUTS.short)
    }
    await this.page.locator('li, [role="option"]').filter({ hasText: thinkerName }).first().click()
  }

  async selectToThinker(thinkerName: string): Promise<void> {
    await this.toThinkerSelect.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
    // Search if available
    const searchInput = this.page.locator('input[placeholder*="search" i]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill(thinkerName)
      await this.page.waitForTimeout(TIMEOUTS.short)
    }
    await this.page.locator('li, [role="option"]').filter({ hasText: thinkerName }).first().click()
  }

  // Connection type selection
  async selectConnectionType(type: 'influenced' | 'critiqued' | 'built_upon' | 'synthesized'): Promise<void> {
    const typeLabels: Record<string, string> = {
      influenced: 'Influenced',
      critiqued: 'Critiqued',
      built_upon: 'Built Upon',
      synthesized: 'Synthesized',
    }
    const label = typeLabels[type] || type

    if (await this.connectionTypeSelect.evaluate(el => el.tagName === 'SELECT')) {
      await this.connectionTypeSelect.selectOption({ value: type })
    } else {
      await this.connectionTypeSelect.click()
      await this.page.locator('li, [role="option"]').filter({ hasText: label }).click()
    }
  }

  // Strength
  async setStrength(value: number): Promise<void> {
    const strength = Math.max(1, Math.min(5, value))
    if (await this.strengthSlider.isVisible()) {
      await this.strengthSlider.fill(strength.toString())
    } else if (await this.strengthInput.isVisible()) {
      await this.strengthInput.fill(strength.toString())
    }
  }

  async getStrength(): Promise<number> {
    if (await this.strengthSlider.isVisible()) {
      return parseInt(await this.strengthSlider.inputValue())
    } else if (await this.strengthInput.isVisible()) {
      return parseInt(await this.strengthInput.inputValue())
    }
    return 3 // default
  }

  // Bidirectional
  async setBidirectional(value: boolean): Promise<void> {
    const isChecked = await this.bidirectionalCheckbox.isChecked()
    if (isChecked !== value) {
      await this.bidirectionalCheckbox.click()
    }
  }

  async isBidirectional(): Promise<boolean> {
    return this.bidirectionalCheckbox.isChecked()
  }

  // Name and notes
  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name)
  }

  async fillNotes(notes: string): Promise<void> {
    await this.notesTextarea.fill(notes)
  }

  // Complete form filling helper
  async fillForm(data: {
    fromThinker: string
    toThinker: string
    connectionType: 'influenced' | 'critiqued' | 'built_upon' | 'synthesized'
    strength?: number
    bidirectional?: boolean
    name?: string
    notes?: string
  }): Promise<void> {
    await this.selectFromThinker(data.fromThinker)
    await this.selectToThinker(data.toThinker)
    await this.selectConnectionType(data.connectionType)
    if (data.strength !== undefined) await this.setStrength(data.strength)
    if (data.bidirectional !== undefined) await this.setBidirectional(data.bidirectional)
    if (data.name) await this.fillName(data.name)
    if (data.notes) await this.fillNotes(data.notes)
  }

  // Form submission
  async submit(): Promise<void> {
    await this.submitButton.click()
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click()
    await this.waitForHidden()
  }

  async close(): Promise<void> {
    await this.closeButton.click()
    await this.waitForHidden()
  }

  // Error handling
  async hasErrors(): Promise<boolean> {
    return this.errorMessages.first().isVisible()
  }

  async getErrorMessages(): Promise<string[]> {
    const errors = await this.errorMessages.allTextContents()
    return errors.filter(e => e.trim())
  }

  // Form state
  async isFormValid(): Promise<boolean> {
    // Check if both thinkers are selected and they're different
    const fromSelected = await this.fromThinkerSelect.textContent()
    const toSelected = await this.toThinkerSelect.textContent()
    return !!fromSelected && !!toSelected && fromSelected !== toSelected
  }

  async isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled()
  }
}

// Factory function
export function createAddConnectionModal(page: Page): AddConnectionModal {
  return new AddConnectionModal(page)
}
