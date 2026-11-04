import { Typography } from 'antd'
import { checkSpelling } from '../spelling.ts'

export function SpellingComparison({ english, answer }: { english: string; answer: string }) {
  const result = checkSpelling(english, answer)
  return (
    <div className="spelling-comparison">
      <div className="spelling-diff-row">
        <Typography.Text type="secondary">你的拼写</Typography.Text>
        <code lang="en">
          {result.parts
            .filter((part) => part.kind !== 'missing')
            .map((part, index) => (
              <span key={index} className={part.kind === 'extra' ? 'spelling-extra' : undefined}>
                {part.text}
              </span>
            ))}
        </code>
      </div>
      <div className="spelling-diff-row">
        <Typography.Text type="secondary">正确答案</Typography.Text>
        <code lang="en">
          {result.parts
            .filter((part) => part.kind !== 'extra')
            .map((part, index) => (
              <span
                key={index}
                className={part.kind === 'missing' ? 'spelling-missing' : undefined}
              >
                {part.text}
              </span>
            ))}
        </code>
      </div>
      <Typography.Paragraph type="secondary" className="spelling-legend">
        <span className="spelling-extra">多写或写错</span> ·{' '}
        <span className="spelling-missing">缺少或应替换的部分</span>
      </Typography.Paragraph>
    </div>
  )
}
