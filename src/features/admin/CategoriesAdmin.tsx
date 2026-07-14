import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ChevronLeft, Plus, Trash2, Check } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { Card, Button } from '@/components/ui'
import { services } from '@/services'
import type { CategoryInput } from '@/services/types'
import { useAuth } from '@/features/auth/AuthContext'

export function CategoriesAdmin() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const siteId = user?.siteId ?? ''

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => services.catalog.listCategories(),
  })
  const [draft, setDraft] = useState<CategoryInput | null>(null)

  const save = useMutation({
    mutationFn: (d: CategoryInput) => services.admin.saveCategory(d),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['categories'] })
      await qc.invalidateQueries({ queryKey: ['products'] })
      setDraft(null)
    },
  })
  const del = useMutation({
    mutationFn: (id: string) => services.admin.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <AppShell
      eyebrow="Paramètres"
      title="Familles"
      action={
        <button
          onClick={() =>
            setDraft({ siteId, name: '', position: (categories.at(-1)?.position ?? 0) + 1 })
          }
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

      {draft && (
        <Card className="mt-3">
          <div className="text-[13px] font-bold text-ink-2">
            {draft.id ? 'Modifier la famille' : 'Nouvelle famille'}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <label className="flex-1">
              <div className="mb-1 text-[10.5px] font-bold text-ink-3 uppercase">Nom</div>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-[12px] border border-line bg-surface px-3.5 py-2.5 text-[15px]"
              />
            </label>
            <label className="w-20">
              <div className="mb-1 text-[10.5px] font-bold text-ink-3 uppercase">Ordre</div>
              <input
                value={draft.position}
                onChange={(e) =>
                  setDraft({ ...draft, position: Math.max(0, parseInt(e.target.value) || 0) })
                }
                inputMode="numeric"
                className="tabnums w-full rounded-[12px] border border-line bg-surface px-3 py-2.5 text-center text-[15px] font-bold"
              />
            </label>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_2fr] gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button
              onClick={() => save.mutate(draft)}
              disabled={draft.name.trim() === '' || save.isPending}
            >
              <Check size={18} /> Enregistrer
            </Button>
          </div>
          {save.error instanceof Error && (
            <div className="mt-2 text-[12px] font-semibold text-warn">{save.error.message}</div>
          )}
        </Card>
      )}

      <div className="mt-2 overflow-hidden rounded-[14px] border border-line/80 bg-surface divide-y divide-line">
        {categories.map((c) => (
          <div key={c.id} className="flex h-11 items-center gap-2 px-2.5">
            <span className="tabnums w-5 text-center text-[11px] font-bold text-ink-3">
              {c.position}
            </span>
            <button
              onClick={() => setDraft({ id: c.id, siteId, name: c.name, position: c.position })}
              className="min-w-0 flex-1 text-left text-[13.5px] font-semibold"
            >
              {c.name}
            </button>
            <button
              onClick={() => {
                if (confirm(`Supprimer la famille « ${c.name} » ?`)) del.mutate(c.id)
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
