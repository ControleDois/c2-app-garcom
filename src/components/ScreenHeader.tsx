import type { ReactNode } from 'react'
import { ChevronLeftIcon } from './icons'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
}

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  return (
    <div className="flex flex-none items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[var(--ink-soft)] active:bg-[var(--page)]"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
      ) : (
        <span className="w-1" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-extrabold text-[var(--ink)]">{title}</h1>
        {subtitle && <p className="truncate text-[12px] text-[var(--muted)]">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}
