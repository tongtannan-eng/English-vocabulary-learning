import { Flex } from 'antd'
import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { ThemeSwitcher } from './ThemeSwitcher.tsx'

export function TopBar({
  action,
  onHome,
  onNavigate,
}: {
  action?: ReactNode
  onHome?: () => void
  onNavigate?: (path: string) => void
}) {
  const headerRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const apply = () =>
      document.documentElement.style.setProperty(
        '--app-header-height',
        `${header.getBoundingClientRect().height}px`,
      )
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  const title = <span>每日单词</span>
  const path = window.location.hash.slice(1) || '/'
  const active =
    path === '/sentences'
      ? '/sentences'
      : path === '/phrases'
        ? '/phrases'
        : path === '/settings' || path === '/trash'
          ? '/settings'
          : /^\/(practice|weekly|unfamiliar|mistakes|spelling-errors|records)/.test(path)
            ? '/practice'
            : '/'

  return (
    <header ref={headerRef} className="app-header">
      <Flex className="app-header-inner" align="center" justify="space-between">
        {onHome ? (
          <button className="wordmark" type="button" onClick={onHome}>
            {title}
          </button>
        ) : (
          <a className="wordmark" href="#/">
            {title}
          </a>
        )}
        <nav className="app-nav" aria-label="主导航">
          {(
            [
              ['/', '学习首页'],
              ['/sentences', '语句'],
              ['/phrases', '词组'],
              ['/practice', '练习中心'],
              ['/settings', '偏好与数据'],
            ] as const
          ).map(([href, label]) => (
            <a
              key={href}
              href={`#${href}`}
              aria-current={active === href ? 'page' : undefined}
              onClick={(event) => {
                if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                  return
                event.preventDefault()
                onNavigate(href)
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <Flex className="header-actions" align="center" gap={10} wrap>
          <ThemeSwitcher />
          {action}
        </Flex>
      </Flex>
    </header>
  )
}
