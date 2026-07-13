import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Section « famille » repliable. En-tête cliquable + corps qui se plie. */
export function FamilySection({
  title,
  count,
  defaultOpen = true,
  compact = false,
  children,
}: {
  title: string
  count?: number
  defaultOpen?: boolean
  compact?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={compact ? 'mt-2' : 'mt-3'}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-[12px] bg-surface-2 px-3',
          compact ? 'py-1.5' : 'py-2.5',
        )}
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
      {open && (
        <div
          className={cn(
            compact
              ? 'mt-1 overflow-hidden rounded-[13px] border border-line/80 bg-surface [&>*+*]:border-t [&>*+*]:border-line'
              : 'mt-2 flex flex-col gap-2',
          )}
        >
          {children}
        </div>
      )}
    </section>
  )
}
