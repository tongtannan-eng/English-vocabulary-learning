import { Button } from 'antd'
import { hydrateCheckpoint } from '../learning.ts'
import { QUICK_LIMITS, quickKey, quickPath, quickWords } from '../quick.ts'
import { todayISO } from '../../../shared/utils/format.ts'
import type { StudyState } from '../learning.ts'

export function QuickPractice({ state }: { state: StudyState }) {
  const date = todayISO()
  return (
    <section className="quick-practice" aria-label="短时练习">
      <div>
        <span>短时练习</span>
        <small>优先到期词 · 每轮最多所选词数，生词再练一遍</small>
      </div>
      <div className="quick-actions">
        {QUICK_LIMITS.map((limit) => {
          const saved = hydrateCheckpoint(state.sessions[quickKey(date, limit)], state.decks)
          const available = quickWords(state.decks, limit, date).length
          return (
            <Button
              key={limit}
              size="small"
              href={`#${quickPath(date, limit)}`}
              disabled={!available && !saved}
            >
              {saved ? `继续 ${limit} 词` : `练 ${limit} 词`}
            </Button>
          )
        })}
      </div>
    </section>
  )
}
