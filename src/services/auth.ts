import type { AuthError, Session, SupabaseClient, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface RegisterInput {
  fullName: string
  email: string
  password: string
}

interface LoginInput {
  email: string
  password: string
}

interface RegistrationResult {
  email: string
  user: User
}

interface LoginResult {
  session: Session
  user: User
}

export class AuthServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthServiceError'
  }
}

function getAuthClient(): SupabaseClient {
  if (!supabase) {
    throw new AuthServiceError(
      'Authentication is not configured. Add the Supabase URL and anon key to .env.local.',
    )
  }

  return supabase
}

function isNetworkError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|network|load failed/i.test(error.message))
  )
}

export function getAuthErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  if (error instanceof AuthServiceError) {
    return error.message
  }

  if (isNetworkError(error)) {
    return 'Unable to reach the authentication service. Check your connection and try again.'
  }

  const authError = error as Partial<AuthError> | null

  switch (authError?.code) {
    case 'email_address_invalid':
      return 'Enter a valid email address.'
    case 'weak_password':
      return 'This password does not meet the project password requirements. Choose a stronger password.'
    case 'user_already_exists':
      return 'An account with this email already exists. Try logging in instead.'
    case 'email_not_confirmed':
      return 'Please confirm your email before logging in. Check the inbox associated with your account.'
    case 'invalid_credentials':
      return 'The email or password is incorrect.'
    case 'over_email_send_rate_limit':
      return 'Too many confirmation emails were requested. Please wait before trying again.'
    case 'over_request_rate_limit':
      return 'Too many attempts were made. Please wait a moment and try again.'
    case 'signup_disabled':
      return 'New account registration is currently unavailable.'
    case 'validation_failed':
      return 'The submitted account information is invalid. Review the form and try again.'
    default:
      return fallback
  }
}

export async function registerWithPassword({
  fullName,
  email,
  password,
}: RegisterInput): Promise<RegistrationResult> {
  const client = getAuthClient()
  const confirmationUrl = `${window.location.origin}/auth/confirm`

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: confirmationUrl,
    },
  })

  if (error) {
    throw new AuthServiceError(
      getAuthErrorMessage(error, 'We could not create your account. Please try again.'),
    )
  }

  if (data.user?.identities?.length === 0) {
    throw new AuthServiceError(
      'An account with this email already exists. Try logging in instead.',
    )
  }

  if (data.session) {
    await client.auth.signOut({ scope: 'local' })
    throw new AuthServiceError(
      'Registration requires email confirmation, but it is not enabled for this Supabase project. Contact the project administrator.',
    )
  }

  if (!data.user) {
    throw new AuthServiceError('We could not create your account. Please try again.')
  }

  return {
    email: data.user.email ?? email,
    user: data.user,
  }
}

export async function loginWithPassword({
  email,
  password,
}: LoginInput): Promise<LoginResult> {
  const client = getAuthClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error) {
    throw new AuthServiceError(
      getAuthErrorMessage(error, 'We could not log you in. Please try again.'),
    )
  }

  if (!data.session || !data.user) {
    throw new AuthServiceError('We could not log you in. Please try again.')
  }

  if (!data.user.email_confirmed_at) {
    await client.auth.signOut({ scope: 'local' })
    throw new AuthServiceError(
      'Please confirm your email before logging in. Check the inbox associated with your account.',
    )
  }

  return { session: data.session, user: data.user }
}
