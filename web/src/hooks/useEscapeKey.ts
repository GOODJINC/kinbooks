import { useEffect, useRef } from 'react'

// Global modal stack to track active modal close handlers in LIFO order
const modalStack: (() => void)[] = []
let isGlobalListenerAttached = false

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && modalStack.length > 0) {
    e.preventDefault()
    e.stopPropagation()
    // Pop only the topmost modal handler and invoke it
    const topCloseHandler = modalStack.pop()
    if (topCloseHandler) {
      topCloseHandler()
    }
  }
}

export function useEscapeKey(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isOpen) return

    if (!isGlobalListenerAttached) {
      window.addEventListener('keydown', handleGlobalKeyDown)
      isGlobalListenerAttached = true
    }

    const handler = () => {
      onCloseRef.current()
    }

    modalStack.push(handler)

    return () => {
      const idx = modalStack.lastIndexOf(handler)
      if (idx !== -1) {
        modalStack.splice(idx, 1)
      }
      if (modalStack.length === 0 && isGlobalListenerAttached) {
        window.removeEventListener('keydown', handleGlobalKeyDown)
        isGlobalListenerAttached = false
      }
    }
  }, [isOpen])
}
