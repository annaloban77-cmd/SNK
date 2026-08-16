'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Tone = 'slate' | 'emerald' | 'amber' | 'red' | 'sky'

const TONE_STYLE: Record<Tone, { bg: string; text: string; ring: string }> = {
  slate: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-700 dark:text-slate-200',
    ring: 'ring-slate-200 dark:ring-slate-700',
  },
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-900',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-900',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    ring: 'ring-red-200 dark:ring-red-900',
  },
  sky: {
    bg: 'bg-sky-100 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-200 dark:ring-sky-900',
  },
}

export interface StatCardProps {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  tone?: Tone
  hint?: React.ReactNode
  loading?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  icon,
  tone = 'slate',
  hint,
  loading,
  className,
}: StatCardProps) {
  const cfg = TONE_STYLE[tone]
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-20 animate-pulse rounded bg-accent" />
          ) : (
            <div className="mt-1 truncate text-2xl font-bold tabular-nums">
              {value}
            </div>
          )}
          {hint ? (
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          ) : null}
        </div>
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg ring-1',
            cfg.bg,
            cfg.text,
            cfg.ring
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}
