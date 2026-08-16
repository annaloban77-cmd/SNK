'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ListChecks, RefreshCw, Eye } from 'lucide-react'
import {
  useRules,
  useUpdateRule,
  type RuleFilters,
} from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { SeverityBadge } from './nk-severity-badge'
import {
  categoryLabel,
  methodLabel,
  formatDate,
} from './nk-format'
import type { RuleDto, Severity } from '@/lib/types'

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Все категории' },
  { value: 'stamp', label: 'Штамп' },
  { value: 'specification', label: 'Спецификация' },
  { value: 'material', label: 'Материал' },
  { value: 'cad_attr', label: 'CAD-атрибуты' },
  { value: 'format', label: 'Формат' },
  { value: 'geometry', label: 'Геометрия' },
  { value: 'semantic', label: 'Семантика' },
]

const METHOD_OPTIONS = [
  { value: 'all', label: 'Все методы' },
  { value: 'deterministic', label: 'Детерминированное' },
  { value: 'semantic', label: 'Семантическое' },
  { value: 'vision', label: 'VLM' },
]

const ENABLED_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'true', label: 'Активные' },
  { value: 'false', label: 'Отключённые' },
]

const CATEGORY_BADGE_STYLE: Record<string, string> = {
  stamp: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900',
  specification: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900',
  material: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
  cad_attr: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900',
  format: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
  geometry: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-900',
  semantic: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
}

export function Rules() {
  const [filters, setFilters] = React.useState<RuleFilters>({
    category: 'all',
    method: 'all',
    enabled: 'all',
    search: '',
    page: 1,
    pageSize: 50,
  })
  const [searchBox, setSearchBox] = React.useState(filters.search ?? '')
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchBox, page: 1 }))
    }, 350)
    return () => clearTimeout(t)
  }, [searchBox])

  const { data, isLoading, isError, refetch, isFetching } = useRules(filters)

  const [selectedRule, setSelectedRule] = React.useState<RuleDto | null>(null)

  function setField<K extends keyof RuleFilters>(k: K, v: RuleFilters[K]) {
    setFilters((f) => ({ ...f, [k]: v, page: 1 }))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Правила"
        description="Детерминированные, семантические и VLM-правила нормоконтроля"
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
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Категория
            </label>
            <Select
              value={filters.category ?? 'all'}
              onValueChange={(v) => setField('category', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Метод
            </label>
            <Select
              value={filters.method ?? 'all'}
              onValueChange={(v) => setField('method', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Статус
            </label>
            <Select
              value={filters.enabled ?? 'all'}
              onValueChange={(v) => setField('enabled', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENABLED_OPTIONS.map((o) => (
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
              placeholder="Код, название, ГОСТ…"
              value={searchBox}
              onChange={(e) => setSearchBox(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-6">
              <ErrorState
                message="Не удалось загрузить правила"
                onRetry={() => refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (data?.items ?? []).length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ListChecks className="size-6" />}
                title="Правила не найдены"
                description="Измените фильтры"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Код</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Метод</TableHead>
                  <TableHead>Критичность</TableHead>
                  <TableHead>ГОСТ-поле</TableHead>
                  <TableHead>Стандарт</TableHead>
                  <TableHead className="text-center">Включено</TableHead>
                  <TableHead className="pr-4 text-right">Детали</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((r) => (
                  <RuleRow
                    key={r.id}
                    rule={r}
                    onOpen={() => setSelectedRule(r)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Всего: {data?.total ?? 0}
      </div>

      <RuleDetailDialog
        rule={selectedRule}
        onOpenChange={(v) => !v && setSelectedRule(null)}
      />
    </div>
  )
}

function RuleRow({
  rule,
  onOpen,
}: {
  rule: RuleDto
  onOpen: () => void
}) {
  const update = useUpdateRule()
  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="pl-6">
        <Badge variant="outline" className="font-mono text-xs">
          {rule.code}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[260px]">
        <div className="truncate text-sm font-medium">{rule.name}</div>
        <div className="line-clamp-1 text-xs text-muted-foreground">
          {rule.description}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-xs ${CATEGORY_BADGE_STYLE[rule.category] ?? ''}`}
        >
          {categoryLabel(rule.category)}
        </Badge>
      </TableCell>
      <TableCell className="text-xs">{methodLabel(rule.method)}</TableCell>
      <TableCell>
        <SeverityBadge severity={rule.severity} />
      </TableCell>
      <TableCell className="text-xs font-mono">
        {rule.gostField ?? '—'}
      </TableCell>
      <TableCell className="text-xs">
        {rule.standard ? (
          <span className="font-mono">{rule.standard.code}</span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell
        className="text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          checked={rule.enabled}
          onCheckedChange={(v) =>
            update.mutate({ id: rule.id, data: { enabled: v } })
          }
        />
      </TableCell>
      <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
        <Button size="icon" variant="ghost" onClick={onOpen}>
          <Eye className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function RuleDetailDialog({
  rule,
  onOpenChange,
}: {
  rule: RuleDto | null
  onOpenChange: (v: boolean) => void
}) {
  const update = useUpdateRule()
  const [severity, setSeverity] = React.useState<Severity>('medium')

  React.useEffect(() => {
    if (rule) setSeverity(rule.severity)
  }, [rule])

  if (!rule) {
    return (
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    )
  }

  return (
    <Dialog open={!!rule} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {rule.code}
            </Badge>
            <span>{rule.name}</span>
          </DialogTitle>
          <DialogDescription>{rule.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Категория
              </div>
              <div>{categoryLabel(rule.category)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Метод
              </div>
              <div>{methodLabel(rule.method)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                ГОСТ-поле
              </div>
              <div className="font-mono">{rule.gostField ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Стандарт
              </div>
              <div>
                {rule.standard ? (
                  <span className="font-mono">{rule.standard.code}</span>
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Создано
              </div>
              <div>{formatDate(rule.createdAt)}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Обновлено
              </div>
              <div>{formatDate(rule.updatedAt)}</div>
            </div>
          </div>

          {rule.expression ? (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Выражение
              </div>
              <pre className="mt-1 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                {rule.expression}
              </pre>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="severity">Критичность</Label>
              <Select
                value={severity}
                onValueChange={(v) => setSeverity(v as Severity)}
              >
                <SelectTrigger id="severity" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Высокая</SelectItem>
                  <SelectItem value="medium">Средняя</SelectItem>
                  <SelectItem value="low">Низкая</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={
                  update.isPending || severity === rule.severity
                }
                onClick={() =>
                  update.mutate({
                    id: rule.id,
                    data: { severity },
                  })
                }
              >
                Сохранить критичность
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant={rule.enabled ? 'destructive' : 'default'}
            onClick={() =>
              update.mutate({
                id: rule.id,
                data: { enabled: !rule.enabled },
              })
            }
            disabled={update.isPending}
          >
            {rule.enabled ? 'Отключить правило' : 'Включить правило'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
