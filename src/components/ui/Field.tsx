import { useId, type ReactNode } from 'react'

type ControlProps = { id: string; 'aria-describedby': string }

// A label, one control and its help text. The control receives the ids, so
// the label and the help are always wired to it.
export function Field({
  label,
  help,
  children,
}: {
  label: string
  help: string
  children: (control: ControlProps) => ReactNode
}) {
  const id = useId()
  const helpId = `${id}-help`
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({ id, 'aria-describedby': helpId })}
      <p id={helpId} className="field-help">
        {help}
      </p>
    </div>
  )
}
