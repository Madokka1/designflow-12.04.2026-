import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
  )
}

/**
 * Удерживает Tab внутри контейнера, пока active === true.
 */
export function useFocusTrap(active: boolean, rootRef: RefObject<HTMLElement | null>) {
  const prevFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    prevFocus.current = document.activeElement as HTMLElement | null
  }, [active])

  useEffect(() => {
    if (!active) return
    const root = rootRef.current
    if (!root) return

    const focusables = getFocusable(root)
    if (focusables.length === 0) return

    window.setTimeout(() => focusables[0].focus(), 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const list = getFocusable(root)
      if (list.length === 0) return
      const f = list[0]
      const l = list[list.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === f) {
          e.preventDefault()
          l.focus()
        }
      } else if (document.activeElement === l) {
        e.preventDefault()
        f.focus()
      }
    }

    root.addEventListener('keydown', onKeyDown)
    return () => {
      root.removeEventListener('keydown', onKeyDown)
      prevFocus.current?.focus?.()
    }
  }, [active, rootRef])
}
