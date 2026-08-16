'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type Tone = 'green' | 'amber' | 'red' | 'slate'

const TONE_BG: Record<Tone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  slate: 'bg-slate-400',
}

const TONE_TEXT: Record<Tone, string> = {
  green: 'text-emerald-700 dark:text-emerald-400',
  amber: 'text-amber-700 dark:text-amber-400',
  red: 'text-red-700 dark:text-red-400',
  slate: 'text-slate-700 dark:text-slate-300',
}

function toneForPercent(pct: number): Tone {
  if (pct >= 90) return 'red'
  if (pct >= 60) return 'amber'
  if (pct <= 0) return 'slate'
  return 'green'
}

export interface UsageBarProps {
  label: string
  value: number
  max: number
  /** Optional override — otherwise computed from value/max */
  percent?: number
  hint?: React.ReactNode
  className?: string
}

export function UsageBar({
  label,
  value,
  max,
  percent,
  hint,
  className,
}: UsageBarProps) {
  const pct =
    percent != null
      ? Math.max(0, Math.min(100, percent))
      : max > 0
      ? Math.min(100, Math.round((value / max) * 100))
      : 0
  const tone = toneForPercent(pct)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium tabular-nums', TONE_TEXT[tone])}>
          {value}
          <span className="text-muted-foreground"> / {max}</span>
          <span className="ml-1 text-xs">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            TONE_BG[tone]
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  )
}
