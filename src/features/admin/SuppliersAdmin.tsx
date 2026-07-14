import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ChevronLeft, Plus, Trash2, Check } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Button } from '@/components/ui'
import { services, type Supplier } from '@/services'
import type { SupplierInput } from '@/services/types'
import { useAuth } from '@/features/auth/AuthContext'
import { WEEKDAYS_SHORT } from '@/lib/format'

type Draft = SupplierInput

function empty(siteId: string): Draft {
  return {
    siteId,
    name: '',
    phone: '',
    orderDays: [],
    cutoff: '11:00',
    leadDays: 1,
    leadKind: 'calendar',
    noWeekendDelivery: true,
  }
}

export function SuppliersAdmin() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const siteId = user?.siteId ?? ''

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => services.catalog.listSuppliers(),
  })
  const [draft, setDraft] = useState<Draft | null>(null)

  const save = useMutation({
    mutationFn: (d: Draft) => services.admin.saveSupplier(d),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['suppliers'] })
      setDraft(null)
    },
  })
  const del = useMutation({
    mutationFn: (id: string) => services.admin.deleteSupplier(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })

  if (draft) {
    return (
      <SupplierForm
        draft={draft}
        onChange={setDraft}
        onCancel={() => setDraft(null)}
        onSave={() => save.mutate(draft)}
        saving={save.isPending}
        error={save.error instanceof Error ? save.error.message : ''}
      />
    )
  }

  return (
    <AppShell
      eyebrow="Paramètres"
      title="Fournisseurs"
      action={
        <button
          onClick={() => setDraft(empty(siteId))}
          className="flex h-9 items-center gap-1 rounded-full bg-crust px-3 text-[13px] font-bold text-white"
        >
          <Plus size={16} /> Nouveau
        </button>
      }
    >
      <button
        onClick={() => navigate('/parametres')}
        className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-ink-2"
      >
        <ChevronLeft size={15} /> Paramètres
      </button>

      <div className="mt-2 overflow-hidden rounded-[14px] border border-line/80 bg-surface divide-y divide-line">
        {suppliers.map((s) => (
          <div key={s.id} className="flex h-12 items-center gap-2 px-2.5">
            <button onClick={() => setDraft(toDraft(s, siteId))} className="min-w-0 flex-1 text-left">
              <div className="truncate text-[13.5px] font-semibold">{s.name}</div>
              <div className="tabnums truncate text-[10px] text-ink-3">
                {s.phone} · commande {s.deliveryLabel || '—'}
              </div>
            </button>
            <button
              onClick={() => {
                if (confirm(`Supprimer « ${s.name} » ?`)) del.mutate(s.id)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-warn"
              aria-label="Supprimer"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </AppShell>
  )
}

function toDraft(s: Supplier, siteId: string): Draft {
  const d = s.calendar.delivery
  return {
    id: s.id,
    siteId,
    name: s.name,
    phone: s.phone,
    orderDays: [...s.orderDays],
    cutoff: s.calendar.cutoff,
    leadDays: d.mode === 'lead' ? d.leadDays : 1,
    leadKind: d.mode === 'lead' ? (d.leadKind ?? 'calendar') : 'calendar',
    noWeekendDelivery: d.mode === 'lead' ? (d.noWeekendDelivery ?? true) : true,
  }
}

function SupplierForm({
  draft,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  draft: Draft
  onChange: (d: Draft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  error: string
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v })
  const toggleDay = (i: number) => {
    const has = draft.orderDays.includes(i)
    set('orderDays', has ? draft.orderDays.filter((d) => d !== i) : [...draft.orderDays, i].sort())
  }
  const valid = draft.name.trim() !== ''

  return (
    <AppShell eyebrow="Paramètres · Fournisseur" title={draft.id ? 'Modifier' : 'Nouveau fournisseur'}>
      <div className="mt-2 flex flex-col gap-2">
        <Field label="Nom">
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px]"
          />
        </Field>
        <Field label="Téléphone">
          <input
            value={draft.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px]"
          />
        </Field>

        <Field label="Jours de commande">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS_SHORT.map((d, i) => {
              const on = draft.orderDays.includes(i)
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(i)}
                  className={
                    'rounded-[10px] border py-2.5 text-[12px] font-bold ' +
                    (on ? 'border-crust bg-crust text-white' : 'border-line bg-surface text-ink-3')
                  }
                >
                  {d}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Heure limite">
            <input
              type="time"
              value={draft.cutoff}
              onChange={(e) => set('cutoff', e.target.value)}
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px]"
            />
          </Field>
          <Field label="Délai livraison (jours)">
            <input
              value={draft.leadDays}
              onChange={(e) => set('leadDays', Math.max(0, parseInt(e.target.value) || 0))}
              inputMode="numeric"
              className="tabnums w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-center text-[14px] font-bold"
            />
          </Field>
        </div>

        <Field label="Type de délai">
          <div className="grid grid-cols-2 gap-2">
            {(['calendar', 'business'] as const).map((k) => (
              <button
                key={k}
                onClick={() => set('leadKind', k)}
                className={
                  'rounded-[12px] border py-2.5 text-[13px] font-bold ' +
                  (draft.leadKind === k
                    ? 'border-crust bg-crust-soft text-crust-ink'
                    : 'border-line bg-surface text-ink-2')
                }
              >
                {k === 'calendar' ? 'Jours calendaires' : 'Jours ouvrés'}
              </button>
            ))}
          </div>
        </Field>

        <label className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3.5 py-3">
          <input
            type="checkbox"
            checked={draft.noWeekendDelivery}
            onChange={(e) => set('noWeekendDelivery', e.target.checked)}
            className="h-5 w-5"
          />
          <span className="text-[13.5px]">Pas de livraison le week-end (report au lundi)</span>
        </label>

        {error && <div className="text-[12.5px] font-semibold text-warn">{error}</div>}

        <div className="mt-1 grid grid-cols-[1fr_2fr] gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={onSave} disabled={!valid || saving}>
            <Check size={18} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-bold tracking-[0.08em] text-ink-3 uppercase">{label}</div>
      {children}
    </label>
  )
}
