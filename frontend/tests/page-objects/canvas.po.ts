import { Page, Locator } from '@playwright/test'
import { CanvasHelpers, createCanvasHelpers, CanvasCoordinates } from '../helpers/canvas-helpers'
import { TIMEOUTS } from '../config/test-constants'

export class CanvasPage {
  readonly page: Page
  readonly canvas: Locator
  readonly helpers: CanvasHelpers

  // Zoom controls
  readonly zoomInButton: Locator
  readonly zoomOutButton: Locator
  readonly resetZoomButton: Locator
  readonly fitToViewButton: Locator
  readonly zoomIndicator: Locator

  // Minimap
  readonly minimap: Locator

  // Year ruler
  readonly yearRuler: Locator
  readonly yearJumpInput: Locator

  constructor(page: Page) {
    this.page = page
    this.canvas = page.locator('canvas').first()
    this.helpers = createCanvasHelpers(page)

    // Zoom controls
    this.zoomInButton = page.locator('[data-testid="zoom-in-button"]')
      .or(page.locator('button[aria-label="Zoom in"]'))
      .or(page.locator('button').filter({ hasText: '+' }))
    this.zoomOutButton = page.locator('[data-testid="zoom-out-button"]')
      .or(page.locator('button[aria-label="Zoom out"]'))
      .or(page.locator('button').filter({ hasText: '-' }))
    this.resetZoomButton = page.locator('[data-testid="reset-zoom-button"]')
      .or(page.locator('button[aria-label="Reset zoom"]'))
    this.fitToViewButton = page.locator('[data-testid="fit-to-view-button"]')
      .or(page.locator('button[aria-label="Fit to view"]'))
    this.zoomIndicator = page.locator('[data-testid="zoom-indicator"]')

    // Minimap
    this.minimap = page.locator('[data-testid="minimap"]')

    // Year ruler
    this.yearRuler = page.locator('[data-testid="year-ruler"]')
    this.yearJumpInput = page.locator('[data-testid="year-jump-input"]')
  }

  // Canvas ready state
  async waitForReady(): Promise<void> {
    await this.canvas.waitFor({ state: 'visible' })
    await this.helpers.waitForCanvasReady()
  }

  // Zoom operations
  async zoomIn(steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      if (await this.zoomInButton.isVisible()) {
        await this.zoomInButton.click()
      } else {
        await this.helpers.zoomIn()
      }
      await this.helpers.waitForCanvasRender()
    }
  }

  async zoomOut(steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      if (await this.zoomOutButton.isVisible()) {
        await this.zoomOutButton.click()
      } else {
        await this.helpers.zoomOut()
      }
      await this.helpers.waitForCanvasRender()
    }
  }

  async resetZoom(): Promise<void> {
    if (await this.resetZoomButton.isVisible()) {
      await this.resetZoomButton.click()
    } else {
      await this.helpers.resetZoom()
    }
    await this.helpers.waitForCanvasRender()
  }

  async fitToView(): Promise<void> {
    if (await this.fitToViewButton.isVisible()) {
      await this.fitToViewButton.click()
      await this.helpers.waitForCanvasRender()
    }
  }

  async getZoomLevel(): Promise<string | null> {
    if (await this.zoomIndicator.isVisible()) {
      return this.zoomIndicator.textContent()
    }
    return null
  }

  async setZoomToLevel(level: number): Promise<void> {
    // Reset first
    await this.resetZoom()
    // Then zoom in or out as needed
    const currentLevel = 1.0
    const diff = level - currentLevel
    const steps = Math.abs(Math.round(diff * 5))

    if (diff > 0) {
      await this.zoomIn(steps)
    } else if (diff < 0) {
      await this.zoomOut(steps)
    }
  }

  // Pan operations
  async panLeft(pixels: number = 100): Promise<void> {
    await this.helpers.panCanvas(-pixels, 0)
  }

  async panRight(pixels: number = 100): Promise<void> {
    await this.helpers.panCanvas(pixels, 0)
  }

  async panUp(pixels: number = 100): Promise<void> {
    await this.helpers.panCanvas(0, -pixels)
  }

  async panDown(pixels: number = 100): Promise<void> {
    await this.helpers.panCanvas(0, pixels)
  }

  async panTo(x: number, y: number): Promise<void> {
    await this.helpers.panTo(x, y)
  }

  // Click operations
  async click(x: number, y: number): Promise<void> {
    await this.helpers.clickOnCanvas(x, y)
  }

  async clickCenter(): Promise<void> {
    await this.helpers.clickAtCanvasCenter()
  }

  async shiftClick(x: number, y: number): Promise<void> {
    await this.helpers.shiftClickOnCanvas(x, y)
  }

  async ctrlClick(x: number, y: number): Promise<void> {
    await this.helpers.ctrlClickOnCanvas(x, y)
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await this.helpers.doubleClickOnCanvas(x, y)
  }

  async rightClick(x: number, y: number): Promise<void> {
    await this.helpers.rightClickOnCanvas(x, y)
  }

  // Drag operations
  async drag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await this.helpers.dragOnCanvas(startX, startY, endX, endY)
  }

  async dragThinker(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await this.helpers.dragThinker(fromX, fromY, toX, toY)
  }

  async selectArea(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await this.helpers.selectAreaOnCanvas(startX, startY, endX, endY)
  }

  // Hover operations
  async hover(x: number, y: number): Promise<void> {
    await this.helpers.hoverOnCanvas(x, y)
  }

  async hoverCenter(): Promise<void> {
    const center = await this.helpers.getCanvasCenter()
    await this.helpers.hoverOnCanvas(center.x, center.y)
  }

  // Canvas information
  async getCanvasSize(): Promise<{ width: number; height: number }> {
    const box = await this.helpers.getCanvasBoundingBox()
    return { width: box.width, height: box.height }
  }

  async getCanvasCenter(): Promise<CanvasCoordinates> {
    return this.helpers.getCanvasCenter()
  }

  async isEmpty(): Promise<boolean> {
    return this.helpers.isCanvasEmpty()
  }

  // Minimap operations
  async isMinimapVisible(): Promise<boolean> {
    return this.minimap.isVisible()
  }

  async clickOnMinimap(x: number, y: number): Promise<void> {
    await this.minimap.click({ position: { x, y } })
    await this.helpers.waitForCanvasRender()
  }

  // Year navigation
  async jumpToYear(year: number): Promise<void> {
    if (await this.yearJumpInput.isVisible()) {
      await this.yearJumpInput.fill(year.toString())
      await this.page.keyboard.press('Enter')
      await this.helpers.waitForCanvasRender()
    }
  }

  // Screenshot
  async takeScreenshot(name: string): Promise<Buffer> {
    await this.helpers.waitForCanvasRender()
    return this.canvas.screenshot({ path: `./test-results/canvas-${name}.png` })
  }

  // Wheel zoom
  async wheelZoom(delta: number): Promise<void> {
    await this.helpers.zoomCanvas(delta)
  }

  async wheelZoomAtPosition(x: number, y: number, delta: number): Promise<void> {
    await this.helpers.zoomCanvas(delta, { x, y })
  }
}

// Factory function
export function createCanvasPage(page: Page): CanvasPage {
  return new CanvasPage(page)
}
