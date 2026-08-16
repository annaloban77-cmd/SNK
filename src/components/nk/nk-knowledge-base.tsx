'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import {
  BookOpen,
  RefreshCw,
  ShieldCheck,
  ListChecks,
  ExternalLink,
  ChevronDown,
  FileText,
  Globe,
  Database,
  Library,
} from 'lucide-react'
import {
  useStandards,
  useStandard,
  useStandardsStats,
  useStandardClauses,
  type StandardFilters,
} from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { CategoryFilter } from './nk-category-filter'
import {
  formatDate,
  standardTypeLabel,
} from './nk-format'
import type { RuleDto, StandardDto, StandardClauseDto } from '@/lib/types'

const TYPE_OPTIONS = [
  { value: 'all', label: 'Все типы' },
  { value: 'GOST', label: 'ГОСТ' },
  { value: 'OST', label: 'ОСТ' },
  { value: 'STO', label: 'СТО' },
  { value: 'RD', label: 'РД' },
  { value: 'REGISTER', label: 'Регистр' },
  { value: 'ESKD', label: 'ЕСКД' },
  { value: 'SPDS', label: 'СПДС' },
]

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Все источники' },
  { value: 'manual', label: 'Ручной ввод' },
  { value: 'cntd', label: 'ЦНТД' },
  { value: 'rs-class', label: 'RS-Class' },
  { value: 'rr-reg', label: 'Регистр РФ' },
]

const STATUS_BADGE_STYLE: Record<string, string> = {
  active:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
  draft:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900',
  cancelled:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
}

const SOURCE_BADGE: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  manual: {
    label: 'Ручной',
    icon: <FileText className="size-3" />,
    cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
  },
  cntd: {
    label: 'ЦНТД',
    icon: <Database className="size-3" />,
    cls: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-900',
  },
  'rs-class': {
    label: 'RS-Class',
    icon: <Globe className="size-3" />,
    cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-900',
  },
  'rr-reg': {
    label: 'Регистр РФ',
    icon: <ShieldCheck className="size-3" />,
    cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-900',
  },
}

function sourceBadge(source: string) {
  return SOURCE_BADGE[source] ?? {
    label: source,
    icon: <Globe className="size-3" />,
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
  }
}

export function KnowledgeBase() {
  const [filters, setFilters] = React.useState<StandardFilters>({
    type: 'all',
    category: 'all',
    source: 'all',
    search: '',
    page: 1,
    pageSize: 60,
  })
  const [searchBox, setSearchBox] = React.useState(filters.search ?? '')
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchBox, page: 1 }))
    }, 350)
    return () => clearTimeout(t)
  }, [searchBox])

  const { data, isLoading, isError, refetch, isFetching } = useStandards(filters)
  const statsQ = useStandardsStats()

  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const categoryOptions = React.useMemo(() => {
    return (statsQ.data?.byCategory ?? [])
      .filter((c) => c.category && c.category !== 'unknown')
      .map((c) => ({
        category: c.category,
        label: c.label,
        count: c.count,
        color: c.color,
      }))
  }, [statsQ.data])

  return (
    <div className="space-y-5">
      <PageHeader
        title="База знаний"
        description="Нормативные документы: ГОСТ, ОСТ, СТО, РД, Регистр, ЕСКД, СПДС"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw
              className={isFetching ? 'size-4 animate-spin' : 'size-4'}
            />
            Обновить
          </Button>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          label="Всего стандартов"
          value={statsQ.data?.total ?? 0}
          loading={statsQ.isLoading}
          icon={<BookOpen className="size-4" />}
          tone="slate"
        />
        <MiniStat
          label="Действующих"
          value={statsQ.data?.activeCount ?? 0}
          loading={statsQ.isLoading}
          icon={<ShieldCheck className="size-4" />}
          tone="emerald"
        />
        <MiniStat
          label="С пунктами"
          value={statsQ.data?.withClausesCount ?? 0}
          loading={statsQ.isLoading}
          icon={<ListChecks className="size-4" />}
          tone="amber"
        />
        <MiniStat
          label="Категорий"
          value={(statsQ.data?.byCategory ?? []).filter((c) => c.category && c.category !== 'unknown').length}
          loading={statsQ.isLoading}
          icon={<Library className="size-4" />}
          tone="sky"
        />
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          {/* Category filter — button group */}
          <CategoryFilter
            options={categoryOptions}
            value={filters.category ?? 'all'}
            onChange={(c) =>
              setFilters((f) => ({ ...f, category: c, page: 1 }))
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Тип
              </label>
              <Select
                value={filters.type ?? 'all'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, type: v, page: 1 }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Источник
              </label>
              <Select
                value={filters.source ?? 'all'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, source: v, page: 1 }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Поиск
              </label>
              <Input
                placeholder="Код, наименование…"
                value={searchBox}
                onChange={(e) => setSearchBox(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Найдено: {data?.total ?? 0}</span>
            {filters.category && filters.category !== 'all' ? (
              <button
                type="button"
                className="text-emerald-700 hover:underline dark:text-emerald-400"
                onClick={() =>
                  setFilters((f) => ({ ...f, category: 'all', page: 1 }))
                }
              >
                Сбросить категорию
              </button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {isError ? (
        <ErrorState
          message="Не удалось загрузить стандарты"
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6" />}
          title="Стандарты не найдены"
          description="Измените фильтры или запросите добавление стандарта"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((s) => (
            <StandardCard
              key={s.id}
              standard={s}
              onOpen={() => setSelectedId(s.id)}
            />
          ))}
        </div>
      )}

      <StandardDetailDialog
        id={selectedId}
        onOpenChange={(v) => !v && setSelectedId(null)}
      />
    </div>
  )
}

function MiniStat({
  label,
  value,
  loading,
  icon,
  tone,
}: {
  label: string
  value: number
  loading?: boolean
  icon: React.ReactNode
  tone: 'slate' | 'emerald' | 'amber' | 'sky'
}) {
  const cls: Record<typeof tone, string> = {
    slate: 'text-slate-700 dark:text-slate-300',
    emerald: 'text-emerald-700 dark:text-emerald-400',
    amber: 'text-amber-700 dark:text-amber-400',
    sky: 'text-sky-700 dark:text-sky-400',
  } as const
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`${cls[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-5 w-12" />
          ) : (
            <div className="text-xl font-bold tabular-nums">{value}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StandardCard({
  standard,
  onOpen,
}: {
  standard: StandardDto
  onOpen: () => void
}) {
  const sb = sourceBadge(standard.source)
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={onOpen}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-sm font-bold">{standard.code}</div>
          <Badge variant="outline" className="text-xs">
            {standardTypeLabel(standard.type)}
          </Badge>
        </div>
        <CardTitle className="line-clamp-2 text-base">{standard.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {standard.scope}
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-0 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${
              STATUS_BADGE_STYLE[standard.status] ?? ''
            }`}
          >
            {standard.status === 'active'
              ? 'Действует'
              : standard.status === 'draft'
              ? 'Черновик'
              : 'Отменён'}
          </span>
          {standard.publishedAt ? formatDate(standard.publishedAt) : '—'}
        </span>
        <div className="flex items-center gap-1.5">
          {standard.clausesCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <ListChecks className="size-3" />
              {standard.clausesCount} п.
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${sb.cls}`}
            title={`Источник: ${sb.label}`}
          >
            {sb.icon}
            {sb.label}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

function StandardDetailDialog({
  id,
  onOpenChange,
}: {
  id: string | null
  onOpenChange: (v: boolean) => void
}) {
  const { data, isLoading } = useStandard(id)
  const clausesQ = useStandardClauses(id)
  const [clausesOpen, setClausesOpen] = React.useState(true)

  React.useEffect(() => {
    if (!id) setClausesOpen(true)
  }, [id])

  const hasClauses =
    (data?.clausesCount ?? 0) > 0 || (clausesQ.data?.items?.length ?? 0) > 0
  const sb = data ? sourceBadge(data.source) : null

  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="size-5 text-muted-foreground" />
            {isLoading ? (
              <Skeleton className="h-6 w-32" />
            ) : (
              <span className="font-mono">{data?.code}</span>
            )}
            {data ? (
              <Badge variant="outline" className="text-xs">
                {standardTypeLabel(data.type)}
              </Badge>
            ) : null}
            {data && sb ? (
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${sb.cls}`}
              >
                {sb.icon}
                {sb.label}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>{data?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Область применения
            </div>
            <p className="mt-0.5">{data?.scope}</p>
          </div>
          {data?.description ? (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Описание
              </div>
              <p className="mt-0.5 whitespace-pre-wrap">{data.description}</p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Статус
              </div>
              <div className="mt-0.5">
                {data?.status === 'active'
                  ? 'Действует'
                  : data?.status === 'draft'
                  ? 'Черновик'
                  : 'Отменён'}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Опубликован
              </div>
              <div className="mt-0.5">{formatDate(data?.publishedAt)}</div>
            </div>
          </div>

          {data?.sourceUrl ? (
            <div>
              <Button asChild variant="outline" size="sm">
                <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" /> Открыть оригинал
                </a>
              </Button>
            </div>
          ) : null}

          {/* Key clauses (collapsible) */}
          {hasClauses ? (
            <Collapsible open={clausesOpen} onOpenChange={setClausesOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/50">
                <span className="flex items-center gap-2">
                  <ListChecks className="size-4 text-amber-600" />
                  Ключевые пункты ({clausesQ.data?.items?.length ?? data?.clausesCount ?? 0})
                </span>
                <ChevronDown
                  className={`size-4 transition-transform ${
                    clausesOpen ? 'rotate-180' : ''
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {clausesQ.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (clausesQ.data?.items ?? []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Список пунктов пуст
                  </div>
                ) : (
                  (clausesQ.data?.items ?? []).map((c: StandardClauseDto) => (
                    <div
                      key={c.id}
                      className="rounded-md border p-3 text-sm"
                    >
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
                      <p className="mt-1 text-sm text-muted-foreground">
                        {c.text}
                      </p>
                    </div>
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>
          ) : null}

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Связанные правила ({data?.rules?.length ?? 0})
            </div>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (data?.rules ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Нет связанных правил
              </div>
            ) : (
              <ul className="space-y-1.5">
                {(data?.rules ?? []).map((r: RuleDto) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-2 rounded-md border p-2"
                  >
                    <Badge variant="outline" className="font-mono text-xs">
                      {r.code}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {r.name}
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        {r.description}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
