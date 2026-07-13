import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, Search } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { FamilySection } from '@/components/FamilySection'
import { services, type Product } from '@/services'

export function StockListPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const items = normalizedQuery
      ? products.filter(
          (product) =>
            product.name.toLowerCase().includes(normalizedQuery) ||
            product.category.toLowerCase().includes(normalizedQuery),
        )
      : products
    return groupByFamily(items)
  }, [query, products])

  return (
    <AppShell eyebrow="Congélateur" title="Stock" subtitle={`${products.length} produits`}>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher…"
            className="h-11 w-full rounded-[14px] border border-line bg-surface pr-4 pl-10 text-[13px] text-ink placeholder:text-ink-3"
          />
        </div>
        <button
          onClick={() => navigate('/inventaire')}
          className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-[14px] bg-crust-soft px-3 text-[11px] font-black text-crust-ink"
        >
          <ClipboardCheck size={16} /> Inventaire
        </button>
      </div>

      {isLoading && (
        <div className="mt-8 text-center text-[13px] text-ink-3">Chargement…</div>
      )}
      {!isLoading && groups.length === 0 && (
        <div className="mt-8 text-center text-[13px] text-ink-3">
          Aucun produit ne correspond.
        </div>
      )}

      {groups.map((group) => (
        <FamilySection
          compact
          key={group.family}
          title={group.family}
          count={group.items.length}
        >
          {group.items.map((product) => {
            const days = autonomy(product)
            const low = product.stockUnits < product.minUnits
            return (
              <div key={product.id} className="flex h-11 items-center gap-2.5 px-3">
                <div className="min-w-0 flex-1 truncate text-[12.5px] font-bold">
                  {product.name}
                </div>
                <div
                  className={
                    low
                      ? 'tabnums w-[58px] text-right text-[12px] font-black text-warn'
                      : 'tabnums w-[58px] text-right text-[12px] font-black text-ink'
                  }
                >
                  {product.stockUnits} u.
                </div>
                <div
                  className={
                    low
                      ? 'tabnums w-[45px] text-right text-[11px] font-black text-warn'
                      : 'tabnums w-[45px] text-right text-[11px] font-bold text-ink-2'
                  }
                >
                  {days >= 99 ? '99+ j' : `~${days} j`}
                </div>
              </div>
            )
          })}
        </FamilySection>
      ))}
    </AppShell>
  )
}

function groupByFamily(items: Product[]): { family: string; items: Product[] }[] {
  const groups = new Map<string, { position: number; items: Product[] }>()
  for (const product of items) {
    const group = groups.get(product.category) ?? {
      position: product.categoryPosition,
      items: [],
    }
    group.items.push(product)
    groups.set(product.category, group)
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].position - b[1].position)
    .map(([family, group]) => ({
      family,
      items: [...group.items].sort((a, b) => autonomy(a) - autonomy(b)),
    }))
}

function autonomy(product: Product): number {
  const average = product.conso.reduce((sum, consumption) => sum + consumption, 0) / 7
  if (average <= 0) return 99
  return Math.floor(product.stockUnits / average)
}
