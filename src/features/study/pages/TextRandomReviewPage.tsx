import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Flex, Progress, Typography } from 'antd'
import { navigate } from '../../../app/router.ts'
import type { QuickLimit } from '../quick.ts'
import type { ReviewCheckpoint, StudyState } from '../learning.ts'
import { hydrateCheckpoint } from '../learning.ts'
import {
  collectReviewWords,
  createReviewSession,
  randomReviewBatch,
  rateReview,
  reviewWordKey,
  textReviewDeck,
} from '../review.ts'
import type { TextReviewKind } from '../review.ts'
import { SpeakButton } from '../components/SpeakButton.tsx'

export function TextRandomReviewPage({
  state,
  kind,
  limit,
  onCheckpoint,
}: {
  state: StudyState
  kind: TextReviewKind
  limit: QuickLimit
  onCheckpoint: (key: string, checkpoint: ReviewCheckpoint | null) => string | void
}) {
  const label = kind === 'phrases' ? '词组' : '语句'
  const key = `random:${kind}:${limit}`
  const path = `/review-random/${kind}/${limit}`
  const words = collectReviewWords([textReviewDeck(kind, state[kind] ?? [])])
  function fresh(seen: string[] = []): ReviewCheckpoint {
    const batch = randomReviewBatch(words, limit, seen)
    return {
      id: crypto.randomUUID(),
      key,
      path,
      title: `随机复习 · ${label}`,
      subtitle: `每轮最多 ${limit} 条`,
      backPath: '/practice',
      front: 'english',
      order: 'sequential',
      session: createReviewSession(batch, 'sequential'),
      initialWords: batch,
      flipped: false,
      answer: '',
      result: null,
      firstAttempts: {},
      shownAnswers: [],
      randomSeen: [...new Set([...seen, ...batch.map(reviewWordKey)])],
      updatedAt: Date.now(),
    }
  }
  const [loaded] = useState(() => hydrateCheckpoint(state.sessions[key], state.decks, state))
  const [checkpoint, setCheckpoint] = useState(() => loaded ?? fresh())
  const [error, setError] = useState('')
  const callback = useRef(onCheckpoint)
  callback.current = onCheckpoint
  const { session } = checkpoint
  const done = session.phase === 'done'
  const word = session.sequence[session.cursor]
  const remaining = words.filter(
    (item) => !(checkpoint.randomSeen ?? []).includes(reviewWordKey(item)),
  ).length

  useEffect(() => {
    document.title = `随机复习${label} · 每日单词`
  }, [label])
  useEffect(() => {
    if (checkpoint.session.phase === 'done') return
    const message = callback.current(checkpoint.key, checkpoint)
    if (message) setError(message)
    // Initial checkpoint is saved once; later changes are saved before updating the UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function save(next: ReviewCheckpoint) {
    const stamped = { ...next, updatedAt: Math.max(Date.now(), checkpoint.updatedAt + 1) }
    const message = onCheckpoint(key, stamped.session.phase === 'done' ? null : stamped)
    if (message) {
      setError(message)
      return
    }
    setError('')
    setCheckpoint(stamped)
  }

  return (
    <main className="page study-page">
      <header className="study-bar">
        <Button onClick={() => navigate('/practice')}>返回</Button>
        <div className="study-title">
          <Typography.Text strong>随机复习 · {label}</Typography.Text>
          <Typography.Text type="secondary">每轮最多 {limit} 条</Typography.Text>
        </div>
        <Typography.Text strong aria-live="polite">
          {done ? '完成' : `${session.cursor + 1} / ${session.sequence.length}`}
        </Typography.Text>
      </header>
      <Typography.Paragraph type="secondary" className="review-instruction">
        翻看{label}，不会计入单词作答或复习排期。
      </Typography.Paragraph>
      <Progress
        percent={done ? 100 : (session.cursor / session.sequence.length) * 100}
        showInfo={false}
        strokeColor="var(--primary)"
        railColor="var(--border)"
        size={4}
      />
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {loaded ? (
        <Typography.Paragraph type="secondary">已恢复上次的顺序和位置。</Typography.Paragraph>
      ) : null}
      {done ? (
        <Flex vertical align="flex-start" gap={12} style={{ marginTop: 40 }}>
          <Typography.Title level={3}>
            {session.initialCount ? '本轮复习完成' : `还没有可以复习的${label}`}
          </Typography.Title>
          {remaining > 0 ? (
            <Button type="primary" onClick={() => save(fresh(checkpoint.randomSeen))}>
              继续复习其他{label}（剩余 {remaining} 条）
            </Button>
          ) : session.initialCount ? (
            <Typography.Text>全部{label}已看过。</Typography.Text>
          ) : null}
          <Button onClick={() => navigate('/practice')}>返回练习中心</Button>
        </Flex>
      ) : word ? (
        <>
          <div className="review-source">
            <Typography.Text type="secondary">{label}</Typography.Text>
          </div>
          <div className="flashcard-scene">
            <SpeakButton english={word.english} className="speak-button" />
            <div
              className="flashcard"
              role="button"
              tabIndex={0}
              aria-pressed={checkpoint.flipped}
              aria-label={
                checkpoint.flipped
                  ? `中文：${word.chinese || '未填写中文'}，点击翻回英文`
                  : `英文：${word.english}，点击查看中文`
              }
              onClick={() => {
                const selection = window.getSelection()
                if (!selection || selection.isCollapsed)
                  save({ ...checkpoint, flipped: !checkpoint.flipped })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  save({ ...checkpoint, flipped: !checkpoint.flipped })
                }
              }}
            >
              <div
                className={checkpoint.flipped ? 'flashcard-inner is-flipped' : 'flashcard-inner'}
              >
                <div className="face face-front" aria-hidden={checkpoint.flipped}>
                  <span className="face-kicker">英文</span>
                  <span
                    className={`face-text ${word.english.length > 60 ? 'is-long' : 'is-medium'}`}
                    lang="en"
                  >
                    {word.english}
                  </span>
                  <span className="face-hint">点击卡片查看中文</span>
                </div>
                <div className="face face-back" aria-hidden={!checkpoint.flipped}>
                  <span className="face-kicker">中文</span>
                  <span
                    className={`face-text ${word.chinese.length > 60 ? 'is-long' : 'is-medium'}`}
                  >
                    {word.chinese || '未填写中文'}
                  </span>
                  <span className="face-hint">点击卡片翻回英文</span>
                </div>
              </div>
            </div>
          </div>
          <div className="study-nav">
            <Button
              size="large"
              disabled={session.cursor === 0}
              onClick={() =>
                save({
                  ...checkpoint,
                  session: { ...session, cursor: session.cursor - 1 },
                  flipped: false,
                })
              }
            >
              上一条
            </Button>
            {checkpoint.flipped ? (
              <Button
                size="large"
                type="primary"
                onClick={() =>
                  save({ ...checkpoint, session: rateReview(session, 'known'), flipped: false })
                }
              >
                下一条
              </Button>
            ) : (
              <Button
                size="large"
                type="primary"
                onClick={() => save({ ...checkpoint, flipped: true })}
              >
                查看中文
              </Button>
            )}
          </div>
        </>
      ) : null}
    </main>
  )
}
