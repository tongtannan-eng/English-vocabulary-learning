import { useEffect, useState } from 'react'
import { Button, Card, Empty, Flex, Segmented, Typography } from 'antd'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { wordPreview } from '../../decks/deck.ts'
import {
  formatDate,
  formatDeckHeading,
  getWeekRange,
  shiftWeek,
} from '../../../shared/utils/format.ts'
import { selectWeeklyDecks } from '../review.ts'
import { loadPrefs, savePrefs } from '../../../services/storage.ts'
import type { Deck, ReviewOrder } from '../../../shared/types.ts'

export function WeeklyPage({ decks, weekStart }: { decks: Deck[]; weekStart: string }) {
  const [order, setOrder] = useState<ReviewOrder>(() => loadPrefs().order)
  const range = getWeekRange(weekStart)
  const currentWeek = getWeekRange().start
  const weeklyDecks = selectWeeklyDecks(decks, weekStart)
  const wordCount = weeklyDecks.reduce((sum, deck) => sum + deck.words.length, 0)

  useEffect(() => {
    document.title = '每周复习 · 每日单词'
  }, [])

  function changeOrder(next: ReviewOrder) {
    setOrder(next)
    savePrefs({ ...loadPrefs(), order: next })
  }

  return (
    <>
      <TopBar action={<Button href="#/practice">返回练习中心</Button>} />
      <main className="page">
        <div className="page-head">
          <Typography.Title level={3}>每周复习</Typography.Title>
          <Typography.Paragraph type="secondary">
            按周一到周日汇总单词卡，跨日期一起复习。
          </Typography.Paragraph>
        </div>
        <Flex className="week-navigation" align="center" justify="space-between" gap={12} wrap>
          <Button href={`#/weekly/${shiftWeek(weekStart, -1)}`}>上一周</Button>
          <Typography.Text strong>
            {formatDate(range.start)} — {formatDate(range.end)}
          </Typography.Text>
          <Flex gap={8}>
            {range.start !== currentWeek ? (
              <Button href={`#/weekly/${currentWeek}`}>回到本周</Button>
            ) : null}
            <Button href={`#/weekly/${shiftWeek(weekStart, 1)}`}>下一周</Button>
          </Flex>
        </Flex>
        <Card className="weekly-summary">
          <div className="collection-heading">
            <div>
              <Typography.Title level={4} style={{ marginTop: 0 }}>
                本周共 {weeklyDecks.length} 组 · {wordCount} 个单词
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {order === 'sequential'
                  ? '按学习日期从早到晚，同一天按创建顺序，组内按录入顺序。'
                  : '将本周所有词组的单词合在一起打乱。'}
              </Typography.Paragraph>
            </div>
            <Flex vertical gap={12}>
              <Segmented
                aria-label="每周复习顺序"
                value={order}
                options={[
                  { label: '按顺序', value: 'sequential' },
                  { label: '全部词随机', value: 'random' },
                ]}
                onChange={(value) => changeOrder(value as ReviewOrder)}
              />
              <Button
                type="primary"
                href={`#/review-weekly/${range.start}`}
                disabled={wordCount === 0}
              >
                开始整周复习
              </Button>
            </Flex>
          </div>
        </Card>
        {weeklyDecks.length === 0 ? (
          <div className="collection-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这一周还没有单词卡" />
            <Button href="#/new">新建单词卡</Button>
          </div>
        ) : (
          <div className="deck-list">
            {weeklyDecks.map((deck) => (
              <Card key={deck.id}>
                <div className="deck-body">
                  <div className="deck-main">
                    <Typography.Title level={4} style={{ marginTop: 0 }}>
                      {formatDeckHeading(deck.date)}
                      {deck.title ? ` · ${deck.title}` : ''}
                    </Typography.Title>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      {wordPreview(deck.words)}
                    </Typography.Paragraph>
                  </div>
                  <Flex align="center" gap={12}>
                    <Typography.Text type="secondary">{deck.words.length} 个词</Typography.Text>
                    <Button
                      href={`#/review/${encodeURIComponent(deck.id)}`}
                      disabled={deck.words.length === 0}
                    >
                      单独复习
                    </Button>
                  </Flex>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
