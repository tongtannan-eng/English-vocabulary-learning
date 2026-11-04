/** Choose the side with room and cap the panel inside the usable viewport. */
export function suggestionPlacement(
  anchor: { top: number; bottom: number },
  viewport: { top: number; bottom: number },
  desiredHeight: number,
) {
  const below = Math.max(0, viewport.bottom - anchor.bottom - 8)
  const above = Math.max(0, anchor.top - viewport.top - 8)
  const upward = below < desiredHeight && above > below
  return { upward, maxHeight: Math.max(0, Math.min(desiredHeight, upward ? above : below)) }
}
