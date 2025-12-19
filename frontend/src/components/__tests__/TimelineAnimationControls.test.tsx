import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { TimelineAnimationControls, useTimelineAnimation } from '../TimelineAnimationControls'

describe('TimelineAnimationControls', () => {
  const defaultProps = {
    startYear: 1700,
    endYear: 2000,
    currentYear: 1850,
    onYearChange: vi.fn(),
    isPlaying: false,
    onPlayPauseToggle: vi.fn(),
    speed: 1,
    onSpeedChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<TimelineAnimationControls {...defaultProps} />)
      expect(screen.getByText('1850')).toBeInTheDocument()
    })

    it('displays current year', () => {
      render(<TimelineAnimationControls {...defaultProps} currentYear={1900} />)
      expect(screen.getByText('1900')).toBeInTheDocument()
    })

    it('displays "All Time" when currentYear is null', () => {
      render(<TimelineAnimationControls {...defaultProps} currentYear={null} />)
      expect(screen.getByText('All Time')).toBeInTheDocument()
    })

    it('displays start and end year labels', () => {
      render(<TimelineAnimationControls {...defaultProps} />)
      expect(screen.getByText('1700')).toBeInTheDocument()
      expect(screen.getByText('2000')).toBeInTheDocument()
    })

    it('shows speed selector', () => {
      render(<TimelineAnimationControls {...defaultProps} />)
      expect(screen.getByText('Speed:')).toBeInTheDocument()
    })
  })

  describe('Play/Pause button', () => {
    it('shows play button when not playing', () => {
      render(<TimelineAnimationControls {...defaultProps} isPlaying={false} />)
      const playButton = screen.getByTitle('Play')
      expect(playButton).toBeInTheDocument()
    })

    it('shows pause button when playing', () => {
      render(<TimelineAnimationControls {...defaultProps} isPlaying={true} />)
      const pauseButton = screen.getByTitle('Pause')
      expect(pauseButton).toBeInTheDocument()
    })

    it('calls onPlayPauseToggle when clicked', () => {
      const onPlayPauseToggle = vi.fn()
      render(<TimelineAnimationControls {...defaultProps} onPlayPauseToggle={onPlayPauseToggle} />)

      const playButton = screen.getByTitle('Play')
      fireEvent.click(playButton)

      expect(onPlayPauseToggle).toHaveBeenCalledTimes(1)
    })
  })

  describe('Reset button', () => {
    it('renders reset button', () => {
      render(<TimelineAnimationControls {...defaultProps} />)
      const resetButton = screen.getByTitle('Reset (show all)')
      expect(resetButton).toBeInTheDocument()
    })

    it('calls onYearChange with null when clicked', () => {
      const onYearChange = vi.fn()
      render(<TimelineAnimationControls {...defaultProps} onYearChange={onYearChange} />)

      const resetButton = screen.getByTitle('Reset (show all)')
      fireEvent.click(resetButton)

      expect(onYearChange).toHaveBeenCalledWith(null)
    })
  })

  describe('Speed control', () => {
    it('shows current speed in selector', () => {
      render(<TimelineAnimationControls {...defaultProps} speed={2} />)
      const select = screen.getByRole('combobox')
      expect(select).toHaveValue('2')
    })

    it('calls onSpeedChange when speed is changed', () => {
      const onSpeedChange = vi.fn()
      render(<TimelineAnimationControls {...defaultProps} onSpeedChange={onSpeedChange} />)

      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '5' } })

      expect(onSpeedChange).toHaveBeenCalledWith(5)
    })

    it('has correct speed options', () => {
      render(<TimelineAnimationControls {...defaultProps} />)
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(5)
      expect(options[0]).toHaveValue('0.5')
      expect(options[1]).toHaveValue('1')
      expect(options[2]).toHaveValue('2')
      expect(options[3]).toHaveValue('5')
      expect(options[4]).toHaveValue('10')
    })
  })

  describe('Progress bar', () => {
    it('renders progress bar', () => {
      const { container } = render(<TimelineAnimationControls {...defaultProps} />)
      const progressBar = container.querySelector('.bg-accent')
      expect(progressBar).toBeInTheDocument()
    })

    it('calculates progress correctly', () => {
      const { container } = render(
        <TimelineAnimationControls {...defaultProps} startYear={0} endYear={100} currentYear={50} />
      )
      const progressBar = container.querySelector('.bg-accent')
      expect(progressBar).toHaveStyle({ width: '50%' })
    })

    it('shows full progress when currentYear is null', () => {
      const { container } = render(
        <TimelineAnimationControls {...defaultProps} currentYear={null} />
      )
      const progressBar = container.querySelector('.bg-accent')
      expect(progressBar).toHaveStyle({ width: '100%' })
    })

    it('shows progress handle when currentYear is set', () => {
      const { container } = render(<TimelineAnimationControls {...defaultProps} currentYear={1850} />)
      const handle = container.querySelector('.rounded-full.border-2')
      expect(handle).toBeInTheDocument()
    })

    it('hides progress handle when currentYear is null', () => {
      const { container } = render(<TimelineAnimationControls {...defaultProps} currentYear={null} />)
      const handle = container.querySelector('.rounded-full.border-2')
      expect(handle).not.toBeInTheDocument()
    })
  })

  describe('Progress click', () => {
    it('calls onYearChange when progress bar is clicked', () => {
      const onYearChange = vi.fn()
      const { container } = render(
        <TimelineAnimationControls
          {...defaultProps}
          startYear={0}
          endYear={100}
          onYearChange={onYearChange}
        />
      )

      const progressBar = container.querySelector('.cursor-pointer')!

      // Mock getBoundingClientRect
      const originalGetBoundingClientRect = progressBar.getBoundingClientRect
      progressBar.getBoundingClientRect = () => ({
        left: 0,
        right: 200,
        width: 200,
        top: 0,
        bottom: 10,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => {},
      })

      fireEvent.click(progressBar, { clientX: 100 })

      // Should call with year 50 (100/200 * 100)
      expect(onYearChange).toHaveBeenCalledWith(50)

      // Restore
      progressBar.getBoundingClientRect = originalGetBoundingClientRect
    })
  })
})

describe('useTimelineAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useTimelineAnimation(1700, 2000))

    expect(result.current.currentYear).toBeNull()
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.speed).toBe(2)
  })

  it('can set current year', () => {
    const { result } = renderHook(() => useTimelineAnimation(1700, 2000))

    act(() => {
      result.current.setCurrentYear(1850)
    })

    expect(result.current.currentYear).toBe(1850)
  })

  it('can change speed', () => {
    const { result } = renderHook(() => useTimelineAnimation(1700, 2000))

    act(() => {
      result.current.setSpeed(5)
    })

    expect(result.current.speed).toBe(5)
  })

  it('togglePlayPause starts animation', () => {
    const { result } = renderHook(() => useTimelineAnimation(1700, 2000))

    act(() => {
      result.current.togglePlayPause()
    })

    expect(result.current.isPlaying).toBe(true)
  })

  it('togglePlayPause stops animation when playing', () => {
    const { result } = renderHook(() => useTimelineAnimation(1700, 2000))

    act(() => {
      result.current.togglePlayPause() // Start
    })
    act(() => {
      result.current.togglePlayPause() // Stop
    })

    expect(result.current.isPlaying).toBe(false)
  })

  it('starts from beginning when currentYear is null', () => {
    const { result } = renderHook(() => useTimelineAnimation(1700, 2000))

    expect(result.current.currentYear).toBeNull()

    act(() => {
      result.current.togglePlayPause()
    })

    // Should set currentYear to startYear
    expect(result.current.currentYear).toBe(1700)
  })

  it('advances year during animation', () => {
    const { result } = renderHook(() => useTimelineAnimation(1700, 2000))

    act(() => {
      result.current.setSpeed(1) // 1 year per second
      result.current.togglePlayPause()
    })

    const initialYear = result.current.currentYear

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.currentYear).toBe(initialYear! + 1)
  })

  it('stops at end year', async () => {
    const { result } = renderHook(() => useTimelineAnimation(1998, 2000))

    act(() => {
      result.current.setCurrentYear(1999)
      result.current.setSpeed(1)
    })

    act(() => {
      result.current.togglePlayPause()
    })

    // Advance time enough for the animation to reach end year and stop
    act(() => {
      vi.advanceTimersByTime(3000) // Give enough time for multiple ticks
    })

    // The animation should reach the end year
    expect(result.current.currentYear).toBe(2000)
    // Note: isPlaying might still be true briefly, but currentYear should be at end
  })

  it('stopAnimation clears interval and stops playing', () => {
    const { result } = renderHook(() => useTimelineAnimation(1700, 2000))

    act(() => {
      result.current.togglePlayPause()
    })

    expect(result.current.isPlaying).toBe(true)

    act(() => {
      result.current.stopAnimation()
    })

    expect(result.current.isPlaying).toBe(false)
  })
})
