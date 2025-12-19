import { Page, Locator } from '@playwright/test'
import { TIMEOUTS } from '../config/test-constants'

export class ToolbarPage {
  readonly page: Page

  // Main toolbar
  readonly toolbar: Locator

  // Add buttons
  readonly addThinkerButton: Locator
  readonly addConnectionButton: Locator
  readonly addEventButton: Locator

  // Timeline buttons
  readonly newTimelineButton: Locator
  readonly combineViewButton: Locator

  // Feature buttons
  readonly analysisButton: Locator
  readonly compareButton: Locator
  readonly aiButton: Locator
  readonly animateButton: Locator
  readonly exportButton: Locator
  readonly helpButton: Locator

  // Filter and search
  readonly filterButton: Locator
  readonly filterDropdown: Locator
  readonly searchInput: Locator
  readonly clearSearchButton: Locator

  // More menu
  readonly moreButton: Locator
  readonly moreMenu: Locator

  // Mobile menu
  readonly mobileMenuButton: Locator
  readonly mobileMenu: Locator

  constructor(page: Page) {
    this.page = page

    // Main toolbar container
    this.toolbar = page.locator('[data-testid="toolbar"]').or(page.locator('header'))

    // Add buttons - multiple fallback selectors
    this.addThinkerButton = this.toolbar.locator('button').filter({ hasText: /add.*thinker/i }).first()
    this.addConnectionButton = this.toolbar.locator('button').filter({ hasText: /add.*connection/i }).first()
    this.addEventButton = this.toolbar.locator('button').filter({ hasText: /add.*event/i }).first()

    // Timeline buttons
    this.newTimelineButton = this.toolbar.locator('button').filter({ hasText: /\+new/i }).first()
    this.combineViewButton = this.toolbar.locator('button').filter({ hasText: /\+combine/i }).first()

    // Feature buttons
    this.analysisButton = this.toolbar.locator('button').filter({ hasText: /analysis/i }).first()
    this.compareButton = this.toolbar.locator('button').filter({ hasText: /compare/i }).first()
    this.aiButton = this.toolbar.locator('button').filter({ hasText: /^ai$/i }).first()
    this.animateButton = this.toolbar.locator('button').filter({ hasText: /animate/i }).first()
    this.exportButton = this.toolbar.locator('button').filter({ hasText: /export/i }).first()
    this.helpButton = this.toolbar.locator('button').filter({ hasText: /help|\?/i }).first()

    // Filter and search
    this.filterButton = this.toolbar.locator('button').filter({ hasText: /filter/i }).first()
    this.filterDropdown = page.locator('[data-testid="filter-dropdown"]').or(page.locator('.filter-dropdown'))
    this.searchInput = this.toolbar.locator('input[placeholder*="Search"]')
    this.clearSearchButton = this.toolbar.locator('button[aria-label="Clear search"]')

    // More menu
    this.moreButton = this.toolbar.locator('button').filter({ hasText: /more|⋯|\.\.\./i }).first()
    this.moreMenu = page.locator('[data-testid="more-menu"]').or(page.locator('[role="menu"]'))

    // Mobile menu
    this.mobileMenuButton = this.toolbar.locator('[data-testid="mobile-menu-button"]')
      .or(this.toolbar.locator('button[aria-label="Menu"]'))
    this.mobileMenu = page.locator('[data-testid="mobile-menu"]').or(page.locator('.mobile-menu'))
  }

  // Visibility checks
  async isToolbarVisible(): Promise<boolean> {
    return this.toolbar.isVisible()
  }

  async isAddThinkerButtonVisible(): Promise<boolean> {
    return this.addThinkerButton.isVisible()
  }

  async isAddConnectionButtonVisible(): Promise<boolean> {
    return this.addConnectionButton.isVisible()
  }

  async isSearchVisible(): Promise<boolean> {
    return this.searchInput.isVisible()
  }

  async isFilterButtonVisible(): Promise<boolean> {
    return this.filterButton.isVisible()
  }

  // Button clicks
  async clickAddThinker(): Promise<void> {
    await this.addThinkerButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async clickAddConnection(): Promise<void> {
    await this.addConnectionButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async clickAddEvent(): Promise<void> {
    await this.addEventButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async clickNewTimeline(): Promise<void> {
    await this.newTimelineButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async clickCombineView(): Promise<void> {
    await this.combineViewButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async clickAnalysis(): Promise<void> {
    await this.analysisButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async clickCompare(): Promise<void> {
    await this.compareButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async clickAI(): Promise<void> {
    await this.aiButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async clickAnimate(): Promise<void> {
    await this.animateButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async clickExport(): Promise<void> {
    await this.exportButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async clickHelp(): Promise<void> {
    await this.helpButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  // Search functionality
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(TIMEOUTS.short)
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear()
    await this.page.waitForTimeout(TIMEOUTS.short)
  }

  async getSearchValue(): Promise<string> {
    return this.searchInput.inputValue()
  }

  // Filter functionality
  async openFilterDropdown(): Promise<void> {
    await this.filterButton.click()
    await this.filterDropdown.waitFor({ state: 'visible' })
  }

  async closeFilterDropdown(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async selectFilter(filterName: string): Promise<void> {
    await this.openFilterDropdown()
    const filterOption = this.filterDropdown.locator('button, [role="option"]').filter({ hasText: filterName })
    await filterOption.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async getActiveFilters(): Promise<string[]> {
    const activeFilters = this.toolbar.locator('[data-testid="active-filter"], .active-filter')
    const count = await activeFilters.count()
    const filters: string[] = []
    for (let i = 0; i < count; i++) {
      const text = await activeFilters.nth(i).textContent()
      if (text) filters.push(text)
    }
    return filters
  }

  // More menu functionality
  async openMoreMenu(): Promise<void> {
    await this.moreButton.click()
    await this.moreMenu.waitFor({ state: 'visible' })
  }

  async closeMoreMenu(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async selectMoreMenuItem(itemName: string): Promise<void> {
    await this.openMoreMenu()
    const menuItem = this.moreMenu.locator('button, [role="menuitem"]').filter({ hasText: itemName })
    await menuItem.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  // Mobile menu functionality
  async openMobileMenu(): Promise<void> {
    if (await this.mobileMenuButton.isVisible()) {
      await this.mobileMenuButton.click()
      await this.mobileMenu.waitFor({ state: 'visible' })
    }
  }

  async closeMobileMenu(): Promise<void> {
    await this.page.keyboard.press('Escape')
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async selectMobileMenuItem(itemName: string): Promise<void> {
    await this.openMobileMenu()
    const menuItem = this.mobileMenu.locator('button').filter({ hasText: itemName })
    await menuItem.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  // Button state checks
  async isButtonEnabled(buttonLocator: Locator): Promise<boolean> {
    return buttonLocator.isEnabled()
  }

  async isButtonDisabled(buttonLocator: Locator): Promise<boolean> {
    return buttonLocator.isDisabled()
  }

  // Get all visible buttons (for testing purposes)
  async getVisibleButtonTexts(): Promise<string[]> {
    const buttons = this.toolbar.locator('button')
    const count = await buttons.count()
    const texts: string[] = []
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i)
      if (await button.isVisible()) {
        const text = await button.textContent()
        if (text) texts.push(text.trim())
      }
    }
    return texts
  }
}

// Factory function
export function createToolbarPage(page: Page): ToolbarPage {
  return new ToolbarPage(page)
}
