import { useMemo, useState, type ReactNode } from 'react'
import {
  Search,
  Check,
  Minus,
  Plus,
  PackageMinus,
  Croissant,
  Layers,
  ChevronRight,
  Save,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button, Badge } from '@/components/ui'
import {
  demoProducts,
  demoPrepas,
  productById,
  groupByFamily,
  type DemoPrepa,
} from '@/features/demo/data'
import { formatPacks, formatTime, plural } from '@/lib/format'
import { cn } from '@/lib/cn'

const CURRENT_USER = 'Sabrina'

interface RecentEntry {
  id: number
  title: string
  subtitle: string
  meta: string
}

type Mode = 'standard' | 'new' | 'single'
const QUICK_QTIES = [1, 2, 5, 10]

interface Line {
  productId: string
  units: number
}

export function QuickExitPage() {
  const [stock, setStock] = useState<Record<string, number>>(() =>
    Object.fromEntries(demoProducts.map((p) => [p.id, p.stockUnits])),
  )
  const [mode, setMode] = useState<Mode>('standard')
  const [recent, setRecent] = useState<RecentEntry[]>([])
  const [customPrepas, setCustomPrepas] = useState<DemoPrepa[]>([])

  function decrement(lines: Line[]): boolean {
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
    <AppShell eyebrow="Congélateur" title="Sortie" subtitle="Enregistre ce qui sort du congélo">
      <div className="mt-1 grid grid-cols-3 gap-1 rounded-[14px] bg-surface-2 p-1">
        <ModeTab active={mode === 'standard'} onClick={() => setMode('standard')}>
          <Croissant size={15} /> Prépa standard
        </ModeTab>
        <ModeTab active={mode === 'new'} onClick={() => setMode('new')}>
          <Layers size={15} /> Prépa new
        </ModeTab>
        <ModeTab active={mode === 'single'} onClick={() => setMode('single')}>
          <PackageMinus size={15} /> Unités
        </ModeTab>
      </div>

      {mode === 'standard' && (
        <PrepaMode prepas={[...demoPrepas, ...customPrepas]} onExit={decrement} onDone={pushRecent} />
      )}
      {mode === 'new' && (
        <NewLotMode
          stock={stock}
          onExit={decrement}
          onDone={pushRecent}
          onSaveStandard={(prepa) => setCustomPrepas((c) => [...c, prepa])}
        />
      )}
      {mode === 'single' && <SingleMode stock={stock} onExit={decrement} onDone={pushRecent} />}

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
        'flex items-center justify-center gap-1 rounded-[11px] px-1 py-2.5 text-[12px] font-bold',
        active ? 'bg-crust text-white' : 'text-ink-2',
      )}
    >
      {children}
    </button>
  )
}

/* -------------------------- Mode prépa standard --------------------------- */

function PrepaMode({
  prepas,
  onExit,
  onDone,
}: {
  prepas: DemoPrepa[]
  onExit: (lines: Line[]) => boolean
  onDone: (title: string, subtitle: string) => void
}) {
  const [selected, setSelected] = useState<DemoPrepa | null>(null)
  const [qties, setQties] = useState<Record<string, number>>({})

  function open(prepa: DemoPrepa) {
    setSelected(prepa)
    setQties(Object.fromEntries(prepa.lines.map((l) => [l.productId, l.units])))
  }

  if (!selected) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        {prepas.map((prepa) => (
          <Card key={prepa.id} className="flex items-center gap-3" onClick={() => open(prepa)}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-crust-soft text-crust-ink">
              <Croissant size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-semibold">{prepa.name}</div>
              <div className="text-[11px] text-ink-3">
                {prepa.time ? `${prepa.time} · ` : ''}
                {prepa.lines.length} produits
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-3" />
          </Card>
        ))}
        <p className="mt-2 px-1 text-[11.5px] text-ink-3">
          Une préparation standard sort ton lot habituel d'un coup. Quantités pré-remplies,
          ajustables.
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
    onDone(selected!.name, lines.map((l) => `${shortName(l.productId)} −${l.units}`).join(' · '))
    setSelected(null)
  }

  return (
    <Card className="mt-3">
      <div className="flex items-center justify-between">
        <div className="text-[16px] font-bold">{selected.name}</div>
        {selected.time && <Badge tone="crust">{selected.time}</Badge>}
      </div>
      <div className="mt-3 flex flex-col divide-y divide-line">
        {selected.lines.map((l) => {
          const p = productById(l.productId)!
          const q = qties[l.productId] ?? 0
          return (
            <LineStepper
              key={l.productId}
              label={p.name}
              sub={formatPacks(q, p.packSize, p.packLabel)}
              value={q}
              onChange={(n) => setQties((s) => ({ ...s, [l.productId]: n }))}
            />
          )
        })}
      </div>
      <TotalRow total={total} />
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

/* ----------------------------- Mode prépa new ----------------------------- */

function NewLotMode({
  stock,
  onExit,
  onDone,
  onSaveStandard,
}: {
  stock: Record<string, number>
  onExit: (lines: Line[]) => boolean
  onDone: (title: string, subtitle: string) => void
  onSaveStandard: (prepa: DemoPrepa) => void
}) {
  const [query, setQuery] = useState('')
  const [lot, setLot] = useState<Record<string, number>>({}) // en unités
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q
      ? demoProducts.filter(
          (p) => p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q),
        )
      : demoProducts
  }, [query])

  const chosen = demoProducts.filter((p) => (lot[p.id] ?? 0) > 0)

  function addOne(id: string, packSize: number) {
    setLot((l) => ({ ...l, [id]: (l[id] ?? 0) + packSize }))
  }
  function setUnits(id: string, units: number) {
    setLot((l) => ({ ...l, [id]: Math.max(0, units) }))
  }

  function sortir() {
    const lines = chosen.map((p) => ({ productId: p.id, units: lot[p.id] ?? 0 }))
    if (lines.length === 0) return
    if (!onExit(lines)) return
    onDone('Lot', lines.map((l) => `${shortName(l.productId)} −${l.units}`).join(' · '))
    setLot({})
    setSaveOpen(false)
    setSaveName('')
  }

  function save() {
    if (!saveName.trim()) return
    onSaveStandard({
      id: `custom-${new Date().getTime()}`,
      name: saveName.trim(),
      time: '',
      lines: chosen.map((p) => ({ productId: p.id, units: lot[p.id] ?? 0 })),
    })
    setSaveOpen(false)
    setSaveName('')
  }

  return (
    <>
      {chosen.length > 0 && (
        <Card className="mt-3">
          <div className="text-[13px] font-bold text-ink-2">Lot en cours</div>
          <div className="mt-2 flex flex-col divide-y divide-line">
            {chosen.map((p) => (
              <LineStepper
                key={p.id}
                label={p.name}
                sub={formatPacks(lot[p.id] ?? 0, p.packSize, p.packLabel)}
                value={lot[p.id] ?? 0}
                step={p.packSize}
                onChange={(n) => setUnits(p.id, n)}
              />
            ))}
          </div>
          <TotalRow total={chosen.reduce((s, p) => s + (lot[p.id] ?? 0), 0)} />
          <Button className="mt-3 w-full" onClick={sortir}>
            <Check size={18} /> Sortir le lot ({chosen.length})
          </Button>
          {!saveOpen ? (
            <button
              onClick={() => setSaveOpen(true)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-ink-2"
            >
              <Save size={14} /> Enregistrer comme prépa standard
            </button>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nom (ex. « Prépa goûter »)"
                className="min-w-0 flex-1 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px]"
              />
              <Button variant="soft" onClick={save}>
                OK
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="relative mt-3">
        <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ajouter un produit au lot…"
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
              {g.items.map((p) => {
                const inLot = (lot[p.id] ?? 0) > 0
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-[var(--radius-app)] border border-line bg-surface p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">{p.name}</div>
                      <div className="tabnums text-[11px] text-ink-3">
                        reste {formatPacks(stock[p.id] ?? 0, p.packSize, p.packLabel)}
                      </div>
                    </div>
                    {inLot ? (
                      <Badge tone="crust">
                        {formatPacks(lot[p.id] ?? 0, p.packSize, p.packLabel)}
                      </Badge>
                    ) : (
                      <button
                        onClick={() => addOne(p.id, p.packSize)}
                        className="flex h-9 items-center gap-1 rounded-[11px] bg-crust-soft px-3 text-[13px] font-bold text-crust-ink"
                      >
                        <Plus size={15} /> Ajouter
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

/* ------------------------------ Mode unités ------------------------------- */

function SingleMode({
  stock,
  onExit,
  onDone,
}: {
  stock: Record<string, number>
  onExit: (lines: Line[]) => boolean
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
    onDone(selected.name, `− ${qty} ${plural('unité', qty)}`)
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

/* -------------------------------- partagés -------------------------------- */

function LineStepper({
  label,
  sub,
  value,
  step = 1,
  onChange,
}: {
  label: string
  sub: string
  value: number
  step?: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold">{label}</div>
        <div className="tabnums text-[10.5px] text-ink-3">{sub}</div>
      </div>
      <div className="flex items-center overflow-hidden rounded-[11px] border border-line bg-surface-2">
        <button
          onClick={() => onChange(Math.max(0, value - step))}
          className="flex h-9 w-10 items-center justify-center text-crust-ink"
          aria-label="Moins"
        >
          <Minus size={16} />
        </button>
        <div className="tabnums w-10 text-center text-[15px] font-extrabold">{value}</div>
        <button
          onClick={() => onChange(value + step)}
          className="flex h-9 w-10 items-center justify-center text-crust-ink"
          aria-label="Plus"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

function TotalRow({ total }: { total: number }) {
  return (
    <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-3">
      <span className="text-[12px] text-ink-2">Total sortie</span>
      <span className="tabnums text-[15px] font-extrabold">{total} unités</span>
    </div>
  )
}

function shortName(productId: string): string {
  const n = productById(productId)?.name ?? ''
  return n.split(' ').slice(0, 2).join(' ')
}
