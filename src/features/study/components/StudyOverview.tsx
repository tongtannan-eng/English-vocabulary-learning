import { CollapsibleSection } from '../../../shared/components/CollapsibleSection.tsx'
import { Button, Typography } from 'antd'
import { getTodayWords, hydrateCheckpoint, learningSummary } from '../learning.ts'
import type { StudyState } from '../learning.ts'
import { loadEditorDraft } from '../../../services/drafts.ts'
import { todayISO } from '../../../shared/utils/format.ts'

export function StudyOverview({ state }: { state: StudyState }) {
  const tasks = getTodayWords(state.decks)
  const today = learningSummary(state.records)
  const todaySession = hydrateCheckpoint(state.sessions[`daily:${todayISO()}`], state.decks)
  const resumable = Object.values(state.sessions)
    .map((saved) => hydrateCheckpoint(saved, state.decks))
    .filter((saved) => saved !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const hasDraft = Boolean(loadEditorDraft('new'))
  return (
    <>
      <CollapsibleSection
        id="today"
        title="今日待复习"
        className="today-panel"
        summary={`到期 ${tasks.due.length} 个 · 新词 ${tasks.fresh.length} 个 · 今日已练 ${today.words} 个`}
        action={
          <>
            <Button
              type="primary"
              size="small"
              href={
                todaySession
                  ? '#/review-today'
                  : resumable
                    ? `#${resumable.path}`
                    : '#/review-today'
              }
              disabled={!tasks.words.length && !todaySession && !resumable}
            >
              {todaySession
                ? '继续今日复习'
                : resumable
                  ? '继续上次复习'
                  : tasks.words.length
                    ? '开始今日复习'
                    : '今日已完成'}
            </Button>
            <Button size="small" href="#/records">
              学习记录
            </Button>
            {hasDraft ? (
              <Button size="small" href="#/new">
                继续草稿
              </Button>
            ) : null}
          </>
        }
      >
        <div className="study-overview" aria-label="今日学习">
          <div className="study-overview-main">
            <div className="today-summary">
              <div className="today-task-counts" aria-label="今日任务数量">
                <span className="task-count task-due">
                  到期 <strong>{tasks.due.length}</strong> 个
                  {tasks.overdue.length ? `（逾期 ${tasks.overdue.length} 个）` : ''}
                </span>
                <span className="task-count task-new">
                  新词 <strong>{tasks.fresh.length}</strong> 个
                </span>
              </div>
              <div className="today-achievement">
                今天已有效练习 <strong>{today.words}</strong> 个不同词条
              </div>
            </div>
          </div>
          {resumable ? (
            <div className="resume-summary" role="status">
              <div>
                <Typography.Text strong>上次的「{resumable.title}」尚未完成</Typography.Text>
                <Typography.Paragraph type="secondary">
                  {resumable.session.phase === 'retry' ? '生词重练' : '首轮'} · 第{' '}
                  {resumable.session.cursor + 1} / {resumable.session.sequence.length}{' '}
                  个，已保留顺序和输入内容。
                </Typography.Paragraph>
              </div>
              <Button href={`#${resumable.path}`}>继续上次复习</Button>
            </div>
          ) : null}
        </div>
      </CollapsibleSection>
    </>
  )
}
