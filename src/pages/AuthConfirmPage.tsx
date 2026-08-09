import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthPageShell } from '../components/auth/AuthPageShell'
import { useAuth } from '../hooks/useAuth'
import { initialAuthCallback, supabase } from '../lib/supabase'
import { getAuthErrorMessage } from '../services/auth'

type ConfirmationState =
  | { status: 'processing'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string }

function getCallbackErrorMessage(errorCode: string | null) {
  if (errorCode === 'otp_expired') {
    return 'This confirmation link has expired or has already been used. Register again to request a new confirmation email.'
  }

  return 'This confirmation link is invalid or has expired. Register again to request a new confirmation email.'
}

function clearCallbackUrl() {
  window.history.replaceState(window.history.state, document.title, window.location.pathname)
}

export function AuthConfirmPage() {
  const { loading, session } = useAuth()
  const hasProcessed = useRef(false)
  const [finalConfirmation, setFinalConfirmation] = useState<ConfirmationState | null>(null)
  const callbackError = initialAuthCallback.errorCode
    ? getCallbackErrorMessage(initialAuthCallback.errorCode)
    : !initialAuthCallback.hasCallbackParameters
      ? 'No email confirmation information was found. Open the link from your confirmation email.'
      : null
  const hasConfirmedSession = Boolean(
    supabase &&
      session?.user.email_confirmed_at &&
      (!initialAuthCallback.callbackType || initialAuthCallback.callbackType === 'signup'),
  )
  const confirmation: ConfirmationState =
    finalConfirmation ??
    (callbackError
      ? { status: 'error', message: callbackError }
      : !loading && !hasConfirmedSession
        ? {
            status: 'error',
            message:
              'This confirmation link is invalid or has expired. Register again to request a new confirmation email.',
          }
        : { status: 'processing', message: 'Confirming your email address…' })

  useEffect(() => {
    if (callbackError) {
      clearCallbackUrl()
      return
    }

    if (hasProcessed.current || loading || !hasConfirmedSession || !supabase) {
      return
    }

    hasProcessed.current = true

    void supabase.auth.signOut({ scope: 'local' }).then(({ error }) => {
      clearCallbackUrl()

      if (error) {
        setFinalConfirmation({
          status: 'error',
          message: getAuthErrorMessage(
            error,
            'Your email was confirmed, but we could not finish the return flow. Go to login and try signing in.',
          ),
        })
        return
      }

      setFinalConfirmation({
        status: 'success',
        message: 'Your email address is confirmed. You can now log in to WatermarkMe.',
      })
    })
  }, [callbackError, hasConfirmedSession, loading])

  return (
    <AuthPageShell
      description="Finish confirming your email, then return to WatermarkMe and log in securely."
      title={confirmation.status === 'success' ? 'Email confirmed' : 'Confirm your email'}
    >
      <div
        aria-live="polite"
        className={[
          'rounded-2xl border p-5',
          confirmation.status === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
            : confirmation.status === 'error'
              ? 'border-red-200 bg-red-50 text-red-900'
              : 'border-indigo-200 bg-indigo-50 text-indigo-950',
        ].join(' ')}
        role={confirmation.status === 'error' ? 'alert' : 'status'}
      >
        {confirmation.status === 'processing' ? (
          <span
            aria-hidden="true"
            className="mb-5 block size-7 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 motion-reduce:animate-none"
          />
        ) : null}
        <h2 className="font-bold">
          {confirmation.status === 'success'
            ? 'Confirmation complete'
            : confirmation.status === 'error'
              ? 'We could not confirm this link'
              : 'Checking your confirmation link'}
        </h2>
        <p className="mt-2 text-sm leading-6">{confirmation.message}</p>
      </div>

      {confirmation.status !== 'processing' ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            to={confirmation.status === 'success' ? '/login' : '/register'}
          >
            {confirmation.status === 'success' ? 'Go to login' : 'Register again'}
          </Link>
          <Link
            className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            to="/"
          >
            Return home
          </Link>
        </div>
      ) : null}
    </AuthPageShell>
  )
}
