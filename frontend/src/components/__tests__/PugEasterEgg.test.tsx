import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { PugEasterEgg } from '../PugEasterEgg'

describe('PugEasterEgg', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      const onClose = vi.fn()
      const { container } = render(<PugEasterEgg isOpen={false} onClose={onClose} />)
      expect(container.firstChild).toBeNull()
    })

    it('renders the animation overlay when open', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Should have the dark background overlay
      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).toBeInTheDocument()
    })

    it('renders the pug emoji', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      expect(screen.getByRole('img', { name: 'pug' })).toBeInTheDocument()
    })

    it('renders "I Love You" text', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      expect(screen.getByText('I')).toBeInTheDocument()
      expect(screen.getByText('Love')).toBeInTheDocument()
      expect(screen.getByText('You')).toBeInTheDocument()
    })

    it('renders floating hearts around the pug', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Should have heart emojis
      expect(screen.getByText('💕')).toBeInTheDocument()
      expect(screen.getByText('💗')).toBeInTheDocument()
    })

    it('renders heart emojis around "Love"', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Should have red heart emojis around Love text
      const hearts = screen.getAllByText('❤️')
      expect(hearts.length).toBe(2)
    })

    it('renders skip hint text', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      expect(screen.getByText('Click anywhere to skip')).toBeInTheDocument()
    })

    it('renders star background elements', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Should have 50 star elements
      const stars = document.querySelectorAll('.w-1.h-1.bg-white.rounded-full')
      expect(stars.length).toBe(50)
    })
  })

  describe('Click to Skip', () => {
    it('calls onClose when overlay is clicked', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const overlay = document.querySelector('.fixed.inset-0')
      if (overlay) {
        fireEvent.click(overlay)
        expect(onClose).toHaveBeenCalledTimes(1)
      }
    })

    it('has cursor-pointer class for clickability indication', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const overlay = document.querySelector('.cursor-pointer')
      expect(overlay).toBeInTheDocument()
    })
  })

  describe('Animation Phases', () => {
    it('starts in pug-spin phase when opened', async () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Initially in pug-spin phase - pug should be animating
      const pugContainer = document.querySelector('[style*="pugSpin"]')
      expect(pugContainer).toBeInTheDocument()
    })

    it('transitions to pug-slide phase after 1.5 seconds', async () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Advance past the pug-spin phase
      await act(async () => {
        vi.advanceTimersByTime(1600)
      })

      // Pug should now be sliding (translateX applied)
      const pugContainer = document.querySelector('[style*="translateX(-45vw)"]')
      expect(pugContainer).toBeInTheDocument()
    })

    it('transitions to text-zoom phase after 2.5 seconds', async () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Advance to text-zoom phase
      await act(async () => {
        vi.advanceTimersByTime(2600)
      })

      // Text should be zooming (textZoom animation)
      const textContainer = document.querySelector('[style*="textZoom"]')
      expect(textContainer).toBeInTheDocument()
    })

    it('shows sparkles during text-zoom and hold phases', async () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Advance to text-zoom phase
      await act(async () => {
        vi.advanceTimersByTime(2600)
      })

      // Sparkles should be visible (20 sparkle elements)
      const sparkles = screen.getAllByText('✨')
      expect(sparkles.length).toBe(20)
    })

    it('transitions to hold phase after 5 seconds', async () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Advance to hold phase
      await act(async () => {
        vi.advanceTimersByTime(5100)
      })

      // Text should be at full scale
      const textContainer = document.querySelector('[style*="scale(5)"]')
      expect(textContainer).toBeInTheDocument()
    })

    it('transitions to fade-out phase after 5.5 seconds', async () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Advance to fade-out phase
      await act(async () => {
        vi.advanceTimersByTime(5600)
      })

      // Overlay should have opacity 0
      const overlay = document.querySelector('[style*="opacity: 0"]')
      expect(overlay).toBeInTheDocument()
    })

    it('calls onClose automatically after full animation (~6.2 seconds)', async () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Should not have called onClose yet
      expect(onClose).not.toHaveBeenCalled()

      // Advance past the entire animation
      await act(async () => {
        vi.advanceTimersByTime(6300)
      })

      // onClose should have been called
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('Opening and Closing', () => {
    it('resets to hidden phase when closed', async () => {
      const onClose = vi.fn()
      const { rerender } = render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Advance animation a bit
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // Close the easter egg
      rerender(<PugEasterEgg isOpen={false} onClose={onClose} />)

      // Should not render anything
      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).not.toBeInTheDocument()
    })

    it('clears timers when closed before animation completes', async () => {
      const onClose = vi.fn()
      const { rerender } = render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Advance a bit but not to completion
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // Close the easter egg
      rerender(<PugEasterEgg isOpen={false} onClose={onClose} />)

      // Advance time past when onClose would have been called
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      // onClose should NOT have been called from the timer (only if clicked)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('restarts animation when reopened', async () => {
      const onClose = vi.fn()
      const { rerender } = render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Advance to text-zoom
      await act(async () => {
        vi.advanceTimersByTime(3000)
      })

      // Close
      rerender(<PugEasterEgg isOpen={false} onClose={onClose} />)

      // Reopen
      rerender(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Should be back in pug-spin phase
      const pugContainer = document.querySelector('[style*="pugSpin"]')
      expect(pugContainer).toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('has dark purple background', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const overlay = document.querySelector('[style*="background-color: rgb(26, 10, 26)"]') ||
                      document.querySelector('[style*="backgroundColor"]')
      expect(overlay).toBeInTheDocument()
    })

    it('applies pink glow to "I Love You" text', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const textContainer = document.querySelector('[style*="text-shadow"]')
      expect(textContainer).toBeInTheDocument()
    })

    it('has z-index of 100 for overlay', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const overlay = document.querySelector('.z-\\[100\\]')
      expect(overlay).toBeInTheDocument()
    })
  })

  describe('Memoization', () => {
    it('maintains consistent star positions across re-renders', async () => {
      const onClose = vi.fn()
      const { rerender } = render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Get initial star positions
      const starsInitial = document.querySelectorAll('.w-1.h-1.bg-white.rounded-full')
      const firstStarStyle = starsInitial[0]?.getAttribute('style')

      // Advance animation and trigger re-render
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // Get star positions after re-render
      const starsAfter = document.querySelectorAll('.w-1.h-1.bg-white.rounded-full')
      const firstStarStyleAfter = starsAfter[0]?.getAttribute('style')

      // Positions should be the same (memoized)
      expect(firstStarStyle).toBe(firstStarStyleAfter)
    })
  })

  describe('Accessibility', () => {
    it('has proper aria-label on pug emoji', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const pug = screen.getByRole('img', { name: 'pug' })
      expect(pug).toHaveAttribute('aria-label', 'pug')
    })
  })

  describe('CSS Keyframes', () => {
    it('injects keyframes styles into the document', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      // Check for injected style element with keyframes
      const styleElements = document.querySelectorAll('style')
      const hasKeyframes = Array.from(styleElements).some(
        style => style.textContent?.includes('@keyframes pugSpin')
      )
      expect(hasKeyframes).toBe(true)
    })

    it('includes textZoom keyframe animation', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const styleElements = document.querySelectorAll('style')
      const hasTextZoom = Array.from(styleElements).some(
        style => style.textContent?.includes('@keyframes textZoom')
      )
      expect(hasTextZoom).toBe(true)
    })

    it('includes sparkleAnim keyframe animation', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const styleElements = document.querySelectorAll('style')
      const hasSparkle = Array.from(styleElements).some(
        style => style.textContent?.includes('@keyframes sparkleAnim')
      )
      expect(hasSparkle).toBe(true)
    })

    it('includes floatHeart keyframe animation', () => {
      const onClose = vi.fn()
      render(<PugEasterEgg isOpen={true} onClose={onClose} />)

      const styleElements = document.querySelectorAll('style')
      const hasFloatHeart = Array.from(styleElements).some(
        style => style.textContent?.includes('@keyframes floatHeart')
      )
      expect(hasFloatHeart).toBe(true)
    })
  })
})
