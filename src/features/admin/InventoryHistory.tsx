import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ClipboardCheck, FileDown, Printer } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card } from '@/components/ui'
import { services, type CountLine, type Product } from '@/services'
import { formatDate, formatTime } from '@/lib/format'

interface Row {
  name: string
  theo: number
  counted: number
  gap: number
  by: string
}

export function InventoryHistory() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string | null>(null)

  const { data: past = [] } = useQuery({
    queryKey: ['inventories-past'],
    queryFn: () => services.inventory.listPast(),
  })
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })
  const { data: members = {} } = useQuery({
    queryKey: ['inv-members'],
    queryFn: () => services.inventory.members(),
  })
  const { data: lines = [] } = useQuery({
    queryKey: ['count-lines', selected],
    queryFn: () => services.inventory.listLines(selected!),
    enabled: !!selected,
  })

  const byId = useMemo(() => {
    const m: Record<string, Product> = {}
    for (const p of products) m[p.id] = p
    return m
  }, [products])

  const rows: Row[] = useMemo(
    () =>
      lines.map((l: CountLine) => {
        const p = byId[l.productId]
        const theo = l.theoreticalUnits ?? p?.stockUnits ?? 0
        return {
          name: p?.name ?? l.productId,
          theo,
          counted: l.countedUnits,
          gap: l.countedUnits - theo,
          by: l.validatedBy ? (members[l.validatedBy] ?? '') : '',
        }
      }),
    [lines, byId, members],
  )

  const label = (r: { validatedAt: string | null; validatedBy: string | null }) => {
    const d = r.validatedAt ? new Date(r.validatedAt) : null
    const who = r.validatedBy ? (members[r.validatedBy] ?? '') : ''
    return { date: d ? `${formatDate(d)} · ${formatTime(d)}` : '—', who }
  }

  if (selected) {
    const rec = past.find((p) => p.id === selected)
    const info = rec ? label(rec) : { date: '—', who: '' }
    return (
      <AppShell eyebrow="Inventaire" title="Inventaire" subtitle={info.date}>
        <button
          onClick={() => setSelected(null)}
          className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-ink-2"
        >
          <ChevronLeft size={15} /> Historique
        </button>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => exportCSV(rows, info.date)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-crust-soft py-2.5 text-[13px] font-bold text-crust-ink"
          >
            <FileDown size={16} /> Excel (CSV)
          </button>
          <button
            onClick={() => printPDF(rows, info.date)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-crust-soft py-2.5 text-[13px] font-bold text-crust-ink"
          >
            <Printer size={16} /> PDF
          </button>
        </div>

        <div className="mt-3 overflow-x-auto rounded-[var(--radius-app)] border border-line">
          <table className="tabnums w-full text-[12px]">
            <thead>
              <tr className="bg-surface-2 text-ink-3">
                <th className="p-2 text-left font-bold">Produit</th>
                <th className="p-2 text-right font-bold">Théo.</th>
                <th className="p-2 text-right font-bold">Compté</th>
                <th className="p-2 text-right font-bold">Écart</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-right">{r.theo}</td>
                  <td className="p-2 text-right font-semibold">{r.counted}</td>
                  <td
                    className={
                      'p-2 text-right font-semibold ' +
                      (r.gap < 0 ? 'text-warn' : r.gap > 0 ? 'text-crust-ink' : 'text-ink-3')
                    }
                  >
                    {r.gap > 0 ? `+${r.gap}` : r.gap}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell eyebrow="Paramètres" title="Historique des inventaires">
      <button
        onClick={() => navigate('/parametres')}
        className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-ink-2"
      >
        <ChevronLeft size={15} /> Paramètres
      </button>

      {past.length === 0 ? (
        <div className="mt-8 text-center text-[13px] text-ink-3">
          Aucun inventaire clôturé pour l'instant.
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {past.map((rec) => {
            const info = label(rec)
            return (
              <Card
                key={rec.id}
                className="flex items-center gap-3"
                onClick={() => setSelected(rec.id)}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-crust-soft text-crust-ink">
                  <ClipboardCheck size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">{info.date}</div>
                  {info.who && <div className="text-[11px] text-ink-3">clôturé par {info.who}</div>}
                </div>
                <ChevronRight size={18} className="text-ink-3" />
              </Card>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

function exportCSV(rows: Row[], when: string) {
  const head = ['Produit', 'Théorique', 'Compté', 'Écart', 'Validé par']
  const body = rows.map((r) => [r.name, r.theo, r.counted, r.gap, r.by])
  const csv = [head, ...body]
    .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventaire-${when.replace(/[^\d]/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function printPDF(rows: Row[], when: string) {
  const trs = rows
    .map(
      (r) =>
        `<tr><td>${r.name}</td><td style="text-align:right">${r.theo}</td><td style="text-align:right">${r.counted}</td><td style="text-align:right">${r.gap}</td><td>${r.by}</td></tr>`,
    )
    .join('')
  const html = `<html><head><meta charset="utf-8"><title>Inventaire ${when}</title>
    <style>body{font-family:sans-serif;padding:24px}h1{font-size:18px}
    table{border-collapse:collapse;width:100%;font-size:12px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3ece1}</style>
    </head><body><h1>Inventaire — ${when}</h1>
    <table><thead><tr><th>Produit</th><th>Théorique</th><th>Compté</th><th>Écart</th><th>Validé par</th></tr></thead>
    <tbody>${trs}</tbody></table></body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}
