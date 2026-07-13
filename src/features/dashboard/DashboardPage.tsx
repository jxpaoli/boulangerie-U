import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, AlertTriangle, Sparkles, Zap, ChevronRight, Activity,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, SectionTitle } from '@/components/ui'
import { services, type Supplier, type Product } from '@/services'
import { formatDayLong, formatPacks } from '@/lib/format'
import { supplierPlan, coverageEnd, toParisCivil } from '@/lib/orderCalendar'
import { computeOrderProposal } from '@/lib/orderProposal'

const today = new Date()
const SAFETY_DELIVERIES = 1

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => services.catalog.listProducts() })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => services.catalog.listSuppliers() })
  const atRisk = products.filter((p) => p.stockUnits < p.minUnits)
  const suppliersDue = suppliers.filter((s) => s.dueToday)
  const orderStatus = computeOrderStatus(suppliersDue, products)
  const covered = Math.max(0, products.length - atRisk.length)
  const health = products.length ? Math.round((covered / products.length) * 100) : 100
  const families = familyHealth(products)

  return (
    <AppShell eyebrow="Shift overview" title="Bonjour." subtitle={cap(formatDayLong(today))}>
      <section className="wow-enter relative mt-1 overflow-hidden rounded-[26px] bg-[#101322] p-4 text-white shadow-[0_24px_55px_rgba(12,16,36,.28)]">
        <div className="pointer-events-none absolute -top-20 -right-16 h-48 w-48 rounded-full bg-[#7374ff]/40 blur-3xl" />
        <div className="pointer-events-none absolute right-8 -bottom-24 h-44 w-44 rounded-full bg-[#ff5c93]/25 blur-3xl" />
        <div className="relative flex items-start justify-between">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[9px] font-black tracking-[.15em] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#42d6ad] shadow-[0_0_10px_#42d6ad]" /> Système actif
          </span>
          <Activity size={18} className="text-white/40" />
        </div>

        <div className="relative mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
          <div>
            <div className="text-[10px] font-black tracking-[.16em] text-white/45 uppercase">Santé du stock</div>
            <div className="mt-1 text-[44px] leading-none font-black tracking-[-.08em] tabnums">{health}<span className="text-[18px] text-white/35">%</span></div>
          </div>
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `conic-gradient(#7c7cff ${health}%, rgba(255,255,255,.1) 0)` }}>
            <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#101322]">
              <Zap size={18} className="text-[#7c7cff]" fill="currentColor" />
            </div>
          </div>
        </div>

        <button onClick={() => orderStatus === 'green' ? navigate('/stock') : navigate('/commandes')} className="relative mt-4 flex w-full items-center justify-between border-t border-white/10 pt-3 text-left transition active:opacity-60">
          <span className="text-[11px] font-bold text-white/70">
            <span className="text-white">{HERO[orderStatus].eyebrow(suppliersDue.length)}</span> · {HERO[orderStatus].title}
          </span>
          <ArrowRight size={14} className="text-white/55" />
        </button>
      </section>

      <SectionTitle>Familles de produits</SectionTitle>
      <div className="wow-enter-2 grid grid-cols-2 gap-2.5">
        {families.map((family) => (
          <button key={family.name} onClick={() => navigate('/stock')} className="flex items-center gap-3 rounded-[20px] border border-line/80 bg-surface p-3 text-left shadow-[0_8px_30px_rgba(30,38,70,.05)] transition active:scale-[.98]">
            <FamilyRing value={family.health} />
            <span className="min-w-0">
              <span className="block truncate text-[11.5px] font-black">{family.name}</span>
              <span className="mt-0.5 block text-[9.5px] text-ink-3">{family.count} produit{family.count > 1 ? 's' : ''}</span>
            </span>
          </button>
        ))}
      </div>

      <SectionTitle>Points de vigilance</SectionTitle>
      {atRisk.length === 0 ? (
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ok-soft text-ok"><Sparkles size={18} /></span>
          <div><div className="text-[13px] font-black">Aucun point de vigilance.</div><div className="text-[11px] text-ink-2">Les niveaux de stock sont cohérents.</div></div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {atRisk.slice(0, 4).map((p) => (
            <Card key={p.id} className="flex items-center gap-3" onClick={() => navigate('/stock')}>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-warn-soft text-warn"><AlertTriangle size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-black">{p.name}</div>
                <div className="tabnums mt-0.5 text-[10.5px] text-ink-3">Stock bas · {formatPacks(p.stockUnits, p.packSize, p.packLabel)} restant · mini {p.minUnits}</div>
              </div>
              <ChevronRight size={17} className="text-ink-3" />
            </Card>
          ))}
        </div>
      )}

      <p className="mt-7 flex items-center justify-center gap-1.5 text-[9px] font-bold tracking-[.12em] text-ink-3 uppercase">Données synchronisées <span className="h-1 w-1 rounded-full bg-ok" /></p>
    </AppShell>
  )
}

function FamilyRing({ value }: { value: number }) {
  const color = value < 60 ? '#ff6b6b' : value < 85 ? '#7c7cff' : '#42d6ad'
  return <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${color} ${value}%, var(--c-surface-2) 0)` }}>
    <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-surface text-[10px] font-black tabnums">{value}%</span>
  </span>
}

function familyHealth(products: Product[]): { name: string; count: number; health: number }[] {
  const groups = new Map<string, Product[]>()
  for (const product of products) groups.set(product.category, [...(groups.get(product.category) ?? []), product])
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      count: items.length,
      health: Math.round(items.reduce((sum, item) => sum + Math.min(100, (item.stockUnits / Math.max(1, item.minUnits)) * 100), 0) / items.length),
    }))
    .sort((a, b) => a.health - b.health)
}

type OrderStatus = 'green' | 'blue' | 'red'
const HERO: Record<OrderStatus, { title: string; eyebrow: (n: number) => string }> = {
  green: { title: 'Voir le détail du stock', eyebrow: () => 'Tout est couvert' },
  blue: { title: 'Préparer la commande', eyebrow: (n) => `${n} fournisseur${n > 1 ? 's' : ''} à commander` },
  red: { title: 'Agir avant la rupture', eyebrow: () => 'Risque avant livraison' },
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
      const pr = computeOrderProposal({ stockUnits: p.stockUnits, conso7: p.conso, packSize: p.packSize, maxStockUnits: p.maxUnits }, now, plan.d1, cov)
      if (pr.ruptureBeforeDelivery) rupture = true
      if (pr.packs > 0) toOrder = true
    }
  }
  return rupture ? 'red' : toOrder ? 'blue' : 'green'
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }
