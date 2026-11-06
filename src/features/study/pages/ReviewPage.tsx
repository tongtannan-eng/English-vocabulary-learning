import { hasReviewWork } from '../reset.ts'
import { highlightExample } from '../highlightExample.ts'
import { ThemeSwitcher } from '../../../shared/components/ThemeSwitcher.tsx'
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  App as AntApp,
  Alert,
  Button,
  Flex,
  Input,
  Progress,
  Modal,
  Segmented,
  Tag,
  Typography,
} from 'antd'
import { SpeakButton } from '../components/SpeakButton.tsx'
import { SpellingPractice } from '../components/SpellingPractice.tsx'
import { formatDeckHeading } from '../../../shared/utils/format.ts'
import {
  advanceRetry,
  createReviewSession,
  randomReviewBatch,
  rateReview,
  reviewWordKey,
} from '../review.ts'
import { attemptKey, hydrateCheckpoint, makeLearningRecord } from '../learning.ts'
import type { LearningRecord, ReviewCheckpoint, ReviewRatingContext } from '../learning.ts'
import { checkSpelling } from '../spelling.ts'
import { navigate } from '../../../app/router.ts'
import { stopSpeaking } from '../speak.ts'
import { loadPrefs, savePrefs } from '../../../services/storage.ts'
import {
  loadShortcuts,
  matchesShortcut,
  matchesSpeakShortcut,
  retryAdvanceAliases,
  shortcutAria,
  shortcutLabel,
  speakTypingLabel,
  subscribeShortcuts,
} from '../../../services/shortcuts.ts'
import type {
  Deck,
  Familiarity,
  FrontSide,
  ReviewOrder,
  ReviewWord,
} from '../../../shared/types.ts'

interface Props {
  words: ReviewWord[]
  decks: Deck[]
  title: string
  subtitle: string
  sessionKey: string
  path: string
  saved?: ReviewCheckpoint
  backPath?: string
  emptyTitle?: string
  initialFront?: FrontSide
  randomLimit?: number
  onRate: (
    word: ReviewWord,
    familiarity: Familiarity,
    context: ReviewRatingContext,
  ) => string | void
  onCheckpoint: (key: string, checkpoint: ReviewCheckpoint | null) => string | void
  onSpelling: (record: LearningRecord, checkpoint: ReviewCheckpoint) => string | void
  onWordDetails: (
    word: ReviewWord,
    checkpoint: ReviewCheckpoint,
    details: { collocations: string[]; notes: string },
  ) => ReviewCheckpoint | string
}

export function ReviewPage({
  words,
  decks,
  title,
  subtitle,
  sessionKey,
  path,
  saved,
  backPath = '/',
  emptyTitle = '还没有可以复习的单词',
  onRate,
  onCheckpoint,
  onSpelling,
  onWordDetails,
  initialFront,
  randomLimit,
}: Props) {
  const { message: feedback } = AntApp.useApp()
  function fresh(
    initialWords: ReviewWord[],
    front = initialFront ?? loadPrefs().front,
    order = loadPrefs().order,
    previousSeen: string[] = [],
  ): ReviewCheckpoint {
    return {
      id: crypto.randomUUID(),
      key: sessionKey,
      path,
      title,
      subtitle,
      backPath,
      front,
      order,
      session: createReviewSession(initialWords, order),
      initialWords,
      flipped: false,
      answer: '',
      result: null,
      firstAttempts: {},
      shownAnswers: [],
      ...(randomLimit
        ? { randomSeen: [...new Set([...previousSeen, ...initialWords.map(reviewWordKey)])] }
        : {}),
      updatedAt: Date.now(),
    }
  }
  const [loaded] = useState(() => hydrateCheckpoint(saved, decks))
  const [checkpoint, setCheckpoint] = useState(
    () => loaded ?? fresh(randomLimit ? randomReviewBatch(words, randomLimit) : words),
  )
  const checkpointRef = useRef(checkpoint)
  const callbacksRef = useRef({ onRate, onCheckpoint, onSpelling })
  const saveTimerRef = useRef<number | undefined>(undefined)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingReset, setPendingReset] = useState<'restart' | ReviewOrder | null>(null)
  const [resetError, setResetError] = useState('')
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editCollocations, setEditCollocations] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState('')
  const [resumeNotice, setResumeNotice] = useState(Boolean(loaded || saved))
  const shortcuts = useSyncExternalStore(subscribeShortcuts, loadShortcuts, loadShortcuts)
  const { session, front, order, flipped } = checkpoint
  const done = session.phase === 'done'
  const word = session.sequence[session.cursor]

  useLayoutEffect(() => {
    callbacksRef.current = { onRate, onCheckpoint, onSpelling }
  }, [onRate, onCheckpoint, onSpelling])
  useEffect(() => {
    document.title = `复习 · ${title}`
  }, [title])
  useEffect(() => stopSpeaking, [session.cursor, session.phase, front])

  useEffect(() => {
    function flush(): string | void {
      window.clearTimeout(saveTimerRef.current)
      const current = checkpointRef.current
      if (current.session.phase !== 'done')
        return callbacksRef.current.onCheckpoint(current.key, current)
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!flush()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const pageHide = () => {
      flush()
    }
    const initialError = flush()
    if (initialError) setError(initialError)
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('pagehide', pageHide)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('pagehide', pageHide)
      flush()
    }
  }, [])

  function adopt(next: ReviewCheckpoint) {
    checkpointRef.current = next
    setCheckpoint(next)
  }

  function saveWordDetails() {
    if (!word) return
    window.clearTimeout(saveTimerRef.current)
    const result = onWordDetails(
      word,
      { ...checkpointRef.current, updatedAt: Date.now() },
      {
        collocations: editCollocations
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        notes: editNotes.trim(),
      },
    )
    if (typeof result === 'string') {
      setEditError(result)
      void feedback.error(result)
      return
    }
    adopt(result)
    setError('')
    setEditOpen(false)
    void feedback.success('例句和备注已保存')
  }

  function update(next: ReviewCheckpoint, defer = false) {
    window.clearTimeout(saveTimerRef.current)
    const stamped = { ...next, updatedAt: Date.now() }
    adopt(stamped)
    const persist = () => {
      const current = checkpointRef.current
      const message = callbacksRef.current.onCheckpoint(
        current.key,
        current.session.phase === 'done' ? null : current,
      )
      setError(message || '')
    }
    if (defer) saveTimerRef.current = window.setTimeout(persist, 200)
    else persist()
  }

  function exposureKey(current = checkpoint): string {
    const currentWord = current.session.sequence[current.session.cursor]
    return JSON.stringify([current.session.phase, currentWord?.deckId, currentWord?.id])
  }

  function revealed(current = checkpoint): string[] {
    return [...new Set([...current.shownAnswers, exposureKey(current)])]
  }

  function flip() {
    if (done) return
    update({
      ...checkpoint,
      flipped: !flipped,
      answer: flipped ? '' : checkpoint.answer,
      result: flipped ? null : checkpoint.result,
      shownAnswers: !flipped ? revealed() : checkpoint.shownAnswers,
    })
  }

  function resetCard() {
    update({ ...checkpoint, flipped: false, answer: '', result: null })
  }

  function rate(familiarity: Familiarity) {
    if (!word || !flipped || session.phase !== 'initial') return
    window.clearTimeout(saveTimerRef.current)
    const next = {
      ...checkpoint,
      session: rateReview(session, familiarity),
      flipped: false,
      answer: '',
      result: null,
      updatedAt: Date.now(),
    }
    const message = onRate(word, familiarity, {
      before: checkpoint,
      after: next.session.phase === 'done' ? null : next,
    })
    if (message) {
      setError(message)
      return
    }
    setError('')
    adopt(next)
  }

  function submitAnswer(): string | void {
    if (!word || !checkpoint.answer.trim()) return '请先输入英文，再提交答案。'
    window.clearTimeout(saveTimerRef.current)
    const attempt = {
      answer: checkpoint.answer,
      correct: checkSpelling(word.english, checkpoint.answer).correct,
      assisted: checkpoint.shownAnswers.includes(exposureKey()),
    }
    const key = attemptKey(checkpoint, word)
    const next: ReviewCheckpoint = {
      ...checkpoint,
      flipped: true,
      result: attempt,
      shownAnswers: revealed(),
      updatedAt: Date.now(),
      firstAttempts: checkpoint.firstAttempts[key]
        ? checkpoint.firstAttempts
        : { ...checkpoint.firstAttempts, [key]: attempt },
    }
    const message = onSpelling(makeLearningRecord(checkpoint, word, 'spelling', attempt), next)
    if (message) return message
    setError('')
    adopt(next)
  }

  function goPrev() {
    if (done || session.cursor === 0) return
    update({
      ...checkpoint,
      session: { ...session, cursor: session.cursor - 1 },
      flipped: false,
      answer: '',
      result: null,
    })
  }

  function goNext() {
    if (!word || done) return
    if (session.phase === 'retry') {
      if (!flipped) {
        flip()
        return
      }
      window.clearTimeout(saveTimerRef.current)
      const next: ReviewCheckpoint = {
        ...checkpoint,
        session: advanceRetry(session),
        flipped: false,
        answer: '',
        result: null,
        updatedAt: Date.now(),
      }
      const message = onCheckpoint(next.key, next.session.phase === 'done' ? null : next)
      if (message) {
        setError(message)
        return
      }
      setError('')
      adopt(next)
      return
    }
    const rating = session.ratings[reviewWordKey(word)]
    if (!rating) {
      if (!flipped) flip()
      return
    }
    update({
      ...checkpoint,
      session: rateReview(session, rating),
      flipped: false,
      answer: '',
      result: null,
    })
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || pendingReset) return
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
      const inWidget =
        target instanceof HTMLElement &&
        Boolean(target.closest('.ant-segmented, [role="menu"], [role="dialog"]'))
      if (inWidget) return
      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key === 'Escape'
      ) {
        if (!typing) navigate(backPath)
        return
      }
      if (matchesSpeakShortcut(event, shortcuts.speak, typing)) {
        event.preventDefault()
        window.dispatchEvent(new Event('english-daily-speak'))
        return
      }
      if (typing && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) return
      if (done) return
      const otherControl =
        target instanceof HTMLElement &&
        Boolean(target.closest('button, a, input, textarea, select, [contenteditable="true"]')) &&
        !target.closest('button[data-retry-advance]')
      if (
        session.phase === 'retry' &&
        flipped &&
        !otherControl &&
        retryAdvanceAliases(shortcuts).some((binding) => matchesShortcut(event, binding))
      ) {
        event.preventDefault()
        goNext()
        return
      }
      if (matchesShortcut(event, shortcuts.flip)) {
        const onControl = target instanceof HTMLElement && Boolean(target.closest('button, a'))
        if (shortcuts.flip === 'Space' && onControl) return
        if (
          shortcuts.flip === 'Enter' &&
          !(target instanceof HTMLElement && target.classList.contains('flashcard'))
        )
          return
        event.preventDefault()
        flip()
      } else if (matchesShortcut(event, shortcuts.unknown)) {
        event.preventDefault()
        rate('unknown')
      } else if (matchesShortcut(event, shortcuts.known)) {
        event.preventDefault()
        rate('known')
      } else if (matchesShortcut(event, shortcuts.previous)) {
        event.preventDefault()
        goPrev()
      } else if (matchesShortcut(event, shortcuts.next)) {
        event.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  function changeFront(next: FrontSide) {
    if (next === front) return
    update({
      ...checkpoint,
      front: next,
      flipped: false,
      answer: '',
      result: null,
      shownAnswers:
        front === 'english' || next === 'english' || flipped ? revealed() : checkpoint.shownAnswers,
    })
    savePrefs({ front: next, order })
  }

  function applyReset(action: 'restart' | ReviewOrder) {
    const current = checkpointRef.current
    const next = fresh(
      action === 'restart' && !randomLimit ? words : current.initialWords,
      current.front,
      action === 'restart' ? current.order : action,
      current.randomSeen,
    )
    next.updatedAt = Math.max(next.updatedAt, current.updatedAt + 1)
    window.clearTimeout(saveTimerRef.current)
    // A failed reset must leave the current queue, input and selected order intact.
    const message = callbacksRef.current.onCheckpoint(next.key, next)
    if (message) {
      setError(message)
      setResetError(message)
      return
    }
    adopt(next)
    setError(
      action !== 'restart' && !savePrefs({ front: next.front, order: next.order })
        ? '本轮顺序已切换，但默认顺序未能保存，请检查浏览器存储。'
        : '',
    )
    setResumeNotice(false)
    setPendingReset(null)
    setResetError('')
  }

  function requestReset(action: 'restart' | ReviewOrder) {
    setResetError('')
    if (hasReviewWork(checkpointRef.current)) setPendingReset(action)
    else applyReset(action)
  }

  function changeOrder(next: ReviewOrder) {
    if (next !== order) requestReset(next)
  }

  function restart() {
    requestReset('restart')
  }

  function continueRandom() {
    if (!randomLimit) return
    const batch = randomReviewBatch(words, randomLimit, checkpoint.randomSeen ?? [])
    if (!batch.length) return
    const next = fresh(batch, checkpoint.front, checkpoint.order, checkpoint.randomSeen)
    const message = onCheckpoint(next.key, next)
    if (message) {
      setError(message)
      return
    }
    setError('')
    setResumeNotice(false)
    adopt(next)
  }

  if (session.initialCount === 0)
    return (
      <main className="page">
        <Flex vertical align="flex-start" gap={16}>
          <Typography.Title level={3}>{emptyTitle}</Typography.Title>
          <Button type="primary" onClick={() => navigate(backPath)}>
            返回
          </Button>
        </Flex>
      </main>
    )

  const dictation = front === 'dictation'
  const englishFront = front === 'english'
  const frontText = word
    ? dictation
      ? '听发音，拼单词'
      : englishFront
        ? word.english
        : word.chinese
    : ''
  const backText = word ? (englishFront ? word.chinese : word.english) : ''
  const total = session.sequence.length
  const remaining = checkpoint.initialWords.filter((item) =>
    decks
      .find((deck) => deck.id === item.deckId)
      ?.words.some((word) => word.id === item.id && word.familiarity === 'unknown'),
  ).length
  const remainingRandom = randomLimit
    ? words.filter((item) => !(checkpoint.randomSeen ?? []).includes(reviewWordKey(item))).length
    : 0
  const nextReview = checkpoint.initialWords
    .flatMap((item) => {
      const current = decks
        .find((deck) => deck.id === item.deckId)
        ?.words.find((word) => word.id === item.id)
      return current?.nextReviewDate ? [current.nextReviewDate] : []
    })
    .sort()[0]

  return (
    <main className="page study-page">
      <Modal
        open={editOpen}
        title="编辑单词补充信息"
        okText="保存"
        cancelText="取消"
        onCancel={() => setEditOpen(false)}
        onOk={saveWordDetails}
      >
        <label htmlFor="review-collocations">常用搭配或例句（每行一条）</label>
        <Input.TextArea
          allowClear
          id="review-collocations"
          rows={4}
          value={editCollocations}
          onChange={(event) => setEditCollocations(event.target.value)}
        />
        <label htmlFor="review-notes">个人备注</label>
        <Input.TextArea
          allowClear
          id="review-notes"
          rows={4}
          value={editNotes}
          onChange={(event) => setEditNotes(event.target.value)}
        />
        {editError ? <Alert type="error" showIcon title={editError} /> : null}
      </Modal>
      <Modal
        open={pendingReset !== null}
        title={pendingReset === 'restart' ? '重新开始本轮复习？' : '切换顺序并重新开始？'}
        okText={pendingReset === 'restart' ? '重新开始' : '切换并重开'}
        cancelText="继续当前复习"
        onCancel={() => {
          setPendingReset(null)
          setResetError('')
        }}
        onOk={() => {
          if (pendingReset) applyReset(pendingReset)
        }}
      >
        <Typography.Paragraph>
          这会回到第 1 题，重置本轮作答状态和输入内容
          {pendingReset === 'random'
            ? '，并重新打乱单词顺序'
            : pendingReset === 'sequential'
              ? '，改为按顺序复习'
              : '，随机模式会重新打乱词序'}
          。已保存的学习记录和复习排期会保留。
        </Typography.Paragraph>
        {resetError ? <Alert type="error" showIcon title={resetError} /> : null}
      </Modal>
      <header className="study-bar">
        <Button onClick={() => navigate(backPath)}>返回</Button>
        <div className="study-title">
          <Typography.Text strong>{title}</Typography.Text>
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        </div>
        <Typography.Text strong aria-live="polite">
          {done
            ? '完成'
            : `${session.phase === 'retry' ? '重练 ' : ''}${session.cursor + 1} / ${total}`}
        </Typography.Text>
      </header>
      {resumeNotice ? (
        <Alert
          className="resume-notice"
          type={loaded ? 'info' : 'warning'}
          showIcon
          closable
          onClose={() => setResumeNotice(false)}
          title={
            loaded
              ? '已继续上次复习，顺序、位置和输入内容已恢复。'
              : '单词内容有更新，已重新开始本轮复习。'
          }
        />
      ) : null}
      <div className="review-settings">
        <button
          type="button"
          className="review-settings-toggle"
          aria-expanded={settingsOpen}
          aria-controls="review-tools"
          onClick={() => setSettingsOpen((value) => !value)}
        >
          <span>
            {front === 'english' ? '英文' : front === 'chinese' ? '中文' : '听写'} ·{' '}
            {order === 'random' ? '随机' : '按顺序'}
          </span>
          <span>{settingsOpen ? '收起设置' : '本轮设置'}</span>
        </button>
        <div id="review-tools" className={`study-tools${settingsOpen ? ' is-open' : ''}`}>
          <ThemeSwitcher />
          <div className="tool">
            <Typography.Text type="secondary">模式</Typography.Text>
            <Segmented
              value={front}
              options={[
                { label: '英文', value: 'english' },
                { label: '中文', value: 'chinese' },
                { label: '听写', value: 'dictation' },
              ]}
              onChange={(value) => changeFront(value as FrontSide)}
            />
          </div>
          <div className="tool">
            <Typography.Text type="secondary">顺序</Typography.Text>
            <Segmented
              value={order}
              options={[
                { label: '按顺序', value: 'sequential' },
                { label: '随机', value: 'random' },
              ]}
              onChange={(value) => changeOrder(value as ReviewOrder)}
            />
          </div>
          {!done ? (
            <Button type="text" onClick={restart}>
              重新开始
            </Button>
          ) : null}
          <Typography.Text className="review-settings-note" type="secondary">
            进度自动保存；切换顺序会重新开始本轮。
          </Typography.Text>
        </div>
      </div>
      <Typography.Paragraph type="secondary" className="review-instruction">
        {session.phase === 'retry'
          ? '先回忆答案，再查看释义；重练不会改变生词状态。'
          : dictation
            ? '先播放发音，再输入听到的单词。'
            : englishFront
              ? '先回忆答案，再翻面选择是否认识。'
              : '看中文输入英文，提交后对照拼写差异，再选择是否认识。'}
      </Typography.Paragraph>
      <Progress
        percent={done ? 100 : (session.cursor / total) * 100}
        showInfo={false}
        strokeColor="var(--primary)"
        railColor="var(--border)"
        size={4}
      />
      {error ? <Alert type="error" showIcon title={error} style={{ marginTop: 16 }} /> : null}
      {session.phase === 'retry' ? (
        <Alert
          className="retry-notice"
          type="info"
          showIcon
          title={`生词重练：将第一轮不认识的 ${session.retryCount} 个单词再复习一遍。`}
          description="先回忆再查看答案；这些词会保留在生词本，供之后复习。"
        />
      ) : null}
      {done ? (
        <Flex vertical align="flex-start" gap={12} style={{ marginTop: 40 }}>
          <Typography.Title level={3}>本轮复习完成</Typography.Title>
          <Typography.Paragraph type="secondary">
            已复习 {session.initialCount} 个单词
            {session.retryCount > 0 ? `，额外重练 ${session.retryCount} 个生词` : ''}。
            {remaining > 0
              ? `本轮有 ${remaining} 个词保留在生词本，可在之后继续复习。`
              : '本轮单词都已标记为认识。'}
          </Typography.Paragraph>
          {nextReview ? (
            <Typography.Text type="secondary">
              本轮最早下次复习：{formatDeckHeading(nextReview)}，到期后会出现在今日任务中。
            </Typography.Text>
          ) : null}
          <Flex gap={8} wrap>
            {randomLimit && remainingRandom > 0 ? (
              <Button type="primary" onClick={continueRandom}>
                继续学习其他单词（剩余 {remainingRandom} 个）
              </Button>
            ) : null}
            {randomLimit && remainingRandom === 0 ? (
              <Typography.Text>所有单词都已练过。</Typography.Text>
            ) : null}
            {!randomLimit && words.length > 0 ? (
              <Button type="primary" onClick={restart}>
                再来一轮
              </Button>
            ) : null}
            <Button href="#/records">查看学习记录</Button>
            <Button href="#/unfamiliar">查看生词本</Button>
            <Button onClick={() => navigate(backPath)}>返回</Button>
          </Flex>
        </Flex>
      ) : word ? (
        <>
          <div className="review-source">
            <div>
              <Tag>{formatDeckHeading(word.deckDate)}</Tag>
              <Typography.Text type="secondary">{word.deckTitle || '每日单词'}</Typography.Text>
            </div>
            {flipped ? (
              <Button
                type="text"
                size="small"
                onClick={() => {
                  setEditCollocations((word.collocations ?? []).join('\n'))
                  setEditNotes(word.notes ?? '')
                  setEditError('')
                  setEditOpen(true)
                }}
              >
                编辑例句和备注
              </Button>
            ) : null}
          </div>
          <div className={dictation ? 'flashcard-scene is-dictation' : 'flashcard-scene'}>
            <SpeakButton
              key={reviewWordKey(word)}
              listenHotkey
              className={dictation && !flipped ? 'dictation-play' : 'speak-button'}
              english={word.english}
              hideWord={dictation && !flipped}
              label={dictation && !flipped ? '播放发音' : undefined}
            />
            <div
              className="flashcard"
              role="button"
              tabIndex={0}
              aria-pressed={flipped}
              aria-label={
                flipped
                  ? `背面：${backText}。点击翻回正面`
                  : dictation
                    ? '听写：播放发音后在下方输入单词，点击可查看答案'
                    : `正面：${frontText}。点击查看背面`
              }
              onClick={() => {
                const selection = window.getSelection()
                if (selection && !selection.isCollapsed) return
                flip()
              }}
            >
              <div
                className={flipped ? 'flashcard-inner is-flipped' : 'flashcard-inner'}
                key={`${reviewWordKey(word)}-${front}`}
              >
                <div className="face face-front" aria-hidden={flipped}>
                  <span className="face-kicker">
                    {dictation ? '听写' : englishFront ? '英文' : '中文'}
                  </span>
                  <span
                    className={dictation ? 'face-text dictation-prompt' : textSizeClass(frontText)}
                    lang={englishFront ? 'en' : 'zh-CN'}
                  >
                    {frontText}
                  </span>
                  <span className="face-hint">
                    {dictation
                      ? '点击播放，可重复收听'
                      : englishFront
                        ? '点击卡片查看背面'
                        : '在下方输入英文，或点击卡片直接看答案'}
                  </span>
                </div>
                <div className="face face-back" aria-hidden={!flipped}>
                  <span className="face-kicker">{englishFront ? '中文' : '英文'}</span>
                  <div className="face-answer">
                    <span className={textSizeClass(backText)} lang={englishFront ? 'zh-CN' : 'en'}>
                      {backText}
                    </span>
                    {dictation ? <span className="dictation-meaning">{word.chinese}</span> : null}
                  </div>
                  <span className="face-hint">
                    {session.phase === 'retry'
                      ? '回忆并查看答案后，继续下一张'
                      : '回忆后，在下方选择是否认识'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {!englishFront ? (
            <SpellingPractice
              key={`${reviewWordKey(word)}-${session.phase}-${front}`}
              english={word.english}
              revealed={flipped}
              answer={checkpoint.answer}
              attempt={checkpoint.result}
              dictation={dictation}
              onAnswerChange={(answer) => update({ ...checkpointRef.current, answer }, true)}
              onSubmitAnswer={submitAnswer}
              onRetry={resetCard}
            />
          ) : null}
          {flipped && ((word.collocations?.length ?? 0) > 0 || word.notes) ? (
            <section className="review-word-details" aria-label="常用搭配与个人备注">
              {word.collocations && word.collocations.length > 0 ? (
                <div>
                  <Typography.Text strong>常用搭配</Typography.Text>
                  <ul>
                    {word.collocations.map((sentence, index) => (
                      <li key={index} lang="en">
                        {highlightExample(sentence, word.english).map((part, partIndex) =>
                          part.highlight ? (
                            <strong className="example-highlight" key={partIndex}>
                              {part.text}
                            </strong>
                          ) : (
                            part.text
                          ),
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {word.notes ? (
                <div>
                  <Typography.Text strong>个人备注</Typography.Text>
                  <Typography.Paragraph className="review-notes">{word.notes}</Typography.Paragraph>
                </div>
              ) : null}
            </section>
          ) : null}
          <div
            className={
              flipped && session.phase === 'initial' ? 'study-nav has-ratings' : 'study-nav'
            }
          >
            <Button
              size="large"
              title={`快捷键：${shortcutLabel(shortcuts.previous)}`}
              aria-keyshortcuts={shortcutAria(shortcuts.previous)}
              onClick={goPrev}
              disabled={session.cursor === 0}
            >
              上一张
            </Button>
            {flipped && session.phase === 'retry' ? (
              <Button
                size="large"
                type="primary"
                data-retry-advance
                title={`快捷键：${[shortcuts.next, ...retryAdvanceAliases(shortcuts)]
                  .filter((binding, index, all) => all.indexOf(binding) === index)
                  .map(shortcutLabel)
                  .join(' / ')}`}
                aria-keyshortcuts={[shortcuts.next, ...retryAdvanceAliases(shortcuts)]
                  .filter((binding, index, all) => all.indexOf(binding) === index)
                  .map(shortcutAria)
                  .join(' ')}
                onClick={goNext}
              >
                {session.cursor === session.sequence.length - 1 ? '完成重练' : '下一张'}
              </Button>
            ) : flipped ? (
              <>
                <Button
                  className="rating-unknown"
                  size="large"
                  title={`快捷键：${shortcutLabel(shortcuts.unknown)}`}
                  aria-keyshortcuts={shortcutAria(shortcuts.unknown)}
                  onClick={() => rate('unknown')}
                >
                  不认识
                </Button>
                <Button
                  size="large"
                  type="primary"
                  title={`快捷键：${shortcutLabel(shortcuts.known)}`}
                  aria-keyshortcuts={shortcutAria(shortcuts.known)}
                  onClick={() => rate('known')}
                >
                  认识
                </Button>
              </>
            ) : (
              <Button
                size="large"
                type={englishFront ? 'primary' : 'default'}
                title={`快捷键：${shortcutLabel(shortcuts.flip)}`}
                aria-keyshortcuts={shortcutAria(shortcuts.flip)}
                onClick={flip}
              >
                {englishFront ? '查看中文' : '直接看答案'}
              </Button>
            )}
          </div>
          <p className="hint">{shortcutHint(shortcuts, session.phase === 'retry')}</p>
        </>
      ) : null}
    </main>
  )
}

function shortcutHint(shortcuts: ReturnType<typeof loadShortcuts>, retry: boolean): string {
  const speak = shortcutLabel(shortcuts.speak)
  const rating = retry
    ? ''
    : ` · ${shortcutLabel(shortcuts.unknown)} 不认识 · ${shortcutLabel(shortcuts.known)} 认识`
  const next = [shortcuts.next, ...(retry ? retryAdvanceAliases(shortcuts) : [])]
    .filter((binding, index, all) => all.indexOf(binding) === index)
    .map(shortcutLabel)
    .join('/')
  return `${speak} 朗读 · ${shortcutLabel(shortcuts.flip)} 翻面${rating} · ${shortcutLabel(shortcuts.previous)} 上一张 · ${next} 下一张 · 输入时按 ${speakTypingLabel(shortcuts.speak)} 朗读，Enter 提交`
}

function textSizeClass(text: string): string {
  if (text.length > 60) return 'face-text is-long'
  if (text.length > 24) return 'face-text is-medium'
  return 'face-text'
}
