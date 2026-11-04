import type { Deck } from '../shared/types.ts'
import type { EditorDraft } from './drafts.ts'
import type { ReviewCheckpoint } from '../features/study/learning.ts'

export interface TrashEntry {
  id: string
  deck: Deck
  deletedAt: number
  draft?: EditorDraft
  sessions: Record<string, ReviewCheckpoint>
}
