'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Severity } from '@/lib/types'
import { AlertTriangle, ArrowDown, Minus } from 'lucide-react'

const SEVERITY_STYLE: Record<
  Severity,
  { label: string; className: string; icon: React.ReactNode }
> = {
  high: {
    label: 'Высокая',
    className:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-900',
    icon: <AlertTriangle className="size-3" />,
  },
  medium: {
    label: 'Средняя',
    className:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900',
    icon: <AlertTriangle className="size-3" />,
  },
  low: {
    label: 'Низкая',
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
    icon: <Minus className="size-3" />,
  },
}

export function SeverityBadge({
  severity,
  className,
  showIcon = true,
}: {
  severity: Severity
  className?: string
  showIcon?: boolean
}) {
  const cfg = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.low
  return (
    <Badge variant="outline" className={cn(cfg.className, className)}>
      {showIcon ? cfg.icon : null}
      {cfg.label}
    </Badge>
  )
}

/** Compact "H:2 M:1 L:0" summary used in document rows */
export function IssuesSummary({
  high,
  medium,
  low,
}: {
  high: number
  medium: number
  low: number
}) {
  return (
    <div className="flex items-center gap-1">
      <Badge
        variant="outline"
        className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900 tabular-nums"
      >
        H:{high}
      </Badge>
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 tabular-nums"
      >
        M:{medium}
      </Badge>
      <Badge
        variant="outline"
        className="bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700 tabular-nums"
      >
        L:{low}
      </Badge>
    </div>
  )
}

// unused import suppression for ArrowDown (kept for future use)
void ArrowDown
