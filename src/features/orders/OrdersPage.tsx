import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Phone,
  ChevronRight,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Minus,
  Plus,
  Eye,
  RefreshCw,
} from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Badge, Button } from '@/components/ui'
import { services, type Supplier, type Product } from '@/services'
import { DEMO_NOW } from '@/features/demo/data'
import {
  supplierPlan,
  coverageEnd,
  toParisCivil,
  civilToDate,
  type Civil,
} from '@/lib/orderCalendar'
import { computeOrderProposal, type OrderProposal } from '@/lib/orderProposal'
import { formatPacks, formatDayLong, plural, packBreakdown } from '@/lib/format'
import { useDemoRole, isSignificantGap, type Role } from '@/features/demo/role'

const SAFETY_DELIVERIES = 1 // filet « +1 livraison » (réglable plus tard)

// carton entamé : fractions affichées en pièces
const FRACS = [
  { f: 0, lab: 'vide' },
  { f: 0.25, lab: '¼' },
  { f: 0.5, lab: '½' },
  { f: 0.75, lab: '¾' },
]
const partUnits = (packSize: number, idx: number) => Math.round(packSize * (FRACS[idx]?.f ?? 0))
function nearestPartIdx(remainder: number, packSize: number): number {
  let best = 0
  let bestDist = Infinity
  FRACS.forEach((fr, i) => {
    const d = Math.abs(Math.round(packSize * fr.f) - remainder)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  })
  return best
}

interface VisualCheck {
  full: number
  partIdx: number
}

interface OrderMeta {
  now: Civil
  d1: Civil
  cov: Civil
  d1Label: string
  covLabel: string
  cutoff: string
}

function orderMeta(supplier: Supplier): OrderMeta {
  const now = toParisCivil(DEMO_NOW)
  const plan = supplierPlan(supplier.calendar, DEMO_NOW)
  const cov = coverageEnd(supplier.calendar, DEMO_NOW, SAFETY_DELIVERIES)
  return {
    now,
    d1: plan.d1,
    cov,
    d1Label: cap(formatDayLong(civilToDate(plan.d1))),
    covLabel: cap(formatDayLong(civilToDate(cov))),
    cutoff: plan.cutoff,
  }
}

function proposalFor(p: Product, stockUnits: number, meta: OrderMeta): OrderProposal {
  return computeOrderProposal(
    { stockUnits, conso7: p.conso, packSize: p.packSize, maxStockUnits: p.maxUnits },
    meta.now,
    meta.d1,
    meta.cov,
  )
}

/** Produits à proposer pour ce fournisseur (stock théorique). */
function orderProducts(allProducts: Product[], supplier: Supplier, meta: OrderMeta): Product[] {
  return allProducts
    .filter((p) => p.supplierId === supplier.id)
    .filter((p) => {
      const pr = proposalFor(p, p.stockUnits, meta)
      return pr.packs > 0 || pr.ruptureBeforeDelivery
    })
}

export function OrdersPage() {
  const [selected, setSelected] = useState<Supplier | null>(null)
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => services.catalog.listSuppliers(),
  })
  const { data: allProducts = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })
  const dueSuppliers = useMemo(() => suppliers.filter((s) => s.dueToday), [suppliers])

  if (selected)
    return (
      <SupplierOrder
        supplier={selected}
        allProducts={allProducts}
        onBack={() => setSelected(null)}
      />
    )

  return (
    <AppShell eyebrow="Commande" title="Commandes du jour" subtitle="Vendredi 10 juillet">
      <div className="mt-2 flex flex-col gap-2">
        {dueSuppliers.map((s) => {
          const meta = orderMeta(s)
          const products = orderProducts(allProducts, s, meta)
          const hasRisk = products.some((p) => proposalFor(p, p.stockUnits, meta).ruptureBeforeDelivery)
          return (
            <Card key={s.id} className="flex items-center gap-3" onClick={() => setSelected(s)}>
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-crust-soft text-[16px] font-extrabold text-crust-ink">
                {s.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{s.name}</div>
                <div className="tabnums text-[11.5px] text-ink-2">
                  Avant {meta.cutoff} · livraison {meta.d1Label}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasRisk && <AlertTriangle size={16} className="text-warn" />}
                <Badge tone="crust">
                  {products.length} réf{products.length > 1 ? 's' : ''}.
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

function SupplierOrder({
  supplier,
  allProducts,
  onBack,
}: {
  supplier: Supplier
  allProducts: Product[]
  onBack: () => void
}) {
  const meta = useMemo(() => orderMeta(supplier), [supplier])
  const products = useMemo(
    () => orderProducts(allProducts, supplier, meta),
    [allProducts, supplier, meta],
  )

  const [checks, setChecks] = useState<Record<string, VisualCheck | undefined>>({})
  const [overrides, setOverrides] = useState<Record<string, number | undefined>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)

  function effectiveStock(p: Product): number {
    const v = checks[p.id]
    if (!v) return p.stockUnits
    return v.full * p.packSize + partUnits(p.packSize, v.partIdx)
  }
  function packsFor(p: Product): number {
    const ov = overrides[p.id]
    if (ov !== undefined) return ov
    return proposalFor(p, effectiveStock(p), meta).packs
  }

  const nbChecked = products.filter((p) => checks[p.id]).length
  const totalUnits = products.reduce((s, p) => s + packsFor(p) * p.packSize, 0)

  if (sent) {
    return (
      <ExportView
        supplier={supplier}
        meta={meta}
        products={products}
        packsFor={packsFor}
        notes={notes}
        onBack={() => setSent(false)}
      />
    )
  }

  return (
    <AppShell eyebrow="Commande" title={supplier.name} subtitle={`Couvrir jusqu'à ${meta.covLabel}`}>
      <Card className="mt-1 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="tabnums text-[13px] font-semibold">{supplier.phone}</div>
          <div className="text-[11px] text-ink-2">
            Commander avant {meta.cutoff} · livraison {meta.d1Label}
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

      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[11.5px] text-ink-2">
          <Eye size={14} className="text-crust" />
          Contrôle visuel : {nbChecked}/{products.length} vérifiés
        </div>
        <RoleSwitch />
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {products.map((p) => (
          <OrderLine
            key={p.id}
            product={p}
            proposal={proposalFor(p, effectiveStock(p), meta)}
            packs={packsFor(p)}
            check={checks[p.id]}
            note={notes[p.id] ?? ''}
            onPacks={(n) => setOverrides((o) => ({ ...o, [p.id]: Math.max(0, n) }))}
            onNote={(t) => setNotes((m) => ({ ...m, [p.id]: t }))}
            onToggleCheck={() =>
              setChecks((c) => {
                if (c[p.id]) {
                  const next = { ...c }
                  delete next[p.id]
                  return next
                }
                const { packs, remainder } = packBreakdown(p.stockUnits, p.packSize)
                return { ...c, [p.id]: { full: packs, partIdx: nearestPartIdx(remainder, p.packSize) } }
              })
            }
            onCheckChange={(v) => {
              setChecks((c) => ({ ...c, [p.id]: v }))
              setOverrides((o) => ({ ...o, [p.id]: undefined })) // la quantité re-suit la proposition
            }}
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
    </AppShell>
  )
}

function OrderLine({
  product: p,
  proposal: pr,
  packs,
  check,
  note,
  onPacks,
  onNote,
  onToggleCheck,
  onCheckChange,
}: {
  product: Product
  proposal: OrderProposal
  packs: number
  check: VisualCheck | undefined
  note: string
  onPacks: (n: number) => void
  onNote: (t: string) => void
  onToggleCheck: () => void
  onCheckChange: (v: VisualCheck) => void
}) {
  const [why, setWhy] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [reconciled, setReconciled] = useState(false)
  const [proposed, setProposed] = useState(false)
  const role = useDemoRole((s) => s.role)
  const edited = packs !== pr.packs
  const checkedStock = check ? check.full * p.packSize + partUnits(p.packSize, check.partIdx) : null

  return (
    <Card>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-semibold">{p.name}</div>
          <div className="tabnums text-[11px] text-ink-3">
            Réf {p.ref} ·{' '}
            {checkedStock !== null ? (
              <span className="text-crust-ink">stock vérifié {formatPacks(checkedStock, p.packSize, p.packLabel)}</span>
            ) : (
              <>stock {formatPacks(p.stockUnits, p.packSize, p.packLabel)}</>
            )}
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
        {check && <Badge tone="ok">vérifié</Badge>}
        {!pr.capped && !pr.ruptureBeforeDelivery && !edited && !check && (
          <Badge tone="crust">suggéré</Badge>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-ink-2">
        <button
          onClick={onToggleCheck}
          className={check ? 'flex items-center gap-1 text-crust-ink' : 'flex items-center gap-1'}
        >
          <Eye size={13} /> Contrôle visuel
        </button>
        <button onClick={() => setWhy((o) => !o)} className="flex items-center gap-1">
          <Info size={13} /> Pourquoi ?
        </button>
        <button onClick={() => setNoteOpen((o) => !o)} className="flex items-center gap-1">
          + Note{note ? ' ✓' : ''}
        </button>
      </div>

      {check && (
        <div className="mt-2 rounded-[12px] bg-surface-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-ink-2">Cartons pleins</span>
            <div className="flex items-center overflow-hidden rounded-[10px] border border-line bg-surface">
              <button
                onClick={() => onCheckChange({ ...check, full: Math.max(0, check.full - 1) })}
                className="flex h-8 w-9 items-center justify-center text-crust-ink"
                aria-label="Moins carton"
              >
                <Minus size={15} />
              </button>
              <div className="tabnums w-8 text-center text-[15px] font-extrabold">{check.full}</div>
              <button
                onClick={() => onCheckChange({ ...check, full: check.full + 1 })}
                className="flex h-8 w-9 items-center justify-center text-crust-ink"
                aria-label="Plus carton"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div className="mt-2 text-[12px] font-semibold text-ink-2">Carton entamé — reste ≈</div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {FRACS.map((fr, idx) => {
              const on = check.partIdx === idx
              return (
                <button
                  key={fr.lab}
                  onClick={() => onCheckChange({ ...check, partIdx: idx })}
                  className={
                    'rounded-[10px] border py-2 text-center ' +
                    (on
                      ? idx === 0
                        ? 'border-warn bg-warn-soft'
                        : 'border-crust bg-crust-soft'
                      : 'border-line bg-surface')
                  }
                >
                  <div className={'tabnums text-[15px] font-extrabold ' + (on && idx === 0 ? 'text-warn' : on ? 'text-crust-ink' : 'text-ink')}>
                    {partUnits(p.packSize, idx)}
                  </div>
                  <div className="text-[9.5px] font-bold text-ink-3">{fr.lab}</div>
                </button>
              )
            })}
          </div>

          {checkedStock !== null && isSignificantGap(checkedStock, p.stockUnits) && (
            <div className="mt-3 border-t border-line pt-2.5">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="tabnums text-ink-2">
                  Théorique {p.stockUnits} · vu {checkedStock}
                </span>
                <Badge tone={checkedStock < p.stockUnits ? 'warn' : 'crust'}>
                  écart {ecart(checkedStock, p.stockUnits)} (&gt; 20 %)
                </Badge>
              </div>

              {reconciled ? (
                <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-ok">
                  <Check size={14} /> Stock recalé · correction {ecart(checkedStock, p.stockUnits)}{' '}
                  enregistrée
                </div>
              ) : proposed ? (
                <div className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-crust-ink">
                  <RefreshCw size={14} /> Recalage proposé ({ecart(checkedStock, p.stockUnits)}) · en
                  attente du responsable
                </div>
              ) : role === 'responsable' ? (
                <>
                  <button
                    onClick={() => setReconciled(true)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-crust-soft py-2 text-[12.5px] font-bold text-crust-ink"
                  >
                    <RefreshCw size={14} /> Recaler le stock ({ecart(checkedStock, p.stockUnits)})
                  </button>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-ink-3">
                    La commande utilise déjà ce que tu as vu. « Recaler » corrige aussi le stock
                    (correction tracée) — sinon le contrôle ne sert qu'à cette commande.
                  </p>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setProposed(true)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-surface py-2 text-[12.5px] font-bold text-crust-ink"
                  >
                    <RefreshCw size={14} /> Proposer un recalage ({ecart(checkedStock, p.stockUnits)})
                  </button>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-ink-3">
                    La commande utilise déjà ce que tu as vu. Le recalage du stock devra être
                    validé par le responsable.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {noteOpen && (
        <input
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="Note (ex. « demander plus », « rupture annoncée »…)"
          className="mt-2 w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-3"
        />
      )}

      {why && (
        <div className="tabnums mt-2 flex flex-col gap-1 border-t border-dashed border-line pt-2 text-[11.5px] text-ink-2">
          {check && checkedStock !== null && (
            <Row k="Stock (théorique → vérifié)" v={`${p.stockUnits} → ${checkedStock} u.`} />
          )}
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
  meta,
  products,
  packsFor,
  notes,
  onBack,
}: {
  supplier: Supplier
  meta: OrderMeta
  products: Product[]
  packsFor: (p: Product) => number
  notes: Record<string, string>
  onBack: () => void
}) {
  const [copied, setCopied] = useState(false)

  const text = useMemo(() => {
    const head = [`Commande ${supplier.name} — vendredi 10 juillet`, `À livrer ${meta.d1Label}`, '']
    const body = products
      .filter((p) => packsFor(p) > 0)
      .map((p) => {
        const n = packsFor(p)
        const note = notes[p.id]
        return (
          `• ${p.name} (réf ${p.ref}) — ${n} ${plural(p.packLabel, n)}` +
          (note ? `  [${note}]` : '')
        )
      })
    return [...head, ...body].join('\n')
  }, [supplier, meta, products, packsFor, notes])

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

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-3">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  )
}

function RoleSwitch() {
  const { role, setRole } = useDemoRole()
  const roles: Role[] = ['vendeuse', 'responsable']
  return (
    <div className="flex items-center overflow-hidden rounded-full border border-line bg-surface-2 text-[10.5px] font-bold">
      {roles.map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          className={
            'px-2.5 py-1 ' + (role === r ? 'bg-crust text-white' : 'text-ink-3')
          }
        >
          {r === 'vendeuse' ? 'Vendeuse' : 'Responsable'}
        </button>
      ))}
    </div>
  )
}

function ecart(seen: number, theo: number): string {
  const d = seen - theo
  return d > 0 ? `+${d}` : `${d}`
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
