import { useEffect, useRef, useState } from 'react'

export function useLoadingOverlayVisible(loading: boolean, minDurationMs = 700) {
  const [visible, setVisible] = useState(loading)
  const startedAt = useRef<number | null>(loading ? Date.now() : null)
  const hideTimer = useRef<number | null>(null)

  useEffect(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }

    if (loading) {
      startedAt.current = Date.now()
      setVisible(true)
      return
    }

    if (startedAt.current === null) {
      setVisible(false)
      return
    }

    const elapsed = Date.now() - startedAt.current
    const remaining = Math.max(0, minDurationMs - elapsed)

    hideTimer.current = window.setTimeout(() => {
      setVisible(false)
      startedAt.current = null
      hideTimer.current = null
    }, remaining)

    return () => {
      if (hideTimer.current !== null) {
        window.clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }
  }, [loading, minDurationMs])

  return visible
}
