export type FrontSide = 'english' | 'chinese' | 'dictation'

export type ReviewOrder = 'sequential' | 'random'

export type Familiarity = 'known' | 'unknown'

export type SpeechAccent = 'en-US' | 'en-GB' | 'en-AU'

export interface Word {
  id: string
  english: string
  chinese: string
  collocations?: string[]
  notes?: string
  familiarity?: Familiarity
  reviewedAt?: number
  reviewStage?: number
  nextReviewDate?: string
  scheduledOn?: string
}

export interface ReviewWord extends Word {
  deckId: string
  deckDate: string
  deckTitle: string
}

export interface Sentence {
  id: string
  english: string
  chinese: string
  createdAt: number
  updatedAt: number
}

export type Phrase = Sentence

export interface Deck {
  id: string
  date: string
  title: string
  words: Word[]
  createdAt: number
  updatedAt: number
}

export interface ReviewPrefs {
  front: FrontSide
  order: ReviewOrder
}

export interface DraftWord {
  id: string
  english: string
  chinese: string
  collocations?: string
  notes?: string
}

export interface DeletedDraftWord {
  word: DraftWord
  index: number
  beforeId?: string
  afterId?: string
}
