import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ChevronLeft, Plus, Trash2, Check } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button } from '@/components/ui'
import { services, type Product } from '@/services'
import type { ProductInput } from '@/services/types'
import { useAuth } from '@/features/auth/AuthProvider'
import { WEEKDAYS_SHORT } from '@/lib/format'

type Draft = ProductInput

function emptyDraft(siteId: string): Draft {
  return {
    siteId,
    name: '',
    categoryId: null,
    minUnits: 0,
    maxUnits: 0,
    supplierId: null,
    supplierRef: '',
    packSize: 1,
    conso: [0, 0, 0, 0, 0, 0, 0],
  }
}

export function ProductsAdmin() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const siteId = user?.siteId ?? ''

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => services.catalog.listCategories(),
  })
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => services.catalog.listSuppliers(),
  })

  const [draft, setDraft] = useState<Draft | null>(null)

  const save = useMutation({
    mutationFn: (d: Draft) => services.admin.saveProduct(d),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['products'] })
      setDraft(null)
    },
  })
  const del = useMutation({
    mutationFn: (id: string) => services.admin.deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })

  const catName = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of categories) m[c.id] = c.name
    return m
  }, [categories])

  if (draft) {
    return (
      <ProductForm
        draft={draft}
        categories={categories}
        suppliers={suppliers}
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
      title="Produits"
      subtitle={`${products.length} produits`}
      action={
        <button
          onClick={() => setDraft(emptyDraft(siteId))}
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

      <div className="mt-3 flex flex-col gap-2">
        {products.map((p) => (
          <Card key={p.id} className="flex items-center gap-3">
            <button
              onClick={() => setDraft(toDraft(p, siteId))}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-[14.5px] font-semibold">{p.name}</div>
              <div className="text-[11px] text-ink-3">
                {catName[p.categoryId ?? ''] ?? p.category} · carton de {p.packSize} · réf {p.ref}
              </div>
            </button>
            <button
              onClick={() => {
                if (confirm(`Supprimer « ${p.name} » ?`)) del.mutate(p.id)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-warn"
              aria-label="Supprimer"
            >
              <Trash2 size={17} />
            </button>
          </Card>
        ))}
      </div>
    </AppShell>
  )
}

function toDraft(p: Product, siteId: string): Draft {
  return {
    id: p.id,
    siteId,
    name: p.name,
    categoryId: p.categoryId,
    minUnits: p.minUnits,
    maxUnits: p.maxUnits,
    supplierId: p.supplierId || null,
    supplierRef: p.ref,
    packSize: p.packSize,
    conso: [...p.conso],
  }
}

function ProductForm({
  draft,
  categories,
  suppliers,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  draft: Draft
  categories: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  onChange: (d: Draft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  error: string
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v })
  const setConso = (i: number, v: number) => {
    const c = [...draft.conso]
    c[i] = Math.max(0, v)
    onChange({ ...draft, conso: c })
  }
  const valid = draft.name.trim() !== '' && draft.packSize > 0

  return (
    <AppShell eyebrow="Paramètres · Produit" title={draft.id ? 'Modifier' : 'Nouveau produit'}>
      <div className="mt-2 flex flex-col gap-3">
        <Field label="Nom">
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            className="w-full rounded-[12px] border border-line bg-surface px-3.5 py-3 text-[15px]"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Famille">
            <select
              value={draft.categoryId ?? ''}
              onChange={(e) => set('categoryId', e.target.value || null)}
              className="w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-[14px]"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fournisseur">
            <select
              value={draft.supplierId ?? ''}
              onChange={(e) => set('supplierId', e.target.value || null)}
              className="w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-[14px]"
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Réf. fourn.">
            <input
              value={draft.supplierRef}
              onChange={(e) => set('supplierRef', e.target.value)}
              className="w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-[14px]"
            />
          </Field>
          <NumField label="Carton (u.)" value={draft.packSize} onChange={(v) => set('packSize', v)} />
          <NumField label="Place max" value={draft.maxUnits} onChange={(v) => set('maxUnits', v)} />
        </div>

        <NumField label="Stock mini (u.)" value={draft.minUnits} onChange={(v) => set('minUnits', v)} />

        <Field label="Conso par jour (Lun → Dim)">
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS_SHORT.map((d, i) => (
              <div key={d} className="text-center">
                <div className="mb-1 text-[9.5px] font-bold text-ink-3 uppercase">{d}</div>
                <input
                  value={draft.conso[i] ?? 0}
                  onChange={(e) => setConso(i, parseInt(e.target.value) || 0)}
                  inputMode="numeric"
                  className="tabnums h-10 w-full rounded-[9px] border border-line bg-surface-2 text-center text-[14px] font-bold"
                />
              </div>
            ))}
          </div>
        </Field>

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

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        inputMode="numeric"
        className="tabnums w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-center text-[15px] font-bold"
      />
    </Field>
  )
}
