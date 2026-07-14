import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Button, Card } from '@/components/ui'
import { services, type AppSettings } from '@/services'

export function OrderSettingsAdmin() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => services.catalog.getSettings() })
  const [draft, setDraft] = useState<AppSettings>({ safetyDeliveries: 1, recalibrationThreshold: 0.2 })

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  const save = useMutation({
    mutationFn: () => services.admin.saveSettings(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  return (
    <AppShell eyebrow="Paramètres" title="Calcul des commandes">
      <button
        onClick={() => navigate('/parametres')}
        className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-ink-2"
      >
        <ChevronLeft size={15} /> Paramètres
      </button>

      <Card className="mt-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-crust-soft text-crust-ink">
            <ShieldCheck size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold">Filet de sécurité</div>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-2">
              Prévoit assez de stock au cas où une livraison serait manquée ou incomplète.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((value) => (
            <button
              key={value}
              onClick={() => setDraft((current) => ({ ...current, safetyDeliveries: value }))}
              className={
                'rounded-[10px] border py-2.5 text-[12px] font-bold ' +
                (draft.safetyDeliveries === value
                  ? 'border-crust bg-crust text-white'
                  : 'border-line bg-surface-2 text-ink-2')
              }
            >
              {value === 0 ? 'Au plus juste' : `+${value} livraison${value > 1 ? 's' : ''}`}
            </button>
          ))}
        </div>
      </Card>

      {save.error instanceof Error && (
        <p className="mt-2 text-[12px] font-semibold text-danger">{save.error.message}</p>
      )}
      {save.isSuccess && <p className="mt-2 text-[12px] font-semibold text-ok">Réglage enregistré.</p>}
      <Button className="mt-3 w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        <Check size={17} /> {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </AppShell>
  )
}
