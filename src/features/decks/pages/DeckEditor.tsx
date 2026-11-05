import { BulkImportModal } from '../components/BulkImportModal.tsx'
import { useHoverPopup } from '../../../shared/hooks/useHoverPopup.ts'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Flex,
  Input,
  Modal,
  Pagination,
  Typography,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { EditorWordRow } from '../components/EditorWordRow.tsx'
import {
  EDITOR_PAGE_SIZE,
  filterEditorWords,
  deleteEditorWord,
  restoreEditorWord,
} from '../editor.ts'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { createDraftWord, normalizeDraft } from '../deck.ts'
import { todayISO } from '../../../shared/utils/format.ts'
import { loadEditorDraft, saveEditorDraft } from '../../../services/drafts.ts'
import { findDuplicates } from '../duplicates.ts'
import { navigate } from '../../../app/router.ts'
import { editorShortcut } from '../../../services/editorShortcuts.ts'
import type { Deck, DeletedDraftWord, DraftWord } from '../../../shared/types.ts'

function buildInitialWords(deck?: Deck): DraftWord[] {
  if (deck && deck.words.length > 0)
    return deck.words.map((word) => ({
      ...word,
      collocations: (word.collocations ?? []).join('\n'),
      notes: word.notes ?? '',
    }))
  return [createDraftWord()]
}

function serialize(value: { date: string; title: string; words: readonly DraftWord[] }): string {
  return JSON.stringify({
    date: value.date,
    title: value.title.trim(),
    words: value.words.map((word) => ({
      english: word.english.trim(),
      chinese: word.chinese.trim(),
      collocations: (word.collocations ?? '').trim(),
      notes: (word.notes ?? '').trim(),
    })),
  })
}

export function DeckEditor({
  deck,
  decks,
  onSave,
}: {
  deck?: Deck
  decks: Deck[]
  onSave: (deck: Deck) => string | void
}) {
  const datePopup = useHoverPopup()
  const [bulkOpen, setBulkOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [requestedPage, setRequestedPage] = useState(1)
  const pendingFocus = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const draftKey = deck?.id ?? 'new'
  const [original] = useState(() => ({
    date: deck?.date ?? todayISO(),
    title: deck?.title ?? '',
    words: buildInitialWords(deck),
  }))
  const [storedDraft] = useState(() => loadEditorDraft(draftKey))
  const [baseline] = useState(() => serialize(original))
  const canRestore =
    storedDraft &&
    (!deck ||
      storedDraft.baseSignature === baseline ||
      (!storedDraft.baseSignature && storedDraft.baseUpdatedAt === deck.updatedAt))
  const [date, setDate] = useState(() => (canRestore ? storedDraft!.date : original.date))
  const [title, setTitle] = useState(() => (canRestore ? storedDraft!.title : original.title))
  const [words, setWords] = useState(() => (canRestore ? storedDraft!.words : original.words))
  const [deletedWords, setDeletedWords] = useState<DeletedDraftWord[]>(() =>
    canRestore ? (storedDraft!.deletedWords ?? []) : [],
  )
  const [error, setError] = useState('')
  const [draftNotice, setDraftNotice] = useState(Boolean(storedDraft))
  const [draftConflict, setDraftConflict] = useState(Boolean(storedDraft && !canRestore))
  const [draftError, setDraftError] = useState('')
  const [draftSaved, setDraftSaved] = useState(false)
  const submittedRef = useRef(false)
  const currentRef = useRef({ date, title, words, deletedWords })
  const duplicates = useMemo(() => findDuplicates(words, decks, deck?.id), [words, decks, deck?.id])
  const visibleWords = useMemo(
    () => filterEditorWords(words, query, incompleteOnly),
    [words, query, incompleteOnly],
  )
  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(visibleWords.length / EDITOR_PAGE_SIZE)),
  )
  const pageWords = visibleWords.slice((page - 1) * EDITOR_PAGE_SIZE, page * EDITOR_PAGE_SIZE)
  const [focusId] = useState(() => (deck ? '' : (words[0]?.id ?? '')))

  useLayoutEffect(() => {
    currentRef.current = { date, title, words, deletedWords }
  }, [date, title, words, deletedWords])

  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    const input = document.getElementById(`english-${pendingFocus.current}`)
    if (input) {
      input.focus({ preventScroll: true })
      input.closest('.word-card')?.scrollIntoView({ block: 'center', behavior: 'instant' })
      pendingFocus.current = null
    }
  }, [page, words, query, incompleteOnly, error])

  function changePage(next: number) {
    setRequestedPage(next)
    window.requestAnimationFrame(() =>
      listRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }),
    )
  }

  function persistDraft(): boolean {
    if (submittedRef.current || draftConflict) return true
    const current = currentRef.current
    return saveEditorDraft(
      draftKey,
      serialize(current) === baseline && !current.deletedWords.length
        ? null
        : {
            ...current,
            baseUpdatedAt: deck?.updatedAt,
            baseSignature: baseline,
            updatedAt: Date.now(),
          },
    )
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ok = persistDraft()
      setDraftError(ok ? '' : '草稿自动保存失败，请使用“保存单词卡”手动保存。')
      setDraftSaved(
        ok &&
          !draftConflict &&
          (serialize(currentRef.current) !== baseline ||
            currentRef.current.deletedWords.length > 0),
      )
    }, 400)
    return () => window.clearTimeout(timer)
  })

  useEffect(() => {
    document.title = deck ? '修改单词卡' : '新建单词卡'
  }, [deck])

  useEffect(() => {
    if (!focusId) return
    document.getElementById(`english-${focusId}`)?.focus()
  }, [focusId])

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (persistDraft()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const onPageHide = () => {
      persistDraft()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
    }
  })

  // Flush the latest raw fields when navigating through browser history as well.
  useEffect(
    () => () => {
      if (!submittedRef.current) {
        const current = currentRef.current
        if (serialize(current) !== baseline || current.deletedWords.length)
          saveEditorDraft(draftKey, {
            ...current,
            baseUpdatedAt: deck?.updatedAt,
            baseSignature: baseline,
            updatedAt: Date.now(),
          })
      }
    },
    [baseline, draftKey, deck?.updatedAt],
  )

  function leave(path = '/') {
    if (persistDraft()) {
      navigate(path)
      return
    }
    Modal.confirm({
      title: '草稿保存失败',
      content: '浏览器没有保存这份草稿。确定离开吗？未保存的内容会丢失。',
      okText: '离开',
      cancelText: '继续编辑',
      onOk: () => navigate(path),
    })
  }

  function discardDraft() {
    if (!saveEditorDraft(draftKey, null)) {
      setDraftError('草稿清除失败，请重试。')
      return
    }
    setDeletedWords([])
    setDate(original.date)
    setTitle(original.title)
    setWords(original.words.map((word) => ({ ...word })))
    setRequestedPage(1)
    setQuery('')
    setIncompleteOnly(false)
    setDraftNotice(false)
    setDraftConflict(false)
    setDraftError('')
    setDraftSaved(false)
  }

  function restoreOldDraft() {
    if (!storedDraft) return
    setDeletedWords(storedDraft.deletedWords ?? [])
    setDate(storedDraft.date)
    setTitle(storedDraft.title)
    setWords(storedDraft.words)
    setDraftConflict(false)
  }

  function updateWord(
    id: string,
    patch: Partial<Pick<DraftWord, 'english' | 'chinese' | 'collocations' | 'notes'>>,
  ) {
    setError('')
    setWords((current) => current.map((word) => (word.id === id ? { ...word, ...patch } : word)))
  }

  function insertAfter(index: number) {
    setError('')
    const created = createDraftWord()
    pendingFocus.current = created.id
    setQuery('')
    setIncompleteOnly(false)
    setRequestedPage(Math.floor((index + 1) / EDITOR_PAGE_SIZE) + 1)
    setWords((current) => {
      const next = [...current]
      next.splice(index + 1, 0, created)
      return next
    })
  }

  function appendBulk(rows: DraftWord[]) {
    const base =
      words.length === 1 &&
      words.every(
        (word) =>
          !word.english.trim() &&
          !word.chinese.trim() &&
          !word.collocations?.trim() &&
          !word.notes?.trim(),
      )
        ? []
        : words
    setWords([...base, ...rows])
    setQuery('')
    setIncompleteOnly(false)
    setRequestedPage(Math.floor(base.length / EDITOR_PAGE_SIZE) + 1)
    pendingFocus.current = rows[0]?.id ?? null
    setError('')
  }

  function removeWord(id: string) {
    const removed = deleteEditorWord(words, id)
    if (!removed) return
    setError('')
    setWords(removed.words)
    setDeletedWords((current) => [...current, removed.deleted])
  }

  function undoRemove() {
    const deleted = deletedWords.at(-1)
    if (!deleted) return
    const restored = restoreEditorWord(words, deleted)
    setWords(restored.words)
    setDeletedWords((current) => current.slice(0, -1))
    setQuery('')
    setIncompleteOnly(false)
    setError('')
    setRequestedPage(Math.floor(restored.index / EDITOR_PAGE_SIZE) + 1)
    pendingFocus.current = deleted.word.id
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!date) {
      setError('请选择学习日期')
      return
    }
    const normalized = normalizeDraft(words, deck?.words)
    if ('error' in normalized) {
      setError(normalized.error)
      if (normalized.index !== undefined) {
        const invalid = words[normalized.index]
        if (invalid) pendingFocus.current = invalid.id
        setQuery('')
        setIncompleteOnly(false)
        setRequestedPage(Math.floor(normalized.index / EDITOR_PAGE_SIZE) + 1)
      }
      return
    }
    const now = Date.now()
    submittedRef.current = true
    const message = onSave({
      id: deck?.id ?? crypto.randomUUID(),
      date,
      title: title.trim(),
      words: normalized.words,
      createdAt: deck?.createdAt ?? now,
      updatedAt: now,
    })
    if (message) {
      submittedRef.current = false
      setError(message)
    } else saveEditorDraft(draftKey, null)
  }

  return (
    <>
      <TopBar onHome={() => leave()} onNavigate={leave} />
      <main className="page">
        <div className="page-head">
          <Typography.Title level={3}>{deck ? '修改单词卡' : '新建单词卡'}</Typography.Title>
          <Typography.Paragraph type="secondary">
            记录这一天学过的单词。每一行都要填写英文和对应的中文释义。
          </Typography.Paragraph>
        </div>

        {draftNotice ? (
          <Alert
            style={{ marginBottom: 16 }}
            type={draftConflict ? 'warning' : 'info'}
            showIcon
            title={draftConflict ? '单词卡已更新，发现一份旧草稿' : '已恢复上次未保存的草稿'}
            description={
              draftConflict
                ? '当前显示已保存内容。你可以恢复旧草稿继续编辑，或放弃草稿。'
                : '未提交的英文、释义、搭配和备注均已恢复，保存后会清除草稿。'
            }
            action={
              <Flex gap={8} wrap>
                {draftConflict ? (
                  <Button size="small" onClick={restoreOldDraft}>
                    恢复旧草稿
                  </Button>
                ) : null}
                <Button size="small" onClick={discardDraft}>
                  放弃草稿
                </Button>
              </Flex>
            }
          />
        ) : null}
        {draftError ? (
          <Alert type="error" title={draftError} showIcon style={{ marginBottom: 16 }} />
        ) : null}

        <form
          onSubmit={handleSubmit}
          onKeyDown={(event) => {
            if (
              draftConflict ||
              bulkOpen ||
              event.defaultPrevented ||
              document.querySelector(
                '.suggest-menu, .ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
              )
            )
              return
            const shortcut = editorShortcut(event.nativeEvent)
            const row =
              event.target instanceof HTMLElement
                ? event.target.closest<HTMLElement>('[data-word-id]')
                : null
            if (!shortcut || (shortcut === 'remove' && !row?.dataset.wordId)) return
            event.preventDefault()
            event.stopPropagation()
            if (shortcut === 'submit') event.currentTarget.requestSubmit()
            else if (shortcut === 'add') insertAfter(words.length - 1)
            else if (shortcut === 'remove' && row?.dataset.wordId) {
              const index = pageWords.findIndex((item) => item.word.id === row.dataset.wordId)
              const neighbour = pageWords[index + 1] ?? pageWords[index - 1]
              pendingFocus.current = neighbour?.word.id ?? null
              removeWord(row.dataset.wordId)
              if (!neighbour)
                window.requestAnimationFrame(() =>
                  document.getElementById('editor-add-word')?.focus(),
                )
            } else if (shortcut === 'cancel') leave()
          }}
        >
          <fieldset className="stack editor-fields" disabled={draftConflict}>
            <div className="meta-grid">
              <label {...datePopup.triggerProps}>
                <span className="field-label">学习日期</span>
                <DatePicker
                  open={!draftConflict && datePopup.open}
                  onOpenChange={datePopup.onOpenChange}
                  panelRender={(panel) => <div {...datePopup.panelProps}>{panel}</div>}
                  value={date ? dayjs(date) : null}
                  allowClear
                  style={{ width: '100%' }}
                  onChange={(value) => {
                    setError('')
                    setDate(value ? value.format('YYYY-MM-DD') : '')
                  }}
                />
              </label>
              <label>
                <span className="field-label">名称</span>
                <Input
                  allowClear
                  value={title}
                  placeholder="可选，例如：考研核心词"
                  maxLength={40}
                  onChange={(event) => {
                    setError('')
                    setTitle(event.target.value)
                  }}
                />
              </label>
            </div>

            <div ref={listRef} className="editor-list-toolbar">
              <div className="editor-search-row">
                <Button onClick={() => setBulkOpen(true)}>批量粘贴</Button>
                <Input
                  aria-label="查找当前单词卡中的词"
                  placeholder="查找英文、释义、搭配或备注"
                  allowClear
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setRequestedPage(1)
                  }}
                />
                <Checkbox
                  checked={incompleteOnly}
                  onChange={(event) => {
                    setIncompleteOnly(event.target.checked)
                    setRequestedPage(1)
                  }}
                >
                  只看未填完整
                </Checkbox>
              </div>
              <Flex align="center" justify="space-between" gap={12} wrap>
                <Typography.Text type="secondary">
                  共 {words.length} 行 · 已填完整 {normalizeCount(words)} 行
                  {query || incompleteOnly ? ` · 找到 ${visibleWords.length} 行` : ''} · 每页{' '}
                  {EDITOR_PAGE_SIZE} 行
                </Typography.Text>
                <Pagination
                  size="small"
                  current={page}
                  pageSize={EDITOR_PAGE_SIZE}
                  total={visibleWords.length}
                  showSizeChanger={false}
                  onChange={changePage}
                />
              </Flex>
            </div>
            <div className="stack editor-word-list">
              {visibleWords.length === 0 ? (
                <Typography.Text type="secondary">
                  {words.length
                    ? '没有符合条件的词，可以清空查找或取消筛选。'
                    : '还没有单词，点击下方按钮添加。'}
                </Typography.Text>
              ) : null}
              {pageWords.map(({ word, index }) => (
                <EditorWordRow
                  key={word.id}
                  word={word}
                  index={index}
                  matches={duplicates.get(word.id)}
                  onChange={(patch) => updateWord(word.id, patch)}
                  onRemove={() => removeWord(word.id)}
                  onEnter={() => insertAfter(index)}
                />
              ))}
            </div>

            {error ? <Alert type="error" showIcon title={error} /> : null}

            <div className="editor-actions editor-actions-sticky">
              {deletedWords.length ? (
                <Alert
                  className="editor-delete-undo"
                  type="info"
                  showIcon
                  title={`已删除「${(deletedWords.at(-1)!.word.english || '空白行').slice(0, 32)}」，可撤销 ${deletedWords.length} 行。`}
                  action={
                    <Button
                      size="small"
                      title="恢复上一行；保存单词卡后结束本次删除撤销"
                      onClick={undoRemove}
                    >
                      撤销上一行
                    </Button>
                  }
                />
              ) : null}
              <Button
                id="editor-add-word"
                type="dashed"
                icon={<PlusOutlined />}
                title="快捷键：Alt+N"
                aria-keyshortcuts="Alt+N"
                onClick={() => insertAfter(words.length - 1)}
              >
                添加单词
              </Button>
              <Typography.Text type="secondary">
                {normalizeCount(words) > 0
                  ? `已填写 ${normalizeCount(words)} 个单词`
                  : '至少填写一个单词'}
                {draftSaved ? ' · 草稿已自动保存' : ''}
              </Typography.Text>
              <Flex gap={8} wrap>
                <Button onClick={() => leave()} title="快捷键：Esc" aria-keyshortcuts="Escape">
                  取消
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  title="快捷键：Command/Ctrl+Enter"
                  aria-keyshortcuts="Meta+Enter Control+Enter"
                >
                  保存单词卡
                </Button>
              </Flex>
            </div>
          </fieldset>
          <Typography.Paragraph type="secondary" className="editor-shortcut-hint">
            在编辑区域使用快捷键：Command/Ctrl+Enter 保存 · Alt+N 添加 · 在单词行内按 Command/Ctrl+D
            删除 · Esc 取消（保留草稿）
          </Typography.Paragraph>
        </form>
      </main>
      <BulkImportModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onAppend={appendBulk}
        words={words}
        decks={decks}
        editingDeckId={deck?.id}
      />
    </>
  )
}

function normalizeCount(words: readonly DraftWord[]): number {
  return words.filter((word) => word.english.trim() && word.chinese.trim()).length
}
