import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  PackageMinus, ClipboardList, Truck, Phone, ArrowRight, AlertTriangle,
  Sparkles, Zap, ChevronRight, Activity,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, SectionTitle, Badge } from '@/components/ui'
import { services, type Supplier, type Product } from '@/services'
import { formatDayLong, formatPacks } from '@/lib/format'
import { supplierPlan, coverageEnd, toParisCivil, civilToDate } from '@/lib/orderCalendar'
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

  return (
    <AppShell eyebrow="Shift overview" title="Bonjour." subtitle={cap(formatDayLong(today))}>
      <section className="wow-enter relative mt-2 overflow-hidden rounded-[30px] bg-[#101322] p-5 text-white shadow-[0_30px_70px_rgba(12,16,36,.3)]">
        <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[#7374ff]/40 blur-3xl" />
        <div className="pointer-events-none absolute right-8 -bottom-24 h-44 w-44 rounded-full bg-[#ff5c93]/25 blur-3xl" />
        <div className="relative flex items-start justify-between">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[9px] font-black tracking-[.15em] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#42d6ad] shadow-[0_0_10px_#42d6ad]" /> Système actif
          </span>
          <Activity size={18} className="text-white/40" />
        </div>

        <div className="relative mt-10 grid grid-cols-[1fr_auto] items-end gap-4">
          <div>
            <div className="text-[10px] font-black tracking-[.16em] text-white/45 uppercase">Santé du stock</div>
            <div className="mt-1 text-[58px] leading-none font-black tracking-[-.08em] tabnums">{health}<span className="text-[24px] text-white/35">%</span></div>
          </div>
          <div className="relative mb-1 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: `conic-gradient(#7c7cff ${health}%, rgba(255,255,255,.1) 0)` }}>
            <div className="flex h-[66px] w-[66px] items-center justify-center rounded-full bg-[#101322]">
              <Zap size={22} className="text-[#7c7cff]" fill="currentColor" />
            </div>
          </div>
        </div>

        <button onClick={() => orderStatus === 'green' ? navigate('/stock') : navigate('/commandes')} className="relative mt-6 flex w-full items-center justify-between rounded-[18px] bg-white px-4 py-3.5 text-left text-[#101322] transition active:scale-[.98]">
          <span>
            <span className="block text-[9px] font-black tracking-[.13em] text-[#757d92] uppercase">{HERO[orderStatus].eyebrow(suppliersDue.length)}</span>
            <span className="mt-0.5 block text-[14px] font-black">{HERO[orderStatus].title}</span>
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#101322] text-white"><ArrowRight size={17} /></span>
        </button>
      </section>

      <div className="wow-enter-2 mt-3 grid grid-cols-2 gap-3">
        <Metric n={atRisk.length} label="sous le minimum" tone="warn" detail="à surveiller" />
        <Metric n={suppliersDue.length} label="commandes du jour" tone="crust" detail="avant cutoff" />
      </div>

      <SectionTitle>Actions express</SectionTitle>
      <div className="wow-enter-3 grid grid-cols-3 gap-2.5">
        <QuickAction icon={PackageMinus} label="Sortir" accent="#7c7cff" onClick={() => navigate('/sortie')} />
        <QuickAction icon={ClipboardList} label="Commander" accent="#ff5c93" onClick={() => navigate('/commandes')} />
        <QuickAction icon={Truck} label="Recevoir" accent="#42d6ad" onClick={() => navigate('/receptions')} />
      </div>

      <SectionTitle>À traiter maintenant</SectionTitle>
      {atRisk.length === 0 ? (
        <Card className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ok-soft text-ok"><Sparkles size={18} /></span>
          <div><div className="text-[13px] font-black">Tout roule.</div><div className="text-[11px] text-ink-2">Aucun stock sous le minimum.</div></div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {atRisk.slice(0, 4).map((p) => (
            <Card key={p.id} className="flex items-center gap-3" onClick={() => navigate('/stock')}>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-warn-soft text-warn"><AlertTriangle size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-black">{p.name}</div>
                <div className="tabnums mt-0.5 text-[10.5px] text-ink-3">{formatPacks(p.stockUnits, p.packSize, p.packLabel)} restant · mini {p.minUnits}</div>
              </div>
              <ChevronRight size={17} className="text-ink-3" />
            </Card>
          ))}
        </div>
      )}

      <SectionTitle>Fournisseurs</SectionTitle>
      <div className="flex flex-col gap-2">
        {suppliers.map((s) => {
          const plan = supplierPlan(s.calendar, today)
          const deliv = cap(formatDayLong(civilToDate(plan.d1)))
          return (
            <div key={s.id} className="flex items-center gap-3 rounded-[20px] border border-line/80 bg-surface p-3 shadow-[0_8px_30px_rgba(30,38,70,.05)]">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-ink text-[14px] font-black text-bg">{s.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black">{s.name}</div>
                <div className="mt-0.5 truncate text-[10.5px] text-ink-2">{s.dueToday ? `Avant ${plan.cutoff} · livraison ${deliv}` : `Livraison ${deliv}`}</div>
              </div>
              {s.dueToday ? <Badge tone="warn">À commander</Badge> : (
                <a href={`tel:${s.phone.replace(/\s/g, '')}`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-ink-2" aria-label={`Appeler ${s.name}`}><Phone size={15} /></a>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-7 flex items-center justify-center gap-1.5 text-[9px] font-bold tracking-[.12em] text-ink-3 uppercase">Données synchronisées <span className="h-1 w-1 rounded-full bg-ok" /></p>
    </AppShell>
  )
}

function Metric({ n, label, detail, tone }: { n: number; label: string; detail: string; tone: 'warn' | 'crust' }) {
  return <div className="rounded-[22px] border border-line/80 bg-surface p-4 shadow-[0_8px_30px_rgba(30,38,70,.05)]">
    <div className={tone === 'warn' ? 'tabnums text-[34px] leading-none font-black tracking-[-.06em] text-warn' : 'tabnums text-[34px] leading-none font-black tracking-[-.06em] text-crust'}>{n}</div>
    <div className="mt-2 text-[11px] font-black">{label}</div><div className="mt-0.5 text-[9.5px] text-ink-3">{detail}</div>
  </div>
}

function QuickAction({ icon: Icon, label, accent, onClick }: { icon: typeof PackageMinus; label: string; accent: string; onClick: () => void }) {
  return <button onClick={onClick} className="group flex flex-col items-start gap-5 rounded-[21px] border border-line/80 bg-surface p-3.5 text-left shadow-[0_8px_30px_rgba(30,38,70,.05)] transition active:scale-[.97]">
    <span className="flex h-9 w-9 items-center justify-center rounded-[13px] text-white shadow-lg" style={{ background: accent }}><Icon size={17} strokeWidth={2.3} /></span>
    <span className="text-[11px] font-black">{label}</span>
  </button>
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
