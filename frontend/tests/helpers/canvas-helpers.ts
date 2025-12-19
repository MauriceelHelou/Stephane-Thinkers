import { Page, Locator } from '@playwright/test'
import { TIMEOUTS } from '../config/test-constants'

export interface CanvasCoordinates {
  x: number
  y: number
}

export interface ThinkerPosition {
  id: string
  name: string
  x: number
  y: number
}

export class CanvasHelpers {
  private page: Page
  private canvasLocator: Locator

  constructor(page: Page) {
    this.page = page
    this.canvasLocator = page.locator('canvas').first()
  }

  // Canvas element access
  async getCanvas(): Promise<Locator> {
    await this.canvasLocator.waitFor({ state: 'visible' })
    return this.canvasLocator
  }

  async getCanvasBoundingBox(): Promise<{ x: number; y: number; width: number; height: number }> {
    const canvas = await this.getCanvas()
    const box = await canvas.boundingBox()
    if (!box) {
      throw new Error('Canvas bounding box not available')
    }
    return box
  }

  async getCanvasCenter(): Promise<CanvasCoordinates> {
    const box = await this.getCanvasBoundingBox()
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    }
  }

  // Wait utilities
  async waitForCanvasReady(): Promise<void> {
    const canvas = await this.getCanvas()
    await canvas.waitFor({ state: 'visible' })
    // Wait for initial render
    await this.page.waitForTimeout(TIMEOUTS.canvasRender)
    // Wait for any pending API calls
    await this.page.waitForLoadState('networkidle')
  }

  async waitForCanvasRender(): Promise<void> {
    await this.page.waitForTimeout(TIMEOUTS.canvasRender)
  }

  // Pan operations
  async panCanvas(deltaX: number, deltaY: number): Promise<void> {
    const center = await this.getCanvasCenter()
    const canvas = await this.getCanvas()

    // Start drag from center
    await canvas.hover({ position: { x: center.x, y: center.y } })
    await this.page.mouse.down()
    await this.page.mouse.move(center.x + deltaX, center.y + deltaY)
    await this.page.mouse.up()
    await this.waitForCanvasRender()
  }

  async panTo(targetX: number, targetY: number): Promise<void> {
    const center = await this.getCanvasCenter()
    await this.panCanvas(targetX - center.x, targetY - center.y)
  }

  // Zoom operations
  async zoomCanvas(delta: number, position?: CanvasCoordinates): Promise<void> {
    const canvas = await this.getCanvas()
    const pos = position || await this.getCanvasCenter()
    const box = await this.getCanvasBoundingBox()

    // Position relative to canvas
    const relX = pos.x - box.x
    const relY = pos.y - box.y

    await canvas.hover({ position: { x: relX, y: relY } })
    await this.page.mouse.wheel(0, delta)
    await this.waitForCanvasRender()
  }

  async zoomIn(steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.zoomCanvas(-100)
    }
  }

  async zoomOut(steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.zoomCanvas(100)
    }
  }

  async resetZoom(): Promise<void> {
    // Click the reset zoom button if available
    const resetButton = this.page.locator('[data-testid="reset-zoom-button"]')
    if (await resetButton.isVisible()) {
      await resetButton.click()
    } else {
      // Use keyboard shortcut
      await this.page.keyboard.press('Meta+0')
    }
    await this.waitForCanvasRender()
  }

  async setZoomLevel(level: number): Promise<void> {
    // Reset first
    await this.resetZoom()

    // Calculate zoom steps needed (each wheel event is ~10%)
    const currentLevel = 1.0
    const difference = level - currentLevel
    const steps = Math.abs(Math.round(difference * 10))

    if (difference > 0) {
      await this.zoomIn(steps)
    } else if (difference < 0) {
      await this.zoomOut(steps)
    }
  }

  // Click operations
  async clickOnCanvas(x: number, y: number, options?: { modifiers?: ('Alt' | 'Control' | 'Meta' | 'Shift')[] }): Promise<void> {
    const canvas = await this.getCanvas()
    const box = await this.getCanvasBoundingBox()

    // Position relative to canvas
    const relX = Math.max(0, Math.min(x - box.x, box.width))
    const relY = Math.max(0, Math.min(y - box.y, box.height))

    if (options?.modifiers) {
      for (const modifier of options.modifiers) {
        await this.page.keyboard.down(modifier)
      }
    }

    await canvas.click({ position: { x: relX, y: relY } })

    if (options?.modifiers) {
      for (const modifier of options.modifiers) {
        await this.page.keyboard.up(modifier)
      }
    }

    await this.waitForCanvasRender()
  }

  async clickAtCanvasCenter(): Promise<void> {
    const center = await this.getCanvasCenter()
    await this.clickOnCanvas(center.x, center.y)
  }

  async shiftClickOnCanvas(x: number, y: number): Promise<void> {
    await this.clickOnCanvas(x, y, { modifiers: ['Shift'] })
  }

  async ctrlClickOnCanvas(x: number, y: number): Promise<void> {
    await this.clickOnCanvas(x, y, { modifiers: ['Control'] })
  }

  async doubleClickOnCanvas(x: number, y: number): Promise<void> {
    const canvas = await this.getCanvas()
    const box = await this.getCanvasBoundingBox()

    const relX = Math.max(0, Math.min(x - box.x, box.width))
    const relY = Math.max(0, Math.min(y - box.y, box.height))

    await canvas.dblclick({ position: { x: relX, y: relY } })
    await this.waitForCanvasRender()
  }

  async rightClickOnCanvas(x: number, y: number): Promise<void> {
    const canvas = await this.getCanvas()
    const box = await this.getCanvasBoundingBox()

    const relX = Math.max(0, Math.min(x - box.x, box.width))
    const relY = Math.max(0, Math.min(y - box.y, box.height))

    await canvas.click({ position: { x: relX, y: relY }, button: 'right' })
    await this.waitForCanvasRender()
  }

  // Drag operations
  async dragOnCanvas(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Promise<void> {
    const canvas = await this.getCanvas()
    const box = await this.getCanvasBoundingBox()

    const startRelX = Math.max(0, Math.min(startX - box.x, box.width))
    const startRelY = Math.max(0, Math.min(startY - box.y, box.height))
    const endRelX = Math.max(0, Math.min(endX - box.x, box.width))
    const endRelY = Math.max(0, Math.min(endY - box.y, box.height))

    await canvas.hover({ position: { x: startRelX, y: startRelY } })
    await this.page.mouse.down()
    await this.page.mouse.move(box.x + endRelX, box.y + endRelY, { steps: 10 })
    await this.page.mouse.up()
    await this.waitForCanvasRender()
  }

  async dragThinker(startX: number, startY: number, toX: number, toY: number): Promise<void> {
    await this.dragOnCanvas(startX, startY, toX, toY)
  }

  // Selection operations
  async selectAreaOnCanvas(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Promise<void> {
    // Shift+drag to select area
    await this.page.keyboard.down('Shift')
    await this.dragOnCanvas(startX, startY, endX, endY)
    await this.page.keyboard.up('Shift')
  }

  // Canvas inspection
  async getCanvasPixelColor(x: number, y: number): Promise<string> {
    const canvas = await this.getCanvas()
    const box = await this.getCanvasBoundingBox()

    const relX = Math.floor(x - box.x)
    const relY = Math.floor(y - box.y)

    const color = await canvas.evaluate((el, { x, y }) => {
      const ctx = (el as HTMLCanvasElement).getContext('2d')
      if (!ctx) return 'rgba(0,0,0,0)'
      const pixel = ctx.getImageData(x, y, 1, 1).data
      return `rgba(${pixel[0]},${pixel[1]},${pixel[2]},${pixel[3] / 255})`
    }, { x: relX, y: relY })

    return color
  }

  async isCanvasEmpty(): Promise<boolean> {
    const canvas = await this.getCanvas()
    const isEmpty = await canvas.evaluate((el) => {
      const ctx = (el as HTMLCanvasElement).getContext('2d')
      if (!ctx) return true

      const imageData = ctx.getImageData(0, 0, el.width, el.height).data
      // Check if all pixels are the same (background color)
      const firstPixel = [imageData[0], imageData[1], imageData[2], imageData[3]]
      for (let i = 4; i < imageData.length; i += 4) {
        if (
          imageData[i] !== firstPixel[0] ||
          imageData[i + 1] !== firstPixel[1] ||
          imageData[i + 2] !== firstPixel[2] ||
          imageData[i + 3] !== firstPixel[3]
        ) {
          return false
        }
      }
      return true
    })

    return isEmpty
  }

  // Hover operations
  async hoverOnCanvas(x: number, y: number): Promise<void> {
    const canvas = await this.getCanvas()
    const box = await this.getCanvasBoundingBox()

    const relX = Math.max(0, Math.min(x - box.x, box.width))
    const relY = Math.max(0, Math.min(y - box.y, box.height))

    await canvas.hover({ position: { x: relX, y: relY } })
  }

  // Screenshot utilities
  async takeCanvasScreenshot(name: string): Promise<Buffer> {
    const canvas = await this.getCanvas()
    await this.waitForCanvasRender()
    return canvas.screenshot({ path: `./test-results/canvas-${name}.png` })
  }

  // Canvas state
  async getZoomLevel(): Promise<number> {
    // Try to get zoom from indicator if available
    const zoomIndicator = this.page.locator('[data-testid="zoom-indicator"]')
    if (await zoomIndicator.isVisible()) {
      const text = await zoomIndicator.textContent()
      const match = text?.match(/(\d+)%/)
      if (match) {
        return parseInt(match[1]) / 100
      }
    }
    return 1.0 // Default zoom level
  }

  // Minimap interactions
  async clickOnMinimap(x: number, y: number): Promise<void> {
    const minimap = this.page.locator('[data-testid="minimap"]')
    if (await minimap.isVisible()) {
      await minimap.click({ position: { x, y } })
      await this.waitForCanvasRender()
    }
  }

  async isMinimapVisible(): Promise<boolean> {
    const minimap = this.page.locator('[data-testid="minimap"]')
    return minimap.isVisible()
  }
}

// Factory function
export function createCanvasHelpers(page: Page): CanvasHelpers {
  return new CanvasHelpers(page)
}

// Additional canvas setup helper for visual tests
export async function setupCanvasTest(page: Page): Promise<CanvasHelpers> {
  const helpers = createCanvasHelpers(page)
  await page.goto('/')
  await helpers.waitForCanvasReady()
  return helpers
}
