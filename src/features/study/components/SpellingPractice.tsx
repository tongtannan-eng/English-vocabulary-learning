import { SpellingComparison } from './SpellingComparison.tsx'
import { useState, type FormEvent } from 'react'
import { Alert, Button, Input, Typography } from 'antd'
import { checkSpelling } from '../spelling.ts'
import type { SpellingAttempt } from '../learning.ts'

export function SpellingPractice({
  english,
  revealed,
  answer,
  attempt,
  onAnswerChange,
  onSubmitAnswer,
  onRetry,
  dictation = false,
}: {
  english: string
  revealed: boolean
  answer: string
  attempt: SpellingAttempt | null
  onAnswerChange: (answer: string) => void
  onSubmitAnswer: () => string | void
  onRetry: () => void
  dictation?: boolean
}) {
  const result = attempt ? checkSpelling(english, attempt.answer) : null
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!answer.trim()) {
      setError('请先输入英文，再提交答案。')
      return
    }
    setError(onSubmitAnswer() || '')
  }

  if (revealed) {
    return (
      <section className="spelling-practice" aria-label="拼写结果" aria-live="polite">
        {result ? (
          <>
            <Alert
              type={result.correct ? 'success' : 'warning'}
              showIcon
              title={result.correct ? '拼写正确' : '拼写有误，对照下面的差异再记一遍'}
            />
            {attempt?.assisted ? (
              <Typography.Text type="secondary" className="spelling-help">
                已看过答案，本次不计入首次正确率。
              </Typography.Text>
            ) : null}
            {!result.correct && attempt ? (
              <SpellingComparison english={english} answer={attempt.answer} />
            ) : null}
          </>
        ) : (
          <Typography.Paragraph type="secondary">
            已查看英文答案，可以重新开始拼写练习。
          </Typography.Paragraph>
        )}
        <Button className="spelling-retry" onClick={onRetry}>
          重新拼写
        </Button>
      </section>
    )
  }

  return (
    <form className="spelling-practice" onSubmit={submit}>
      <label htmlFor="spelling-answer" className="field-label">
        {dictation ? '听发音，拼单词' : '看中文，拼英文'}
      </label>
      <div className="spelling-input-row">
        <Input
          id="spelling-answer"
          size="large"
          value={answer}
          placeholder="输入英文单词或短语"
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={Math.max(200, english.length + 40)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'spelling-error' : 'spelling-help'}
          onChange={(event) => {
            onAnswerChange(event.target.value)
            setError('')
          }}
        />
        <Button size="large" type="primary" htmlType="submit">
          提交答案
        </Button>
      </div>
      <Typography.Text id="spelling-help" type="secondary" className="spelling-help">
        按 Enter 提交，忽略大小写和首尾空格。
      </Typography.Text>
      {error ? (
        <Typography.Text id="spelling-error" type="danger" role="alert">
          {error}
        </Typography.Text>
      ) : null}
    </form>
  )
}
