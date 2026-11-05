import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import { Input } from 'antd'
import { createPortal } from 'react-dom'
import { loadDict, lookupMeanings, type LocalDict } from '../suggest.ts'
import { suggestionPlacement } from '../suggestionPopup.ts'

export function ChineseField({
  value,
  english,
  onChange,
  onEnter,
}: {
  value: string
  english: string
  onChange: (value: string) => void
  onEnter: () => void
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const fieldRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [dict, setDict] = useState<LocalDict | null>(null)
  const [error, setError] = useState('')
  const [active, setActive] = useState({ query: '', index: -1 })
  const [placement, setPlacement] = useState({
    upward: false,
    maxHeight: 280,
    left: 0,
    top: 0,
    width: 0,
  })
  const query = english.trim()
  const options = dict && query ? lookupMeanings(dict, query) : []
  const activeIndex = active.query === query && active.index < options.length ? active.index : -1
  function close() {
    setOpen(false)
    setActive({ query, index: -1 })
  }
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null
    if (!fieldRef.current?.contains(next) && !panelRef.current?.contains(next)) close()
  }
  function choose(index: number) {
    const option = options[index]
    if (option === undefined) return
    onChange(option)
    close()
  }

  useEffect(() => {
    if (!open) return
    function dismissOutside(event: PointerEvent) {
      const target = event.target as Node | null
      if (!fieldRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
        setActive({ query, index: -1 })
      }
    }
    document.addEventListener('pointerdown', dismissOutside, true)
    return () => document.removeEventListener('pointerdown', dismissOutside, true)
  }, [open, query])

  useEffect(() => {
    if (!open || !query || dict || error) return
    let cancelled = false
    loadDict()
      .then((loaded) => {
        if (!cancelled) setDict(loaded)
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : '词库加载失败，请手动填写')
      })
    return () => {
      cancelled = true
    }
  }, [dict, open, error, query])

  useLayoutEffect(() => {
    if (!open) return
    function position() {
      const field = fieldRef.current,
        panel = panelRef.current
      if (!field || !panel) return
      const visual = window.visualViewport
      let top = (visual?.offsetTop ?? 0) + 8
      let bottom = top - 8 + (visual?.height ?? window.innerHeight) - 8
      const editor = field.closest('fieldset')
      const toolbar = editor?.querySelector('.editor-list-toolbar')?.getBoundingClientRect()
      const footer = editor?.querySelector('.editor-actions-sticky')?.getBoundingClientRect()
      if (toolbar && toolbar.top <= top && toolbar.bottom > top) top = toolbar.bottom + 8
      if (footer && footer.top > top && footer.top < bottom) bottom = footer.top - 8
      const anchor = field.getBoundingClientRect()
      const side = suggestionPlacement(
        anchor,
        { top, bottom },
        Math.min(280, panel.scrollHeight + 2),
      )
      const next = {
        ...side,
        left: anchor.left,
        width: anchor.width,
        top: side.upward ? anchor.top - 8 : anchor.bottom + 8,
      }
      setPlacement((previous) =>
        Object.keys(next).every(
          (key) => previous[key as keyof typeof next] === next[key as keyof typeof next],
        )
          ? previous
          : next,
      )
    }
    position()
    const observer = new ResizeObserver(position)
    if (panelRef.current) observer.observe(panelRef.current)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
    }
  }, [open, query, options.length, dict, error])

  useEffect(() => {
    if (open && activeIndex >= 0)
      optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  return (
    <div ref={fieldRef} className="suggest-field" onBlur={handleBlur}>
      <label htmlFor={`${id}-input`} className="field-label">
        中文释义
      </label>
      <Input
        allowClear
        id={`${id}-input`}
        value={value}
        placeholder="点击查看释义，也可手动填写"
        onClick={() => setOpen(true)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          setActive({ query, index: -1 })
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            event.stopPropagation()
            close()
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            if (options.length)
              setActive({
                query,
                index:
                  !open || activeIndex < 0
                    ? event.key === 'ArrowDown'
                      ? 0
                      : options.length - 1
                    : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
                      options.length,
              })
            return
          }
          if (
            event.key !== 'Enter' ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.shiftKey
          )
            return
          event.preventDefault()
          if (open && activeIndex >= 0) choose(activeIndex)
          else onEnter()
        }}
      />
      {open
        ? createPortal(
            <div
              ref={panelRef}
              onBlur={handleBlur}
              className={`suggest-menu${placement.upward ? ' opens-up' : ''}`}
              style={{
                maxHeight: placement.maxHeight,
                left: placement.left,
                top: placement.top,
                width: placement.width,
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  close()
                  fieldRef.current?.querySelector('input')?.focus()
                }
              }}
            >
              <div
                className="suggest-options"
                id={`${id}-list`}
                role="listbox"
                aria-label="中文释义候选"
              >
                {options.map((option, index) => (
                  <button
                    key={`${option}-${index}`}
                    id={`${id}-option-${index}`}
                    ref={(element) => {
                      optionRefs.current[index] = element
                    }}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={activeIndex === index}
                    className={index === 0 && options.length > 1 ? 'is-summary' : undefined}
                    onPointerEnter={() => setActive({ query, index })}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(index)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {!query ? (
                <p className="suggest-status" role="status">
                  先填写英文，再点击这里查看候选
                </p>
              ) : null}
              {query && !dict && !error ? (
                <p className="suggest-status" role="status">
                  正在加载词库…
                </p>
              ) : null}
              {dict && query && options.length === 0 ? (
                <p className="suggest-status" role="status">
                  词库里没有这个词，请手动填写
                </p>
              ) : null}
              {error ? (
                <div className="suggest-status" role="status">
                  <p>{error}</p>
                  <button type="button" className="suggest-retry" onClick={() => setError('')}>
                    重新加载词库
                  </button>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
