import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ClipboardCheck } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Badge } from '@/components/ui'
import { FamilySection } from '@/components/FamilySection'
import { services, type Product } from '@/services'
import { formatPacks } from '@/lib/format'

export function StockListPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = q
      ? products.filter(
          (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
        )
      : products
    return groupByFamily(items)
  }, [query, products])

  return (
    <AppShell eyebrow="Congélateur" title="Stock" subtitle={`${products.length} produits`}>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher…"
            className="w-full rounded-[14px] border border-line bg-surface py-3.5 pr-4 pl-11 text-[15px] text-ink placeholder:text-ink-3"
          />
        </div>
        <button
          onClick={() => navigate('/inventaire')}
          className="flex h-[52px] flex-shrink-0 items-center gap-1.5 rounded-[14px] bg-crust-soft px-3.5 text-[13px] font-bold text-crust-ink"
        >
          <ClipboardCheck size={17} /> Inventaire
        </button>
      </div>

      {isLoading && <div className="mt-8 text-center text-[13px] text-ink-3">Chargement…</div>}
      {!isLoading && groups.length === 0 && (
        <div className="mt-8 text-center text-[13px] text-ink-3">Aucun produit ne correspond.</div>
      )}

      {groups.map((g) => (
        <FamilySection key={g.family} title={g.family} count={g.items.length}>
          {g.items.map((p) => {
            const days = autonomy(p)
            const low = p.stockUnits < p.minUnits
            return (
              <Card key={p.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-semibold">{p.name}</div>
                  <div className="tabnums mt-0.5 text-[11px] text-ink-3">
                    {formatPacks(p.stockUnits, p.packSize, p.packLabel)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabnums text-[15px] font-extrabold">{p.stockUnits}</div>
                  <div className="text-[10px] text-ink-3">unités</div>
                </div>
                {low ? <Badge tone="warn">sous mini</Badge> : <Badge tone="ok">~{days} j</Badge>}
              </Card>
            )
          })}
        </FamilySection>
      ))}

      <p className="mt-6 text-center text-[11px] text-ink-3">
        Produits regroupés par famille · autonomie estimée · source : {services.source}
      </p>
    </AppShell>
  )
}

/** Regroupe par famille en respectant categoryPosition ; urgents (autonomie faible) d'abord. */
function groupByFamily(items: Product[]): { family: string; items: Product[] }[] {
  const map = new Map<string, { position: number; items: Product[] }>()
  for (const p of items) {
    const g = map.get(p.category) ?? { position: p.categoryPosition, items: [] }
    g.items.push(p)
    map.set(p.category, g)
  }
  return [...map.entries()]
    .sort((a, b) => a[1].position - b[1].position)
    .map(([family, g]) => ({
      family,
      items: [...g.items].sort((a, b) => autonomy(a) - autonomy(b)),
    }))
}

function autonomy(p: Product): number {
  const avg = p.conso.reduce((s, c) => s + c, 0) / 7
  if (avg <= 0) return 99
  return Math.floor(p.stockUnits / avg)
}
