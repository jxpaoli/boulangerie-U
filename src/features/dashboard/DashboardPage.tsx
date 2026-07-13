import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, ArrowRight, ChevronRight, Sparkles, Zap } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { services, type Product, type Supplier } from '@/services'
import { formatDayLong } from '@/lib/format'
import { coverageEnd, supplierPlan, toParisCivil } from '@/lib/orderCalendar'
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

  const atRisk = products.filter((product) => product.stockUnits < product.minUnits)
  const worst = [...atRisk].sort(
    (a, b) =>
      a.stockUnits / Math.max(1, a.minUnits) - b.stockUnits / Math.max(1, b.minUnits),
  )[0]
  const suppliersDue = suppliers.filter((supplier) => supplier.dueToday)
  const orderStatus = computeOrderStatus(suppliersDue, products)
  const health = products.length
    ? Math.round(((products.length - atRisk.length) / products.length) * 100)
    : 100
  const families = familyHealth(products)

  return (
    <AppShell compact eyebrow="Shift overview" title="Bonjour." subtitle={cap(formatDayLong(today))}>
      <section className="wow-enter relative mt-1 overflow-hidden rounded-[24px] bg-[#101322] p-3.5 text-white shadow-[0_20px_45px_rgba(12,16,36,.26)]">
        <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-[#7374ff]/40 blur-3xl" />
        <div className="pointer-events-none absolute right-8 -bottom-24 h-44 w-44 rounded-full bg-[#ff5c93]/25 blur-3xl" />

        <div className="relative flex items-start justify-between">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[9px] font-black tracking-[.15em] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#42d6ad] shadow-[0_0_10px_#42d6ad]" />
            Système actif
          </span>
          <Activity size={17} className="text-white/40" />
        </div>

        <div className="relative mt-3 grid grid-cols-[1fr_auto] items-center gap-4">
          <div>
            <div className="text-[9px] font-black tracking-[.16em] text-white/45 uppercase">
              Santé du stock
            </div>
            <div className="tabnums mt-0.5 text-[38px] leading-none font-black tracking-[-.08em]">
              {health}<span className="text-[16px] text-white/35">%</span>
            </div>
          </div>
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#7c7cff ${health}%, rgba(255,255,255,.1) 0)`,
            }}
          >
            <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#101322]">
              <Zap size={16} className="text-[#7c7cff]" fill="currentColor" />
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate(orderStatus === 'green' ? '/stock' : '/commandes')}
          className="relative mt-3 flex w-full items-center justify-between border-t border-white/10 pt-2.5 text-left transition active:opacity-60"
        >
          <span className="truncate pr-2 text-[10.5px] font-bold text-white/65">
            <span className="text-white">{HERO[orderStatus].eyebrow(suppliersDue.length)}</span>
            {' · '}{HERO[orderStatus].title}
          </span>
          <ArrowRight size={13} className="flex-shrink-0 text-white/55" />
        </button>
      </section>

      <h2 className="mt-4 mb-1.5 text-[9px] font-black tracking-[.18em] text-ink-3 uppercase">
        Familles
      </h2>
      <div className="wow-enter-2 grid grid-cols-5 gap-1">
        {families.map((family) => (
          <button
            key={family.name}
            title={family.name}
            aria-label={`${family.name} : ${family.health}%`}
            onClick={() => navigate('/stock')}
            className="flex flex-col items-center gap-1 rounded-xl py-1 transition active:scale-[.96]"
          >
            <FamilyRing value={family.health} />
            <span className="block w-full truncate text-center text-[8.5px] font-black">
              {family.name}
            </span>
          </button>
        ))}
      </div>

      <h2 className="mt-4 mb-1.5 text-[9px] font-black tracking-[.18em] text-ink-3 uppercase">
        Points de vigilance
      </h2>
      {atRisk.length === 0 ? (
        <button
          onClick={() => navigate('/stock')}
          className="flex w-full items-center gap-3 rounded-[18px] border border-line/80 bg-surface px-3 py-2.5 text-left shadow-[0_8px_25px_rgba(30,38,70,.05)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-ok-soft text-ok">
            <Sparkles size={16} />
          </span>
          <span className="flex-1">
            <span className="block text-[12px] font-black">Rien à signaler</span>
            <span className="block text-[9.5px] text-ink-3">Tous les niveaux sont cohérents</span>
          </span>
          <ChevronRight size={15} className="text-ink-3" />
        </button>
      ) : (
        <button
          onClick={() => navigate('/stock')}
          className="flex w-full items-center gap-3 rounded-[18px] border border-warn/20 bg-surface px-3 py-2.5 text-left shadow-[0_8px_25px_rgba(30,38,70,.05)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-warn-soft text-warn">
            <AlertTriangle size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-black">
              {atRisk.length} stock{atRisk.length > 1 ? 's' : ''} sous le minimum
            </span>
            <span className="block truncate text-[9.5px] text-ink-3">
              {vigilanceDetail(worst)}
            </span>
          </span>
          <ChevronRight size={15} className="text-ink-3" />
        </button>
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[8px] font-bold tracking-[.12em] text-ink-3 uppercase">
        Données synchronisées <span className="h-1 w-1 rounded-full bg-ok" />
      </p>
    </AppShell>
  )
}

function FamilyRing({ value }: { value: number }) {
  const color = value < 60 ? '#ff6b6b' : value < 85 ? '#7c7cff' : '#42d6ad'
  return (
    <span
      className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${value}%, var(--c-surface-2) 0)` }}
    >
      <span className="tabnums flex h-[35px] w-[35px] items-center justify-center rounded-full bg-bg text-[8.5px] font-black">
        {value}%
      </span>
    </span>
  )
}

function familyHealth(products: Product[]): { name: string; health: number }[] {
  const groups = new Map<string, Product[]>()
  for (const product of products) {
    groups.set(product.category, [...(groups.get(product.category) ?? []), product])
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      health: Math.round(
        items.reduce(
          (sum, item) =>
            sum + Math.min(100, (item.stockUnits / Math.max(1, item.minUnits)) * 100),
          0,
        ) / items.length,
      ),
    }))
    .sort((a, b) => a.health - b.health)
}

function vigilanceDetail(product: Product | undefined): string {
  if (!product) return 'Consulter le stock'
  if (product.stockUnits === 0) return `${product.name} est en rupture`
  return `${product.name} · ${product.stockUnits}/${product.minUnits} unités`
}

type OrderStatus = 'green' | 'blue' | 'red'

const HERO: Record<OrderStatus, { title: string; eyebrow: (n: number) => string }> = {
  green: { title: 'Voir le détail du stock', eyebrow: () => 'Tout est couvert' },
  blue: {
    title: 'Préparer la commande',
    eyebrow: (n) => `${n} fournisseur${n > 1 ? 's' : ''} à commander`,
  },
  red: { title: 'Agir avant la rupture', eyebrow: () => 'Risque avant livraison' },
}

function computeOrderStatus(dueSuppliers: Supplier[], products: Product[]): OrderStatus {
  let rupture = false
  let toOrder = false
  for (const supplier of dueSuppliers) {
    const now = toParisCivil(today)
    const plan = supplierPlan(supplier.calendar, today)
    const coverUntil = coverageEnd(supplier.calendar, today, SAFETY_DELIVERIES)
    for (const product of products) {
      if (product.supplierId !== supplier.id) continue
      const proposal = computeOrderProposal(
        {
          stockUnits: product.stockUnits,
          conso7: product.conso,
          packSize: product.packSize,
          maxStockUnits: product.maxUnits,
        },
        now,
        plan.d1,
        coverUntil,
      )
      if (proposal.ruptureBeforeDelivery) rupture = true
      if (proposal.packs > 0) toOrder = true
    }
  }
  return rupture ? 'red' : toOrder ? 'blue' : 'green'
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
