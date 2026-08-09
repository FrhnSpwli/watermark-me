import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AuthContext, type AuthContextValue } from '../../context/AuthContext'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { getAuthErrorMessage } from '../../services/auth'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [initializationError, setInitializationError] = useState<string | null>(
    isSupabaseConfigured
      ? null
      : 'Authentication is not configured. Add both Supabase variables to .env.local.',
  )

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isActive = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) {
        return
      }

      setSession(nextSession)
      setInitializationError(null)
      setLoading(false)
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isActive) {
        return
      }

      if (error) {
        setSession(null)
        setInitializationError(
          getAuthErrorMessage(error, 'We could not restore your session. Please log in again.'),
        )
      } else {
        setSession(data.session)
      }

      setLoading(false)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) {
      return 'Authentication is not configured.'
    }

    const { error } = await supabase.auth.signOut()

    if (error) {
      return getAuthErrorMessage(error, 'We could not log you out. Please try again.')
    }

    return null
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      initializationError,
      signOut,
    }),
    [initializationError, loading, session, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
