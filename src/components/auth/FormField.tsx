import type { InputHTMLAttributes } from 'react'

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string
  label: string
  error?: string
  hint?: string
}

export function FormField({ id, label, error, hint, className, ...inputProps }: FormFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800" htmlFor={id}>
        {label}
      </label>
      <input
        {...inputProps}
        aria-describedby={describedBy || undefined}
        aria-invalid={Boolean(error)}
        className={[
          'mt-2 w-full rounded-xl border bg-white px-3.5 py-3 text-base text-slate-950 shadow-sm outline-none transition',
          'placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100',
          'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
          error ? 'border-red-400' : 'border-slate-300',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        id={id}
      />
      {hint ? (
        <p className="mt-2 text-xs leading-5 text-slate-500" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-700" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
