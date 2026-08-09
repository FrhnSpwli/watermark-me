import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

interface InitialAuthCallback {
  hasCallbackParameters: boolean
  errorCode: string | null
  callbackType: string | null
}

function readInitialAuthCallback(): InitialAuthCallback {
  if (typeof window === 'undefined') {
    return {
      hasCallbackParameters: false,
      errorCode: null,
      callbackType: null,
    }
  }

  const url = new URL(window.location.href)
  const hashParameters = new URLSearchParams(url.hash.slice(1))
  const getParameter = (name: string) =>
    url.searchParams.get(name) ?? hashParameters.get(name)

  return {
    hasCallbackParameters: Boolean(
      getParameter('code') ||
        getParameter('access_token') ||
        getParameter('error') ||
        getParameter('error_code'),
    ),
    errorCode: getParameter('error_code') ?? getParameter('error'),
    callbackType: getParameter('type'),
  }
}

// Capture callback metadata before the auth client consumes and removes URL tokens.
// Access and refresh tokens are intentionally never copied or exported.
export const initialAuthCallback = readInitialAuthCallback()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null
