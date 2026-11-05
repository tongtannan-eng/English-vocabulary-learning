import { TextEntryPage } from '../../entries/TextEntryPage.tsx'
import { addPhrase, removePhrase, updatePhrase } from '../phrases.ts'
import type { Phrase } from '../../../shared/types.ts'

export function PhrasePage({
  phrases,
  onSave,
}: {
  phrases: Phrase[]
  onSave: (phrases: Phrase[]) => string | void
}) {
  return (
    <TextEntryPage
      items={phrases}
      onSave={onSave}
      title="词组"
      description="所有词组记在同一张表里，不按天拆开。英文和中文均为必填。"
      englishLabel="英文词组"
      englishPlaceholder="例如：look forward to"
      addLabel="添加词组"
      emptyText="还没有词组"
      requiredMessage="请填写英文词组和中文。"
      deleteTitle="删除这条词组？"
      add={addPhrase}
      update={updatePhrase}
      remove={removePhrase}
    />
  )
}
