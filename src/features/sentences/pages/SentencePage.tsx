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
      title="语句"
      description="所有语句记在同一张表里，不按天拆开。英文和中文均为必填。"
      englishLabel="英文语句"
      englishPlaceholder="例如：I have been learning English for three years."
      addLabel="添加语句"
      emptyText="还没有语句"
      requiredMessage="请填写英文语句和中文。"
      deleteTitle="删除这条语句？"
      add={addSentence}
      update={updateSentence}
      remove={removeSentence}
    />
  )
}
