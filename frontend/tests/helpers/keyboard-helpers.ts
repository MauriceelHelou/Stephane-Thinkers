import { Page } from '@playwright/test'
import { KEYBOARD_SHORTCUTS } from '../config/test-constants'

export interface ShortcutDefinition {
  key: string
  meta?: boolean
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export class KeyboardHelpers {
  private page: Page
  private isMac: boolean

  constructor(page: Page) {
    this.page = page
    // Detect platform (default to Mac for CI)
    this.isMac = true // Will be overridden by actual detection
  }

  async detectPlatform(): Promise<void> {
    this.isMac = await this.page.evaluate(() => navigator.platform.toLowerCase().includes('mac'))
  }

  // Build key combination string
  private buildKeyCombo(shortcut: ShortcutDefinition): string {
    const parts: string[] = []

    if (shortcut.meta) {
      parts.push(this.isMac ? 'Meta' : 'Control')
    }
    if (shortcut.ctrl) {
      parts.push('Control')
    }
    if (shortcut.shift) {
      parts.push('Shift')
    }
    if (shortcut.alt) {
      parts.push('Alt')
    }
    parts.push(shortcut.key)

    return parts.join('+')
  }

  // Press a keyboard shortcut
  async pressShortcut(shortcut: ShortcutDefinition): Promise<void> {
    const keyCombo = this.buildKeyCombo(shortcut)
    await this.page.keyboard.press(keyCombo)
  }

  // Common application shortcuts
  async addThinker(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.addThinker)
  }

  async addConnection(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.addConnection)
  }

  async addEvent(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.addEvent)
  }

  async newTimeline(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.newTimeline)
  }

  async openCommandPalette(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.commandPalette)
  }

  async openHelp(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.help)
  }

  async escape(): Promise<void> {
    await this.page.keyboard.press('Escape')
  }

  async toggleNotes(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.toggleNotes)
  }

  async zoomIn(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.zoomIn)
  }

  async zoomOut(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.zoomOut)
  }

  async resetZoom(): Promise<void> {
    await this.pressShortcut(KEYBOARD_SHORTCUTS.resetZoom)
  }

  // Generic key presses
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key)
  }

  async pressKeys(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.page.keyboard.press(key)
    }
  }

  async typeText(text: string, options?: { delay?: number }): Promise<void> {
    await this.page.keyboard.type(text, options)
  }

  // Modifier key operations
  async withShift(action: () => Promise<void>): Promise<void> {
    await this.page.keyboard.down('Shift')
    try {
      await action()
    } finally {
      await this.page.keyboard.up('Shift')
    }
  }

  async withCtrl(action: () => Promise<void>): Promise<void> {
    await this.page.keyboard.down('Control')
    try {
      await action()
    } finally {
      await this.page.keyboard.up('Control')
    }
  }

  async withMeta(action: () => Promise<void>): Promise<void> {
    const key = this.isMac ? 'Meta' : 'Control'
    await this.page.keyboard.down(key)
    try {
      await action()
    } finally {
      await this.page.keyboard.up(key)
    }
  }

  async withAlt(action: () => Promise<void>): Promise<void> {
    await this.page.keyboard.down('Alt')
    try {
      await action()
    } finally {
      await this.page.keyboard.up('Alt')
    }
  }

  // Navigation keys
  async tab(): Promise<void> {
    await this.page.keyboard.press('Tab')
  }

  async shiftTab(): Promise<void> {
    await this.page.keyboard.press('Shift+Tab')
  }

  async enter(): Promise<void> {
    await this.page.keyboard.press('Enter')
  }

  async space(): Promise<void> {
    await this.page.keyboard.press('Space')
  }

  async arrowUp(): Promise<void> {
    await this.page.keyboard.press('ArrowUp')
  }

  async arrowDown(): Promise<void> {
    await this.page.keyboard.press('ArrowDown')
  }

  async arrowLeft(): Promise<void> {
    await this.page.keyboard.press('ArrowLeft')
  }

  async arrowRight(): Promise<void> {
    await this.page.keyboard.press('ArrowRight')
  }

  async home(): Promise<void> {
    await this.page.keyboard.press('Home')
  }

  async end(): Promise<void> {
    await this.page.keyboard.press('End')
  }

  async pageUp(): Promise<void> {
    await this.page.keyboard.press('PageUp')
  }

  async pageDown(): Promise<void> {
    await this.page.keyboard.press('PageDown')
  }

  // Delete and backspace
  async delete(): Promise<void> {
    await this.page.keyboard.press('Delete')
  }

  async backspace(): Promise<void> {
    await this.page.keyboard.press('Backspace')
  }

  // Clipboard operations
  async copy(): Promise<void> {
    await this.page.keyboard.press(this.isMac ? 'Meta+c' : 'Control+c')
  }

  async paste(): Promise<void> {
    await this.page.keyboard.press(this.isMac ? 'Meta+v' : 'Control+v')
  }

  async cut(): Promise<void> {
    await this.page.keyboard.press(this.isMac ? 'Meta+x' : 'Control+x')
  }

  async selectAll(): Promise<void> {
    await this.page.keyboard.press(this.isMac ? 'Meta+a' : 'Control+a')
  }

  async undo(): Promise<void> {
    await this.page.keyboard.press(this.isMac ? 'Meta+z' : 'Control+z')
  }

  async redo(): Promise<void> {
    await this.page.keyboard.press(this.isMac ? 'Meta+Shift+z' : 'Control+y')
  }

  // Focus management
  async focusElement(selector: string): Promise<void> {
    await this.page.focus(selector)
  }

  async getCurrentlyFocused(): Promise<string | null> {
    return this.page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      return el.tagName + (el.id ? `#${el.id}` : '') + (el.className ? `.${el.className.split(' ').join('.')}` : '')
    })
  }
}

// Factory function
export function createKeyboardHelpers(page: Page): KeyboardHelpers {
  return new KeyboardHelpers(page)
}
