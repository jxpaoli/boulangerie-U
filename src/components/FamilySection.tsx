import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Section « famille » repliable. En-tête cliquable + corps qui se plie. */
export function FamilySection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  count?: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-[12px] bg-surface-2 px-3 py-2.5"
      >
        <ChevronDown
          size={16}
          className={cn('flex-shrink-0 text-ink-3 transition-transform', !open && '-rotate-90')}
        />
        <span className="flex-1 text-left text-[12px] font-bold tracking-[0.1em] text-ink-2 uppercase">
          {title}
        </span>
        {count !== undefined && (
          <span className="tabnums rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink-3">
            {count}
          </span>
        )}
      </button>
      {open && <div className="mt-2 flex flex-col gap-2">{children}</div>}
    </section>
  )
}
