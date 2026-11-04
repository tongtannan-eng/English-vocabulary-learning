import { useEffect, useState } from 'react'
import { Button, Empty, Input, Pagination, Segmented, Tag, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { SpeakButton } from '../components/SpeakButton.tsx'
import { historicalMistakes, historicalReviewWords } from '../mistakes.ts'
import { hydrateCheckpoint } from '../learning.ts'
import type { StudyState } from '../learning.ts'
import type { HistoricalMistake } from '../mistakes.ts'
import { formatDate } from '../../../shared/utils/format.ts'

type StatusFilter = 'all' | HistoricalMistake['status']
const STATUS = { unknown: '待巩固', known: '已认识 · 历史保留', unavailable: '原词条已修改或删除' }
export function MistakesPage({ state }: { state: StudyState }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [requestedPage, setPage] = useState(1)
  useEffect(() => {
    document.title = '历史错题本 · 每日单词'
  }, [])
  const entries = historicalMistakes(state)
  const available = historicalReviewWords(state)
  const saved = hydrateCheckpoint(state.sessions.mistakes, state.decks)
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const filtered = entries.filter(
    (entry) =>
      (status === 'all' || entry.status === status) &&
      terms.every((term) =>
        [
          entry.english,
          entry.chinese,
          ...entry.sources.map((source) => `${source.deckTitle} ${source.deckDate}`),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term),
      ),
  )
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(filtered.length / 20)))
  return (
    <>
      <TopBar />
      <main className="page mistakes-page">
        <div className="page-head collection-heading">
          <div>
            <Typography.Title level={3}>历史错题本</Typography.Title>
            <Typography.Paragraph type="secondary">
              曾经标记“不认识”的词都会保留，后来认识了也不会移出。相同英文和释义合并展示。
            </Typography.Paragraph>
          </div>
          <Button type="primary" href="#/review-mistakes" disabled={!available.length && !saved}>
            {saved ? '继续历史错题复习' : `复习有效词（${available.length}）`}
          </Button>
        </div>
        <div className="mistakes-summary" role="status">
          共 {entries.length} 个历史词条 · 待巩固{' '}
          {entries.filter((entry) => entry.status === 'unknown').length} 个 · 已认识{' '}
          {entries.filter((entry) => entry.status === 'known').length} 个
        </div>
        <div className="mistakes-filters">
          <Input
            aria-label="搜索历史错题"
            placeholder="搜索英文、释义、来源名称或日期"
            prefix={<SearchOutlined />}
            value={query}
            allowClear
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
          />
          <Segmented<StatusFilter>
            aria-label="历史错题状态"
            value={status}
            options={[
              { label: '全部', value: 'all' },
              { label: '待巩固', value: 'unknown' },
              { label: '已认识', value: 'known' },
              { label: '原词变动', value: 'unavailable' },
            ]}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
        </div>
        {!entries.length ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="还没有历史错题；复习时标记不认识后，会自动保留在这里。"
          />
        ) : !filtered.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的历史错题" />
        ) : (
          <>
            <div className="vocabulary-list">
              {filtered.slice((page - 1) * 20, page * 20).map((entry) => (
                <article className="vocabulary-row mistake-row" key={entry.key}>
                  <div className="vocabulary-main">
                    <div className="mistake-word-heading">
                      <Typography.Text className="vocabulary-english" lang="en" strong>
                        {entry.english}
                      </Typography.Text>
                      <SpeakButton english={entry.english} />
                      <Tag className={`mistake-status is-${entry.status}`}>
                        {STATUS[entry.status]}
                      </Tag>
                    </div>
                    <Typography.Paragraph className="vocabulary-meaning">
                      {entry.chinese}
                    </Typography.Paragraph>
                    <Typography.Paragraph className="mistake-meta" type="secondary">
                      {entry.lastUnknownAt !== undefined
                        ? `最近不认识：${new Date(entry.lastUnknownAt).toLocaleString('zh-CN')}`
                        : '旧数据未记录不认识的具体时间'}{' '}
                      · {entry.sources.length} 个来源词条
                    </Typography.Paragraph>
                    <details className="mistake-sources">
                      <summary>查看来源</summary>
                      {entry.sources.map((source) => (
                        <p key={JSON.stringify([source.deckId, source.wordId])}>
                          {formatDate(source.deckDate)}
                          {source.deckTitle ? ` · ${source.deckTitle}` : ''}
                        </p>
                      ))}
                    </details>
                  </div>
                  {entry.words.length ? (
                    <Button href={`#/edit/${encodeURIComponent(entry.words[0]!.deckId)}`}>
                      查看原词
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="deck-pagination">
              <Pagination
                current={page}
                pageSize={20}
                total={filtered.length}
                showSizeChanger={false}
                onChange={setPage}
                showTotal={(total) => `共 ${total} 个词条`}
                responsive
              />
            </div>
          </>
        )}
        <Typography.Paragraph className="mistakes-note" type="secondary">
          历史收录以“不认识”标记为准。原词条修改或删除后保留当时的英文、释义和来源；批量复习使用仍存在且内容一致的词。旧数据只能恢复现有记录中可查到的历史。
        </Typography.Paragraph>
      </main>
    </>
  )
}
