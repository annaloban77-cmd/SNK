'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
} from '@/components/ui/pagination'
import {
  FileText,
  RefreshCw,
  Upload,
  FlaskConical,
  Play,
  Eye,
  MoreHorizontal,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import {
  useDocuments,
  useSamples,
  useAnalyzeSample,
  type DocumentFilters,
} from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { DocStatusBadge } from './nk-status-badge'
import { IssuesSummary } from './nk-severity-badge'
import { SourceBadge } from './nk-source-icon'
import { UploadDocumentDialog } from './nk-upload-dialog'
import { useNKStore } from '@/stores/nk-store'
import { formatDateTime, formatBytes } from './nk-format'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'new', label: 'Новые' },
  { value: 'processing', label: 'В проверке' },
  { value: 'analyzed', label: 'Проверенные' },
  { value: 'failed', label: 'С ошибкой' },
]

const FORMAT_OPTIONS = [
  { value: 'all', label: 'Все форматы' },
  { value: 'A0', label: 'A0' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'A3', label: 'A3' },
  { value: 'A4', label: 'A4' },
  { value: 'unknown', label: 'Неизвестный' },
]

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Все типы' },
  { value: 'scan', label: 'Скан/IMG' },
  { value: 'pdf', label: 'PDF' },
  { value: 'dwg', label: 'DWG' },
  { value: 'dxf', label: 'DXF' },
  { value: 'cdw', label: 'CDW' },
  { value: 'sldprt', label: 'SLDPRT' },
  { value: 'sldasm', label: 'SLDASM' },
  { value: 'slddrw', label: 'SLDDRW' },
  { value: 'spw', label: 'SPW' },
]

export function Documents() {
  const store = useNKStore()
  const [filters, setFilters] = React.useState<DocumentFilters>({
    status: 'all',
    format: 'all',
    sourceType: 'all',
    search: '',
    page: 1,
    pageSize: 20,
  })

  // Apply project filter override from Projects view
  React.useEffect(() => {
    if (store.documentsProjectId) {
      setFilters((f) => ({ ...f, projectId: store.documentsProjectId ?? undefined, page: 1 }))
    }
  }, [store.documentsProjectId])

  // Local search box with debounce
  const [searchBox, setSearchBox] = React.useState(filters.search ?? '')
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) =>
        f.search === searchBox ? f : { ...f, search: searchBox, page: 1 }
      )
    }, 350)
    return () => clearTimeout(t)
  }, [searchBox])

  const { data, isLoading, isError, refetch, isFetching } = useDocuments(filters)

  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [samplesOpen, setSamplesOpen] = React.useState(false)

  function setField<K extends keyof DocumentFilters>(k: K, v: DocumentFilters[K]) {
    setFilters((f) => ({ ...f, [k]: v, page: 1 }))
  }

  const total = data?.total ?? 0
  const pageSize = data?.pageSize ?? filters.pageSize ?? 20
  const page = data?.page ?? filters.page ?? 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Документы"
        description="Загруженные чертежи и CAD-файлы для нормоконтроля"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
              Обновить
            </Button>
            <SamplesDropdown
              open={samplesOpen}
              onOpenChange={setSamplesOpen}
              onSampleAnalyzed={(docId) => {
                store.selectDocument(docId)
                store.setView('document-detail')
              }}
            />
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              Загрузить
            </Button>
          </>
        }
      />

      {/* Filters bar */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                Формат
              </label>
              <Select
                value={filters.format ?? 'all'}
                onValueChange={(v) => setField('format', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Тип источника
              </label>
              <Select
                value={filters.sourceType ?? 'all'}
                onValueChange={(v) => setField('sourceType', v)}
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
                placeholder="Имя, обозначение…"
                value={searchBox}
                onChange={(e) => setSearchBox(e.target.value)}
              />
            </div>
          </div>
          {store.documentsProjectId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                store.setDocumentsProjectId(null)
                setFilters((f) => ({ ...f, projectId: undefined, page: 1 }))
              }}
            >
              Сбросить фильтр проекта
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-6">
              <ErrorState
                message="Не удалось загрузить документы"
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
                icon={<FileText className="size-6" />}
                title="Документы не найдены"
                description="Измените фильтры или загрузите новый документ"
                action={
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload className="size-4" /> Загрузить документ
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Имя</TableHead>
                    <TableHead>Формат</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Замечания</TableHead>
                    <TableHead>Размер</TableHead>
                    <TableHead className="text-right">Дата</TableHead>
                    <TableHead className="pr-4 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer"
                      onClick={() => {
                        store.selectDocument(d.id)
                        store.setView('document-detail')
                      }}
                    >
                      <TableCell className="pl-6">
                        <div className="font-medium line-clamp-1 max-w-[280px]">
                          {d.name}
                        </div>
                        {d.project ? (
                          <div className="text-xs text-muted-foreground">
                            {d.project.code}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {d.format}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <SourceBadge sourceType={d.sourceType} />
                      </TableCell>
                      <TableCell>
                        <DocStatusBadge status={d.status} />
                      </TableCell>
                      <TableCell>
                        <IssuesSummary
                          high={d.highCount}
                          medium={d.mediumCount}
                          low={d.lowCount}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {formatBytes(d.size)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDateTime(d.createdAt)}
                      </TableCell>
                      <TableCell
                        className="pr-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                store.selectDocument(d.id)
                                store.setView('document-detail')
                              }}
                            >
                              <Eye className="size-4" /> Открыть
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                store.selectDocument(d.id)
                                store.setView('document-detail')
                              }}
                            >
                              <Play className="size-4" /> Запустить проверку
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Скачать</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() =>
                                window.open(
                                  `/api/documents/${d.id}/file`,
                                  '_blank'
                                )
                              }
                            >
                              <Download className="size-4" /> Скачать оригинал
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 ? (
                <div className="flex items-center justify-between border-t p-3">
                  <div className="text-xs text-muted-foreground">
                    Всего: {total} · стр. {page} из {totalPages}
                  </div>
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setFilters((f) => ({
                              ...f,
                              page: Math.max(1, page - 1),
                            }))
                          }}
                          aria-disabled={page <= 1}
                          className={
                            page <= 1 ? 'pointer-events-none opacity-50' : ''
                          }
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }).map(
                        (_, i) => {
                          const pageNum = i + 1
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                href="#"
                                isActive={pageNum === page}
                                onClick={(e) => {
                                  e.preventDefault()
                                  setFilters((f) => ({ ...f, page: pageNum }))
                                }}
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        }
                      )}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            setFilters((f) => ({
                              ...f,
                              page: Math.min(totalPages, page + 1),
                            }))
                          }}
                          aria-disabled={page >= totalPages}
                          className={
                            page >= totalPages
                              ? 'pointer-events-none opacity-50'
                              : ''
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(docId) => {
          store.selectDocument(docId)
          store.setView('document-detail')
        }}
      />
    </div>
  )
}

function SamplesDropdown({
  open,
  onOpenChange,
  onSampleAnalyzed,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSampleAnalyzed: (docId: string) => void
}) {
  const { data, isLoading } = useSamples()
  const analyze = useAnalyzeSample()
  const items = data?.items ?? []

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FlaskConical className="size-4" />
          Тестовые чертежи
          {open ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px]">
        <DropdownMenuLabel>Готовые тестовые чертежи</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Загрузка…
          </div>
        ) : items.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            Семплы не найдены
          </div>
        ) : (
          items.map((s) => (
            <DropdownMenuItem
              key={s.id}
              disabled={!s.available || analyze.isPending}
              onSelect={async (e) => {
                e.preventDefault()
                const res = await analyze.mutateAsync({ id: s.id, runLlm: false })
                if (res?.documentId) {
                  onSampleAnalyzed(res.documentId)
                }
              }}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{s.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {s.description}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
