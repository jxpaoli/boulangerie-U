import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Minus, Plus, Check, ClipboardCheck, Flag } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button, Badge } from '@/components/ui'
import { FamilySection } from '@/components/FamilySection'
import { services, type Product, type CountLine } from '@/services'

export function InventoryPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: countId } = useQuery({
    queryKey: ['inventory-open'],
    queryFn: () => services.inventory.open(),
  })
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })
  const { data: lines = [] } = useQuery({
    queryKey: ['count-lines', countId],
    queryFn: () => services.inventory.listLines(countId!),
    enabled: !!countId,
  })
  const { data: members = {} } = useQuery({
    queryKey: ['inv-members'],
    queryFn: () => services.inventory.members(),
  })

  // synchro temps réel : à chaque validation (par n'importe qui), on rafraîchit
  useEffect(() => {
    if (!countId) return
    const unsub = services.inventory.subscribe(countId, () => {
      void qc.invalidateQueries({ queryKey: ['count-lines', countId] })
    })
    return unsub
  }, [countId, qc])

  const lineOf = useMemo(() => {
    const m: Record<string, CountLine> = {}
    for (const l of lines) m[l.productId] = l
    return m
  }, [lines])

  const [draft, setDraft] = useState<Record<string, number>>({})
  const [finished, setFinished] = useState(false)

  const counted = (p: Product) => draft[p.id] ?? lineOf[p.id]?.countedUnits ?? p.stockUnits

  const validate = useMutation({
    mutationFn: (p: Product) => services.inventory.validateLine(countId!, p.id, counted(p)),
    onSuccess: (_r, p) => {
      setDraft((d) => {
        const n = { ...d }
        delete n[p.id]
        return n
      })
      void qc.invalidateQueries({ queryKey: ['count-lines', countId] })
    },
  })
  const finish = useMutation({
    mutationFn: () => services.inventory.finish(countId!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['products'] })
      setFinished(true)
    },
  })

  const groups = useMemo(() => groupByFamily(products), [products])
  const nbValidated = lines.length

  if (finished) {
    return (
      <AppShell eyebrow="Inventaire" title="Inventaire clôturé">
        <Card className="mt-2 flex flex-col items-center py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-soft text-ok">
            <ClipboardCheck size={30} />
          </div>
          <div className="mt-4 text-[15px] font-bold">Stock recalé sur le comptage</div>
          <p className="mt-2 px-4 text-[12px] text-ink-2">
            {nbValidated} produit(s) validé(s). Les écarts sont devenus des corrections tracées
            (rien n'est écrasé).
          </p>
        </Card>
        <Button className="mt-3 w-full" onClick={() => navigate('/stock')}>
          Voir le stock
        </Button>
      </AppShell>
    )
  }

  return (
    <AppShell
      eyebrow="Inventaire"
      title="Comptage en cours"
      subtitle={`${nbValidated}/${products.length} produits validés`}
    >
      <p className="mt-1 px-1 text-[11.5px] text-ink-3">
        À plusieurs : chaque validation apparaît en direct sur tous les écrans. L'export se fait
        dans Paramètres → Historique des inventaires, une fois clôturé.
      </p>

      {groups.map((g) => (
        <FamilySection key={g.family} title={g.family} count={g.items.length}>
          {g.items.map((p) => {
            const l = lineOf[p.id]
            const val = counted(p)
            const gap = val - p.stockUnits
            return (
              <Card key={p.id}>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold">{p.name}</div>
                    <div className="tabnums text-[11px] text-ink-3">
                      théorique {p.stockUnits}
                      {gap !== 0 && (
                        <span className={gap < 0 ? 'text-warn' : 'text-crust-ink'}>
                          {' '}
                          · écart {gap > 0 ? `+${gap}` : gap}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center overflow-hidden rounded-[11px] border border-line bg-surface-2">
                    <button
                      onClick={() => setDraft((d) => ({ ...d, [p.id]: Math.max(0, val - 1) }))}
                      className="flex h-9 w-9 items-center justify-center text-crust-ink"
                      aria-label="Moins"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      value={val}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [p.id]: Math.max(0, parseInt(e.target.value) || 0) }))
                      }
                      inputMode="numeric"
                      className="tabnums w-12 bg-transparent text-center text-[16px] font-extrabold text-ink"
                    />
                    <button
                      onClick={() => setDraft((d) => ({ ...d, [p.id]: val + 1 }))}
                      className="flex h-9 w-9 items-center justify-center text-crust-ink"
                      aria-label="Plus"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {l ? (
                    <Badge tone="ok">
                      ✓ validé{l.validatedBy ? ` · ${members[l.validatedBy] ?? ''}` : ''}
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-ink-3">non compté</span>
                  )}
                  <button
                    onClick={() => validate.mutate(p)}
                    className={
                      'flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold ' +
                      (l ? 'bg-surface-2 text-ink-2' : 'bg-crust text-white')
                    }
                  >
                    <Check size={14} /> {l ? 'Revalider' : 'Valider'}
                  </button>
                </div>
              </Card>
            )
          })}
        </FamilySection>
      ))}

      <div className="mt-5">
        <Button
          className="w-full"
          onClick={() => {
            if (confirm(`Clôturer l'inventaire ? Le stock sera recalé sur le comptage.`))
              finish.mutate()
          }}
          disabled={finish.isPending || nbValidated === 0}
        >
          <Flag size={18} /> Terminer l'inventaire ({nbValidated})
        </Button>
      </div>
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
