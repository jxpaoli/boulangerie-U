import { useMemo, useState } from 'react'
import { Phone, ChevronRight, AlertTriangle, Info } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import {
  demoSuppliers,
  productsOfSupplier,
  DEMO_NOW,
  type DemoSupplier,
  type DemoProduct,
} from '@/features/demo/data'
import {
  supplierPlan,
  coverageEnd,
  toParisCivil,
  civilToDate,
} from '@/lib/orderCalendar'
import { computeOrderProposal, type OrderProposal } from '@/lib/orderProposal'
import { formatPacks, formatDayLong } from '@/lib/format'

const SAFETY_DELIVERIES = 1 // filet « +1 livraison » (réglable plus tard)

interface Line {
  product: DemoProduct
  proposal: OrderProposal
}

function buildOrder(supplier: DemoSupplier): {
  d1Label: string
  covLabel: string
  cutoff: string
  lines: Line[]
} {
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
                <Badge tone="crust">{order.lines.length} réf.</Badge>
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

  return (
    <AppShell
      eyebrow="Commande"
      title={supplier.name}
      subtitle={`Couvrir jusqu'à ${order.covLabel}`}
    >
      {/* Bandeau appel */}
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
          <OrderLine key={line.product.id} line={line} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={onBack}>Valider la commande</Button>
      </div>
      <p className="mt-3 text-center text-[11px] text-ink-3">
        Prochaine étape : contrôle visuel + export bon de commande.
      </p>
    </AppShell>
  )
}

function OrderLine({ line }: { line: Line }) {
  const [open, setOpen] = useState(false)
  const { product: p, proposal: pr } = line

  return (
    <Card>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold">{p.name}</div>
          <div className="tabnums text-[11px] text-ink-3">
            En stock {formatPacks(p.stockUnits, p.packSize, p.packLabel)}
          </div>
        </div>
        <div className="text-right">
          <div className="tabnums text-[16px] font-extrabold text-crust-ink">
            {pr.packs} {p.packLabel}
            {pr.packs > 1 ? 's' : ''}
          </div>
          <div className="tabnums text-[10.5px] text-ink-3">{pr.units} u.</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {pr.ruptureBeforeDelivery && <Badge tone="danger">rupture avant livraison</Badge>}
        {pr.capped && <Badge tone="warn">plafonné (place)</Badge>}
        {!pr.capped && !pr.ruptureBeforeDelivery && <Badge tone="crust">suggéré</Badge>}
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-ink-2"
        >
          <Info size={13} /> Pourquoi ?
        </button>
      </div>

      {open && (
        <div className="tabnums mt-2 flex flex-col gap-1 border-t border-dashed border-line pt-2 text-[11.5px] text-ink-2">
          <Row k="Stock actuel" v={`${p.stockUnits} u.`} />
          <Row k="Conso avant livraison" v={`− ${pr.consoBeforeD1} u.`} />
          <Row k="Stock projeté à la livraison" v={`${pr.projectedBeforeD1} u.`} />
          <Row k="Besoin à couvrir (avec filet)" v={`${pr.besoinCible} u.`} />
          <Row k="Besoin brut" v={`${pr.brutUnits} u.`} />
          <Row
            k="Arrondi conditionnement"
            v={`${pr.packs} × ${p.packSize} = ${pr.units} u.`}
          />
          {pr.capped && pr.maxPacksByCapacity !== null && (
            <div className="mt-1 text-warn">
              Plafonné : le congélo n'accepte que {pr.maxPacksByCapacity} {p.packLabel}
              {pr.maxPacksByCapacity > 1 ? 's' : ''} (filet de sécurité réduit).
            </div>
          )}
        </div>
      )}
    </Card>
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
