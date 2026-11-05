import { spellingErrors } from '../spellingErrors.ts'
import { historicalMistakes } from '../mistakes.ts'
import { useEffect, useState } from 'react'
import { Button, Card, Flex, Segmented, Typography } from 'antd'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { QuickPractice } from '../components/QuickPractice.tsx'
import { selectWeeklyDecks, selectMonthlyDecks, collectUnfamiliarWords } from '../review.ts'
import { getMonthRange, getWeekRange } from '../../../shared/utils/format.ts'
import { QUICK_LIMITS } from '../quick.ts'
import { hydrateCheckpoint } from '../learning.ts'
import type { StudyState } from '../learning.ts'

export function PracticePage({ state }: { state: StudyState }) {
  const [randomKind, setRandomKind] = useState<'words' | 'phrases' | 'sentences'>('words')
  useEffect(() => {
    document.title = '练习中心 · 每日单词'
  }, [])
  const week = selectWeeklyDecks(state.decks, getWeekRange().start)
  const wordCount = week.reduce((sum, deck) => sum + deck.words.length, 0)
  const month = selectMonthlyDecks(state.decks, getMonthRange().start)
  const monthCount = month.reduce((sum, deck) => sum + deck.words.length, 0)
  const allCount = state.decks.reduce((sum, deck) => sum + deck.words.length, 0)
  const randomCount = randomKind === 'words' ? allCount : (state[randomKind]?.length ?? 0)
  const spellingErrorCount = spellingErrors(state).length
  const mistakes = historicalMistakes(state).length
  const unfamiliar = collectUnfamiliarWords(state.decks).length
  const resumable = Object.values(state.sessions)
    .map((saved) => hydrateCheckpoint(saved, state.decks, state))
    .filter((saved) => saved !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]
  return (
    <>
      <TopBar />
      <main className="page practice-page">
        <div className="page-head">
          <Typography.Title level={3}>练习中心</Typography.Title>
          <Typography.Paragraph type="secondary">
            按今天的时间和目标选择练习。单词练习共用学习记录和复习排期。
          </Typography.Paragraph>
        </div>
        {resumable ? (
          <div className="practice-resume">
            <div>
              <Typography.Text strong>继续「{resumable.title}」</Typography.Text>
              <p>已保留上次的位置、顺序和输入。</p>
            </div>
            <Button href={`#${resumable.path}`}>继续练习</Button>
          </div>
        ) : null}
        <QuickPractice state={state} />
        <div className="practice-grid">
          <Card className="practice-card">
            <Typography.Title level={4}>随机复习</Typography.Title>
            <div className="random-practice-heading">
              <Segmented
                aria-label="随机复习内容"
                value={randomKind}
                options={[
                  { label: '单词', value: 'words' },
                  { label: '词组', value: 'phrases' },
                  { label: '语句', value: 'sentences' },
                ]}
                onChange={(value) => setRandomKind(value as typeof randomKind)}
              />
              <span>全部 {randomCount} 条</span>
            </div>
            <Typography.Paragraph type="secondary">
              随机抽取所选内容，完成后继续复习其他条目。
            </Typography.Paragraph>
            <Flex gap={8} wrap>
              {QUICK_LIMITS.map((limit) => (
                <Button
                  key={limit}
                  href={`#/review-random/${randomKind === 'words' ? '' : `${randomKind}/`}${limit}`}
                  disabled={!randomCount}
                >
                  复习 {limit} 条
                </Button>
              ))}
            </Flex>
          </Card>
          <Card className="practice-card">
            <Typography.Title level={4}>每月复习</Typography.Title>
            <div className="practice-count">
              本月 {month.length} 组 · {monthCount} 个词
            </div>
            <Typography.Paragraph type="secondary">
              按自然月汇总单词，也可以查看其他月份。
            </Typography.Paragraph>
            <Button type="primary" href="#/monthly">
              查看本月
            </Button>
          </Card>
          <Card className="practice-card entry-weekly">
            <Typography.Title level={4}>每周复习</Typography.Title>
            <div className="practice-count">
              本周 {week.length} 组 · {wordCount} 个词
            </div>
            <Typography.Paragraph type="secondary">
              把一周学过的单词放在一起复习，巩固跨天记忆。
            </Typography.Paragraph>
            <Button type="primary" href="#/weekly">
              查看本周
            </Button>
          </Card>
          <Card className="practice-card entry-vocabulary">
            <Typography.Title level={4}>生词本</Typography.Title>
            <div className="practice-count">{unfamiliar} 个词待掌握</div>
            <Typography.Paragraph type="secondary">
              集中练习“不认识”的词，掌握后自动移出。
            </Typography.Paragraph>
            <Button type="primary" href="#/unfamiliar">
              查看生词本
            </Button>
          </Card>
          <Card className="practice-card entry-mistakes">
            <Typography.Title level={4}>历史错题本</Typography.Title>
            <div className="practice-count">{mistakes} 个历史词条</div>
            <Typography.Paragraph type="secondary">
              保留曾经不认识的词，后来认识也不会移出。
            </Typography.Paragraph>
            <Button type="primary" href="#/mistakes">
              查看历史错题
            </Button>
          </Card>
          <Card className="practice-card entry-spelling-errors">
            <Typography.Title level={4}>拼写错题</Typography.Title>
            <div className="practice-count">{spellingErrorCount} 个错题词条</div>
            <Typography.Paragraph type="secondary">
              对照错误拼写，分别重练中文拼写和听写。
            </Typography.Paragraph>
            <Button type="primary" href="#/spelling-errors">
              查看拼写错题
            </Button>
          </Card>
          <Card className="practice-card">
            <Typography.Title level={4}>学习记录</Typography.Title>
            <Typography.Paragraph type="secondary">
              查看每天的真实作答、听写准确率和练习趋势。
            </Typography.Paragraph>
            <Button href="#/records">查看学习记录</Button>
          </Card>
        </div>
      </main>
    </>
  )
}
