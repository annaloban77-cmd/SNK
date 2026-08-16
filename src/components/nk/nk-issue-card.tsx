'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SeverityBadge } from './nk-severity-badge'
import { IssueStatusBadge } from './nk-status-badge'
import { useUpdateIssue } from '@/hooks/use-nk-api'
import type { IssueDto, IssueStatus } from '@/lib/types'
import {
  MoreHorizontal,
  Check,
  Ban,
  Wrench,
  RotateCcw,
  FileText,
  Lightbulb,
  ShieldCheck,
} from 'lucide-react'
import { issueSourceLabel as sourceLbl } from './nk-format'

const ACTION_LABEL: Record<
  'confirm' | 'reject' | 'fix' | 'reset',
  { label: string; icon: React.ReactNode; status: IssueStatus }
> = {
  confirm: {
    label: 'Подтвердить',
    icon: <Check className="size-3.5" />,
    status: 'confirmed',
  },
  reject: {
    label: 'Отклонить',
    icon: <Ban className="size-3.5" />,
    status: 'rejected',
  },
  fix: {
    label: 'Исправлено',
    icon: <Wrench className="size-3.5" />,
    status: 'fixed',
  },
  reset: {
    label: 'Сбросить',
    icon: <RotateCcw className="size-3.5" />,
    status: 'new',
  },
}

export function IssueCard({ issue }: { issue: IssueDto }) {
  const update = useUpdateIssue()
  const [collapsed, setCollapsed] = React.useState(false)

  function act(action: 'confirm' | 'reject' | 'fix' | 'reset') {
    update.mutate({ id: issue.id, status: ACTION_LABEL[action].status })
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={issue.severity} />
              <Badge variant="outline" className="font-mono text-xs">
                {issue.code}
              </Badge>
              <IssueStatusBadge status={issue.status} />
              <Badge
                variant="outline"
                className="bg-muted/40 text-xs font-normal"
              >
                {sourceLbl(issue.source)}
              </Badge>
            </div>
            <CardTitle className="text-base font-semibold">
              {issue.title}
            </CardTitle>
            {issue.rule ? (
              <div className="text-xs text-muted-foreground">
                Правило:{' '}
                <span className="font-mono">{issue.rule.code}</span> ·{' '}
                {issue.rule.name}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? 'Подробнее' : 'Свернуть'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => act('confirm')}>
                  {ACTION_LABEL.confirm.icon} Подтвердить
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => act('reject')}>
                  {ACTION_LABEL.reject.icon} Отклонить
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => act('fix')}>
                  {ACTION_LABEL.fix.icon} Исправлено
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => act('reset')}>
                  {ACTION_LABEL.reset.icon} Сбросить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-foreground/90">{issue.description}</p>

        {!collapsed ? (
          <>
            {issue.requirement ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <FileText className="size-3.5" />
                  Требование стандарта
                </div>
                <p className="text-sm">{issue.requirement}</p>
              </div>
            ) : null}

            {issue.recommendation ? (
              <div className="rounded-md border bg-emerald-50/40 p-3 dark:bg-emerald-950/20">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  <Lightbulb className="size-3.5" />
                  Рекомендация
                </div>
                <p className="text-sm">{issue.recommendation}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {issue.gostRef ? (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-3.5" />
                  ГОСТ:{' '}
                  <span className="font-mono text-foreground">
                    {issue.gostRef}
                  </span>
                </span>
              ) : null}
              {issue.field ? (
                <span>
                  Поле:{' '}
                  <span className="font-mono text-foreground">
                    {issue.field}
                  </span>
                </span>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="bg-emerald-50/40 hover:bg-emerald-100 dark:bg-emerald-950/20"
            onClick={() => act('confirm')}
            disabled={update.isPending || issue.status === 'confirmed'}
          >
            <Check className="size-3.5" /> Подтвердить
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-red-50/40 hover:bg-red-100 dark:bg-red-950/20"
            onClick={() => act('reject')}
            disabled={update.isPending || issue.status === 'rejected'}
          >
            <Ban className="size-3.5" /> Отклонить
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => act('fix')}
            disabled={update.isPending || issue.status === 'fixed'}
          >
            <Wrench className="size-3.5" /> Исправлено
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// (no extra exports — IssueCard is the only export)
