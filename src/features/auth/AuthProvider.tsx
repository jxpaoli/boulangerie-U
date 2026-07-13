import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth, type AuthUser } from '@/features/auth/auth'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    auth
      .current()
      .then((u) => alive && setUser(u))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    async signIn(email, password) {
      setUser(await auth.signIn(email, password))
    },
    async signOut() {
      await auth.signOut()
      setUser(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
