import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthLoadingScreen } from '../components/auth/AuthLoadingScreen'
import { AuthPageShell } from '../components/auth/AuthPageShell'
import { FormField } from '../components/auth/FormField'
import { useAuth } from '../hooks/useAuth'
import { validateEmail, validatePassword } from '../lib/validation'
import { getAuthErrorMessage, registerWithPassword } from '../services/auth'

interface RegistrationForm {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

type RegistrationErrors = Partial<Record<keyof RegistrationForm, string>>

const initialForm: RegistrationForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function validateRegistration(form: RegistrationForm): RegistrationErrors {
  const errors: RegistrationErrors = {}
  const trimmedName = form.fullName.trim()
  const emailError = validateEmail(form.email)
  const passwordError = validatePassword(form.password)

  if (!trimmedName) {
    errors.fullName = 'Full name is required.'
  } else if (trimmedName.length < 2) {
    errors.fullName = 'Enter at least 2 characters for your full name.'
  } else if (trimmedName.length > 100) {
    errors.fullName = 'Full name must be 100 characters or fewer.'
  }

  if (emailError) {
    errors.email = emailError
  }

  if (passwordError) {
    errors.password = passwordError
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.'
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return errors
}

export function RegisterPage() {
  const { loading, user } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof RegistrationForm
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmissionError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const validationErrors = validateRegistration(form)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      const result = await registerWithPassword({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      setRegisteredEmail(result.email)
    } catch (error) {
      setSubmissionError(
        getAuthErrorMessage(error, 'We could not create your account. Please try again.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <AuthLoadingScreen />
  }

  // Keep the page mounted during sign-up so a misconfigured auto-confirm
  // session can be cleared before route redirection is considered.
  if (user && !isSubmitting) {
    return <Navigate replace to="/dashboard" />
  }

  if (registeredEmail) {
    return (
      <AuthPageShell
        description="Your account was created, but it is not ready to use until you confirm the email address."
        title="Check your email"
      >
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div
            aria-hidden="true"
            className="mb-5 grid size-11 place-items-center rounded-full bg-emerald-600 text-xl font-bold text-white"
          >
            ✓
          </div>
          <h2 className="text-xl font-bold text-emerald-950">Confirmation link sent</h2>
          <p className="mt-3 text-sm leading-6 text-emerald-950/75">
            We sent a confirmation link to:
          </p>
          <p className="mt-1 break-all font-semibold text-emerald-950">{registeredEmail}</p>
          <p className="mt-4 text-sm leading-6 text-emerald-950/75">
            Confirm your email address before logging in to WatermarkMe. If the
            message is missing, check your spam folder.
          </p>
        </div>
        <Link
          className="mt-6 inline-flex w-full justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          to="/login"
        >
          Go to login
        </Link>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      description="Create an account to keep your future document workflow private to you."
      title="Create your account"
    >
      <form noValidate onSubmit={handleSubmit}>
        <div className="space-y-5">
          <FormField
            autoComplete="name"
            disabled={isSubmitting}
            error={errors.fullName}
            id="full-name"
            label="Full name"
            name="fullName"
            onChange={handleChange}
            placeholder="Andi Farhan Sappewali"
            required
            type="text"
            value={form.fullName}
          />
          <FormField
            autoComplete="email"
            disabled={isSubmitting}
            error={errors.email}
            id="register-email"
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
            autoComplete="new-password"
            disabled={isSubmitting}
            error={errors.password}
            hint="Use at least 8 characters with uppercase, lowercase, and a number."
            id="register-password"
            label="Password"
            name="password"
            onChange={handleChange}
            required
            type="password"
            value={form.password}
          />
          <FormField
            autoComplete="new-password"
            disabled={isSubmitting}
            error={errors.confirmPassword}
            id="confirm-password"
            label="Confirm password"
            name="confirmPassword"
            onChange={handleChange}
            required
            type="password"
            value={form.confirmPassword}
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
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link className="rounded font-semibold text-indigo-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" to="/login">
          Log in
        </Link>
      </p>
    </AuthPageShell>
  )
}
