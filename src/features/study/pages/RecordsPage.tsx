import { useEffect } from 'react'
import { Button, Empty, Typography } from 'antd'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { addDays, formatDate, todayISO } from '../../../shared/utils/format.ts'
import { learningSummary } from '../learning.ts'
import type { LearningRecord } from '../learning.ts'

export function RecordsPage({ records }: { records: LearningRecord[] }) {
  const today = todayISO()
  const summaries = Array.from({ length: 7 }, (_, offset) =>
    learningSummary(records, addDays(today, -offset)),
  )
  const current = summaries[0]!
  useEffect(() => {
    document.title = '学习记录 · 每日单词'
  }, [])
  const score = (correct: number, total: number) =>
    total > 0 ? `${correct} / ${total}（${Math.round((correct / total) * 100)}%）` : '—'
  return (
    <>
      <TopBar action={<Button href="#/practice">返回练习中心</Button>} />
      <main className="page">
        <div className="page-head">
          <Typography.Title level={3}>学习记录</Typography.Title>
          <Typography.Paragraph type="secondary">
            只记录真实作答；翻卡浏览、播放发音和手动移出生词本都不计入练习量。
          </Typography.Paragraph>
        </div>
        <div className="learning-totals">
          <div>
            <strong>{current.words}</strong>
            <span>今日不同词条</span>
          </div>
          <div>
            <strong>
              {current.known} / {current.unknown}
            </strong>
            <span>首轮自评认识 / 不认识</span>
          </div>
          <div>
            <strong>{score(current.spellingCorrect, current.spellingTotal)}</strong>
            <span>首次拼写正确 / 提交</span>
          </div>
          <div>
            <strong>{score(current.dictationCorrect, current.dictationTotal)}</strong>
            <span>首次听写正确 / 提交</span>
          </div>
        </div>
        {records.length === 0 ? (
          <Empty
            description="还没有作答记录，完成一次复习或提交拼写后会自动记录。"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : null}
        <Typography.Title level={4}>最近七天</Typography.Title>
        <div className="learning-history">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>不同词条</th>
                <th>自评认识 / 不认识</th>
                <th>首次拼写</th>
                <th>首次听写</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => (
                <tr key={summary.day}>
                  <td>
                    <time dateTime={summary.day} title={formatDate(summary.day)}>
                      {summary.day === today
                        ? '今天'
                        : `${summary.day.slice(5, 7)}月${summary.day.slice(8)}日`}
                    </time>
                  </td>
                  <td>{summary.words}</td>
                  <td>
                    {summary.known} / {summary.unknown}
                  </td>
                  <td>{score(summary.spellingCorrect, summary.spellingTotal)}</td>
                  <td>{score(summary.dictationCorrect, summary.dictationTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details className="learning-explanation record-definitions">
          <summary>统计口径与复习间隔</summary>
          <Typography.Paragraph type="secondary">
            相同英文和释义视为同一词条，同一天反复练习或出现在不同词组里只计一次；拼写与听写按当天每个词条、每种题型的第一次首轮提交统计，看过答案和生词重练不计入首次正确率。自评次数与拼写正确率分别计算。
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary">
            记录从启用此功能后开始，旧单词不会补记历史成绩。间隔复习依次为 1、3、7、14、30、60
            天；忘记或首次拼写未通过的词次日再练，同一天重练不会加速升级。
          </Typography.Paragraph>
        </details>
      </main>
    </>
  )
}
