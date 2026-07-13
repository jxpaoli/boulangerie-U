import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  PackageMinus,
  ClipboardList,
  Truck,
  Snowflake,
  Moon,
  LogOut,
  Settings,
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
}: {
  title: string
  eyebrow?: string
  subtitle?: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  const { toggle } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-bg">
      <header className="flex items-end justify-between gap-3 px-4 pt-8 pb-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[10.5px] font-bold tracking-[0.14em] text-crust uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-0.5 text-[22px] leading-tight font-bold tracking-tight text-balance">
            {title}
          </h1>
          {subtitle && <div className="mt-0.5 text-[12px] text-ink-2">{subtitle}</div>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {action}
          <button
            onClick={toggle}
            aria-label="Changer de thème"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2"
          >
            <Moon size={17} />
          </button>
          {user && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-crust text-[13px] font-extrabold text-white"
                aria-label="Menu utilisateur"
              >
                {user.name[0]?.toUpperCase()}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute top-full right-0 z-40 mt-1.5 w-56 overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow)]">
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

      <main className="flex-1 px-4 pb-28">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t border-line bg-surface/95 px-1.5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="flex">
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
                  'flex flex-1 flex-col items-center gap-[3px] py-1 text-[10px] font-semibold',
                  isActive ? 'text-crust' : 'text-ink-3',
                )
              }
            >
              <Icon size={22} strokeWidth={1.9} />
              {label}
            </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
