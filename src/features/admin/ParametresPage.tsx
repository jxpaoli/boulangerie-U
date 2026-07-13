import { useNavigate } from 'react-router-dom'
import { Package, Truck, Layers, ChevronRight, Croissant, ClipboardCheck } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthProvider'
import { services } from '@/services'

const ENTRIES = [
  { to: '/parametres/produits', icon: Package, label: 'Produits', sub: 'Catalogue, conso, seuils' },
  { to: '/parametres/fournisseurs', icon: Truck, label: 'Fournisseurs', sub: 'Calendriers de commande' },
  { to: '/parametres/familles', icon: Layers, label: 'Familles', sub: 'Regroupement des produits' },
  {
    to: '/parametres/inventaires',
    icon: ClipboardCheck,
    label: 'Historique des inventaires',
    sub: 'Consulter et extraire (Excel / PDF)',
  },
]

export function ParametresPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  if (user?.role !== 'responsable') {
    return (
      <AppShell eyebrow="Paramètres" title="Paramètres">
        <Card className="mt-4 text-center text-[13px] text-ink-2">
          La configuration est réservée au <b>responsable</b>.
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell eyebrow="Paramètres" title="Configuration">
      <div className="mt-2 flex flex-col gap-2">
        {ENTRIES.map((e) => (
          <Card key={e.to} className="flex items-center gap-3" onClick={() => navigate(e.to)}>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-crust-soft text-crust-ink">
              <e.icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{e.label}</div>
              <div className="text-[11.5px] text-ink-2">{e.sub}</div>
            </div>
            <ChevronRight size={18} className="text-ink-3" />
          </Card>
        ))}
        <Card className="flex items-center gap-3 opacity-60">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-3">
            <Croissant size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">Préparations</div>
            <div className="text-[11.5px] text-ink-3">Bientôt</div>
          </div>
        </Card>
      </div>
      {services.source === 'mock' && (
        <p className="mt-4 px-1 text-[11.5px] text-ink-3">
          Mode démo : les modifications ne sont pas enregistrées (l'administration réelle
          fonctionne une fois branché sur Supabase).
        </p>
      )}
    </AppShell>
  )
}
