export function entryErrorMessage(
  saveError: string,
  attempted: boolean,
  english: string,
  chinese: string,
  requiredMessage: string,
): string {
  if (saveError) return saveError
  return attempted && (!english.trim() || !chinese.trim()) ? requiredMessage : ''
}
