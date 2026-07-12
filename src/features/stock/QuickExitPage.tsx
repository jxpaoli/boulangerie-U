import { useMemo, useState } from 'react'
import { Search, Check, Minus, Plus, PackageMinus } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button, Badge } from '@/components/ui'
import { demoProducts } from '@/features/demo/data'
import { formatPacks } from '@/lib/format'
import { cn } from '@/lib/cn'

interface RecentExit {
  id: number
  name: string
  qty: number
  at: Date
}

const QUICK_QTIES = [1, 2, 5, 10]

export function QuickExitPage() {
  // stock local (démo) — sera remplacé par le service de mouvements de stock
  const [stock, setStock] = useState<Record<string, number>>(() =>
    Object.fromEntries(demoProducts.map((p) => [p.id, p.stockUnits])),
  )
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [recent, setRecent] = useState<RecentExit[]>([])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return demoProducts
    return demoProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q),
    )
  }, [query])

  const selected = demoProducts.find((p) => p.id === selectedId) ?? null

  function confirmExit() {
    if (!selected) return
    const current = stock[selected.id] ?? 0
    if (qty > current) {
      // V1 : stock négatif interdit par défaut (le forçage responsable viendra avec les droits)
      alert(
        `Stock insuffisant : il ne reste que ${current} ${selected.name}.\n` +
          `La sortie ne peut pas rendre le stock négatif.`,
      )
      return
    }
    setStock((s) => ({ ...s, [selected.id]: current - qty }))
    setRecent((r) => [{ id: Date.now(), name: selected.name, qty, at: new Date() }, ...r].slice(0, 6))
    setSelectedId(null)
    setQty(1)
    setQuery('')
  }

  return (
    <AppShell
      eyebrow="Congélateur"
      title="Sortie rapide"
      subtitle="Enregistre ce qui sort du congélo"
    >
      {/* Recherche */}
      <div className="relative mt-1">
        <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un produit ou une réf…"
          className="w-full rounded-[14px] border border-line bg-surface py-3.5 pr-4 pl-11 text-[15px] text-ink placeholder:text-ink-3"
        />
      </div>

      {!selected ? (
        <div className="mt-3 flex flex-col gap-2">
          {results.map((p) => (
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
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-ink-3">
              Aucun produit ne correspond.
            </div>
          )}
        </div>
      ) : (
        /* Panneau quantité */
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
            <Button onClick={confirmExit}>
              <Check size={18} /> Sortir {qty}
            </Button>
          </div>
        </Card>
      )}

      {/* Dernières sorties */}
      {recent.length > 0 && (
        <>
          <div className="mx-1 mt-6 mb-2 text-[11px] font-bold tracking-[0.12em] text-ink-3 uppercase">
            Dernières sorties
          </div>
          <div className="flex flex-col gap-1.5">
            {recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-surface px-3.5 py-2.5"
              >
                <span className="text-[13.5px]">{r.name}</span>
                <Badge tone="crust">− {r.qty}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  )
}
