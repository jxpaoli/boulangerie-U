import { useMemo, useState, type ReactNode } from 'react'
import { Search, Check, Minus, Plus, PackageMinus, Croissant, ChevronRight } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button, Badge } from '@/components/ui'
import {
  demoProducts,
  demoPrepas,
  productById,
  groupByFamily,
  type DemoPrepa,
} from '@/features/demo/data'
import { formatPacks, formatTime } from '@/lib/format'
import { cn } from '@/lib/cn'

// Démo : l'utilisateur connecté (viendra de Supabase Auth). Tracé sur chaque sortie.
const CURRENT_USER = 'Sabrina'

interface RecentEntry {
  id: number
  title: string
  subtitle: string
  meta: string
}

type Mode = 'prepa' | 'single'
const QUICK_QTIES = [1, 2, 5, 10]

export function QuickExitPage() {
  // stock local (démo) — sera remplacé par le service de mouvements de stock
  const [stock, setStock] = useState<Record<string, number>>(() =>
    Object.fromEntries(demoProducts.map((p) => [p.id, p.stockUnits])),
  )
  const [mode, setMode] = useState<Mode>('prepa')
  const [recent, setRecent] = useState<RecentEntry[]>([])

  function decrement(lines: { productId: string; units: number }[]): boolean {
    // vérifie qu'aucune ligne ne rend le stock négatif (V1 : interdit par défaut)
    const shortfalls = lines.filter((l) => l.units > (stock[l.productId] ?? 0))
    if (shortfalls.length > 0) {
      const names = shortfalls
        .map((l) => `• ${productById(l.productId)?.name} (reste ${stock[l.productId] ?? 0})`)
        .join('\n')
      alert(`Stock insuffisant pour :\n${names}\n\nLa sortie ne peut pas rendre le stock négatif.`)
      return false
    }
    setStock((s) => {
      const next = { ...s }
      for (const l of lines) next[l.productId] = (next[l.productId] ?? 0) - l.units
      return next
    })
    return true
  }

  function pushRecent(title: string, subtitle: string) {
    const now = new Date()
    const meta = `${formatTime(now)} · ${CURRENT_USER}`
    setRecent((r) => [{ id: now.getTime(), title, subtitle, meta }, ...r].slice(0, 6))
  }

  return (
    <AppShell
      eyebrow="Congélateur"
      title="Sortie"
      subtitle="Enregistre ce qui sort du congélo"
    >
      {/* Sélecteur de mode */}
      <div className="mt-1 grid grid-cols-2 gap-1 rounded-[14px] bg-surface-2 p-1">
        <ModeTab active={mode === 'prepa'} onClick={() => setMode('prepa')}>
          <Croissant size={16} /> Préparation
        </ModeTab>
        <ModeTab active={mode === 'single'} onClick={() => setMode('single')}>
          <PackageMinus size={16} /> Un produit
        </ModeTab>
      </div>

      {mode === 'prepa' ? (
        <PrepaMode onExit={decrement} onDone={pushRecent} />
      ) : (
        <SingleMode stock={stock} onExit={decrement} onDone={pushRecent} />
      )}

      {recent.length > 0 && (
        <>
          <div className="mx-1 mt-6 mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
            Dernières sorties
          </div>
          <div className="flex flex-col gap-1.5">
            {recent.map((r) => (
              <div key={r.id} className="rounded-xl bg-surface px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[13.5px] font-semibold">{r.title}</div>
                  <div className="tabnums flex-shrink-0 text-[11px] font-semibold text-crust-ink">
                    {r.meta}
                  </div>
                </div>
                <div className="tabnums text-[11px] text-ink-3">{r.subtitle}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  )
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-[11px] py-2.5 text-[13px] font-bold',
        active ? 'bg-crust text-white' : 'text-ink-2',
      )}
    >
      {children}
    </button>
  )
}

/* ----------------------------- Mode préparation ---------------------------- */

function PrepaMode({
  onExit,
  onDone,
}: {
  onExit: (lines: { productId: string; units: number }[]) => boolean
  onDone: (title: string, subtitle: string) => void
}) {
  const [selected, setSelected] = useState<DemoPrepa | null>(null)
  // quantités éditables de la prépa en cours (productId -> units)
  const [qties, setQties] = useState<Record<string, number>>({})

  function open(prepa: DemoPrepa) {
    setSelected(prepa)
    setQties(Object.fromEntries(prepa.lines.map((l) => [l.productId, l.units])))
  }

  if (!selected) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        {demoPrepas.map((prepa) => (
          <Card key={prepa.id} className="flex items-center gap-3" onClick={() => open(prepa)}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-crust-soft text-crust-ink">
              <Croissant size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold">{prepa.name}</div>
              <div className="text-[11px] text-ink-3">
                {prepa.time} · {prepa.lines.length} produits
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-3" />
          </Card>
        ))}
        <p className="mt-2 px-1 text-[11.5px] text-ink-3">
          Une préparation sort plusieurs produits d'un coup (four ou décongélation). Les quantités
          sont pré-remplies — tu ajustes si besoin.
        </p>
      </div>
    )
  }

  const total = Object.values(qties).reduce((s, n) => s + n, 0)

  function confirm() {
    const lines = selected!.lines
      .map((l) => ({ productId: l.productId, units: qties[l.productId] ?? 0 }))
      .filter((l) => l.units > 0)
    if (lines.length === 0) return
    if (!onExit(lines)) return
    const subtitle = lines
      .map((l) => `${shortName(l.productId)} −${l.units}`)
      .join(' · ')
    onDone(selected!.name, subtitle)
    setSelected(null)
  }

  return (
    <Card className="mt-3">
      <div className="flex items-center justify-between">
        <div className="text-[16px] font-bold">{selected.name}</div>
        <Badge tone="crust">{selected.time}</Badge>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-line">
        {selected.lines.map((l) => {
          const p = productById(l.productId)!
          const q = qties[l.productId] ?? 0
          return (
            <div key={l.productId} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{p.name}</div>
                <div className="tabnums text-[10.5px] text-ink-3">
                  {formatPacks(q, p.packSize, p.packLabel)}
                </div>
              </div>
              <div className="flex items-center overflow-hidden rounded-[11px] border border-line bg-surface-2">
                <button
                  onClick={() => setQties((s) => ({ ...s, [l.productId]: Math.max(0, q - 1) }))}
                  className="h-9 w-10 text-[18px] font-bold text-crust-ink"
                  aria-label="Moins"
                >
                  −
                </button>
                <input
                  value={q}
                  onChange={(e) =>
                    setQties((s) => ({
                      ...s,
                      [l.productId]: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  inputMode="numeric"
                  className="tabnums w-12 bg-transparent text-center text-[16px] font-extrabold text-ink"
                />
                <button
                  onClick={() => setQties((s) => ({ ...s, [l.productId]: q + 1 }))}
                  className="h-9 w-10 text-[18px] font-bold text-crust-ink"
                  aria-label="Plus"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-3">
        <span className="text-[12px] text-ink-2">Total sortie</span>
        <span className="tabnums text-[15px] font-extrabold">{total} unités</span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={() => setSelected(null)}>
          Retour
        </Button>
        <Button onClick={confirm}>
          <Check size={18} /> Sortir la prépa
        </Button>
      </div>
    </Card>
  )
}

/* ------------------------------ Mode 1 produit ----------------------------- */

function SingleMode({
  stock,
  onExit,
  onDone,
}: {
  stock: Record<string, number>
  onExit: (lines: { productId: string; units: number }[]) => boolean
  onDone: (title: string, subtitle: string) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return demoProducts
    return demoProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q),
    )
  }, [query])

  const selected = demoProducts.find((p) => p.id === selectedId) ?? null

  function confirm() {
    if (!selected) return
    if (!onExit([{ productId: selected.id, units: qty }])) return
    onDone(selected.name, `− ${qty} unités`)
    setSelectedId(null)
    setQty(1)
    setQuery('')
  }

  if (!selected) {
    return (
      <>
        <div className="relative mt-3">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un produit ou une réf…"
            className="w-full rounded-[14px] border border-line bg-surface py-3.5 pr-4 pl-11 text-[15px] text-ink placeholder:text-ink-3"
          />
        </div>
        <div className="mt-3">
          {groupByFamily(results).map((g) => (
            <section key={g.family}>
              <div className="mx-1 mt-4 mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
                {g.family}
              </div>
              <div className="flex flex-col gap-2">
                {g.items.map((p) => (
                  <Card
                    key={p.id}
                    className="flex items-center gap-3"
                    onClick={() => {
                      setSelectedId(p.id)
                      setQty(1)
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-semibold">{p.name}</div>
                      <div className="tabnums text-[11px] text-ink-3">
                        Réf {p.ref} · reste {formatPacks(stock[p.id] ?? 0, p.packSize, p.packLabel)}
                      </div>
                    </div>
                    <PackageMinus size={20} className="text-crust" />
                  </Card>
                ))}
              </div>
            </section>
          ))}
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-ink-3">
              Aucun produit ne correspond.
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <Card className="mt-3">
      <div className="text-[16px] font-bold">{selected.name}</div>
      <div className="tabnums mt-0.5 text-[12px] text-ink-2">
        En stock : {formatPacks(stock[selected.id] ?? 0, selected.packSize, selected.packLabel)}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-crust-ink"
          aria-label="Moins"
        >
          <Minus size={24} />
        </button>
        <input
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
          inputMode="numeric"
          className="tabnums w-24 bg-transparent text-center text-[40px] font-extrabold text-ink"
        />
        <button
          onClick={() => setQty((q) => q + 1)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-crust-ink"
          aria-label="Plus"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {QUICK_QTIES.map((n) => (
          <button
            key={n}
            onClick={() => setQty(n)}
            className={cn(
              'tabnums rounded-full px-4 py-2 text-[14px] font-bold',
              qty === n ? 'bg-crust text-white' : 'bg-surface-2 text-ink-2',
            )}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={() => setSelectedId(null)}>
          Annuler
        </Button>
        <Button onClick={confirm}>
          <Check size={18} /> Sortir {qty}
        </Button>
      </div>
    </Card>
  )
}

function shortName(productId: string): string {
  const n = productById(productId)?.name ?? ''
  return n.split(' ').slice(0, 2).join(' ')
}
