'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { SeverityBadge } from './nk-severity-badge'
import { IssueStatusBadge } from './nk-status-badge'
import {
  useUpdateIssue,
  useStandards,
  useStandard,
  useStandardClauses,
} from '@/hooks/use-nk-api'
import type { IssueDto, StandardDto, StandardClauseDto, RuleDto } from '@/lib/types'
import {
  MoreHorizontal,
  Check,
  Ban,
  Wrench,
  RotateCcw,
  FileText,
  Lightbulb,
  ShieldCheck,
  ExternalLink,
  BookOpen,
  ListChecks,
  ChevronDown,
} from 'lucide-react'
import {
  issueSourceLabel as sourceLbl,
  standardTypeLabel,
  formatDate,
} from './nk-format'

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

type IssueStatus = IssueDto['status']

export function IssueCard({ issue }: { issue: IssueDto }) {
  const update = useUpdateIssue()
  const [collapsed, setCollapsed] = React.useState(false)
  const [gostOpen, setGostOpen] = React.useState(false)

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
                <button
                  type="button"
                  className="font-mono text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
                  onClick={() => setGostOpen(true)}
                  title="Открыть карточку ГОСТ и правила"
                >
                  {issue.rule.code}
                </button>{' '}
                · {issue.rule.name}
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
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 transition-colors hover:bg-accent"
                  onClick={() => setGostOpen(true)}
                  title="Открыть карточку ГОСТ"
                >
                  <ShieldCheck className="size-3.5" />
                  ГОСТ:{' '}
                  <span className="font-mono text-foreground">
                    {issue.gostRef}
                  </span>
                </button>
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
          {issue.gostRef ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGostOpen(true)}
            >
              <BookOpen className="size-3.5" />
              Прочитать ГОСТ
            </Button>
          ) : null}
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

      <GostDialog
        open={gostOpen}
        onOpenChange={setGostOpen}
        gostRef={issue.gostRef}
        rule={issue.rule}
      />
    </Card>
  )
}

/**
 * Extract a search token from a gostRef like "ГОСТ 2.104-2006, п. 3".
 * Returns "ГОСТ 2.104-2006" (without the ", п. 3" suffix).
 */
function gostSearchToken(gostRef: string | null | undefined): string {
  if (!gostRef) return ''
  // Cut off clause suffix after the first comma
  const head = gostRef.split(',')[0]?.trim() ?? gostRef.trim()
  return head
}

function GostDialog({
  open,
  onOpenChange,
  gostRef,
  rule,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  gostRef: string | null
  rule: { id: string; code: string; name: string; standardId?: string | null } | null | undefined
}) {
  const searchToken = gostSearchToken(gostRef)
  // Fetch standards by code search
  const standardsQ = useStandards({
    search: searchToken || undefined,
    pageSize: 5,
  })

  // Pick the first matching standard
  const matchedStandard: StandardDto | null =
    (standardsQ.data?.items ?? [])[0] ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="size-5 text-muted-foreground" />
            {gostRef ? (
              <span className="font-mono">{gostRef}</span>
            ) : (
              <span>ГОСТ не указан</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Карточка стандарта и связанных правил
          </DialogDescription>
        </DialogHeader>

        {rule ? (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Правило, породившее замечание
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {rule.code}
              </Badge>
              <span className="text-sm font-medium">{rule.name}</span>
            </div>
          </div>
        ) : null}

        {!gostRef ? (
          <p className="text-sm text-muted-foreground">
            В замечании не указана ссылка на ГОСТ.
          </p>
        ) : standardsQ.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : matchedStandard ? (
          <StandardDetailBlock standard={matchedStandard} />
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
            ГОСТ не найден в локальной базе знаний. Попробуйте обновить
            справочник стандартов или добавить его вручную.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StandardDetailBlock({ standard }: { standard: StandardDto }) {
  const { data, isLoading } = useStandard(standard.id)
  const clausesQ = useStandardClauses(standard.id)
  const [clausesOpen, setClausesOpen] = React.useState(true)
  const linkedRules: RuleDto[] = data?.rules ?? []

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Наименование
        </div>
        <div className="mt-0.5 font-medium">{standard.name}</div>
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Область применения
        </div>
        <p className="mt-0.5">{standard.scope}</p>
      </div>
      {standard.description ? (
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Описание
          </div>
          <p className="mt-0.5 whitespace-pre-wrap">{standard.description}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Тип
          </div>
          <div className="mt-0.5">
            <Badge variant="outline" className="text-xs">
              {standardTypeLabel(standard.type)}
            </Badge>
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Статус
          </div>
          <div className="mt-0.5">
            {standard.status === 'active'
              ? 'Действует'
              : standard.status === 'draft'
              ? 'Черновик'
              : 'Отменён'}
          </div>
        </div>
      </div>

      {standard.sourceUrl ? (
        <div>
          <Button asChild variant="outline" size="sm">
            <a href={standard.sourceUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> Открыть на ЦНТД
            </a>
          </Button>
        </div>
      ) : null}

      {(clausesQ.data?.items?.length ?? 0) > 0 ? (
        <Collapsible open={clausesOpen} onOpenChange={setClausesOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50">
            <span className="flex items-center gap-2">
              <ListChecks className="size-4 text-amber-600" />
              Ключевые пункты ({clausesQ.data?.items?.length ?? 0})
            </span>
            <ChevronDown
              className={`size-4 transition-transform ${
                clausesOpen ? 'rotate-180' : ''
              }`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {(clausesQ.data?.items ?? []).map((c: StandardClauseDto) => (
              <div key={c.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs font-semibold">
                    {c.number}
                    {c.title ? ` · ${c.title}` : ''}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      c.severity === 'high'
                        ? 'border-red-200 text-red-700 dark:border-red-900 dark:text-red-300'
                        : c.severity === 'medium'
                        ? 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300'
                        : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {c.severity === 'high'
                      ? 'Высокая'
                      : c.severity === 'medium'
                      ? 'Средняя'
                      : 'Низкая'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Связанные правила ({linkedRules.length})
        </div>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : linkedRules.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Нет связанных правил
          </div>
        ) : (
          <ul className="space-y-1.5">
            {linkedRules.map((r: RuleDto) => (
              <li
                key={r.id}
                className="flex items-start gap-2 rounded-md border p-2"
              >
                <Badge variant="outline" className="font-mono text-xs">
                  {r.code}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">
                    {r.description}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground">
        Обновлено: {formatDate(standard.updatedAt)}
      </div>
    </div>
  )
}
