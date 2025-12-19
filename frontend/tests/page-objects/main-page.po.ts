import { Page, Locator, expect } from '@playwright/test'
import { TEST_IDS, TIMEOUTS } from '../config/test-constants'
import { CanvasHelpers, createCanvasHelpers } from '../helpers/canvas-helpers'
import { KeyboardHelpers, createKeyboardHelpers } from '../helpers/keyboard-helpers'

export class MainPage {
  readonly page: Page
  readonly canvas: CanvasHelpers
  readonly keyboard: KeyboardHelpers

  // Toolbar elements
  readonly toolbar: Locator
  readonly addThinkerButton: Locator
  readonly addConnectionButton: Locator
  readonly addEventButton: Locator
  readonly newTimelineButton: Locator
  readonly combineViewButton: Locator
  readonly exportButton: Locator
  readonly helpButton: Locator
  readonly analysisButton: Locator
  readonly compareButton: Locator
  readonly aiButton: Locator
  readonly animateButton: Locator
  readonly moreMenuButton: Locator
  readonly filterButton: Locator
  readonly searchInput: Locator

  // Canvas elements
  readonly canvasElement: Locator
  readonly zoomControls: Locator
  readonly zoomInButton: Locator
  readonly zoomOutButton: Locator
  readonly resetZoomButton: Locator
  readonly zoomIndicator: Locator
  readonly minimap: Locator

  // Timeline tabs
  readonly timelineTabs: Locator
  readonly allThinkersTab: Locator

  // Panels
  readonly detailPanel: Locator
  readonly notesPanel: Locator
  readonly aiPanel: Locator
  readonly networkMetricsPanel: Locator
  readonly researchQuestionsPanel: Locator
  readonly quotesPanel: Locator

  // Connection legend
  readonly connectionLegend: Locator

  constructor(page: Page) {
    this.page = page
    this.canvas = createCanvasHelpers(page)
    this.keyboard = createKeyboardHelpers(page)

    // Toolbar
    this.toolbar = page.locator(`[data-testid="${TEST_IDS.toolbar}"]`).or(page.locator('header'))
    // Use specific locators that match toolbar buttons with keyboard shortcuts
    this.addThinkerButton = page.locator('button').filter({ hasText: /Ctrl\+T/i }).first()
    this.addConnectionButton = page.locator('button').filter({ hasText: /Ctrl\+K/i }).first()
    this.addEventButton = page.locator('button').filter({ hasText: /Ctrl\+E/i }).first()
    this.newTimelineButton = page.locator('button').filter({ hasText: /\+new/i }).first()
    this.combineViewButton = page.locator('button').filter({ hasText: /\+combine/i }).first()
    this.exportButton = page.locator('button').filter({ hasText: /export/i }).first()
    this.helpButton = page.locator('button').filter({ hasText: /help|\?/i }).first()
    this.analysisButton = page.locator('button').filter({ hasText: /analysis/i }).first()
    this.compareButton = page.locator('button').filter({ hasText: /compare/i }).first()
    this.aiButton = page.locator('button').filter({ hasText: /ai/i }).first()
    this.animateButton = page.locator('button').filter({ hasText: /animate/i }).first()
    this.moreMenuButton = page.locator('button').filter({ hasText: /more|⋯/i }).first()
    this.filterButton = page.locator('button').filter({ hasText: /filter/i }).first()
    this.searchInput = page.locator('input[placeholder*="Search"]').first()

    // Canvas
    this.canvasElement = page.locator('canvas').first()
    this.zoomControls = page.locator(`[data-testid="${TEST_IDS.zoomControls}"]`)
    this.zoomInButton = page.locator(`[data-testid="${TEST_IDS.zoomInButton}"]`).or(page.locator('button').filter({ hasText: '+' }))
    this.zoomOutButton = page.locator(`[data-testid="${TEST_IDS.zoomOutButton}"]`).or(page.locator('button').filter({ hasText: '-' }))
    this.resetZoomButton = page.locator(`[data-testid="${TEST_IDS.resetZoomButton}"]`)
    this.zoomIndicator = page.locator(`[data-testid="${TEST_IDS.zoomIndicator}"]`)
    this.minimap = page.locator(`[data-testid="${TEST_IDS.minimap}"]`)

    // Timeline tabs
    this.timelineTabs = page.locator(`[data-testid="${TEST_IDS.timelineTabs}"]`).or(page.locator('[role="tablist"]'))
    this.allThinkersTab = page.locator('button').filter({ hasText: /all thinkers/i }).first()

    // Panels
    this.detailPanel = page.locator(`[data-testid="${TEST_IDS.detailPanel}"]`)
    this.notesPanel = page.locator(`[data-testid="${TEST_IDS.notesPanel}"]`)
    this.aiPanel = page.locator(`[data-testid="${TEST_IDS.aiPanel}"]`)
    this.networkMetricsPanel = page.locator(`[data-testid="${TEST_IDS.networkMetricsPanel}"]`)
    this.researchQuestionsPanel = page.locator(`[data-testid="${TEST_IDS.researchQuestionsPanel}"]`)
    this.quotesPanel = page.locator(`[data-testid="${TEST_IDS.quotesPanel}"]`)

    // Connection legend
    this.connectionLegend = page.locator(`[data-testid="${TEST_IDS.connectionLegend}"]`).or(page.locator('.connection-legend'))
  }

  // Navigation
  async goto(): Promise<void> {
    await this.page.goto('/')
    await this.waitForPageLoad()
  }

  async waitForPageLoad(): Promise<void> {
    await this.canvasElement.waitFor({ state: 'visible', timeout: TIMEOUTS.long })
    await this.page.waitForLoadState('networkidle')
    await this.canvas.waitForCanvasReady()
  }

  // Modal triggers
  async openAddThinkerModal(): Promise<void> {
    await this.addThinkerButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async openAddConnectionModal(): Promise<void> {
    await this.addConnectionButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async openAddEventModal(): Promise<void> {
    await this.addEventButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async openNewTimelineModal(): Promise<void> {
    await this.newTimelineButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async openCombineViewModal(): Promise<void> {
    await this.combineViewButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async openExportModal(): Promise<void> {
    await this.exportButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  async openHelpGuide(): Promise<void> {
    await this.helpButton.click()
    await this.page.waitForSelector('[role="dialog"]', { state: 'visible' })
  }

  // Panel toggles
  async openAIPanel(): Promise<void> {
    await this.aiButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async openAnalysisPanel(): Promise<void> {
    await this.analysisButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async openCompareView(): Promise<void> {
    await this.compareButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async toggleAnimation(): Promise<void> {
    await this.animateButton.click()
  }

  // Timeline tab interactions
  async selectTimelineTab(name: string): Promise<void> {
    const tab = this.page.locator('button').filter({ hasText: name })
    await tab.click()
    await this.canvas.waitForCanvasRender()
  }

  async selectAllThinkersTab(): Promise<void> {
    await this.allThinkersTab.click()
    await this.canvas.waitForCanvasRender()
  }

  async getTimelineTabCount(): Promise<number> {
    const tabs = this.page.locator(`[data-testid="${TEST_IDS.timelineTab}"]`)
    return tabs.count()
  }

  // Search functionality
  async searchFor(query: string): Promise<void> {
    await this.searchInput.fill(query)
    await this.page.waitForTimeout(TIMEOUTS.short)
  }

  async clearSearch(): Promise<void> {
    await this.searchInput.clear()
    await this.page.waitForTimeout(TIMEOUTS.short)
  }

  // Filter functionality
  async openFilterDropdown(): Promise<void> {
    await this.filterButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  // Connection legend
  async toggleConnectionType(type: 'influenced' | 'critiqued' | 'built_upon' | 'synthesized'): Promise<void> {
    const checkbox = this.page.locator(`[data-testid="${type}-checkbox"]`)
      .or(this.page.locator('label').filter({ hasText: new RegExp(type.replace('_', ' '), 'i') }))
    await checkbox.click()
    await this.canvas.waitForCanvasRender()
  }

  // More menu
  async openMoreMenu(): Promise<void> {
    await this.moreMenuButton.click()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async selectMoreMenuItem(itemText: string): Promise<void> {
    await this.openMoreMenu()
    const item = this.page.locator('button, [role="menuitem"]').filter({ hasText: itemText })
    await item.click()
  }

  // Modal utilities
  async closeModal(): Promise<void> {
    await this.keyboard.escape()
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async isModalOpen(): Promise<boolean> {
    const modal = this.page.locator('[role="dialog"]')
    return modal.isVisible()
  }

  // Canvas interactions through the helper
  async clickOnCanvas(x: number, y: number): Promise<void> {
    await this.canvas.clickOnCanvas(x, y)
  }

  async panCanvas(deltaX: number, deltaY: number): Promise<void> {
    await this.canvas.panCanvas(deltaX, deltaY)
  }

  async zoomIn(): Promise<void> {
    await this.canvas.zoomIn()
  }

  async zoomOut(): Promise<void> {
    await this.canvas.zoomOut()
  }

  // Detail panel interactions
  async isDetailPanelOpen(): Promise<boolean> {
    return this.detailPanel.isVisible()
  }

  async closeDetailPanel(): Promise<void> {
    const closeButton = this.detailPanel.locator('button').filter({ hasText: '×' })
    if (await closeButton.isVisible()) {
      await closeButton.click()
    } else {
      await this.keyboard.escape()
    }
    await this.page.waitForTimeout(TIMEOUTS.animation)
  }

  async getDetailPanelTitle(): Promise<string | null> {
    const title = this.detailPanel.locator('h2, h3').first()
    if (await title.isVisible()) {
      return title.textContent()
    }
    return null
  }

  // Keyboard shortcuts
  async pressAddThinkerShortcut(): Promise<void> {
    await this.keyboard.addThinker()
  }

  async pressAddConnectionShortcut(): Promise<void> {
    await this.keyboard.addConnection()
  }

  async pressAddEventShortcut(): Promise<void> {
    await this.keyboard.addEvent()
  }

  async pressNewTimelineShortcut(): Promise<void> {
    await this.keyboard.newTimeline()
  }

  async pressCommandPalette(): Promise<void> {
    await this.keyboard.openCommandPalette()
  }

  async pressHelpShortcut(): Promise<void> {
    await this.keyboard.openHelp()
  }

  // Screenshot for visual testing
  async takeScreenshot(name: string): Promise<Buffer> {
    return this.page.screenshot({ path: `./test-results/${name}.png`, fullPage: true })
  }

  // Wait utilities
  async waitForAPIResponse(urlPattern: string | RegExp): Promise<void> {
    await this.page.waitForResponse(
      resp => typeof urlPattern === 'string'
        ? resp.url().includes(urlPattern)
        : urlPattern.test(resp.url()),
      { timeout: TIMEOUTS.apiCall }
    )
  }

  async waitForNoNetworkActivity(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
  }
}

// Factory function
export function createMainPage(page: Page): MainPage {
  return new MainPage(page)
}
