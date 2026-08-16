'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  History,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Globe,
  Cpu,
  ShieldCheck,
  Plus,
  Pencil,
  Eye,
  Trash2,
  KeyRound,
  Building2,
  Settings as SettingsIcon,
  FileText,
  Ban,
  PlayCircle,
  FileSearch,
} from 'lucide-react'
import { useAuditLog, useOrgUsers, type AuditFilters } from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { formatDateTime } from './nk-format'
import type { AuditLogDto } from '@/lib/types'

const ACTION_OPTIONS = [
  { value: 'all', label: 'Все действия' },
  { value: 'organization', label: 'Организация' },
  { value: 'user', label: 'Пользователи' },
  { value: 'apikey', label: 'API-ключи' },
  { value: 'rule', label: 'Правила' },
  { value: 'standard', label: 'Стандарты' },
  { value: 'document', label: 'Документы' },
  { value: 'api', label: 'API-запросы' },
]

type ActionTone = 'green' | 'blue' | 'red' | 'slate'

interface ActionMeta {
  label: string
  icon: React.ReactNode
  tone: ActionTone
}

function getActionMeta(action: string): ActionMeta {
  // Patterns: organization.created, user.invited, apikey.created, rule.toggled, etc.
  const [domain, verb] = action.split('.')
  const tone: ActionTone =
    verb === 'created' || verb === 'invited' || verb === 'added'
      ? 'green'
      : verb === 'updated' || verb === 'viewed' || verb === 'listed' || verb === 'toggled'
      ? 'blue'
      : verb === 'deleted' || verb === 'revoked' || verb === 'removed'
      ? 'red'
      : 'slate'

  const domainIcon: Record<string, React.ReactNode> = {
    organization: <Building2 className="size-3.5" />,
    user: <UserIcon className="size-3.5" />,
    apikey: <KeyRound className="size-3.5" />,
    rule: <SettingsIcon className="size-3.5" />,
    standard: <ShieldCheck className="size-3.5" />,
    document: <FileText className="size-3.5" />,
    api: <Cpu className="size-3.5" />,
  }

  const verbLabel: Record<string, string> = {
    created: 'создание',
    updated: 'обновление',
    invited: 'приглашение',
    added: 'добавление',
    viewed: 'просмотр',
    listed: 'список',
    toggled: 'переключение',
    deleted: 'удаление',
    revoked: 'отзыв',
    removed: 'удаление',
    analyzed: 'анализ',
    uploaded: 'загрузка',
  }

  const domainLabel: Record<string, string> = {
    organization: 'организация',
    user: 'пользователь',
    apikey: 'API-ключ',
    rule: 'правило',
    standard: 'стандарт',
    document: 'документ',
    api: 'API',
  }

  return {
    label: `${domainLabel[domain] ?? domain} · ${verbLabel[verb] ?? verb}`,
    icon: domainIcon[domain] ?? <History className="size-3.5" />,
    tone,
  }
}

const TONE_STYLE: Record<ActionTone, { badge: string; icon: string }> = {
  green: {
    badge:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  blue: {
    badge:
      'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-900',
    icon: 'text-sky-600 dark:text-sky-400',
  },
  red: {
    badge:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-900',
    icon: 'text-red-600 dark:text-red-400',
  },
  slate: {
    badge:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
    icon: 'text-slate-600 dark:text-slate-400',
  },
}

function actionVerbIcon(verb: string): React.ReactNode {
  if (verb === 'created' || verb === 'invited' || verb === 'added')
    return <Plus className="size-3.5" />
  if (verb === 'updated' || verb === 'toggled')
    return <Pencil className="size-3.5" />
  if (verb === 'viewed' || verb === 'listed')
    return <Eye className="size-3.5" />
  if (verb === 'deleted' || verb === 'removed')
    return <Trash2 className="size-3.5" />
  if (verb === 'revoked') return <Ban className="size-3.5" />
  if (verb === 'analyzed') return <FileSearch className="size-3.5" />
  if (verb === 'uploaded') return <PlayCircle className="size-3.5" />
  return <History className="size-3.5" />
}

export function AuditLog() {
  const [filters, setFilters] = React.useState<AuditFilters>({
    action: 'all',
    userId: 'all',
    page: 1,
    pageSize: 25,
  })
  const usersQ = useOrgUsers()

  function setField<K extends keyof AuditFilters>(k: K, v: AuditFilters[K]) {
    setFilters((f) => ({ ...f, [k]: v, page: 1 }))
  }

  const { data, isLoading, isError, refetch, isFetching } = useAuditLog(filters)

  const total = data?.total ?? 0
  const pageSize = data?.pageSize ?? 25
  const page = data?.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Аудит"
        description="Журнал действий пользователей и API-запросов"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            Обновить
          </Button>
        }
      />

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Действие
            </label>
            <Select
              value={filters.action ?? 'all'}
              onValueChange={(v) => setField('action', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Пользователь
            </label>
            <Select
              value={filters.userId ?? 'all'}
              onValueChange={(v) => setField('userId', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все пользователи</SelectItem>
                <SelectItem value="system">Система</SelectItem>
                {(usersQ.data?.items ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Всего записей: <span className="font-medium tabular-nums">{total}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
              <RefreshCw className="size-3" />
              Авто-обновление 30с
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Журнал событий
          </CardTitle>
          <CardDescription>
            Стр. {page} из {totalPages} · {total} событий
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {isError ? (
            <div className="px-6">
              <ErrorState
                message="Не удалось загрузить журнал аудита"
                onRetry={() => refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="space-y-2 px-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (data?.items ?? []).length === 0 ? (
            <div className="px-6">
              <EmptyState
                icon={<History className="size-6" />}
                title="Событий не найдено"
                description="Измените фильтры или подождите — журнал обновляется автоматически"
              />
            </div>
          ) : (
            <ScrollArea className="max-h-[40rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Время</TableHead>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Действие</TableHead>
                    <TableHead>Ресурс</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="pr-6">Детали</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
        {(data?.items ?? []).length > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t p-3">
            <div className="text-xs text-muted-foreground">
              Показано {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} из {total}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}
              >
                <ChevronLeft className="size-4" />
                Назад
              </Button>
              <span className="text-xs tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}
              >
                Вперёд
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}

function AuditRow({ entry }: { entry: AuditLogDto }) {
  const meta = getActionMeta(entry.action)
  const verb = entry.action.split('.')[1] ?? ''
  const toneStyle = TONE_STYLE[meta.tone]
  const [open, setOpen] = React.useState(false)

  let details: unknown = null
  if (entry.details) {
    try {
      details = JSON.parse(entry.details)
    } catch {
      details = entry.details
    }
  }

  return (
    <TableRow>
      <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDateTime(entry.createdAt)}
      </TableCell>
      <TableCell>
        {entry.user ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{entry.user.email}</span>
            {entry.user.name ? (
              <span className="text-xs text-muted-foreground">{entry.user.name}</span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Cpu className="size-3.5" />
            Система
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`gap-1 ${toneStyle.badge}`}>
          <span className={toneStyle.icon}>{actionVerbIcon(verb)}</span>
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell>
        {entry.resourceType ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs">{entry.resourceType}</span>
            {entry.resourceId ? (
              <code className="font-mono text-[10px] text-muted-foreground">
                {entry.resourceId.slice(0, 12)}…
              </code>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {entry.ipAddress ? (
          <span className="inline-flex items-center gap-1">
            <Globe className="size-3" />
            {entry.ipAddress}
          </span>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="pr-6">
        {entry.details ? (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-emerald-700 hover:underline dark:text-emerald-400">
              <ChevronDown
                className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`}
              />
              {open ? 'Скрыть' : 'Показать'}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-1 max-w-md overflow-x-auto rounded-md border bg-muted/30 p-2 text-[10px] leading-relaxed">
                <code className="font-mono">
                  {typeof details === 'string'
                    ? details
                    : JSON.stringify(details, null, 2)}
                </code>
              </pre>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}
