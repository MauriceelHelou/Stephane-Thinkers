'use client'

import { ReactNode, useEffect, useRef } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

export function Modal({ isOpen, onClose, title, children, maxWidth = 'xl' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return

    // Focus the close button when modal opens
    closeButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Trap focus within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    // Prevent background scrolling
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => {
        // Close when clicking the backdrop (outside the modal content)
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={`bg-white shadow-xl w-full h-full sm:h-auto sm:rounded-lg ${maxWidthClasses[maxWidth]} sm:max-h-[90vh] overflow-y-auto`}
      >
        <div className="sticky top-0 bg-white border-b border-timeline px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-xl sm:text-2xl font-serif font-semibold text-primary truncate pr-4">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0 w-8 h-8 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent rounded"
            aria-label="Close modal"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

interface ModalFooterProps {
  children: ReactNode
}

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className="flex justify-end gap-3 pt-4">
      {children}
    </div>
  )
}

interface ModalButtonProps {
  type?: 'button' | 'submit'
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}

export function ModalButton({ type = 'button', variant = 'secondary', disabled, onClick, children }: ModalButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-sans text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-colors'
  const variantClasses = {
    primary: 'bg-accent text-white hover:bg-opacity-90',
    secondary: 'border border-timeline hover:bg-gray-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </button>
  )
}

interface ModalErrorProps {
  error?: Error | null
  message?: string | null
  fallbackMessage?: string
}

export function ModalError({ error, message, fallbackMessage = 'An error occurred. Please try again.' }: ModalErrorProps) {
  if (!error && !message) return null

  const displayMessage = message || error?.message || fallbackMessage

  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
      <strong>Error:</strong> {displayMessage}
    </div>
  )
}
