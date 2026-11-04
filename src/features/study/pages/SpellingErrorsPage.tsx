import { useEffect, useState } from 'react'
import { Button, Empty, Input, Pagination, Segmented, Tag, Typography } from 'antd'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { SpeakButton } from '../components/SpeakButton.tsx'
import { SpellingComparison } from '../components/SpellingComparison.tsx'
import { spellingErrors, spellingErrorWords } from '../spellingErrors.ts'
import { hydrateCheckpoint } from '../learning.ts'
import type { StudyState } from '../learning.ts'
import type { SpellingMode } from '../spellingErrors.ts'

export function SpellingErrorsPage({ state }: { state: StudyState }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'all' | SpellingMode>('all')
  const [requestedPage, setPage] = useState(1)
  useEffect(() => {
    document.title = '拼写错题 · 每日单词'
  }, [])
  const entries = spellingErrors(state)
  const filtered = entries.filter(
    (entry) =>
      (mode === 'all' || entry.counts[mode] > 0) &&
      `${entry.english} ${entry.chinese}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(filtered.length / 20)))
  return (
    <>
      <TopBar />
      <main className="page mistakes-page">
        <div className="page-head">
          <Typography.Title level={3}>拼写错题</Typography.Title>
          <Typography.Paragraph type="secondary">
            回看真正拼错的地方，分别重练中文拼写和听写。
          </Typography.Paragraph>
        </div>
        <div className="error-practice-actions">
          {(['chinese', 'dictation'] as const).map((kind) => {
            const count = spellingErrorWords(state, kind).length
            const saved = hydrateCheckpoint(state.sessions[`errors:${kind}`], state.decks)
            return (
              <Button
                key={kind}
                type="primary"
                href={`#/review-errors/${kind}`}
                disabled={!count && !saved}
              >
                {saved ? '继续' : '重练'}
                {kind === 'chinese' ? '拼写' : '听写'}错题（{count}）
              </Button>
            )
          })}
        </div>
        <div className="mistakes-filters">
          <Input
            aria-label="搜索拼写错题"
            placeholder="搜索英文或释义"
            value={query}
            allowClear
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
          <Segmented<'all' | SpellingMode>
            aria-label="错题类型"
            value={mode}
            options={[
              { label: '全部', value: 'all' },
              { label: '中文拼写', value: 'chinese' },
              { label: '听写', value: 'dictation' },
            ]}
            onChange={(value) => {
              setMode(value)
              setPage(1)
            }}
          />
        </div>
        <Typography.Paragraph type="secondary">
          共 {entries.length} 个错题词条 ·{' '}
          {entries.reduce((sum, entry) => sum + entry.errors.length, 0)} 次有效错答
        </Typography.Paragraph>
        {!filtered.length ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              entries.length
                ? '没有符合条件的错题'
                : '还没有拼写错题。首轮未看答案的错误提交会自动记录在这里。'
            }
          />
        ) : (
          <>
            <div className="vocabulary-list">
              {filtered.slice((page - 1) * 20, page * 20).map((entry) => {
                const errors =
                  mode === 'all'
                    ? entry.errors
                    : entry.errors.filter((record) => record.mode === mode)
                const latest = errors[0]!
                return (
                  <article className="vocabulary-row spelling-error-row" key={entry.key}>
                    <div className="vocabulary-main">
                      <div className="mistake-word-heading">
                        <Typography.Text strong className="vocabulary-english" lang="en">
                          {entry.english}
                        </Typography.Text>
                        <SpeakButton english={entry.english} />
                        <Tag>
                          拼写错 {entry.counts.chinese} 次 · 听写错 {entry.counts.dictation} 次
                        </Tag>
                      </div>
                      <Typography.Paragraph className="vocabulary-meaning">
                        {entry.chinese}
                      </Typography.Paragraph>
                      <Typography.Paragraph type="secondary" className="mistake-meta">
                        最近错答：{new Date(latest.at).toLocaleString('zh-CN')} ·{' '}
                        {latest.mode === 'dictation' ? '听写' : '中文拼写'}
                      </Typography.Paragraph>
                      {latest.answer !== undefined ? (
                        <SpellingComparison english={latest.english} answer={latest.answer} />
                      ) : (
                        <Typography.Paragraph type="secondary">
                          这条旧记录未保存具体错误拼写。
                        </Typography.Paragraph>
                      )}
                      <details className="mistake-sources">
                        <summary>查看 {errors.length} 次错答记录</summary>
                        <ul>
                          {errors.map((record) => (
                            <li key={record.id}>
                              {new Date(record.at).toLocaleString('zh-CN')} ·{' '}
                              {record.mode === 'dictation' ? '听写' : '中文拼写'} ·{' '}
                              {record.answer !== undefined ? (
                                <code>{record.answer}</code>
                              ) : (
                                '具体拼写未记录'
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                      {!entry.available ? (
                        <Typography.Text type="secondary">
                          原词条已修改或删除，保留错答记录。
                        </Typography.Text>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="deck-pagination">
              <Pagination
                current={page}
                pageSize={20}
                total={filtered.length}
                showSizeChanger={false}
                onChange={setPage}
                responsive
              />
            </div>
          </>
        )}
        <details className="record-definitions">
          <summary>错题收录与次数说明</summary>
          <p>
            只统计首轮、未看答案的错误提交；同一次提交重复保存不会增加次数。生词重练和看过答案的提交不计入有效错答。原有首次成绩口径不变，旧记录不会补造具体输入。重练纠正后，原错答记录仍可回看。
          </p>
        </details>
      </main>
    </>
  )
}
