import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, ArrowRight, CalendarClock, ChevronRight, Croissant, Sparkles, Zap } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { services, type Product } from '@/services'
import { formatDayLong } from '@/lib/format'
import { supplierPlan } from '@/lib/orderCalendar'
import { dailyOrderSummary, hasPlacedOrderForCycle } from '@/lib/orderCycle'

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
  const { data: prepas = [] } = useQuery({
    queryKey: ['prepas'],
    queryFn: () => services.catalog.listPrepas(),
  })
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', 'history'],
    queryFn: () => services.orders.listHistory(),
  })
  const { data: cuisson = [] } = useQuery({
    queryKey: ['cuisson-du-jour'],
    queryFn: () => services.stock.listCuissonDuJour(),
  })

  const atRisk = products.filter((product) => product.stockUnits < product.minUnits)
  const worst = [...atRisk].sort(
    (a, b) =>
      a.stockUnits / Math.max(1, a.minUnits) - b.stockUnits / Math.max(1, b.minUnits),
  )[0]
  const suppliersDue = suppliers.filter((supplier) => supplier.dueToday)
  const passedOrders = suppliersDue.filter((supplier) => {
    const delivery = supplierPlan(supplier.calendar, today).d1
    return hasPlacedOrderForCycle(orders, supplier.id, civilISO(delivery))
  }).length
  const orderSummary = ordersLoading
    ? 'Commandes du jour'
    : dailyOrderSummary(suppliersDue.length, passedOrders)
  const health = products.length
    ? Math.round(((products.length - atRisk.length) / products.length) * 100)
    : 100
  const families = familyHealth(products)
  const duePrepas = prepas.filter((prepa) => prepa.time && prepa.time <= currentTime() && !ranToday(prepa.lastRunAt))

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
          onClick={() => navigate(suppliersDue.length > 0 ? '/commandes' : '/stock')}
          className="relative mt-3 flex w-full items-center justify-between border-t border-white/10 pt-2.5 text-left transition active:opacity-60"
        >
          <span className="truncate pr-2 text-[10.5px] font-bold text-white/65">
            <span className="text-white">{orderSummary}</span>
          </span>
          <ArrowRight size={13} className="flex-shrink-0 text-white/55" />
        </button>
      </section>

      {cuisson.length > 0 && (
        <>
          <h2 className="mt-4 mb-1.5 text-[9px] font-black tracking-[.18em] text-ink-3 uppercase">
            À cuire aujourd'hui
          </h2>
          <button
            onClick={() => navigate('/sortie')}
            className="flex w-full items-center gap-3 rounded-[18px] border border-line/80 bg-surface px-3 py-2.5 text-left shadow-[0_8px_25px_rgba(30,38,70,.05)]"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] bg-crust-soft text-crust-ink">
              <Croissant size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-black">
                {cuisson.reduce((sum, line) => sum + line.units, 0)} à cuire ·{' '}
                {cuisson.length} produit{cuisson.length > 1 ? 's' : ''}
              </span>
              <span className="block truncate text-[9.5px] text-ink-3">
                {cuisson.map((line) => `${line.productName} (${line.units})`).join(' · ')}
              </span>
            </span>
            <ChevronRight size={15} className="flex-shrink-0 text-ink-3" />
          </button>
        </>
      )}

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
      {duePrepas.length > 0 ? (
        <button
          onClick={() => navigate('/sortie')}
          className="flex w-full items-center gap-3 rounded-[18px] border border-warn/20 bg-surface px-3 py-2.5 text-left shadow-[0_8px_25px_rgba(30,38,70,.05)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-warn-soft text-warn">
            <CalendarClock size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-black">
              {duePrepas.length} préparation{duePrepas.length > 1 ? 's' : ''} à faire
            </span>
            <span className="block truncate text-[9.5px] text-ink-3">{duePrepas[0]?.name}</span>
          </span>
          <ChevronRight size={15} className="text-ink-3" />
        </button>
      ) : atRisk.length === 0 ? (
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

function currentTime(): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Paris',
  }).format(new Date())
}

function ranToday(value?: string | null): boolean {
  if (!value) return false
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' })
  return day.format(new Date(value)) === day.format(new Date())
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

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function civilISO(value: { y: number; m: number; d: number }): string {
  return `${value.y}-${String(value.m).padStart(2, '0')}-${String(value.d).padStart(2, '0')}`
}
