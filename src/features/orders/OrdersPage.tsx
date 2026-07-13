import { useMemo, useState } from 'react'
import { Phone, ChevronRight, AlertTriangle, Info, Copy, Check, Minus, Plus } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import {
  demoSuppliers,
  productsOfSupplier,
  DEMO_NOW,
  type DemoSupplier,
  type DemoProduct,
} from '@/features/demo/data'
import { supplierPlan, coverageEnd, toParisCivil, civilToDate } from '@/lib/orderCalendar'
import { computeOrderProposal, type OrderProposal } from '@/lib/orderProposal'
import { formatPacks, formatDayLong, plural } from '@/lib/format'

const SAFETY_DELIVERIES = 1 // filet « +1 livraison » (réglable plus tard)

interface Line {
  product: DemoProduct
  proposal: OrderProposal
}

interface BuiltOrder {
  d1Label: string
  covLabel: string
  cutoff: string
  lines: Line[]
}

function buildOrder(supplier: DemoSupplier): BuiltOrder {
  const now = toParisCivil(DEMO_NOW)
  const plan = supplierPlan(supplier.calendar, DEMO_NOW)
  const cov = coverageEnd(supplier.calendar, DEMO_NOW, SAFETY_DELIVERIES)
  const lines = productsOfSupplier(supplier.id)
    .map((product) => ({
      product,
      proposal: computeOrderProposal(
        {
          stockUnits: product.stockUnits,
          conso7: product.conso,
          packSize: product.packSize,
          maxStockUnits: product.maxUnits,
        },
        now,
        plan.d1,
        cov,
      ),
    }))
    .filter((l) => l.proposal.packs > 0 || l.proposal.ruptureBeforeDelivery)
  return {
    d1Label: cap(formatDayLong(civilToDate(plan.d1))),
    covLabel: cap(formatDayLong(civilToDate(cov))),
    cutoff: plan.cutoff,
    lines,
  }
}

export function OrdersPage() {
  const [selected, setSelected] = useState<DemoSupplier | null>(null)
  const dueSuppliers = useMemo(() => demoSuppliers.filter((s) => s.dueToday), [])

  if (selected) return <SupplierOrder supplier={selected} onBack={() => setSelected(null)} />

  return (
    <AppShell eyebrow="Commande" title="Commandes du jour" subtitle="Vendredi 10 juillet">
      <div className="mt-2 flex flex-col gap-2">
        {dueSuppliers.map((s) => {
          const order = buildOrder(s)
          const hasRisk = order.lines.some((l) => l.proposal.ruptureBeforeDelivery)
          return (
            <Card key={s.id} className="flex items-center gap-3" onClick={() => setSelected(s)}>
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-crust-soft text-[16px] font-extrabold text-crust-ink">
                {s.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{s.name}</div>
                <div className="tabnums text-[11.5px] text-ink-2">
                  Avant {order.cutoff} · livraison {order.d1Label}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasRisk && <AlertTriangle size={16} className="text-warn" />}
                <Badge tone="crust">
                  {order.lines.length} réf{order.lines.length > 1 ? 's' : ''}.
                </Badge>
                <ChevronRight size={18} className="text-ink-3" />
              </div>
            </Card>
          )
        })}
      </div>
      <p className="mt-4 px-1 text-[11.5px] text-ink-3">
        Quantités calculées pour couvrir jusqu'à la livraison d'après la prochaine (filet +1
        livraison), plafonnées par la place au congélo. Données de démo.
      </p>
    </AppShell>
  )
}

function SupplierOrder({ supplier, onBack }: { supplier: DemoSupplier; onBack: () => void }) {
  const order = useMemo(() => buildOrder(supplier), [supplier])
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(order.lines.map((l) => [l.product.id, l.proposal.packs])),
  )
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)

  const totalUnits = order.lines.reduce(
    (s, l) => s + (qty[l.product.id] ?? 0) * l.product.packSize,
    0,
  )

  if (sent) {
    return (
      <ExportView
        supplier={supplier}
        order={order}
        qty={qty}
        notes={notes}
        onBack={() => setSent(false)}
      />
    )
  }

  return (
    <AppShell eyebrow="Commande" title={supplier.name} subtitle={`Couvrir jusqu'à ${order.covLabel}`}>
      <Card className="mt-1 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="tabnums text-[13px] font-semibold">{supplier.phone}</div>
          <div className="text-[11px] text-ink-2">
            Commander avant {order.cutoff} · livraison {order.d1Label}
          </div>
        </div>
        <a
          href={`tel:${supplier.phone.replace(/\s/g, '')}`}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-ok text-white"
          aria-label={`Appeler ${supplier.name}`}
        >
          <Phone size={20} />
        </a>
      </Card>

      <div className="mt-3 flex flex-col gap-2">
        {order.lines.map((line) => (
          <OrderLine
            key={line.product.id}
            line={line}
            packs={qty[line.product.id] ?? 0}
            note={notes[line.product.id] ?? ''}
            onPacks={(n) => setQty((q) => ({ ...q, [line.product.id]: Math.max(0, n) }))}
            onNote={(t) => setNotes((m) => ({ ...m, [line.product.id]: t }))}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-dashed border-line px-1 pt-3">
        <span className="text-[12px] text-ink-2">Total commande</span>
        <span className="tabnums text-[15px] font-extrabold">{totalUnits} unités</span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={() => setSent(true)}>Préparer l'appel →</Button>
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-3">
        Prochaine étape prévue : contrôle visuel (cartons pleins + carton entamé) avant validation.
      </p>
    </AppShell>
  )
}

function OrderLine({
  line,
  packs,
  note,
  onPacks,
  onNote,
}: {
  line: Line
  packs: number
  note: string
  onPacks: (n: number) => void
  onNote: (t: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const { product: p, proposal: pr } = line
  const edited = packs !== pr.packs

  return (
    <Card>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold">{p.name}</div>
          <div className="tabnums text-[11px] text-ink-3">
            Réf {p.ref} · en stock {formatPacks(p.stockUnits, p.packSize, p.packLabel)}
          </div>
        </div>
        <div className="flex items-center overflow-hidden rounded-[11px] border border-line bg-surface-2">
          <button
            onClick={() => onPacks(packs - 1)}
            className="flex h-9 w-9 items-center justify-center text-crust-ink"
            aria-label="Moins"
          >
            <Minus size={16} />
          </button>
          <div className="tabnums w-9 text-center text-[16px] font-extrabold">{packs}</div>
          <button
            onClick={() => onPacks(packs + 1)}
            className="flex h-9 w-9 items-center justify-center text-crust-ink"
            aria-label="Plus"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="tabnums text-[11px] text-ink-3">
          {packs} {plural(p.packLabel, packs)} · {packs * p.packSize} u.
          {edited && <span className="text-crust-ink"> (ajusté)</span>}
        </span>
        {pr.ruptureBeforeDelivery && <Badge tone="danger">rupture avant livraison</Badge>}
        {pr.capped && <Badge tone="warn">plafonné</Badge>}
        {!pr.capped && !pr.ruptureBeforeDelivery && !edited && <Badge tone="crust">suggéré</Badge>}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-ink-2">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1">
          <Info size={13} /> Pourquoi ?
        </button>
        <button onClick={() => setNoteOpen((o) => !o)} className="flex items-center gap-1">
          + Note{note ? ' ✓' : ''}
        </button>
      </div>

      {noteOpen && (
        <input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Note (ex. « demander plus », « rupture annoncée »…)"
          className="mt-2 w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-3"
        />
      )}

      {open && (
        <div className="tabnums mt-2 flex flex-col gap-1 border-t border-dashed border-line pt-2 text-[11.5px] text-ink-2">
          <Row k="Stock actuel" v={`${p.stockUnits} u.`} />
          <Row k="Conso avant livraison" v={`− ${pr.consoBeforeD1} u.`} />
          <Row k="Stock projeté à la livraison" v={`${pr.projectedBeforeD1} u.`} />
          <Row k="Besoin à couvrir (avec filet)" v={`${pr.besoinCible} u.`} />
          <Row k="Besoin brut" v={`${pr.brutUnits} u.`} />
          <Row k="Proposition (arrondi carton)" v={`${pr.packs} × ${p.packSize} = ${pr.units} u.`} />
          {pr.capped && pr.maxPacksByCapacity !== null && (
            <div className="mt-1 text-warn">
              Plafonné : le congélo n'accepte que {pr.maxPacksByCapacity}{' '}
              {plural(p.packLabel, pr.maxPacksByCapacity)} (filet de sécurité réduit).
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function ExportView({
  supplier,
  order,
  qty,
  notes,
  onBack,
}: {
  supplier: DemoSupplier
  order: BuiltOrder
  qty: Record<string, number>
  notes: Record<string, string>
  onBack: () => void
}) {
  const [copied, setCopied] = useState(false)

  const text = useMemo(() => {
    const head = [
      `Commande ${supplier.name} — vendredi 10 juillet`,
      `À livrer ${order.d1Label}`,
      '',
    ]
    const body = order.lines
      .filter((l) => (qty[l.product.id] ?? 0) > 0)
      .map((l) => {
        const n = qty[l.product.id] ?? 0
        const note = notes[l.product.id]
        return (
          `• ${l.product.name} (réf ${l.product.ref}) — ${n} ${plural(l.product.packLabel, n)}` +
          (note ? `  [${note}]` : '')
        )
      })
    return [...head, ...body].join('\n')
  }, [supplier, order, qty, notes])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <AppShell eyebrow="Commande · à passer" title={supplier.name} subtitle="Bon de commande">
      <Card className="mt-1 flex items-center gap-3">
        <div className="min-w-0 flex-1 text-[12px] text-ink-2">
          Appelle {supplier.name} et lis la liste — coche au fur et à mesure.
        </div>
        <a
          href={`tel:${supplier.phone.replace(/\s/g, '')}`}
          className="flex h-11 flex-shrink-0 items-center gap-2 rounded-xl bg-ok px-3 text-[14px] font-bold text-white"
        >
          <Phone size={18} /> Appeler
        </a>
      </Card>

      <pre className="tabnums mt-3 overflow-x-auto rounded-[var(--radius-app)] border border-line bg-surface p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink">
        {text}
      </pre>

      <Button variant="soft" className="mt-3 w-full" onClick={copy}>
        {copied ? (
          <>
            <Check size={18} /> Copié
          </>
        ) : (
          <>
            <Copy size={18} /> Copier (SMS / e-mail)
          </>
        )}
      </Button>

      <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={onBack}>
          Modifier
        </Button>
        <Button onClick={onBack}>Commande passée ✓</Button>
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-3">
        L'export PDF et l'enregistrement en base viendront avec le branchement Supabase.
      </p>
    </AppShell>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-3">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
