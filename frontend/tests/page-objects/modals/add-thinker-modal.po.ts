import { Page, Locator } from '@playwright/test'
import { TIMEOUTS } from '../../config/test-constants'

export class AddThinkerModal {
  readonly page: Page
  readonly modal: Locator

  // Form fields
  readonly nameInput: Locator
  readonly birthYearInput: Locator
  readonly deathYearInput: Locator
  readonly fieldInput: Locator
  readonly activePeriodInput: Locator
  readonly biographyTextarea: Locator
  readonly timelineSelect: Locator

  // Positioning options
  readonly autoPositionRadio: Locator
  readonly manualPositionRadio: Locator
  readonly positionXInput: Locator
  readonly positionYInput: Locator

  // Tags
  readonly tagSelector: Locator
  readonly selectedTags: Locator

  // Buttons
  readonly submitButton: Locator
  readonly cancelButton: Locator
  readonly closeButton: Locator

  // Error messages
  readonly errorMessages: Locator

  constructor(page: Page) {
    this.page = page
    this.modal = page.locator('[role="dialog"]').filter({ has: page.locator('text=/add.*thinker/i') })

    // Form fields - using multiple fallback selectors
    this.nameInput = this.modal.locator('input[name="name"]')
      .or(this.modal.locator('input').filter({ has: page.locator('label:text-matches("name", "i")') }).first())
      .or(this.modal.locator('input[placeholder*="name" i]').first())
    this.birthYearInput = this.modal.locator('input[name="birth_year"]')
      .or(this.modal.locator('input[placeholder*="birth" i]'))
    this.deathYearInput = this.modal.locator('input[name="death_year"]')
      .or(this.modal.locator('input[placeholder*="death" i]'))
    this.fieldInput = this.modal.locator('input[name="field"]')
      .or(this.modal.locator('input[placeholder*="field" i]'))
    this.activePeriodInput = this.modal.locator('input[name="active_period"]')
      .or(this.modal.locator('input[placeholder*="period" i]'))
    this.biographyTextarea = this.modal.locator('textarea[name="biography_notes"]')
      .or(this.modal.locator('textarea'))
    this.timelineSelect = this.modal.locator('select[name="timeline_id"]')
      .or(this.modal.locator('[data-testid="timeline-select"]'))
      .or(this.modal.locator('button').filter({ hasText: /select.*timeline/i }))

    // Positioning
    this.autoPositionRadio = this.modal.locator('input[type="radio"][value="auto"]')
      .or(this.modal.locator('label').filter({ hasText: /auto/i }).locator('input'))
    this.manualPositionRadio = this.modal.locator('input[type="radio"][value="manual"]')
      .or(this.modal.locator('label').filter({ hasText: /manual/i }).locator('input'))
    this.positionXInput = this.modal.locator('input[name="position_x"]')
    this.positionYInput = this.modal.locator('input[name="position_y"]')

    // Tags
    this.tagSelector = this.modal.locator('[data-testid="tag-selector"]')
      .or(this.modal.locator('button').filter({ hasText: /select.*tags/i }))
    this.selectedTags = this.modal.locator('[data-testid="selected-tags"]')
      .or(this.modal.locator('.selected-tags'))

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

  // Form filling
  async fillName(name: string): Promise<void> {
    await this.nameInput.fill(name)
  }

  async fillBirthYear(year: number): Promise<void> {
    await this.birthYearInput.fill(year.toString())
  }

  async fillDeathYear(year: number): Promise<void> {
    await this.deathYearInput.fill(year.toString())
  }

  async fillField(field: string): Promise<void> {
    await this.fieldInput.fill(field)
  }

  async fillActivePeriod(period: string): Promise<void> {
    await this.activePeriodInput.fill(period)
  }

  async fillBiography(notes: string): Promise<void> {
    await this.biographyTextarea.fill(notes)
  }

  async selectTimeline(timelineName: string): Promise<void> {
    // Handle both select and custom searchable dropdown
    if (await this.timelineSelect.evaluate(el => el.tagName === 'SELECT')) {
      await this.timelineSelect.selectOption({ label: timelineName })
    } else {
      await this.timelineSelect.click()
      await this.page.locator('li, [role="option"]').filter({ hasText: timelineName }).click()
    }
  }

  async setAutoPosition(): Promise<void> {
    if (await this.autoPositionRadio.isVisible()) {
      await this.autoPositionRadio.check()
    }
  }

  async setManualPosition(x: number, y: number): Promise<void> {
    if (await this.manualPositionRadio.isVisible()) {
      await this.manualPositionRadio.check()
      await this.positionXInput.fill(x.toString())
      await this.positionYInput.fill(y.toString())
    }
  }

  async selectTag(tagName: string): Promise<void> {
    await this.tagSelector.click()
    await this.page.locator('li, [role="option"]').filter({ hasText: tagName }).click()
  }

  // Complete form filling helper
  async fillForm(data: {
    name: string
    birthYear?: number
    deathYear?: number
    field?: string
    activePeriod?: string
    biography?: string
    timeline?: string
    tags?: string[]
  }): Promise<void> {
    await this.fillName(data.name)
    if (data.birthYear) await this.fillBirthYear(data.birthYear)
    if (data.deathYear) await this.fillDeathYear(data.deathYear)
    if (data.field) await this.fillField(data.field)
    if (data.activePeriod) await this.fillActivePeriod(data.activePeriod)
    if (data.biography) await this.fillBiography(data.biography)
    if (data.timeline) await this.selectTimeline(data.timeline)
    if (data.tags) {
      for (const tag of data.tags) {
        await this.selectTag(tag)
      }
    }
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
    const invalidInputs = this.modal.locator(':invalid')
    const count = await invalidInputs.count()
    return count === 0
  }

  async isSubmitEnabled(): Promise<boolean> {
    return this.submitButton.isEnabled()
  }

  // Get current values
  async getNameValue(): Promise<string> {
    return this.nameInput.inputValue()
  }

  async getBirthYearValue(): Promise<string> {
    return this.birthYearInput.inputValue()
  }

  async getDeathYearValue(): Promise<string> {
    return this.deathYearInput.inputValue()
  }
}

// Factory function
export function createAddThinkerModal(page: Page): AddThinkerModal {
  return new AddThinkerModal(page)
}
