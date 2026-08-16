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
import { BookOpen, RefreshCw, ShieldCheck, ListChecks } from 'lucide-react'
import {
  useStandards,
  useStandard,
  type StandardFilters,
} from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import {
  formatDate,
  standardTypeLabel,
} from './nk-format'
import type { RuleDto, StandardDto } from '@/lib/types'

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

const STATUS_BADGE_STYLE: Record<string, string> = {
  active:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
  draft:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900',
  cancelled:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
}

export function KnowledgeBase() {
  const [filters, setFilters] = React.useState<StandardFilters>({
    type: 'all',
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

  const [selectedId, setSelectedId] = React.useState<string | null>(null)

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

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Тип стандарта
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
                Поиск
              </label>
              <Input
                placeholder="Код, наименование, область…"
                value={searchBox}
                onChange={(e) => setSearchBox(e.target.value)}
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Всего: {data?.total ?? 0}
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
            <Skeleton key={i} className="h-40 w-full" />
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

function StandardCard({
  standard,
  onOpen,
}: {
  standard: StandardDto
  onOpen: () => void
}) {
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
      <CardFooter className="mt-auto flex items-center justify-between pt-0 text-xs text-muted-foreground">
        <span>
          <span
            className={`mr-1 inline-flex items-center rounded-md border px-1.5 py-0.5 ${
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
        <span className="inline-flex items-center gap-1">
          <ListChecks className="size-3" />
          правил: {standard.rulesCount}
        </span>
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
  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
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
