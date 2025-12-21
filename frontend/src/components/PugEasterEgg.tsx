'use client'

import { useState, useEffect, useMemo } from 'react'

interface PugEasterEggProps {
  isOpen: boolean
  onClose: () => void
}

export function PugEasterEgg({ isOpen, onClose }: PugEasterEggProps) {
  const [phase, setPhase] = useState<'hidden' | 'pug-spin' | 'pug-slide' | 'text-zoom' | 'hold' | 'fade-out'>('hidden')

  // Memoize random positions so they don't change on re-render
  const stars = useMemo(() =>
    Array.from({ length: 50 }).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      opacity: Math.random() * 0.8 + 0.2,
    })), []
  )

  const sparkles = useMemo(() =>
    Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.5}s`,
    })), []
  )

  useEffect(() => {
    if (isOpen) {
      // Start the animation sequence
      setPhase('pug-spin')

      // Phase timing
      const timers = [
        setTimeout(() => setPhase('pug-slide'), 1500),      // After spin, slide pug
        setTimeout(() => setPhase('text-zoom'), 2500),      // Show text zooming in
        setTimeout(() => setPhase('hold'), 5000),           // Hold at full size
        setTimeout(() => setPhase('fade-out'), 5500),       // Start fade out
        setTimeout(() => {
          setPhase('hidden')
          onClose()
        }, 6200),                                           // Close
      ]

      return () => timers.forEach(t => clearTimeout(t))
    } else {
      setPhase('hidden')
    }
  }, [isOpen, onClose])

  if (!isOpen && phase === 'hidden') return null

  // Inline styles for animations (more reliable than styled-jsx)
  const pugStyle: React.CSSProperties = phase === 'pug-spin'
    ? {
        fontSize: '120px',
        filter: 'drop-shadow(0 0 20px rgba(255,182,193,0.5))',
        animation: 'pugSpin 1.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }
    : {
        fontSize: '120px',
        filter: 'drop-shadow(0 0 20px rgba(255,182,193,0.5))',
        transform: 'translateX(-45vw) scale(0.75)',
        transition: 'all 1s ease-out',
      }

  const textStyle: React.CSSProperties = {
    color: '#ff69b4',
    textShadow: '0 0 30px #ff1493, 0 0 60px #ff69b4, 0 0 90px #ff1493',
    fontSize: 'clamp(2rem, 10vw, 6rem)',
    lineHeight: 1.2,
    ...(phase === 'text-zoom' ? {
      animation: 'textZoom 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    } : phase === 'hold' || phase === 'fade-out' ? {
      transform: 'scale(5)',
      opacity: 1,
      transition: 'all 0.5s ease-out',
    } : {
      transform: 'scale(0.01)',
      opacity: 0,
    }),
  }

  return (
    <>
      {/* Global keyframes */}
      <style>{`
        @keyframes pugSpin {
          0% {
            transform: perspective(500px) rotateY(-90deg) scale(0.3);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          50% {
            transform: perspective(500px) rotateY(15deg) scale(1.1);
          }
          70% {
            transform: perspective(500px) rotateY(-10deg) scale(1);
          }
          100% {
            transform: perspective(500px) rotateY(0deg) scale(1);
          }
        }

        @keyframes textZoom {
          0% {
            transform: scale(0.01);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: scale(5);
            opacity: 1;
          }
        }

        @keyframes sparkleAnim {
          0%, 100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }

        @keyframes floatHeart {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden cursor-pointer"
        style={{
          backgroundColor: '#1a0a1a',
          opacity: phase === 'fade-out' ? 0 : 1,
          transition: 'opacity 0.5s ease-out',
        }}
      >
        {/* Stars background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {stars.map((star, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full"
              style={{
                left: star.left,
                top: star.top,
                animationDelay: star.delay,
                opacity: star.opacity,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          ))}
        </div>

        {/* The Pug */}
        <div className="absolute" style={pugStyle}>
          <div className="relative">
            <span role="img" aria-label="pug" className="block">🐕</span>
            {/* Hearts floating around pug */}
            <span
              className="absolute -top-4 -right-4 text-3xl"
              style={{ animation: 'floatHeart 1s ease-in-out infinite', animationDelay: '0.1s' }}
            >
              💕
            </span>
            <span
              className="absolute -bottom-2 -left-4 text-2xl"
              style={{ animation: 'floatHeart 1s ease-in-out infinite', animationDelay: '0.3s' }}
            >
              💗
            </span>
          </div>
        </div>

        {/* "I Love You" Text */}
        <div className="absolute text-center font-serif font-bold" style={textStyle}>
          <div>I</div>
          <div className="flex items-center justify-center gap-4">
            <span className="text-red-500" style={{ textShadow: '0 0 30px #ff0000' }}>❤️</span>
            Love
            <span className="text-red-500" style={{ textShadow: '0 0 30px #ff0000' }}>❤️</span>
          </div>
          <div>You</div>
        </div>

        {/* Sparkle effects during text zoom */}
        {(phase === 'text-zoom' || phase === 'hold') && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {sparkles.map((sparkle, i) => (
              <div
                key={i}
                className="absolute text-2xl"
                style={{
                  left: sparkle.left,
                  top: sparkle.top,
                  animationDelay: sparkle.delay,
                  animation: 'sparkleAnim 0.8s ease-in-out infinite',
                }}
              >
                ✨
              </div>
            ))}
          </div>
        )}

        {/* Click to skip hint */}
        <div className="absolute bottom-4 right-4 text-white/40 text-xs pointer-events-none">
          Click anywhere to skip
        </div>
      </div>
    </>
  )
}
