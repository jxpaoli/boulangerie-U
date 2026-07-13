import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Minus, Plus, Check, ClipboardCheck, FileDown, Printer, Flag } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button, Badge } from '@/components/ui'
import { FamilySection } from '@/components/FamilySection'
import { services, type Product, type CountLine } from '@/services'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatDate } from '@/lib/format'

export function InventoryPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

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

  const rows = () =>
    products.map((p) => {
      const l = lineOf[p.id]
      return {
        name: p.name,
        theo: p.stockUnits,
        counted: l ? l.countedUnits : '',
        gap: l ? l.countedUnits - p.stockUnits : '',
        by: l?.validatedBy ? (members[l.validatedBy] ?? '') : '',
      }
    })

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

  const canFinish = user?.role === 'responsable'

  return (
    <AppShell
      eyebrow="Inventaire"
      title="Comptage en cours"
      subtitle={`${nbValidated}/${products.length} produits validés`}
    >
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => exportCSV(rows())}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-surface-2 py-2.5 text-[13px] font-bold text-ink-2"
        >
          <FileDown size={16} /> Excel (CSV)
        </button>
        <button
          onClick={() => printPDF(rows())}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-surface-2 py-2.5 text-[13px] font-bold text-ink-2"
        >
          <Printer size={16} /> PDF
        </button>
      </div>
      <p className="mt-2 px-1 text-[11px] text-ink-3">
        À plusieurs : chaque validation apparaît en direct sur tous les écrans.
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
        {canFinish ? (
          <Button
            className="w-full"
            onClick={() => {
              if (confirm(`Clôturer l'inventaire ? Le stock sera recalé sur le comptage.`))
                finish.mutate()
            }}
            disabled={finish.isPending}
          >
            <Flag size={18} /> Terminer l'inventaire ({nbValidated})
          </Button>
        ) : (
          <p className="text-center text-[12px] text-ink-3">
            La clôture de l'inventaire est réservée au responsable.
          </p>
        )}
      </div>
    </AppShell>
  )
}

/* --------------------------------- helpers -------------------------------- */

type Row = { name: string; theo: number; counted: number | string; gap: number | string; by: string }

function exportCSV(rows: Row[]) {
  const head = ['Produit', 'Théorique', 'Compté', 'Écart', 'Validé par']
  const body = rows.map((r) => [r.name, r.theo, r.counted, r.gap, r.by])
  const csv = [head, ...body]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventaire-${formatDate(new Date()).replace(/\//g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function printPDF(rows: Row[]) {
  const trs = rows
    .map(
      (r) =>
        `<tr><td>${r.name}</td><td style="text-align:right">${r.theo}</td><td style="text-align:right">${r.counted}</td><td style="text-align:right">${r.gap}</td><td>${r.by}</td></tr>`,
    )
    .join('')
  const html = `<html><head><meta charset="utf-8"><title>Inventaire</title>
    <style>body{font-family:sans-serif;padding:24px}h1{font-size:18px}
    table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3ece1}</style>
    </head><body><h1>Inventaire — ${formatDate(new Date())}</h1>
    <table><thead><tr><th>Produit</th><th>Théorique</th><th>Compté</th><th>Écart</th><th>Validé par</th></tr></thead>
    <tbody>${trs}</tbody></table></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
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
