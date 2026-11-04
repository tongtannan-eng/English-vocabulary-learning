import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

/** Use with a trigger wrapper and a portal panel so crossing the gap keeps it open. */
export function useHoverPopup() {
  const [open, setState] = useState(false)
  const openRef = useRef(false)
  const keyboardRef = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  function cancelClose() {
    clearTimeout(timer.current)
  }
  function setOpen(value: boolean) {
    cancelClose()
    openRef.current = value
    setState(value)
  }
  function closeLater() {
    cancelClose()
    timer.current = setTimeout(() => setOpen(false), 180)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  function onPointerEnter(event: PointerEvent) {
    if (event.pointerType === 'mouse') setOpen(true)
  }
  function onPointerDownCapture(event: PointerEvent) {
    keyboardRef.current = false
    // Touch has no hover. Keep a deliberate tap fallback on those devices only.
    if (event.pointerType === 'touch' || event.pointerType === 'pen') setOpen(true)
  }
  function onKeyDownCapture(event: KeyboardEvent) {
    keyboardRef.current = true
    if (event.key === 'Escape') setOpen(false)
    if (event.key === 'ArrowDown') setOpen(true)
  }
  function onOpenChange(value: boolean) {
    // Ignore desktop click/focus requests: pointer entry is the opening gesture.
    if (!value || openRef.current || keyboardRef.current) setOpen(value)
  }
  return {
    open,
    setOpen,
    onOpenChange,
    triggerProps: {
      onPointerEnter,
      onPointerLeave: closeLater,
      onPointerDownCapture,
      onKeyDownCapture,
    },
    panelProps: { onPointerEnter: cancelClose, onPointerLeave: closeLater },
  }
}
