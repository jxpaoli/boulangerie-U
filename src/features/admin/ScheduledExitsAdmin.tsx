import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Check, ChevronLeft, Minus, Plus, Search, Star, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { FamilySection } from '@/components/FamilySection'
import { Button } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { services, type Prepa, type PrepaInput, type Product } from '@/services'

interface Draft {
  id?: string
  name: string
  time: string
  units: Record<string, number>
}

export function ScheduledExitsAdmin() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [draft, setDraft] = useState<Draft | null>(null)

  const { data: prepas = [] } = useQuery({
    queryKey: ['prepas'],
    queryFn: () => services.catalog.listPrepas(),
  })
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => services.catalog.listProducts(),
  })

  const save = useMutation({
    mutationFn: (value: Draft) => {
      const input: PrepaInput = {
        id: value.id,
        siteId: user?.siteId ?? '',
        name: value.name.trim(),
        time: value.time,
        lines: Object.entries(value.units)
          .filter(([, units]) => units > 0)
          .map(([productId, units]) => ({ productId, units })),
      }
      return services.admin.savePrepa(input)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['prepas'] })
      setDraft(null)
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => services.admin.deletePrepa(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prepas'] }),
  })

  if (draft) {
    return (
      <ScheduledExitForm
        draft={draft}
        products={products}
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
      title="Sorties programmées"
      subtitle={`${prepas.length} préparation${prepas.length > 1 ? 's' : ''}`}
      action={
        <button
          onClick={() => setDraft({ name: '', time: '', units: {} })}
          className="flex h-9 items-center gap-1 rounded-full bg-crust px-3 text-[13px] font-bold text-white"
        >
          <Plus size={16} /> Nouvelle
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
        {prepas.map((prepa) => (
          <div key={prepa.id} className="flex h-12 items-center gap-2.5 px-2.5">
            <CalendarClock size={17} className="flex-shrink-0 text-crust" />
            <button
              onClick={() => setDraft(toDraft(prepa))}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-[13.5px] font-semibold">{prepa.name}</div>
              <div className="tabnums text-[10px] text-ink-3">
                {prepa.time || 'Sans heure'} · {prepa.lines.length} produit{prepa.lines.length > 1 ? 's' : ''}
              </div>
            </button>
            <button
              onClick={() => {
                if (confirm(`Supprimer « ${prepa.name} » ?`)) remove.mutate(prepa.id)
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-warn"
              aria-label={`Supprimer ${prepa.name}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      {prepas.length === 0 && (
        <p className="mt-5 text-center text-[12px] text-ink-3">Aucune sortie programmée.</p>
      )}
    </AppShell>
  )
}

function ScheduledExitForm({
  draft,
  products,
  onChange,
  onCancel,
  onSave,
  saving,
  error,
}: {
  draft: Draft
  products: Product[]
  onChange: (draft: Draft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  error: string
}) {
  const [query, setQuery] = useState('')
  const selectedCount = Object.values(draft.units).filter((units) => units > 0).length
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('fr')
    if (!value) return products
    return products.filter(
      (product) =>
        product.name.toLocaleLowerCase('fr').includes(value) ||
        product.ref.toLocaleLowerCase('fr').includes(value),
    )
  }, [products, query])
  const favorites = query.trim() ? [] : filtered.filter((product) => product.isFavorite)
  const remaining = filtered
  const valid = draft.name.trim() !== '' && draft.time !== '' && selectedCount > 0

  const setUnits = (productId: string, units: number) => {
    const next = { ...draft.units }
    if (units <= 0) delete next[productId]
    else next[productId] = units
    onChange({ ...draft, units: next })
  }

  return (
    <AppShell
      eyebrow="Paramètres · Sortie"
      title={draft.id ? 'Modifier' : 'Nouvelle sortie'}
      subtitle={`${selectedCount} produit${selectedCount > 1 ? 's' : ''}`}
    >
      <div className="mt-1 grid grid-cols-[1fr_105px] gap-2">
        <label>
          <span className="mb-1 block text-[10px] font-bold text-ink-3 uppercase">Nom</span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Prépa du matin"
            className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px]"
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold text-ink-3 uppercase">Heure</span>
          <input
            type="time"
            value={draft.time}
            onChange={(event) => onChange({ ...draft, time: event.target.value })}
            className="tabnums h-10 w-full rounded-[10px] border border-line bg-surface px-2 text-center text-[13px]"
          />
        </label>
      </div>

      <div className="relative mt-2">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher un produit…"
          className="h-10 w-full rounded-[10px] border border-line bg-surface pr-3 pl-9 text-[13px]"
        />
      </div>

      {favorites.length > 0 && (
        <FamilySection title="Favoris" count={favorites.length} compact>
          {favorites.map((product) => (
            <ProgrammedProductRow
              key={product.id}
              product={product}
              units={draft.units[product.id] ?? 0}
              onUnits={(units) => setUnits(product.id, units)}
            />
          ))}
        </FamilySection>
      )}
      {groupByFamily(remaining).map((group) => (
        <FamilySection
          key={group.family}
          title={group.family}
          count={group.items.length}
          compact
          defaultOpen={query.trim() !== ''}
        >
          {group.items.map((product) => (
            <ProgrammedProductRow
              key={product.id}
              product={product}
              units={draft.units[product.id] ?? 0}
              onUnits={(units) => setUnits(product.id, units)}
            />
          ))}
        </FamilySection>
      ))}

      {error && <p className="mt-2 text-[12px] font-semibold text-warn">{error}</p>}
      <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
        <Button variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button onClick={onSave} disabled={!valid || saving}>
          <Check size={17} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </AppShell>
  )
}

function ProgrammedProductRow({
  product,
  units,
  onUnits,
}: {
  product: Product
  units: number
  onUnits: (units: number) => void
}) {
  return (
    <div className="flex h-12 items-center gap-2 px-2.5">
      {product.isFavorite && <Star size={14} className="flex-shrink-0 fill-crust text-crust" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{product.name}</div>
        <div className="truncate text-[9.5px] text-ink-3">Réf {product.ref}</div>
      </div>
      {units <= 0 ? (
        <button
          onClick={() => onUnits(1)}
          className="flex h-8 items-center gap-1 rounded-[9px] bg-crust-soft px-2.5 text-[12px] font-bold text-crust-ink"
        >
          <Plus size={14} /> Ajouter
        </button>
      ) : (
        <div className="flex h-8 items-center overflow-hidden rounded-[9px] border border-line bg-surface-2">
          <button onClick={() => onUnits(units - 1)} className="flex h-8 w-8 items-center justify-center">
            <Minus size={14} />
          </button>
          <input
            value={units}
            onChange={(event) => onUnits(Math.max(0, parseInt(event.target.value) || 0))}
            inputMode="numeric"
            className="tabnums w-10 bg-transparent text-center text-[13px] font-bold"
          />
          <button onClick={() => onUnits(units + 1)} className="flex h-8 w-8 items-center justify-center">
            <Plus size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function toDraft(prepa: Prepa): Draft {
  return {
    id: prepa.id,
    name: prepa.name,
    time: prepa.time,
    units: Object.fromEntries(prepa.lines.map((line) => [line.productId, line.units])),
  }
}

function groupByFamily(items: Product[]): { family: string; items: Product[] }[] {
  const groups = new Map<string, { position: number; items: Product[] }>()
  for (const product of items) {
    const group = groups.get(product.category) ?? { position: product.categoryPosition, items: [] }
    group.items.push(product)
    groups.set(product.category, group)
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].position - b[1].position)
    .map(([family, group]) => ({ family, items: group.items }))
}
