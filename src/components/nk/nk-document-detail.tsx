'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  useDocument,
  useDocumentIssues,
  useCheckLog,
  useAnalyzeDocument,
  type CheckLogEntry,
} from '@/hooks/use-nk-api'
import { useNKStore } from '@/stores/nk-store'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { DocStatusBadge } from './nk-status-badge'
import { SourceBadge } from './nk-source-icon'
import { IssueCard } from './nk-issue-card'
import {
  ArrowLeft,
  Play,
  Download,
  Box,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import {
  formatDateTime,
  formatDuration,
  formatBytes,
  stageLabel,
  stageStatusLabel,
} from './nk-format'
import type { StampFields } from '@/lib/types'

export function DocumentDetail() {
  const store = useNKStore()
  const docId = store.selectedDocumentId

  const { data: doc, isLoading, isError, refetch } = useDocument(docId)
  const analyze = useAnalyzeDocument()

  if (!docId) {
    return (
      <EmptyState
        icon={<FileText className="size-6" />}
        title="Документ не выбран"
        description="Выберите документ из списка, чтобы увидеть его детали"
        action={
          <Button onClick={() => store.setView('documents')}>
            <ArrowLeft className="size-4" /> К списку документов
          </Button>
        }
      />
    )
  }

  if (isError) {
    return (
      <ErrorState
        message="Не удалось загрузить документ"
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          isLoading ? (
            <Skeleton className="h-7 w-72" />
          ) : (
            <span className="line-clamp-1">{doc?.name ?? 'Документ'}</span>
          )
        }
        description={
          doc ? (
            <span className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono">
                {doc.format}
              </Badge>
              <SourceBadge sourceType={doc.sourceType} />
              <DocStatusBadge status={doc.status} />
              {doc.project ? (
                <span>
                  Проект:{' '}
                  <span className="font-mono">{doc.project.code}</span> ·{' '}
                  {doc.project.name}
                </span>
              ) : null}
              <span>· {formatBytes(doc.size)}</span>
              <span>· {formatDateTime(doc.createdAt)}</span>
            </span>
          ) : undefined
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => store.setView('documents')}>
              <ArrowLeft className="size-4" /> Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toastDownload()}
            >
              <Download className="size-4" /> Скачать отчёт
            </Button>
            <Button
              size="sm"
              disabled={analyze.isPending || doc?.status === 'processing'}
              onClick={async () => {
                const res = await analyze.mutateAsync({ id: docId, runLlm: true })
                if (res?.documentId) {
                  refetch()
                }
              }}
            >
              {analyze.isPending || doc?.status === 'processing' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              Запустить проверку
            </Button>
          </>
        }
      />

      {analyze.isPending ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="size-4 animate-spin text-amber-600" />
              Идёт анализ документа…
            </div>
            <Progress value={50} className="h-2" />
            <div className="text-xs text-muted-foreground">
              VLM-извлечение штампа → детерминированные правила → LLM-семантика
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left: preview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Предпросмотр</CardTitle>
            <CardDescription>Оригинальный файл документа</CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentPreview
              docId={docId}
              mimeType={doc?.mimeType}
              sourceType={doc?.sourceType}
            />
          </CardContent>
        </Card>

        {/* Right: stamp data */}
        <StampCard stamp={doc?.stamp ?? null} loading={isLoading} />
      </div>

      <DocumentTabs docId={docId} />
    </div>
  )
}

function toastDownload() {
  toast.info('В разработке')
}

function DocumentPreview({
  docId,
  mimeType,
  sourceType,
}: {
  docId: string
  mimeType?: string
  sourceType?: string
}) {
  const src = `/api/documents/${docId}/file`

  if (!mimeType) {
    return <Skeleton className="h-[60vh] w-full" />
  }

  if (mimeType.startsWith('image/')) {
    return (
      <div className="flex items-center justify-center rounded-md border bg-muted/30 p-3">
        <img
          src={src}
          alt="Предпросмотр документа"
          className="max-h-[70vh] w-auto object-contain"
        />
      </div>
    )
  }

  if (mimeType === 'application/pdf') {
    return (
      <iframe
        src={src}
        title="PDF preview"
        className="h-[70vh] w-full rounded-md border"
      />
    )
  }

  // CAD files — placeholder
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 rounded-md border bg-muted/30 p-6 text-center">
      <Box className="size-12 text-muted-foreground" />
      <div className="text-base font-medium">CAD-файл требует конвертации</div>
      <p className="max-w-md text-sm text-muted-foreground">
        Тип источника: <span className="font-mono">{sourceType}</span>. Прямой
        предпросмотр недоступен. Запустите проверку — система извлечёт
        атрибуты из CAD-файла и сформирует замечания.
      </p>
      <Button asChild variant="outline">
        <a href={src} download>
          <Download className="size-4" /> Скачать оригинал
        </a>
      </Button>
    </div>
  )
}

function StampCard({
  stamp,
  loading,
}: {
  stamp: StampFields | null
  loading?: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Основная надпись (штамп)</CardTitle>
        <CardDescription>Поля по ГОСТ 2.104-2006</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !stamp ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="Штамп не извлечён"
            description="Запустите проверку, чтобы VLM-модель распознала поля основной надписи"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Формат" value={stamp.format} mono />
              <Field label="Обозначение" value={stamp.designation} mono />
              <Field label="Наименование" value={stamp.name} />
              <Field label="Масштаб" value={stamp.scale} mono />
              <Field label="Масса" value={stamp.mass} />
              <Field label="Материал" value={stamp.material} />
              <Field label="Литера" value={stamp.letter} mono />
              <Field label="Стадия" value={stamp.stage} />
              <Field label="Инв. номер" value={stamp.invNumber} mono />
              <Field
                label="Листов"
                value={stamp.sheetCount != null ? String(stamp.sheetCount) : null}
                mono
              />
              <Field label="Тип документа" value={stamp.documentType} />
              <Field label="Примечания" value={stamp.notes} />
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Подписи
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field
                  label="Разраб."
                  value={stamp.signatures?.developed ?? null}
                />
                <Field
                  label="Пров."
                  value={stamp.signatures?.checked ?? null}
                />
                <Field
                  label="Н.контр."
                  value={stamp.signatures?.normControl ?? null}
                />
                <Field
                  label="Утв."
                  value={stamp.signatures?.approved ?? null}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Даты
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field
                  label="Разраб."
                  value={stamp.dates?.developed ?? null}
                />
                <Field
                  label="Пров."
                  value={stamp.dates?.checked ?? null}
                />
                <Field
                  label="Утв."
                  value={stamp.dates?.approved ?? null}
                />
              </div>
            </div>

            {stamp.technicalRequirements && stamp.technicalRequirements.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Технические требования
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {stamp.technicalRequirements.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {stamp.gostReferences && stamp.gostReferences.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Перечень ГОСТ
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stamp.gostReferences.map((g, i) => (
                    <Badge key={i} variant="outline" className="font-mono text-xs">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-0.5 truncate text-sm ${
          value ? 'text-foreground' : 'text-muted-foreground/60'
        } ${mono ? 'font-mono' : ''}`}
        title={value ?? undefined}
      >
        {value ?? '—'}
      </div>
    </div>
  )
}

function DocumentTabs({ docId }: { docId: string }) {
  const issuesQ = useDocumentIssues(docId)
  const logQ = useCheckLog(docId)
  const { data: doc } = useDocument(docId)

  return (
    <Tabs defaultValue="issues">
      <TabsList>
        <TabsTrigger value="issues">
          Замечания
          {issuesQ.data?.items?.length ? (
            <Badge variant="secondary" className="ml-1.5">
              {issuesQ.data.items.length}
            </Badge>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="log">Журнал проверок</TabsTrigger>
        <TabsTrigger value="raw">Сырые данные</TabsTrigger>
      </TabsList>

      <TabsContent value="issues" className="space-y-3">
        {issuesQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : (issuesQ.data?.items ?? []).length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-6" />}
            title="Замечаний нет"
            description="Документ прошёл проверку без замечаний или проверка ещё не запускалась"
          />
        ) : (
          <div className="space-y-3">
            {(issuesQ.data?.items ?? []).map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="log">
        <CheckLogTimeline items={logQ.data?.items ?? []} loading={logQ.isLoading} />
      </TabsContent>

      <TabsContent value="raw">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сырой JSON штампа</CardTitle>
            <CardDescription>
              Полный объект, распознанный VLM-моделью
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/30 p-4 text-xs">
              {JSON.stringify(doc?.stamp ?? null, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function CheckLogTimeline({
  items,
  loading,
}: {
  items: CheckLogEntry[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="size-6" />}
        title="Журнал пуст"
        description="Запустите проверку, чтобы увидеть этапы выполнения"
      />
    )
  }
  return (
    <Card>
      <CardContent className="p-4">
        <ol className="relative space-y-4 border-l pl-6">
          {items.map((entry) => (
            <li key={entry.id} className="relative">
              <span
                className={`absolute -left-[27px] flex size-5 items-center justify-center rounded-full ring-4 ring-background ${
                  entry.status === 'success'
                    ? 'bg-emerald-500'
                    : entry.status === 'failed'
                    ? 'bg-red-500'
                    : entry.status === 'started'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              >
                {entry.status === 'success' ? (
                  <CheckCircle2 className="size-3 text-white" />
                ) : entry.status === 'failed' ? (
                  <XCircle className="size-3 text-white" />
                ) : entry.status === 'started' ? (
                  <Loader2 className="size-3 animate-spin text-white" />
                ) : (
                  <AlertTriangle className="size-3 text-white" />
                )}
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {stageLabel(entry.stage)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{stageStatusLabel(entry.status)}</span>
                  {entry.durationMs != null ? (
                    <span className="tabular-nums">
                      · {formatDuration(entry.durationMs)}
                    </span>
                  ) : null}
                  <span>· {formatDateTime(entry.createdAt)}</span>
                </div>
              </div>
              {entry.message ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.message}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
