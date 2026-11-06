import { spellingErrorWords } from '../features/study/spellingErrors.ts'
import { BackToTop } from '../shared/components/BackToTop.tsx'
import { PageBoundary } from '../shared/components/PageBoundary.tsx'
import { historicalReviewWords } from '../features/study/mistakes.ts'
import { trashDeck, restoreTrash, purgeTrash } from '../services/trash.ts'
import type { TrashResult } from '../services/trash.ts'
import { quickKey, quickPath, quickWords } from '../features/study/quick.ts'
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { App as AntApp, Button, Flex, Typography } from 'antd'
import { sortDecks } from '../features/decks/deck.ts'
import { DeckList } from '../features/decks/pages/DeckList.tsx'
import { StudyOverview } from '../features/study/components/StudyOverview.tsx'
import {
  formatDate,
  formatDeckHeading,
  getMonthRange,
  getWeekRange,
  todayISO,
} from '../shared/utils/format.ts'
import {
  collectReviewWords,
  collectUnfamiliarWords,
  selectWeeklyDecks,
  selectMonthlyDecks,
} from '../features/study/review.ts'
import {
  appendLearningRecord,
  applyReviewRating,
  getTodayWords,
  pruneCheckpoints,
  withCheckpoint,
  hydrateCheckpoint,
  updateReviewWordDetails,
} from '../features/study/learning.ts'
import type {
  LearningRecord,
  ReviewCheckpoint,
  ReviewRatingContext,
  StudyState,
} from '../features/study/learning.ts'
import { navigate, parseHash, type Route } from './router.ts'
import {
  loadStudyState,
  saveStudyState,
  STUDY_STORAGE_KEY,
  upsertDeck,
} from '../services/storage.ts'
import { importBackup } from '../services/backup.ts'
import type { ParsedDeckFile } from '../services/backupTypes.ts'
import type { Deck, Familiarity, FrontSide, Phrase, ReviewWord, Sentence } from '../shared/types.ts'

const SentencePage = lazy(() =>
  import('../features/sentences/pages/SentencePage.tsx').then((page) => ({
    default: page.SentencePage,
  })),
)
const PhrasePage = lazy(() =>
  import('../features/phrases/pages/PhrasePage.tsx').then((page) => ({ default: page.PhrasePage })),
)
const MistakesPage = lazy(() =>
  import('../features/study/pages/MistakesPage.tsx').then((page) => ({
    default: page.MistakesPage,
  })),
)
const PracticePage = lazy(() =>
  import('../features/study/pages/PracticePage.tsx').then((page) => ({
    default: page.PracticePage,
  })),
)
const SettingsPage = lazy(() =>
  import('../features/settings/pages/SettingsPage.tsx').then((page) => ({
    default: page.SettingsPage,
  })),
)
const TrashPage = lazy(() =>
  import('../features/decks/pages/TrashPage.tsx').then((page) => ({ default: page.TrashPage })),
)
const DeckEditor = lazy(() =>
  import('../features/decks/pages/DeckEditor.tsx').then((page) => ({ default: page.DeckEditor })),
)
const ReviewPage = lazy(() =>
  import('../features/study/pages/ReviewPage.tsx').then((page) => ({ default: page.ReviewPage })),
)
const RecordsPage = lazy(() =>
  import('../features/study/pages/RecordsPage.tsx').then((page) => ({ default: page.RecordsPage })),
)
const UnfamiliarPage = lazy(() =>
  import('../features/study/pages/UnfamiliarPage.tsx').then((page) => ({
    default: page.UnfamiliarPage,
  })),
)
const WeeklyPage = lazy(() =>
  import('../features/study/pages/WeeklyPage.tsx').then((page) => ({ default: page.WeeklyPage })),
)
const MonthlyPage = lazy(() =>
  import('../features/study/pages/MonthlyPage.tsx').then((page) => ({ default: page.MonthlyPage })),
)
const TextRandomReviewPage = lazy(() =>
  import('../features/study/pages/TextRandomReviewPage.tsx').then((page) => ({
    default: page.TextRandomReviewPage,
  })),
)
const SpellingErrorsPage = lazy(() =>
  import('../features/study/pages/SpellingErrorsPage.tsx').then((page) => ({
    default: page.SpellingErrorsPage,
  })),
)

function AppPage() {
  const { message } = AntApp.useApp()
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  const [study, setStudy] = useState(loadStudyState)
  const { decks, records, sessions } = study

  useLayoutEffect(() => {
    if (route.name !== 'list') window.scrollTo({ top: 0, behavior: 'instant' })
  }, [route])

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash))
    function onStorage(event: StorageEvent) {
      if (event.key !== STUDY_STORAGE_KEY && event.key !== null) return
      const current = loadStudyState()
      setStudy(current)
    }
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const sorted = sortDecks(decks)

  function commit(next: StudyState): boolean {
    if (!saveStudyState(next)) return false
    setStudy(next)
    return true
  }

  function handleSave(deck: Deck): string | void {
    const current = loadStudyState()
    const isEditing = current.decks.some((item) => item.id === deck.id)
    if (!commit(pruneCheckpoints({ ...current, decks: upsertDeck(current.decks, deck) })))
      return '保存失败，浏览器可能禁止了本地存储。'
    void message.success(isEditing ? '单词卡保存成功' : '单词卡创建成功')
    navigate('/')
  }

  function updateTrashResult(result: TrashResult): TrashResult {
    if (!('error' in result)) setStudy(result.state)
    return result
  }
  const handleDelete = (id: string) => updateTrashResult(trashDeck(id))
  const handleRestore = (id: string) => updateTrashResult(restoreTrash(id))
  const handlePurge = (id: string) => updateTrashResult(purgeTrash(id))

  function handleSentences(sentences: Sentence[]): string | void {
    if (!commit(pruneCheckpoints({ ...loadStudyState(), sentences })))
      return '语句保存失败，请检查浏览器本地存储。'
  }

  function handlePhrases(phrases: Phrase[]): string | void {
    if (!commit(pruneCheckpoints({ ...loadStudyState(), phrases })))
      return '词组保存失败，请检查浏览器本地存储。'
  }

  function handleImport(file: ParsedDeckFile): { message: string } | { error: string } {
    const result = importBackup(file)
    if ('error' in result) return result
    setStudy(result.state)
    return { message: result.message }
  }

  function handleRate(
    word: ReviewWord,
    familiarity: Familiarity,
    context?: ReviewRatingContext,
  ): string | void {
    const next = applyReviewRating(loadStudyState(), word, familiarity, context)
    if (!next) return '单词内容已修改或删除，请返回列表重新开始。'
    if (!commit(next)) return '学习记录保存失败，请检查浏览器本地存储后重试。'
  }

  function handleCheckpoint(key: string, checkpoint: ReviewCheckpoint | null): string | void {
    const current = loadStudyState()
    if (
      checkpoint &&
      /^\/review-random\/(phrases|sentences)\//.test(checkpoint.path) &&
      !hydrateCheckpoint(checkpoint, current.decks, current)
    )
      return '内容已修改或删除，请返回练习中心重新开始。'
    if (!commit(withCheckpoint(current, key, checkpoint)))
      return '复习进度保存失败，请检查浏览器本地存储。'
  }

  function handleSpelling(record: LearningRecord, checkpoint: ReviewCheckpoint): string | void {
    const current = loadStudyState()
    const next = withCheckpoint(
      { ...current, records: appendLearningRecord(current.records, record) },
      checkpoint.key,
      checkpoint,
    )
    if (!commit(next)) return '作答记录保存失败，请重试，当前答案尚未计入记录。'
  }

  function handleWordDetails(
    word: ReviewWord,
    checkpoint: ReviewCheckpoint,
    details: { collocations: string[]; notes: string },
  ): ReviewCheckpoint | string {
    const next = updateReviewWordDetails(loadStudyState(), word, checkpoint, details)
    const updated = next?.sessions[checkpoint.key]
    if (!next || !updated) return '单词或复习内容已修改或删除，请刷新后重试。'
    if (!commit(next)) return '保存失败，请检查浏览器本地存储后重试。'
    return updated
  }

  function review(source: {
    key: string
    path: string
    words: ReviewWord[]
    title: string
    subtitle: string
    backPath?: string
    emptyTitle?: string
    initialFront?: FrontSide
    randomLimit?: number
  }) {
    const { key: sourceKey, ...props } = source
    return (
      <ReviewPage
        key={sourceKey}
        {...props}
        sessionKey={sourceKey}
        decks={decks}
        saved={sessions[sourceKey]}
        onRate={handleRate}
        onCheckpoint={handleCheckpoint}
        onSpelling={handleSpelling}
        onWordDetails={handleWordDetails}
      />
    )
  }

  if (route.name === 'practice') return <PracticePage state={study} />
  if (route.name === 'review-random-text')
    return (
      <TextRandomReviewPage
        key={`${route.kind}:${route.limit}`}
        state={study}
        kind={route.kind}
        limit={route.limit}
        onCheckpoint={handleCheckpoint}
      />
    )
  if (route.name === 'review-random')
    return review({
      key: `random:${route.limit}`,
      path: `/review-random/${route.limit}`,
      words: collectReviewWords(decks),
      title: '随机复习',
      subtitle: `从全部单词中随机抽取，每轮最多 ${route.limit} 个`,
      backPath: '/practice',
      emptyTitle: '还没有可以复习的单词',
      randomLimit: route.limit,
    })
  if (route.name === 'sentences')
    return <SentencePage sentences={study.sentences ?? []} onSave={handleSentences} />
  if (route.name === 'phrases')
    return <PhrasePage phrases={study.phrases ?? []} onSave={handlePhrases} />
  if (route.name === 'settings')
    return (
      <SettingsPage
        key={route.section ?? 'learning'}
        initialSection={route.section}
        trashCount={study.trash?.length ?? 0}
        onImport={handleImport}
      />
    )
  if (route.name === 'trash')
    return <TrashPage state={study} onRestore={handleRestore} onPurge={handlePurge} />
  if (route.name === 'review-quick')
    return review({
      key: quickKey(route.date, route.limit),
      path: quickPath(route.date, route.limit),
      words: quickWords(decks, route.limit, route.date),
      backPath: '/practice',
      title: `短时练习 · 最多 ${route.limit} 词`,
      subtitle: '优先到期、再练新词；同义词条去重，生词额外重练一遍',
      emptyTitle: '当前没有待练习的词，今日任务已完成',
    })
  if (route.name === 'spelling-errors') return <SpellingErrorsPage state={study} />
  if (route.name === 'review-errors')
    return review({
      key: `errors:${route.mode}`,
      path: `/review-errors/${route.mode}`,
      words: spellingErrorWords(study, route.mode),
      title: route.mode === 'dictation' ? '听写错题重练' : '拼写错题重练',
      subtitle: '首轮独立作答，继续使用真实成绩与排期',
      backPath: '/spelling-errors',
      initialFront: route.mode,
      emptyTitle: '暂时没有仍可重练的错题词条',
    })
  if (route.name === 'mistakes') return <MistakesPage state={study} />
  if (route.name === 'review-mistakes')
    return review({
      key: 'mistakes',
      path: '/review-mistakes',
      words: historicalReviewWords(study),
      title: '历史错题复习',
      subtitle: '认识后仍会保留在历史错题本中',
      backPath: '/mistakes',
      emptyTitle: '暂时没有仍可复习的历史词条',
    })
  if (route.name === 'records') return <RecordsPage records={records} />
  if (route.name === 'unfamiliar')
    return <UnfamiliarPage words={collectUnfamiliarWords(sorted)} onRate={handleRate} />
  if (route.name === 'review-unfamiliar')
    return review({
      key: 'unfamiliar',
      path: '/review-unfamiliar',
      words: collectUnfamiliarWords(sorted),
      title: '生词复习',
      subtitle: '认识的词会自动从生词本移出',
      backPath: '/unfamiliar',
      emptyTitle: '生词本里没有待掌握的单词',
    })
  if (route.name === 'review-today')
    return review({
      key: `daily:${route.date}`,
      path: `/review-today/${route.date}`,
      words: getTodayWords(decks, route.date).words,
      title: route.date === todayISO() ? '今日复习' : `${formatDeckHeading(route.date)}复习任务`,
      subtitle: '按顺序时先复习到期旧词，再练新词',
      emptyTitle: '这一天的任务已完成，明天再来复习',
    })
  if (route.name === 'weekly') return <WeeklyPage decks={decks} weekStart={route.weekStart} />
  if (route.name === 'monthly') return <MonthlyPage decks={decks} monthStart={route.monthStart} />
  if (route.name === 'review-monthly') {
    const range = getMonthRange(route.monthStart)
    return review({
      key: `month:${range.start}`,
      path: `/review-monthly/${range.start}`,
      words: collectReviewWords(selectMonthlyDecks(decks, range.start)),
      title: '整月复习',
      subtitle: `${formatDate(range.start)} — ${formatDate(range.end)}`,
      backPath: `/monthly/${range.start}`,
      emptyTitle: '这个月还没有可以复习的单词',
    })
  }
  if (route.name === 'review-weekly') {
    const range = getWeekRange(route.weekStart)
    return review({
      key: `week:${range.start}`,
      path: `/review-weekly/${range.start}`,
      words: collectReviewWords(selectWeeklyDecks(decks, range.start)),
      title: '整周复习',
      subtitle: `${formatDate(range.start)} — ${formatDate(range.end)}`,
      backPath: `/weekly/${range.start}`,
      emptyTitle: '这一周还没有可以复习的单词',
    })
  }
  if (route.name === 'edit') {
    const deck = route.deckId ? decks.find((item) => item.id === route.deckId) : undefined
    if (route.deckId && !deck)
      return (
        <main className="page">
          <Flex vertical align="flex-start" gap={16}>
            <Typography.Title level={3}>没有找到这组单词卡</Typography.Title>
            <Button type="primary" onClick={() => navigate('/')}>
              返回列表
            </Button>
          </Flex>
        </main>
      )
    return <DeckEditor key={deck?.id ?? 'new'} deck={deck} decks={decks} onSave={handleSave} />
  }
  if (route.name === 'review') {
    const deck = decks.find((item) => item.id === route.deckId)
    return review({
      key: `deck:${route.deckId}`,
      path: `/review/${encodeURIComponent(route.deckId)}`,
      words: deck ? collectReviewWords([deck]) : [],
      title: deck ? deck.title.trim() || formatDeckHeading(deck.date) : '单词复习',
      subtitle: deck ? formatDate(deck.date) : '',
      emptyTitle: deck ? '这组单词卡还是空的' : '没有找到这组单词卡',
    })
  }
  return (
    <DeckList
      decks={sorted}
      onRestore={handleRestore}
      overview={<StudyOverview state={study} />}
      onDelete={handleDelete}
    />
  )
}

function App() {
  return (
    <PageBoundary>
      <Suspense
        fallback={
          <main className="page page-loading" role="status">
            正在加载页面…
          </main>
        }
      >
        <AppPage />
      </Suspense>
      <BackToTop />
    </PageBoundary>
  )
}
export default App
