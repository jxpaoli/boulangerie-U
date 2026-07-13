import { useMemo, useState } from 'react'
import { Truck, ChevronRight, Minus, Plus, Check, PackageCheck } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button, Badge } from '@/components/ui'
import {
  demoDeliveries,
  demoSuppliers,
  supplierOf,
  productById,
  type DemoDelivery,
} from '@/features/demo/data'
import { formatPacks, plural } from '@/lib/format'

export function ReceptionsPage() {
  const [selected, setSelected] = useState<DemoDelivery | null>(null)

  if (selected) return <Reception delivery={selected} onBack={() => setSelected(null)} />

  return (
    <AppShell eyebrow="Réception" title="Livraisons attendues" subtitle="Vendredi 10 juillet">
      {demoDeliveries.length === 0 ? (
        <div className="mt-8 text-center text-[13px] text-ink-3">
          Aucune livraison à réceptionner.
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {demoDeliveries.map((d) => {
            const name = demoSuppliers.find((x) => x.id === d.supplierId)?.name ?? d.supplierId
            return (
              <Card key={d.id} className="flex items-center gap-3" onClick={() => setSelected(d)}>
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-crust-soft text-crust-ink">
                  <Truck size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">{name}</div>
                  <div className="text-[11.5px] text-ink-2">
                    {d.orderedAtLabel} · {d.expectedLabel}
                  </div>
                </div>
                <Badge tone="crust">
                  {d.lines.length} réf{d.lines.length > 1 ? 's' : ''}.
                </Badge>
                <ChevronRight size={18} className="text-ink-3" />
              </Card>
            )
          })}
        </div>
      )}
      <p className="mt-4 px-1 text-[11.5px] text-ink-3">
        Seule la quantité <b>acceptée</b> entre en stock. Ce qui manque n'entre pas — il reviendra
        dans la prochaine commande. Données de démo.
      </p>
    </AppShell>
  )
}

function Reception({ delivery, onBack }: { delivery: DemoDelivery; onBack: () => void }) {
  const supplierName = useMemo(() => {
    const first = productById(delivery.lines[0]?.productId ?? '')
    return first ? supplierOf(first).name : delivery.supplierId
  }, [delivery])

  // quantités acceptées, en CARTONS (défaut = commandé)
  const [acceptedPacks, setAcceptedPacks] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      delivery.lines.map((l) => {
        const p = productById(l.productId)!
        return [l.productId, Math.round(l.orderedUnits / p.packSize)]
      }),
    ),
  )
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  function orderedPacks(productId: string, orderedUnits: number): number {
    const p = productById(productId)!
    return Math.round(orderedUnits / p.packSize)
  }

  function setConforme() {
    setAcceptedPacks(
      Object.fromEntries(
        delivery.lines.map((l) => [l.productId, orderedPacks(l.productId, l.orderedUnits)]),
      ),
    )
  }

  const enteredUnits = delivery.lines.reduce((sum, l) => {
    const p = productById(l.productId)!
    return sum + (acceptedPacks[l.productId] ?? 0) * p.packSize
  }, 0)

  const anyShort = delivery.lines.some(
    (l) => (acceptedPacks[l.productId] ?? 0) < orderedPacks(l.productId, l.orderedUnits),
  )

  if (done) {
    return (
      <AppShell eyebrow="Réception" title={supplierName} subtitle="Réception enregistrée">
        <Card className="mt-2 flex flex-col items-center py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ok-soft text-ok">
            <PackageCheck size={30} />
          </div>
          <div className="mt-4 text-[15px] font-bold">Entré en stock</div>
          <div className="mt-3 flex w-full flex-col gap-1.5 px-2">
            {delivery.lines.map((l) => {
              const p = productById(l.productId)!
              const packs = acceptedPacks[l.productId] ?? 0
              const short = packs < orderedPacks(l.productId, l.orderedUnits)
              return (
                <div
                  key={l.productId}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[13px]"
                >
                  <span>{p.name}</span>
                  <span className={short ? 'font-bold text-warn' : 'font-bold text-ok'}>
                    + {packs * p.packSize} u.
                  </span>
                </div>
              )
            })}
          </div>
          {anyShort && (
            <p className="mt-3 px-3 text-[11.5px] text-ink-2">
              Le manquant n'a pas été ajouté — il reviendra automatiquement dans la prochaine
              proposition de commande.
            </p>
          )}
        </Card>
        <Button className="mt-3 w-full" onClick={onBack}>
          Terminé
        </Button>
      </AppShell>
    )
  }

  return (
    <AppShell eyebrow="Réception" title={supplierName} subtitle="Vérifie ce qui est arrivé">
      <Button variant="soft" className="mt-1 w-full" onClick={setConforme}>
        <Check size={18} /> Tout est conforme
      </Button>
      <p className="mt-2 px-1 text-[11px] text-ink-3">
        Ou ajuste une ligne si un carton manque / est abîmé.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {delivery.lines.map((l) => {
          const p = productById(l.productId)!
          const ordered = orderedPacks(l.productId, l.orderedUnits)
          const accepted = acceptedPacks[l.productId] ?? 0
          const short = accepted < ordered
          return (
            <Card key={l.productId}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold">{p.name}</div>
                  <div className="tabnums text-[11px] text-ink-3">
                    Commandé {formatPacks(l.orderedUnits, p.packSize, p.packLabel)}
                  </div>
                </div>
                <div className="flex items-center overflow-hidden rounded-[11px] border border-line bg-surface-2">
                  <button
                    onClick={() =>
                      setAcceptedPacks((a) => ({ ...a, [l.productId]: Math.max(0, accepted - 1) }))
                    }
                    className="flex h-9 w-9 items-center justify-center text-crust-ink"
                    aria-label="Moins"
                  >
                    <Minus size={16} />
                  </button>
                  <div className="tabnums w-9 text-center text-[16px] font-extrabold">
                    {accepted}
                  </div>
                  <button
                    onClick={() =>
                      setAcceptedPacks((a) => ({ ...a, [l.productId]: accepted + 1 }))
                    }
                    className="flex h-9 w-9 items-center justify-center text-crust-ink"
                    aria-label="Plus"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="tabnums text-[11px] text-ink-3">
                  Accepté {accepted} {plural(p.packLabel, accepted)} · {accepted * p.packSize} u.
                </span>
                {short ? (
                  <Badge tone="warn">manque {ordered - accepted}</Badge>
                ) : (
                  <Badge tone="ok">conforme</Badge>
                )}
              </div>

              {short && (
                <input
                  value={notes[l.productId] ?? ''}
                  onChange={(e) => setNotes((m) => ({ ...m, [l.productId]: e.target.value }))}
                  placeholder="Note (ex. « abîmé », « pas livré »…)"
                  className="mt-2 w-full rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-3"
                />
              )}
            </Card>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-dashed border-line px-1 pt-3">
        <span className="text-[12px] text-ink-2">À entrer en stock</span>
        <span className="tabnums text-[15px] font-extrabold">{enteredUnits} unités</span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={onBack}>
          Retour
        </Button>
        <Button onClick={() => setDone(true)}>Valider la réception</Button>
      </div>
    </AppShell>
  )
}
