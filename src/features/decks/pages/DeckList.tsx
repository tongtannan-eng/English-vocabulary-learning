import type { TrashResult } from '../../../services/trash.ts'
import { CollapsibleSection } from '../../../shared/components/CollapsibleSection.tsx'
import { HoverDropdown } from '../../../shared/components/HoverDropdown.tsx'
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { EllipsisOutlined, RightOutlined } from '@ant-design/icons'
import { App as AntApp, Alert, Button, Card, Empty, Tag, Typography } from 'antd'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import {
  DECK_PAGE_SIZE,
  defaultDeckListView,
  filterDeckList,
  formatMonth,
  loadDeckListView,
  paginateDeckList,
  saveDeckListView,
  unfamiliarWordCount,
} from '../deckList.ts'
import type { DeckListView } from '../deckList.ts'
import { formatDate, formatDeckHeading, isToday } from '../../../shared/utils/format.ts'
import { exportBackup } from '../../../services/backup.ts'
import type { Deck } from '../../../shared/types.ts'
import { SpeakButton } from '../../study/components/SpeakButton.tsx'

const DeckFilters = lazy(() =>
  import('../components/DeckFilters.tsx').then((page) => ({ default: page.DeckFilters })),
)

const DeckPagination = lazy(() =>
  import('../components/DeckPagination.tsx').then((page) => ({ default: page.DeckPagination })),
)
const DeleteDeckModal = lazy(() =>
  import('../components/DeleteDeckModal.tsx').then((page) => ({ default: page.DeleteDeckModal })),
)

export function DeckList({
  decks,
  overview,
  onRestore,
  onDelete,
}: {
  decks: Deck[]
  onRestore: (id: string) => TrashResult
  overview: ReactNode
  onDelete: (id: string) => TrashResult
}) {
  const { message: feedback } = AntApp.useApp()
  const resultsRef = useRef<HTMLDivElement>(null)
  const [undoId, setUndoId] = useState<string | null>(null)
  const [pending, setPending] = useState<Deck | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{
    type: 'success' | 'warning' | 'error'
    text: string
  } | null>(null)
  const [view, setView] = useState(loadDeckListView)
  const viewRef = useRef(view)
  const scrollRef = useRef(view.scrollY)
  const initialScrollRef = useRef(view.scrollY)
  const pageRef = useRef(view.page)
  const navigatingRef = useRef(false)
  const pageJumpRef = useRef(false)
  const filtered = useMemo(() => filterDeckList(decks, view), [decks, view])
  const { page, groups } = paginateDeckList(filtered, view.page)
  const hasFilters = Boolean(view.query || view.startDate || view.endDate || view.status !== 'all')

  useEffect(() => {
    document.title = '每日单词'
  }, [])

  useLayoutEffect(() => {
    const restoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: initialScrollRef.current, behavior: 'instant' })
      scrollRef.current = window.scrollY
    })
    function onScroll() {
      if (!navigatingRef.current) scrollRef.current = window.scrollY
    }
    function persist() {
      saveDeckListView({ ...viewRef.current, page: pageRef.current, scrollY: scrollRef.current })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', persist)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', persist)
      persist()
      window.history.scrollRestoration = restoration
    }
  }, [])

  useLayoutEffect(() => {
    pageRef.current = page
    if (pageJumpRef.current) {
      pageJumpRef.current = false
      const top = (resultsRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 16
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
      scrollRef.current = window.scrollY
    }
    saveDeckListView({ ...view, page, scrollY: scrollRef.current })
  }, [page, view])

  function updateView(patch: Partial<DeckListView>) {
    const next = { ...viewRef.current, page, scrollY: scrollRef.current, ...patch }
    viewRef.current = next
    setView(next)
  }

  function updateFilters(patch: Partial<DeckListView>) {
    updateView({ ...patch, page: 1, collapsedMonths: [], expandedDeckIds: [] })
  }

  function rememberPosition() {
    navigatingRef.current = true
    scrollRef.current = window.scrollY
    saveDeckListView({ ...viewRef.current, page, scrollY: window.scrollY })
  }

  function rememberNavigation(event: MouseEvent<HTMLElement>) {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return
    const target = event.target
    const link = target instanceof Element ? target.closest('a[href^="#/"]') : null
    if (link && link.getAttribute('href') !== '#/') rememberPosition()
  }

  function toggleMonth(month: string) {
    updateView({
      collapsedMonths: view.collapsedMonths.includes(month)
        ? view.collapsedMonths.filter((item) => item !== month)
        : [...view.collapsedMonths, month],
    })
  }

  function togglePreview(id: string) {
    updateView({
      expandedDeckIds: view.expandedDeckIds.includes(id)
        ? view.expandedDeckIds.filter((item) => item !== id)
        : [...view.expandedDeckIds, id],
    })
  }

  function changePage(next: number) {
    pageJumpRef.current = true
    updateView({ page: next, expandedDeckIds: [] })
  }

  function confirmDelete() {
    if (!pending) return
    const result = onDelete(pending.id)
    if ('error' in result) {
      setError(result.error)
      void feedback.error(result.error)
      return
    }
    updateView({
      page: Math.min(page, Math.max(1, Math.ceil((filtered.length - 1) / DECK_PAGE_SIZE))),
      expandedDeckIds: view.expandedDeckIds.filter((id) => id !== pending.id),
    })
    setError('')
    setUndoId(result.entryId ?? null)
    void feedback.success('单词卡已移入回收站')
    setPending(null)
  }

  function handleExport(ids?: string[]) {
    saveDeckListView({ ...viewRef.current, page, scrollY: window.scrollY })
    const result = exportBackup(ids)
    setNotice({ type: result.type, text: result.message })
    if (result.type === 'error') void feedback.error(result.message)
    if (result.type === 'warning') void feedback.warning(result.message)
  }

  return (
    <div onClickCapture={rememberNavigation}>
      <TopBar />
      <main className="page">
        <div className="page-head deck-list-heading">
          <div>
            <Typography.Title level={3}>我的单词卡</Typography.Title>
            <Typography.Paragraph type="secondary">
              按月整理，随时查找。翻面选择是否认识，生词会自动收录。
            </Typography.Paragraph>
          </div>
          <Button type="primary" href="#/new">
            新建单词卡
          </Button>
        </div>

        {overview}

        {undoId ? (
          <Alert
            className="delete-undo-notice"
            type="info"
            showIcon
            title="已移入回收站，单词卡可以恢复。"
            action={
              <Button
                size="small"
                onClick={() => {
                  const result = onRestore(undoId)
                  if ('error' in result) {
                    setError(result.error)
                    void feedback.error(result.error)
                  } else {
                    setError('')
                    setUndoId(null)
                    setNotice({ type: 'success', text: result.message })
                  }
                }}
              >
                撤销删除
              </Button>
            }
            closable
            onClose={() => setUndoId(null)}
          />
        ) : null}
        {notice ? (
          <Alert
            style={{ marginBottom: 16 }}
            type={notice.type}
            title={notice.text}
            showIcon
            closable
            onClose={() => setNotice(null)}
          />
        ) : null}
        {error ? <Alert style={{ marginBottom: 16 }} type="error" title={error} showIcon /> : null}

        {decks.length === 0 ? (
          <Card>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="还没有单词卡，记下今天学过的英文和中文释义吧。"
            >
              <Button type="primary" href="#/new">
                新建今天的单词卡
              </Button>
            </Empty>
          </Card>
        ) : (
          <>
            <CollapsibleSection
              id="search"
              title="搜索与筛选"
              className="deck-search-panel"
              summary={
                hasFilters
                  ? `已筛选 · 找到 ${filtered.length} 组`
                  : '按名称、英文、释义、日期或生词状态查找'
              }
              action={
                hasFilters ? (
                  <Button size="small" onClick={() => updateFilters(defaultDeckListView())}>
                    清除筛选
                  </Button>
                ) : null
              }
            >
              <Suspense fallback={<p role="status">正在加载筛选…</p>}>
                <DeckFilters view={view} updateFilters={updateFilters} />
              </Suspense>
            </CollapsibleSection>
            <div ref={resultsRef} className="deck-results-summary" aria-live="polite">
              <Typography.Text type="secondary">
                {hasFilters
                  ? `共 ${decks.length} 组，找到 ${filtered.length} 组`
                  : `共 ${decks.length} 组单词卡`}{' '}
                · 每页 {DECK_PAGE_SIZE} 组 · 日期倒序
              </Typography.Text>
            </div>
            {filtered.length === 0 ? (
              <div className="collection-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的单词卡" />
                <Button onClick={() => updateFilters(defaultDeckListView())}>
                  清空筛选，查看全部
                </Button>
              </div>
            ) : (
              <>
                <div className="compact-deck-columns" aria-hidden="true">
                  <span>学习日期</span>
                  <span>单词卡名称</span>
                  <span>单词数</span>
                  <span>生词数</span>
                  <span>操作</span>
                </div>
                {groups.map((group) => {
                  const collapsed = view.collapsedMonths.includes(group.month)
                  return (
                    <section
                      className="deck-month"
                      key={group.month}
                      aria-label={formatMonth(group.month)}
                    >
                      <h2 className="deck-month-heading">
                        <button
                          type="button"
                          className="deck-month-toggle"
                          aria-expanded={!collapsed}
                          aria-controls={`month-${group.month}`}
                          onClick={() => toggleMonth(group.month)}
                        >
                          <RightOutlined
                            aria-hidden
                            className={collapsed ? undefined : 'is-open'}
                          />
                          <span>{formatMonth(group.month)}</span>
                          <span className="deck-month-count">
                            {group.total} 组
                            {group.total > group.decks.length
                              ? ` · 本页 ${group.decks.length} 组`
                              : ''}
                          </span>
                        </button>
                      </h2>
                      <ul
                        id={`month-${group.month}`}
                        className="compact-deck-list"
                        hidden={collapsed}
                      >
                        {group.decks.map((deck) => {
                          const expanded = view.expandedDeckIds.includes(deck.id)
                          const unknownCount = unfamiliarWordCount(deck)
                          return (
                            <li className="compact-deck-item" key={deck.id}>
                              <div className="compact-deck-row">
                                <div className="compact-deck-date" title={formatDate(deck.date)}>
                                  <span>
                                    {formatDeckHeading(deck.date).replace(/^\d{4}年/, '')}
                                  </span>
                                  {isToday(deck.date) ? (
                                    <Tag>今天</Tag>
                                  ) : (
                                    <span className="compact-weekday">
                                      {formatDate(deck.date)
                                        .split(' ')
                                        .at(-1)
                                        ?.replace('星期', '周')}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className="compact-deck-title"
                                  title={deck.title || undefined}
                                >
                                  {deck.title}
                                </span>
                                <div className="compact-deck-counts">
                                  <span
                                    className="compact-word-count"
                                    aria-label={`${deck.words.length} 个单词`}
                                  >
                                    {deck.words.length}
                                    <span className="mobile-count-label"> 个词</span>
                                  </span>
                                  <span
                                    className={
                                      unknownCount > 0
                                        ? 'compact-unknown-count has-unknown'
                                        : 'compact-unknown-count'
                                    }
                                    aria-label={`${unknownCount} 个生词`}
                                  >
                                    {unknownCount}
                                    <span className="mobile-count-label"> 生词</span>
                                  </span>
                                </div>
                                <div className="compact-deck-actions">
                                  <Button
                                    type="text"
                                    size="small"
                                    aria-expanded={expanded}
                                    aria-controls={`preview-${deck.id}`}
                                    onClick={() => togglePreview(deck.id)}
                                  >
                                    {expanded ? '收起' : '预览'}
                                  </Button>
                                  <Button
                                    type="text"
                                    size="small"
                                    href={`#/edit/${encodeURIComponent(deck.id)}`}
                                  >
                                    编辑
                                  </Button>
                                  <Button
                                    type="primary"
                                    size="small"
                                    href={`#/review/${encodeURIComponent(deck.id)}`}
                                    disabled={deck.words.length === 0}
                                  >
                                    复习
                                  </Button>
                                  <HoverDropdown
                                    menu={{
                                      items: [
                                        { key: 'export', label: '导出这组' },
                                        { type: 'divider' },
                                        { key: 'delete', label: '删除', danger: true },
                                      ],
                                      onClick: ({ key }) => {
                                        if (key === 'export') handleExport([deck.id])
                                        if (key === 'delete') {
                                          setError('')
                                          setPending(deck)
                                        }
                                      },
                                    }}
                                  >
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<EllipsisOutlined />}
                                      aria-label={`${deck.title || formatDeckHeading(deck.date)}的更多操作`}
                                    />
                                  </HoverDropdown>
                                </div>
                              </div>
                              {expanded ? (
                                <div id={`preview-${deck.id}`} className="compact-deck-preview">
                                  {deck.words.length > 0 ? (
                                    <ul>
                                      {deck.words.map((word) => (
                                        <li key={word.id}>
                                          <div className="compact-preview-word">
                                            <span lang="en">{word.english}</span>
                                            <SpeakButton english={word.english} size="small" />
                                          </div>
                                          <span className="compact-preview-meaning">
                                            <span>{word.chinese}</span>
                                            {word.familiarity === 'unknown' ? (
                                              <Tag>生词</Tag>
                                            ) : null}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <Typography.Text type="secondary">
                                      这组还没有单词
                                    </Typography.Text>
                                  )}
                                </div>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  )
                })}
                <div className="deck-pagination">
                  {filtered.length > DECK_PAGE_SIZE ? (
                    <Suspense fallback={<span role="status">正在加载分页…</span>}>
                      <DeckPagination
                        page={page}
                        pageSize={DECK_PAGE_SIZE}
                        total={filtered.length}
                        onChange={changePage}
                      />
                    </Suspense>
                  ) : (
                    <Typography.Text type="secondary">
                      共 {filtered.length} 组 · 1 / 1 页
                    </Typography.Text>
                  )}
                </div>
              </>
            )}
          </>
        )}
        <Typography.Paragraph type="secondary" className="deck-storage-note">
          数据保存在当前浏览器。备份、导入和回收站请前往「偏好与数据」。
        </Typography.Paragraph>
      </main>
      {pending ? (
        <Suspense
          fallback={
            <p className="page" role="status">
              正在加载删除确认…
            </p>
          }
        >
          <DeleteDeckModal
            deck={pending}
            onConfirm={confirmDelete}
            onCancel={() => setPending(null)}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
