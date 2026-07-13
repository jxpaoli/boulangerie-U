import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PackageMinus, ClipboardList, Truck, Phone, ArrowRight, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, SectionTitle, StatTile, Badge } from '@/components/ui'
import { services } from '@/services'
import { formatDayLong, formatPacks } from '@/lib/format'
import { supplierPlan, civilToDate } from '@/lib/orderCalendar'

const today = new Date()

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => services.catalog.listSuppliers(),
  })

  const atRisk = products.filter((p) => p.stockUnits < p.minUnits)
  const suppliersDue = suppliers.filter((s) => s.dueToday)

  return (
    <AppShell eyebrow="Point Chaud" title="Bonjour" subtitle={cap(formatDayLong(today))}>
      {/* Hero : commande du jour */}
      <div
        className="mt-1 rounded-[22px] bg-gradient-to-br from-crust to-crust-ink p-[18px] text-white"
        style={{ boxShadow: '0 8px 20px rgba(150,80,20,.32)' }}
      >
        <div className="text-[11px] font-bold tracking-[0.12em] uppercase opacity-85">
          {suppliersDue.length > 0 ? `${suppliersDue.length} commande(s) aujourd'hui` : 'Aucune commande aujourd’hui'}
        </div>
        <h2 className="mt-1 text-[19px] font-bold">Commande à préparer</h2>
        <p className="mt-0.5 text-[12.5px] leading-snug opacity-90">
          Quantités calculées pour couvrir jusqu'à la livraison d'après la prochaine (ton filet +1
          livraison).
        </p>
        <button
          onClick={() => navigate('/commandes')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[13px] bg-white py-3.5 text-[15px] font-extrabold text-crust-ink"
        >
          <ClipboardList size={18} />
          Préparer la commande
        </button>
      </div>

      {/* Tuiles */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <StatTile n={atRisk.length} label="produits sous le niveau" tone="warn" />
        <StatTile n={suppliersDue.length} label="commandes à passer aujourd'hui" tone="crust" />
      </div>

      {/* Actions rapides */}
      <SectionTitle>Actions rapides</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5">
        <QuickAction icon={PackageMinus} label="Sortie" onClick={() => navigate('/sortie')} />
        <QuickAction icon={ClipboardList} label="Commander" onClick={() => navigate('/commandes')} />
        <QuickAction icon={Truck} label="Réception" onClick={() => navigate('/receptions')} />
      </div>

      {/* Stocks à risque */}
      <SectionTitle>Stocks à risque</SectionTitle>
      {atRisk.length === 0 ? (
        <Card>
          <div className="text-[13px] text-ink-2">Aucun produit sous son niveau. 👍</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {atRisk.map((p) => (
            <Card key={p.id} className="flex items-center gap-3" onClick={() => navigate('/stock')}>
              <AlertTriangle size={18} className="flex-shrink-0 text-warn" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{p.name}</div>
                <div className="tabnums text-[11px] text-ink-3">
                  Reste {formatPacks(p.stockUnits, p.packSize, p.packLabel)} · mini {p.minUnits}
                </div>
              </div>
              <Badge tone="warn">sous mini</Badge>
            </Card>
          ))}
        </div>
      )}

      {/* Fournisseurs à commander */}
      <SectionTitle>Fournisseurs — à commander</SectionTitle>
      <div className="flex flex-col gap-2">
        {suppliers.map((s) => {
          const plan = supplierPlan(s.calendar, today)
          const deliv = cap(formatDayLong(civilToDate(plan.d1)))
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3"
            >
              <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-xl bg-crust-soft text-[15px] font-extrabold text-crust-ink">
                {s.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{s.name}</div>
                <div className="text-[11px] text-ink-2">
                  {s.dueToday ? (
                    <>
                      Commander avant {plan.cutoff} · livraison {deliv}
                    </>
                  ) : (
                    <>Prochaine livraison {deliv}</>
                  )}
                </div>
              </div>
              {s.dueToday ? (
                <Badge tone="warn">à commander</Badge>
              ) : (
                <a
                  href={`tel:${s.phone.replace(/\s/g, '')}`}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-ok-soft text-ok"
                  aria-label={`Appeler ${s.name}`}
                >
                  <Phone size={16} />
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-6 mb-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-3">
        Données de démonstration <ArrowRight size={11} /> branchement Supabase à venir
      </p>
    </AppShell>
  )
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof PackageMinus
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface py-4 text-[12px] font-bold text-ink"
    >
      <Icon size={22} className="text-crust" />
      {label}
    </button>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
