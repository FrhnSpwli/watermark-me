import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  initializationError: string | null
  signOut: () => Promise<string | null>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
