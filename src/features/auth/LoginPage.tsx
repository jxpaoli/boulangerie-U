import { useState } from 'react'
import { ArrowRight, Boxes, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
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
    <div className="relative mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center overflow-x-hidden px-6 py-10">
      <div className="pointer-events-none absolute -top-24 -right-28 h-72 w-72 rounded-full bg-crust/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-32 h-64 w-64 rounded-full bg-danger/15 blur-3xl" />

      <div className="wow-enter relative mb-9">
        <div className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[11px] font-black tracking-[.16em] uppercase">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-bg shadow-lg">
              <Boxes size={19} strokeWidth={2.4} />
            </span>
            Point Chaud
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[9px] font-black tracking-wider text-ok uppercase backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-ok shadow-[0_0_10px_var(--c-ok)]" /> Live
          </span>
        </div>

        <div className="mb-3 flex items-center gap-2 text-[10px] font-black tracking-[.2em] text-crust uppercase">
          <Sparkles size={12} /> Shift control
        </div>
        <h1 className="max-w-[360px] text-[46px] leading-[.92] font-black tracking-[-.065em]">
          Le stock.<br /><span className="text-ink-3">Sans le chaos.</span>
        </h1>
        <p className="mt-5 max-w-[330px] text-[13px] leading-relaxed font-medium text-ink-2">
          Prenez votre service. Chaque sortie, commande et réception reste sous contrôle.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit(email, password)
        }}
        className="wow-enter-2 relative flex flex-col gap-3 rounded-[26px] border border-line/80 bg-surface/75 p-3 shadow-[var(--shadow)] backdrop-blur-xl"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          autoComplete="username"
          className="w-full rounded-[17px] border border-transparent bg-surface-2 px-4 py-4 text-[14px] font-semibold outline-none transition focus:border-crust"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoComplete="current-password"
          className="w-full rounded-[17px] border border-transparent bg-surface-2 px-4 py-4 text-[14px] font-semibold outline-none transition focus:border-crust"
        />
        {error && <div className="px-1 text-[12px] font-bold text-warn">{error}</div>}
        <Button type="submit" disabled={busy} className="mt-1 w-full justify-between px-5">
          <span>{busy ? 'Connexion…' : 'Prendre mon service'}</span><ArrowRight size={18} />
        </Button>
      </form>

      {dataSource === 'mock' && (
        <div className="wow-enter-3 relative mt-6">
          <div className="mb-2 flex items-center justify-center gap-1.5 text-[10px] font-black tracking-[0.14em] text-ink-3 uppercase">
            <ShieldCheck size={12} /> Accès rapide démo
          </div>
          <div className="flex flex-col gap-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                onClick={() => void submit(u.email, '')}
                disabled={busy}
                className="flex items-center justify-between rounded-[17px] border border-line bg-surface/70 px-4 py-3.5 text-left shadow-sm backdrop-blur transition active:scale-[.98]"
              >
                <span className="text-[14px] font-bold">{u.name}</span>
                <span className="rounded-full bg-crust-soft px-2.5 py-1 text-[9px] font-black tracking-wide text-crust-ink uppercase">{u.role}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
