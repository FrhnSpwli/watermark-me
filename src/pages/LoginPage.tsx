import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthPageShell } from '../components/auth/AuthPageShell'
import { FormField } from '../components/auth/FormField'
import { validateEmail } from '../lib/validation'
import { getAuthErrorMessage, loginWithPassword } from '../services/auth'

interface LoginForm {
  email: string
  password: string
}

type LoginErrors = Partial<Record<keyof LoginForm, string>>

function getDestination(state: unknown) {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string' &&
    state.from.startsWith('/') &&
    !state.from.startsWith('//')
  ) {
    return state.from
  }

  return '/dashboard'
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof LoginForm
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmissionError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const nextErrors: LoginErrors = {}
    const emailError = validateEmail(form.email)

    if (emailError) {
      nextErrors.email = emailError
    }

    if (!form.password) {
      nextErrors.password = 'Password is required.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      await loginWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      navigate(getDestination(location.state), { replace: true })
    } catch (error) {
      setSubmissionError(
        getAuthErrorMessage(error, 'We could not log you in. Please try again.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageShell
      description="Use your confirmed email address to access your private workspace."
      title="Welcome back"
    >
      <form noValidate onSubmit={handleSubmit}>
        <div className="space-y-5">
          <FormField
            autoComplete="email"
            disabled={isSubmitting}
            error={errors.email}
            id="login-email"
            inputMode="email"
            label="Email"
            name="email"
            onChange={handleChange}
            placeholder="you@example.com"
            required
            type="email"
            value={form.email}
          />
          <FormField
            autoComplete="current-password"
            disabled={isSubmitting}
            error={errors.password}
            id="login-password"
            label="Password"
            name="password"
            onChange={handleChange}
            required
            type="password"
            value={form.password}
          />
        </div>

        {submissionError ? (
          <div
            aria-live="polite"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
            role="alert"
          >
            {submissionError}
          </div>
        ) : null}

        <button
          className="mt-6 inline-flex w-full justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Need an account?{' '}
        <Link className="rounded font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" to="/register">
          Get started
        </Link>
      </p>
    </AuthPageShell>
  )
}
