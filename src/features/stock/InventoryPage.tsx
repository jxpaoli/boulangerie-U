import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, ChevronLeft, Check } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button, Badge } from '@/components/ui'
import { FamilySection } from '@/components/FamilySection'
import { services, type Product } from '@/services'
import { formatPacks } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'

export function InventoryPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })

  // quantités comptées, pré-remplies avec le théorique
  const [counted, setCounted] = useState<Record<string, number>>({})
  const [done, setDone] = useState(false)

  const countOf = (p: Product) => counted[p.id] ?? p.stockUnits
  const groups = useMemo(() => groupByFamily(products), [products])
  const changed = products.filter((p) => countOf(p) !== p.stockUnits)

  async function validate() {
    await services.stock.recordInventory(
      'full',
      products.map((p) => ({ productId: p.id, countedUnits: countOf(p) })),
    )
    await qc.invalidateQueries({ queryKey: ['products'] })
    setDone(true)
  }

  if (done) {
    return (
      <AppShell eyebrow="Inventaire" title="Stock recalé">
        <Card className="mt-2 flex flex-col items-center py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-soft text-ok">
            <ClipboardCheck size={30} />
          </div>
          <div className="mt-4 text-[15px] font-bold">
            {changed.length === 0 ? 'Aucun écart' : `${changed.length} correction(s) enregistrée(s)`}
          </div>
          <p className="mt-2 px-4 text-[12px] text-ink-2">
            Le stock théorique est aligné sur ce que tu as compté. Les écarts sont tracés (rien
            n'est écrasé).
          </p>
        </Card>
        <Button className="mt-3 w-full" onClick={() => navigate('/stock')}>
          Voir le stock
        </Button>
      </AppShell>
    )
  }

  if (user?.role !== 'responsable') {
    return (
      <AppShell eyebrow="Inventaire" title="Inventaire">
        <Card className="mt-4 text-center text-[13px] text-ink-2">
          L'inventaire (recalage du stock) est réservé au <b>responsable</b>.
        </Card>
        <Button variant="ghost" className="mt-3 w-full" onClick={() => navigate('/stock')}>
          <ChevronLeft size={18} /> Retour au stock
        </Button>
      </AppShell>
    )
  }

  return (
    <AppShell eyebrow="Inventaire" title="Compter le stock" subtitle="Saisis ce que tu comptes vraiment">
      {groups.map((g) => (
        <FamilySection key={g.family} title={g.family} count={g.items.length}>
          {g.items.map((p) => {
            const c = countOf(p)
            const gap = c - p.stockUnits
            return (
              <Card key={p.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{p.name}</div>
                  <div className="tabnums text-[11px] text-ink-3">
                    théorique {p.stockUnits} · {formatPacks(p.stockUnits, p.packSize, p.packLabel)}
                  </div>
                </div>
                {gap !== 0 && (
                  <Badge tone={gap < 0 ? 'warn' : 'crust'}>{gap > 0 ? `+${gap}` : gap}</Badge>
                )}
                <input
                  value={c}
                  onChange={(e) =>
                    setCounted((s) => ({ ...s, [p.id]: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  inputMode="numeric"
                  className="tabnums w-16 rounded-[10px] border border-line bg-surface-2 py-2 text-center text-[16px] font-extrabold text-ink"
                />
              </Card>
            )
          })}
        </FamilySection>
      ))}

      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={() => navigate('/stock')}>
          Annuler
        </Button>
        <Button onClick={validate}>
          <Check size={18} /> Valider l'inventaire{changed.length > 0 ? ` (${changed.length})` : ''}
        </Button>
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-3">
        On ne jette rien : chaque écart devient une correction tracée.
      </p>
    </AppShell>
  )
}

function groupByFamily(items: Product[]): { family: string; items: Product[] }[] {
  const map = new Map<string, { position: number; items: Product[] }>()
  for (const p of items) {
    const g = map.get(p.category) ?? { position: p.categoryPosition, items: [] }
    g.items.push(p)
    map.set(p.category, g)
  }
  return [...map.entries()]
    .sort((a, b) => a[1].position - b[1].position)
    .map(([family, g]) => ({ family, items: g.items }))
}
