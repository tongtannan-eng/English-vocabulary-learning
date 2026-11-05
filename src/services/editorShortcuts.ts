export type EditorShortcut = 'submit' | 'add' | 'remove' | 'cancel'

/** Keep ordinary typing and Enter available to the editor. */
export function editorShortcut(
  event: Pick<
    KeyboardEvent,
    | 'code'
    | 'key'
    | 'metaKey'
    | 'ctrlKey'
    | 'altKey'
    | 'shiftKey'
    | 'repeat'
    | 'isComposing'
    | 'keyCode'
    | 'defaultPrevented'
  >,
): EditorShortcut | null {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229)
    return null
  if (
    event.key === 'Escape' &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  )
    return 'cancel'
  if (event.key === 'Enter' && event.metaKey !== event.ctrlKey && !event.altKey && !event.shiftKey)
    return 'submit'
  if (event.code === 'KeyD' && event.metaKey !== event.ctrlKey && !event.altKey && !event.shiftKey)
    return 'remove'
  if (event.code === 'KeyN' && event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey)
    return 'add'
  return null
}
