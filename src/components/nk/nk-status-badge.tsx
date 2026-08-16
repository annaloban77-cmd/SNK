'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle2, XCircle, FileClock, CircleDashed, Check, Ban, Wrench } from 'lucide-react'
import type { DocumentStatus, IssueStatus } from '@/lib/types'

const DOC_STATUS_STYLE: Record<
  DocumentStatus,
  { label: string; className: string; icon?: React.ReactNode }
> = {
  new: {
    label: 'Новый',
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
    icon: <CircleDashed className="size-3" />,
  },
  processing: {
    label: 'В проверке',
    className:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900',
    icon: <Loader2 className="size-3 animate-spin" />,
  },
  analyzed: {
    label: 'Проверен',
    className:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
    icon: <CheckCircle2 className="size-3" />,
  },
  failed: {
    label: 'Ошибка',
    className:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-900',
    icon: <XCircle className="size-3" />,
  },
}

const ISSUE_STATUS_STYLE: Record<
  IssueStatus,
  { label: string; className: string; icon?: React.ReactNode }
> = {
  new: {
    label: 'Новое',
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
    icon: <CircleDashed className="size-3" />,
  },
  confirmed: {
    label: 'Подтверждено',
    className:
      'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-900',
    icon: <Check className="size-3" />,
  },
  rejected: {
    label: 'Отклонено',
    className:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-900',
    icon: <Ban className="size-3" />,
  },
  fixed: {
    label: 'Исправлено',
    className:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
    icon: <Wrench className="size-3" />,
  },
}

export function DocStatusBadge({
  status,
  className,
  showIcon = true,
}: {
  status: DocumentStatus
  className?: string
  showIcon?: boolean
}) {
  const cfg = DOC_STATUS_STYLE[status] ?? DOC_STATUS_STYLE.new
  return (
    <Badge variant="outline" className={cn(cfg.className, className)}>
      {showIcon ? cfg.icon : null}
      {cfg.label}
    </Badge>
  )
}

export function IssueStatusBadge({
  status,
  className,
  showIcon = true,
}: {
  status: IssueStatus
  className?: string
  showIcon?: boolean
}) {
  const cfg = ISSUE_STATUS_STYLE[status] ?? ISSUE_STATUS_STYLE.new
  return (
    <Badge variant="outline" className={cn(cfg.className, className)}>
      {showIcon ? cfg.icon : null}
      {cfg.label}
    </Badge>
  )
}

// unused import suppression
void FileClock
