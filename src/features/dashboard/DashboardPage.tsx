import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PackageMinus, ClipboardList, Truck, Phone, ArrowRight, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, SectionTitle, StatTile, Badge } from '@/components/ui'
import { services, type Supplier, type Product } from '@/services'
import { formatDayLong, formatPacks } from '@/lib/format'
import { supplierPlan, coverageEnd, toParisCivil, civilToDate } from '@/lib/orderCalendar'
import { computeOrderProposal } from '@/lib/orderProposal'

const today = new Date()
const SAFETY_DELIVERIES = 1

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

  // statut de la commande du jour : vert (rien) / bleu (à commander) / rouge (rupture)
  const orderStatus = computeOrderStatus(suppliersDue, products)

  return (
    <AppShell eyebrow="Point Chaud" title="Bonjour" subtitle={cap(formatDayLong(today))}>
      {/* Hero : commande du jour */}
      <div
        className="mt-1 flex items-center gap-3 rounded-[16px] p-3.5 text-white"
        style={{ background: HERO[orderStatus].bg }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase opacity-90">
            {HERO[orderStatus].eyebrow(suppliersDue.length)}
          </div>
          <h2 className="mt-0.5 text-[16px] font-bold text-balance">{HERO[orderStatus].title}</h2>
        </div>
        {orderStatus !== 'green' && (
          <button
            onClick={() => navigate('/commandes')}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[11px] bg-white px-3 py-2 text-[13px] font-extrabold text-[#241c12]"
          >
            <ClipboardList size={16} /> Préparer
          </button>
        )}
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

type OrderStatus = 'green' | 'blue' | 'red'

const HERO: Record<
  OrderStatus,
  { bg: string; title: string; eyebrow: (n: number) => string }
> = {
  green: {
    bg: 'linear-gradient(135deg,#3b7a4b,#285436)',
    title: 'Tout est couvert 👍',
    eyebrow: () => "Rien à commander aujourd'hui",
  },
  blue: {
    bg: 'linear-gradient(135deg,#2f6fed,#1e46b8)',
    title: 'Commande à préparer',
    eyebrow: (n) => `${n} fournisseur${n > 1 ? 's' : ''} à commander`,
  },
  red: {
    bg: 'linear-gradient(135deg,#c2410c,#7a2410)',
    title: 'Risque de rupture — commande vite',
    eyebrow: () => 'Stock à risque avant livraison',
  },
}

function computeOrderStatus(dueSuppliers: Supplier[], products: Product[]): OrderStatus {
  let rupture = false
  let toOrder = false
  for (const s of dueSuppliers) {
    const now = toParisCivil(today)
    const plan = supplierPlan(s.calendar, today)
    const cov = coverageEnd(s.calendar, today, SAFETY_DELIVERIES)
    for (const p of products) {
      if (p.supplierId !== s.id) continue
      const pr = computeOrderProposal(
        { stockUnits: p.stockUnits, conso7: p.conso, packSize: p.packSize, maxStockUnits: p.maxUnits },
        now,
        plan.d1,
        cov,
      )
      if (pr.ruptureBeforeDelivery) rupture = true
      if (pr.packs > 0) toOrder = true
    }
  }
  return rupture ? 'red' : toOrder ? 'blue' : 'green'
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
