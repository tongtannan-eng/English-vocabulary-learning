import type { ReviewCheckpoint } from './learning.ts'

export function hasReviewWork(checkpoint: ReviewCheckpoint): boolean {
  if (checkpoint.session.phase === 'done') return false
  return (
    checkpoint.answer.length > 0 ||
    checkpoint.flipped ||
    checkpoint.result !== null ||
    checkpoint.session.cursor > 0 ||
    checkpoint.session.phase === 'retry' ||
    Object.keys(checkpoint.session.ratings).length > 0 ||
    Object.keys(checkpoint.firstAttempts).length > 0 ||
    checkpoint.shownAnswers.length > 0
  )
}
