import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Flex, Typography } from 'antd'
import { SpeakButton } from '../components/SpeakButton.tsx'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { formatDate } from '../../../shared/utils/format.ts'
import { reviewWordKey } from '../review.ts'
import type { Familiarity, ReviewWord } from '../../../shared/types.ts'

export function UnfamiliarPage({
  words,
  onRate,
}: {
  words: ReviewWord[]
  onRate: (word: ReviewWord, familiarity: Familiarity) => string | void
}) {
  const [error, setError] = useState('')
  useEffect(() => {
    document.title = '生词本 · 每日单词'
  }, [])

  function markKnown(word: ReviewWord) {
    setError(onRate(word, 'known') || '')
  }

  return (
    <>
      <TopBar action={<Button href="#/practice">返回练习中心</Button>} />
      <main className="page">
        <div className="page-head collection-heading">
          <div>
            <Typography.Title level={3}>生词本</Typography.Title>
            <Typography.Paragraph type="secondary">
              复习时不认识的词会自动收录。选择认识后，会从这里移出。
            </Typography.Paragraph>
          </div>
          <Button type="primary" href="#/review-unfamiliar" disabled={words.length === 0}>
            复习生词（{words.length}）
          </Button>
        </div>
        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        ) : null}
        {words.length === 0 ? (
          <div className="collection-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="生词本里没有待掌握的单词" />
            <Typography.Paragraph type="secondary">
              先去复习单词卡，不认识的词会出现在这里。
            </Typography.Paragraph>
            <Button href="#/practice">返回练习中心</Button>
          </div>
        ) : (
          <div className="vocabulary-list">
            {words.map((word) => (
              <div className="vocabulary-row" key={reviewWordKey(word)}>
                <div className="vocabulary-main">
                  <Flex align="center" gap={12}>
                    <Typography.Text className="vocabulary-english" lang="en" strong>
                      {word.english}
                    </Typography.Text>
                    <SpeakButton english={word.english} />
                  </Flex>
                  <Typography.Paragraph className="vocabulary-meaning">
                    {word.chinese}
                  </Typography.Paragraph>
                  <Typography.Link
                    href={`#/edit/${encodeURIComponent(word.deckId)}`}
                    className="vocabulary-source"
                  >
                    {formatDate(word.deckDate)}
                    {word.deckTitle ? ` · ${word.deckTitle}` : ''}
                  </Typography.Link>
                </div>
                <Button onClick={() => markKnown(word)}>认识了</Button>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
