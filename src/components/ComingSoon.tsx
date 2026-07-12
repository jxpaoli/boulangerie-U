import type { LucideIcon } from 'lucide-react'
import { AppShell } from '@/components/AppShell'

export function ComingSoon({
  eyebrow,
  title,
  icon: Icon,
  phase,
  points,
}: {
  eyebrow: string
  title: string
  icon: LucideIcon
  phase: string
  points: string[]
}) {
  return (
    <AppShell eyebrow={eyebrow} title={title}>
      <div className="mt-6 flex flex-col items-center rounded-[var(--radius-app)] border border-dashed border-line bg-surface px-6 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-crust-soft text-crust-ink">
          <Icon size={30} />
        </div>
        <div className="mt-4 text-[15px] font-bold">En construction — {phase}</div>
        <ul className="mt-4 flex flex-col gap-2 text-left text-[13px] text-ink-2">
          {points.map((pt) => (
            <li key={pt} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-crust" />
              {pt}
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  )
}
