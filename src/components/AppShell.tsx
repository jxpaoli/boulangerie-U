import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  PackageMinus,
  ClipboardList,
  Truck,
  Snowflake,
  Moon,
  Sun,
  LogOut,
  Settings,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'
import { useAuth } from '@/features/auth/AuthProvider'

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/sortie', label: 'Sortie', icon: PackageMinus },
  { to: '/commandes', label: 'Commandes', icon: ClipboardList },
  { to: '/receptions', label: 'Réception', icon: Truck },
  { to: '/stock', label: 'Stock', icon: Snowflake },
] as const

export function AppShell({
  title,
  eyebrow,
  subtitle,
  children,
  action,
  compact = false,
}: {
  title: string
  eyebrow?: string
  subtitle?: ReactNode
  children: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  const { theme, toggle } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="flex items-end justify-between gap-3 px-4 pt-5 pb-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-crust uppercase">
              <Sparkles size={11} /> {eyebrow}
            </div>
          )}
          <h1 className="text-[25px] leading-none font-black tracking-[-0.04em] text-balance">
            {title}
          </h1>
          {subtitle && <div className="mt-1.5 text-[12px] font-medium text-ink-2">{subtitle}</div>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {action}
          <button
            onClick={toggle}
            aria-label="Changer de thème"
            className="glass flex h-10 w-10 items-center justify-center rounded-2xl border border-line/80 text-ink-2 shadow-sm transition active:scale-95"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          {user && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink text-[13px] font-black text-bg shadow-lg transition active:scale-95"
                aria-label="Menu utilisateur"
              >
                {user.name[0]?.toUpperCase()}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="glass absolute top-full right-0 z-40 mt-2 w-60 overflow-hidden rounded-[20px] border border-line p-1.5 shadow-[var(--shadow)]">
                    <div className="border-b border-line px-3.5 py-2.5">
                      <div className="text-[13px] font-bold">{user.name}</div>
                      <div className="text-[11px] text-ink-3 capitalize">{user.role}</div>
                    </div>
                    {user.role === 'responsable' && (
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          navigate('/parametres')
                        }}
                        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[13.5px] font-semibold text-ink"
                      >
                        <Settings size={16} className="text-ink-2" /> Paramètres
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMenuOpen(false)
                        void signOut()
                      }}
                      className="flex w-full items-center gap-2.5 border-t border-line px-3.5 py-3 text-left text-[13.5px] font-semibold text-warn"
                    >
                      <LogOut size={16} /> Changer d'utilisateur
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className={cn('flex-1 px-4', compact ? 'pb-24' : 'pb-28')}>{children}</main>

      <nav className="glass fixed inset-x-3 bottom-3 z-20 mx-auto max-w-[520px] rounded-[24px] border border-line/80 p-1.5 shadow-[0_18px_50px_rgba(10,15,35,.24)]">
        <div className="flex gap-1">
          {NAV.map((item) => {
            const { to, label, icon: Icon } = item
            const end = 'end' in item ? item.end : false
            return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-1 flex-col items-center gap-[3px] rounded-[18px] py-2 text-[9.5px] font-bold transition-all',
                  isActive ? 'bg-ink text-bg shadow-md' : 'text-ink-3 hover:text-ink',
                )
              }
            >
              <Icon size={20} strokeWidth={2.1} />
              {label}
            </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
