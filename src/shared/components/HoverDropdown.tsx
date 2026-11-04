import { useRef, useState } from 'react'
import { Dropdown } from 'antd'
import type { DropdownProps } from 'antd'

/** All menu dropdowns use hover; keyboard and touch are explicit fallbacks. */
export function HoverDropdown({
  children,
  ...props
}: Omit<DropdownProps, 'trigger' | 'open' | 'onOpenChange'>) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  return (
    <span
      ref={triggerRef}
      className="hover-dropdown"
      onPointerDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return
        setKeyboard(false)
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          event.preventDefault()
          setOpen((value) => !value)
        }
      }}
      onKeyDown={(event) => {
        // Menu items live in a portal; let Ant Design handle their own keyboard events.
        if (!event.currentTarget.contains(event.target as Node)) return
        if (['ArrowDown', 'Enter', ' '].includes(event.key)) {
          event.preventDefault()
          setKeyboard(true)
          setOpen(true)
        }
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <Dropdown
        {...props}
        trigger={['hover']}
        open={open}
        onOpenChange={setOpen}
        autoFocus={keyboard}
        popupRender={(menu) => (
          <div
            onKeyDownCapture={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
              triggerRef.current?.querySelector<HTMLElement>('button, a, [tabindex="0"]')?.focus()
            }}
          >
            {props.popupRender?.(menu) ?? menu}
          </div>
        )}
        menu={
          props.menu
            ? {
                ...props.menu,
                onClick: (info) => {
                  props.menu?.onClick?.(info)
                  setOpen(false)
                },
              }
            : undefined
        }
      >
        {children}
      </Dropdown>
    </span>
  )
}
