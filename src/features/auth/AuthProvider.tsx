import { useEffect, useState, type ReactNode } from 'react'
import { auth, type AuthUser } from '@/features/auth/auth'
import { AuthContext, type AuthContextValue } from '@/features/auth/AuthContext'

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
