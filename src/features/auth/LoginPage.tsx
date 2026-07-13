import { useState } from 'react'
import { Croissant, LogIn } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { DEMO_USERS } from '@/features/auth/auth'
import { dataSource } from '@/lib/supabase'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(mail: string, pass: string) {
    setError('')
    setBusy(true)
    try {
      await signIn(mail, pass)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6">
      <div className="mb-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-crust text-white">
          <Croissant size={30} />
        </div>
        <h1 className="mt-4 text-[22px] font-bold tracking-tight">Point Chaud</h1>
        <p className="mt-1 text-[13px] text-ink-2">Connexion pour votre service</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(email, password)
        }}
        className="flex flex-col gap-3"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          autoComplete="username"
          className="w-full rounded-[14px] border border-line bg-surface px-4 py-3.5 text-[15px]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoComplete="current-password"
          className="w-full rounded-[14px] border border-line bg-surface px-4 py-3.5 text-[15px]"
        />
        {error && <div className="text-[12.5px] font-semibold text-warn">{error}</div>}
        <Button type="submit" disabled={busy} className="mt-1 w-full">
          <LogIn size={18} /> {busy ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      {dataSource === 'mock' && (
        <div className="mt-6">
          <div className="mb-2 text-center text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
            Accès rapide (démo)
          </div>
          <div className="flex flex-col gap-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => submit(u.email, '')}
                disabled={busy}
                className="flex items-center justify-between rounded-[14px] border border-line bg-surface px-4 py-3 text-left"
              >
                <span className="text-[14px] font-semibold">{u.name}</span>
                <span className="text-[11px] font-bold text-crust-ink capitalize">{u.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
