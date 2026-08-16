'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
  AlertTriangle,
  RefreshCw,
  Check,
  Ban,
  Wrench,
  ShieldCheck,
} from 'lucide-react'
import {
  useIssues,
  useBulkIssues,
  type IssueFilters,
} from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { SeverityBadge } from './nk-severity-badge'
import { IssueStatusBadge } from './nk-status-badge'
import { useNKStore } from '@/stores/nk-store'
import { formatDateTime } from './nk-format'

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'high', label: 'Высокая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'low', label: 'Низкая' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'new', label: 'Новые' },
  { value: 'confirmed', label: 'Подтверждённые' },
  { value: 'rejected', label: 'Отклонённые' },
  { value: 'fixed', label: 'Исправленные' },
]

export function Issues() {
  const store = useNKStore()
  const [filters, setFilters] = React.useState<IssueFilters>({
    severity: 'all',
    status: 'all',
    documentId: '',
    search: '',
    page: 1,
    pageSize: 20,
  })

  const [searchBox, setSearchBox] = React.useState(filters.search ?? '')
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) =>
        f.search === searchBox ? f : { ...f, search: searchBox, page: 1 }
      )
    }, 350)
    return () => clearTimeout(t)
  }, [searchBox])

  const { data, isLoading, isError, refetch, isFetching } = useIssues(filters)
  const bulk = useBulkIssues()

  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const allOnPage = data?.items ?? []
  const allChecked =
    allOnPage.length > 0 && allOnPage.every((i) => selected.has(i.id))
  const someChecked = allOnPage.some((i) => selected.has(i.id))

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (allChecked) {
      setSelected((s) => {
        const next = new Set(s)
        for (const i of allOnPage) next.delete(i.id)
        return next
      })
    } else {
      setSelected((s) => {
        const next = new Set(s)
        for (const i of allOnPage) next.add(i.id)
        return next
      })
    }
  }
  function bulkAction(action: 'confirm' | 'reject' | 'fix') {
    if (selected.size === 0) return
    bulk.mutateAsync({ ids: Array.from(selected), action }).then(() => {
      setSelected(new Set())
    })
  }

  function setField<K extends keyof IssueFilters>(k: K, v: IssueFilters[K]) {
    setFilters((f) => ({ ...f, [k]: v, page: 1 }))
  }

  const total = data?.total ?? 0
  const pageSize = data?.pageSize ?? 20
  const page = data?.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Замечания"
        description="Все замечания нормоконтроля по всем документам"
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
              Критичность
            </label>
            <Select
              value={filters.severity ?? 'all'}
              onValueChange={(v) => setField('severity', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((o) => (
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
              value={filters.status ?? 'all'}
              onValueChange={(v) => setField('status', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              ID документа
            </label>
            <Input
              placeholder="documentId"
              value={filters.documentId ?? ''}
              onChange={(e) =>
                setField('documentId', e.target.value || undefined)
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Поиск
            </label>
            <Input
              placeholder="Код, заголовок…"
              value={searchBox}
              onChange={(e) => setSearchBox(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 ? (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="text-sm">
              Выбрано замечаний: <span className="font-bold">{selected.size}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkAction('confirm')}
                disabled={bulk.isPending}
              >
                <Check className="size-3.5" /> Подтвердить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkAction('reject')}
                disabled={bulk.isPending}
              >
                <Ban className="size-3.5" /> Отклонить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkAction('fix')}
                disabled={bulk.isPending}
              >
                <Wrench className="size-3.5" /> Исправлено
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                Снять выделение
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-6">
              <ErrorState
                message="Не удалось загрузить замечания"
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
                icon={<AlertTriangle className="size-6" />}
                title="Замечаний не найдено"
                description="Измените фильтры или запустите проверку документов"
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4 w-8">
                    <Checkbox
                      checked={
                        allChecked ? true : someChecked ? 'indeterminate' : false
                      }
                      onCheckedChange={toggleAll}
                      aria-label="Выделить все"
                    />
                  </TableHead>
                  <TableHead>Документ</TableHead>
                  <TableHead>Код</TableHead>
                  <TableHead>Заголовок</TableHead>
                  <TableHead>Критичность</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>ГОСТ</TableHead>
                  <TableHead className="pr-4 text-right">Дата</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((issue) => (
                  <TableRow
                    key={issue.id}
                    className="cursor-pointer"
                    onClick={() => {
                      if (issue.document) {
                        store.selectDocument(issue.document.id)
                        store.setView('document-detail')
                      }
                    }}
                  >
                    <TableCell
                      className="pl-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selected.has(issue.id)}
                        onCheckedChange={() => toggleOne(issue.id)}
                        aria-label={`Выбрать ${issue.code}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate text-xs">
                        {issue.document?.name ?? '—'}
                      </div>
                      {issue.document?.format ? (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {issue.document.format}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {issue.code}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate text-sm">{issue.title}</div>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={issue.severity} />
                    </TableCell>
                    <TableCell>
                      <IssueStatusBadge status={issue.status} />
                    </TableCell>
                    <TableCell>
                      {issue.gostRef ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs">
                          <ShieldCheck className="size-3 text-muted-foreground" />
                          {issue.gostRef}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right text-xs text-muted-foreground">
                      {formatDateTime(issue.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Всего: {total} · стр. {page} из {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: page - 1 }))}
            >
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setFilters((f) => ({ ...f, page: page + 1 }))}
            >
              Вперёд
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
