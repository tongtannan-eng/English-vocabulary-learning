import { TextEntryPage } from '../../entries/TextEntryPage.tsx'
import { addSentence, removeSentence, updateSentence } from '../sentences.ts'
import type { Sentence } from '../../../shared/types.ts'

export function SentencePage({
  sentences,
  onSave,
}: {
  sentences: Sentence[]
  onSave: (sentences: Sentence[]) => string | void
}) {
  return (
    <TextEntryPage
      items={sentences}
      onSave={onSave}
      title="句子"
      description="所有句子记在同一张表里，不按天拆开。中文可以不填。"
      englishLabel="英文句子"
      englishPlaceholder="例如：I have been learning English for three years."
      addLabel="添加句子"
      emptyText="还没有句子"
      requiredMessage="请先填写英文句子。"
      deleteTitle="删除这条句子？"
      add={addSentence}
      update={updateSentence}
      remove={removeSentence}
    />
  )
}
