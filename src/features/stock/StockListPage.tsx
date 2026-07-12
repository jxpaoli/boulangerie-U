import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Badge } from '@/components/ui'
import { demoProducts } from '@/features/demo/data'
import { formatPacks, WEEKDAYS_SHORT } from '@/lib/format'

export function StockListPage() {
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = q
      ? demoProducts.filter(
          (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
        )
      : demoProducts
    return [...items].sort((a, b) => autonomy(a) - autonomy(b))
  }, [query])

  return (
    <AppShell eyebrow="Congélateur" title="Stock" subtitle={`${demoProducts.length} produits`}>
      <div className="relative mt-1">
        <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher…"
          className="w-full rounded-[14px] border border-line bg-surface py-3.5 pr-4 pl-11 text-[15px] text-ink placeholder:text-ink-3"
        />
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {list.map((p) => {
          const days = autonomy(p)
          const low = p.stockUnits < p.minUnits
          return (
            <Card key={p.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold">{p.name}</div>
                <div className="tabnums mt-0.5 text-[11px] text-ink-3">
                  {p.category} · {formatPacks(p.stockUnits, p.packSize, p.packLabel)}
                </div>
              </div>
              <div className="text-right">
                <div className="tabnums text-[15px] font-extrabold">{p.stockUnits}</div>
                <div className="text-[10px] text-ink-3">unités</div>
              </div>
              {low ? (
                <Badge tone="warn">sous mini</Badge>
              ) : (
                <Badge tone="ok">~{days} j</Badge>
              )}
            </Card>
          )
        })}
      </div>
      <p className="mt-6 text-center text-[11px] text-ink-3">
        Autonomie estimée à partir de la conso {WEEKDAYS_SHORT.join('/')} · données de démo
      </p>
    </AppShell>
  )
}

/** Nombre de jours avant rupture au rythme de conso moyen (approx. démo). */
function autonomy(p: { stockUnits: number; conso: number[] }): number {
  const avg = p.conso.reduce((s, c) => s + c, 0) / 7
  if (avg <= 0) return 99
  return Math.floor(p.stockUnits / avg)
}
