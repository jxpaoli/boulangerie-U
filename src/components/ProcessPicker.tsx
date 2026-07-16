import type { ExitProcess } from '@/services'
import { PROCESS_LABEL, PROCESS_ORDER } from '@/lib/process'
import { cn } from '@/lib/cn'

/** Sélecteur segmenté 3 choix : Mise en pousse / Cuisson directe / Décongélation. */
export function ProcessPicker({
  value,
  onChange,
}: {
  value: ExitProcess
  onChange: (process: ExitProcess) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-[12px] bg-surface-2 p-1">
      {PROCESS_ORDER.map((process) => (
        <button
          key={process}
          type="button"
          onClick={() => onChange(process)}
          className={cn(
            'rounded-[9px] px-1 py-2 text-center text-[11.5px] font-bold leading-tight',
            value === process ? 'bg-crust text-white' : 'text-ink-2',
          )}
        >
          {PROCESS_LABEL[process]}
        </button>
      ))}
    </div>
  )
}
