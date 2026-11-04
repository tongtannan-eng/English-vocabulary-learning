import { useState } from 'react'
import { Button, Input } from 'antd'
import type { DraftWord } from '../../../shared/types.ts'
import type { DuplicateMatch } from '../duplicates.ts'
import { formatDate } from '../../../shared/utils/format.ts'
import { ChineseField } from './ChineseField.tsx'
import { updateEditorEnglish } from '../editor.ts'

export function EditorWordRow({
  word,
  index,
  matches,
  onChange,
  onRemove,
  onEnter,
}: {
  word: DraftWord
  index: number
  matches?: DuplicateMatch[]
  onChange: (
    patch: Partial<Pick<DraftWord, 'english' | 'chinese' | 'collocations' | 'notes'>>,
  ) => void
  onRemove: () => void
  onEnter: () => void
}) {
  const [extrasOpen, setExtrasOpen] = useState(false)
  const collocations = (word.collocations ?? '').split('\n').filter((line) => line.trim()).length
  const extraLabel =
    [collocations ? `搭配 ${collocations}` : '', word.notes?.trim() ? '备注已填' : '']
      .filter(Boolean)
      .join(' · ') || '补充搭配 / 备注'
  return (
    <div className="word-card compact-word-card" id={`editor-word-${word.id}`}>
      <div className="word-row-heading">
        <span className="word-row-number">第 {index + 1} 行</span>
        <div className="word-row-actions">
          <button
            className="word-extra-toggle"
            type="button"
            aria-expanded={extrasOpen}
            aria-controls={`extras-${word.id}`}
            onClick={() => setExtrasOpen((value) => !value)}
          >
            {extraLabel}
            <span aria-hidden="true">{extrasOpen ? ' ▴' : ' ▾'}</span>
          </button>
          <Button size="small" type="text" danger onClick={onRemove}>
            删除
          </Button>
        </div>
      </div>
      <div className="word-grid">
        <label>
          <span className="field-label">英文</span>
          <Input
            id={`english-${word.id}`}
            value={word.english}
            placeholder="abandon"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck
            onChange={(event) => {
              const next = updateEditorEnglish(word, event.target.value)
              onChange({ english: next.english, chinese: next.chinese })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault()
            }}
          />
        </label>
        <ChineseField
          english={word.english}
          value={word.chinese}
          onChange={(chinese) => onChange({ chinese })}
          onEnter={onEnter}
        />
      </div>
      {matches?.length ? (
        <details className="word-duplicates">
          <summary>发现 {matches.length} 处重复 · 可保留不同词义</summary>
          <div>
            {matches.slice(0, 3).map((match, matchIndex) => (
              <p key={matchIndex}>
                {match.row
                  ? `当前第 ${match.row} 行`
                  : `${formatDate(match.date!)}${match.title ? ` · ${match.title}` : ''}`}
                ：{match.english} · {match.chinese || '尚未填写释义'}
              </p>
            ))}
            {matches.length > 3 ? <p>另有 {matches.length - 3} 处记录。</p> : null}
          </div>
        </details>
      ) : null}
      <div
        id={`extras-${word.id}`}
        className="word-extras-grid compact-word-extras"
        hidden={!extrasOpen}
      >
        <label>
          <span className="field-label">常用搭配</span>
          <Input.TextArea
            value={word.collocations ?? ''}
            autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder={'一行一条搭配或例句\n例如：an apple a day'}
            onChange={(event) => onChange({ collocations: event.target.value })}
          />
        </label>
        <label>
          <span className="field-label">个人备注</span>
          <Input.TextArea
            value={word.notes ?? ''}
            autoSize={{ minRows: 3, maxRows: 8 }}
            placeholder="记忆方法、易混词或使用场景"
            onChange={(event) => onChange({ notes: event.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
