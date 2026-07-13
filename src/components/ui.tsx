import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-[16px] border border-line/80 bg-surface p-3 shadow-[0_5px_18px_rgba(30,38,70,.04)]',
        onClick && 'cursor-pointer transition duration-200 active:scale-[.985]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mx-1 mt-4 mb-1.5 text-[10px] font-black tracking-[0.18em] text-ink-3 uppercase">
      {children}
    </h2>
  )
}

type Tone = 'crust' | 'ok' | 'warn' | 'danger' | 'neutral'

const toneMap: Record<Tone, string> = {
  crust: 'bg-crust-soft text-crust-ink',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-2 text-ink-2 border border-line',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide whitespace-nowrap',
        toneMap[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  type = 'button',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'soft'
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const variants = {
    primary: 'bg-ink text-bg shadow-[0_12px_30px_rgba(15,18,35,.25)]',
    soft: 'bg-crust-soft text-crust-ink',
    ghost: 'bg-surface border border-line text-ink',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[13px] px-3.5 py-3 text-[14px] font-black transition active:scale-[0.98] disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function StatTile({
  n,
  label,
  tone = 'crust',
}: {
  n: ReactNode
  label: string
  tone?: 'crust' | 'warn' | 'ok'
}) {
  const color = tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-crust'
  return (
    <div className="rounded-[16px] border border-line/80 bg-surface p-3 shadow-[0_5px_18px_rgba(30,38,70,.04)]">
      <div className={cn('tabnums text-[32px] leading-none font-black tracking-[-.06em]', color)}>{n}</div>
      <div className="mt-1 text-[11px] leading-tight font-medium text-ink-2">{label}</div>
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[16px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-3">
      {children}
    </div>
  )
}
