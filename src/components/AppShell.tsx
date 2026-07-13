import type { ReactNode } from 'react'
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
          {user?.role === 'responsable' && (
            <button
              onClick={() => navigate('/parametres')}
              aria-label="Paramètres"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2"
            >
              <Settings size={17} />
            </button>
          )}
          {user && (
            <button
              onClick={() => {
                if (confirm(`Fermer la session de ${user.name} ?`)) void signOut()
              }}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1 text-[11px] font-bold text-ink-2"
              aria-label="Changer d'utilisateur"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-crust-soft text-[11px] text-crust-ink">
                {user.name[0]}
              </span>
              <LogOut size={13} />
            </button>
          )}
          <button
            onClick={toggle}
            aria-label="Changer de thème"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-2"
          >
            <Moon size={17} />
          </button>
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
