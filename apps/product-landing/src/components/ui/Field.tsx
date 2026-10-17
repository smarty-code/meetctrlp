import { useId, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/cn"

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  name: string
  label: string
  hint?: string
  error?: string | undefined
}

/** Labelled text input with hint and an announced error (PRD 7.1). */
export function Field({
  name,
  label,
  hint,
  error,
  className,
  required,
  ...props
}: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        required={required}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-tap rounded-sm border border-line bg-surface px-4 text-body text-ink outline-none focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink",
          error && "border-chip-error-fg",
          className
        )}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-caption text-ink-faint">
          {hint}
        </p>
      )}
      <p
        id={errorId}
        aria-live="polite"
        className="text-small text-chip-error-fg empty:hidden"
      >
        {error ?? ""}
      </p>
    </div>
  )
}
