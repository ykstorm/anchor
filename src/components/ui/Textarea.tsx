import type { ComponentProps, KeyboardEvent } from 'react'

// Enter submits the surrounding form; Shift+Enter, or Enter while an input
// method is composing, still types a newline.
function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}

export function Textarea(props: Omit<ComponentProps<'textarea'>, 'onKeyDown'>) {
  return <textarea {...props} className="textarea" onKeyDown={submitOnEnter} />
}
