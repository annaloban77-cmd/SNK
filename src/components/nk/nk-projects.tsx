'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FolderKanban, FileText, RefreshCw, ArrowRight } from 'lucide-react'
import { useProjects } from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { useNKStore } from '@/stores/nk-store'
import { formatDate } from './nk-format'

const STAGE_LABELS: Record<string, string> = {
  concept: 'Концепция',
  design: 'Проектирование',
  production: 'Производство',
  review: 'Согласование',
  archive: 'Архив',
}

function stageLabel(s: string): string {
  return STAGE_LABELS[s] ?? s
}

export function Projects() {
  const { data, isLoading, isError, refetch, isFetching } = useProjects()
  const store = useNKStore()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Проекты"
        description="Проекты судостроительного предприятия"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw
              className={isFetching ? 'size-4 animate-spin' : 'size-4'}
            />
            Обновить
          </Button>
        }
      />

      {isError ? (
        <ErrorState
          message="Не удалось загрузить проекты"
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title="Проектов нет"
          description="Добавьте проекты через сидинг или напрямую в БД"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((p) => (
            <Card key={p.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-sm font-bold">{p.code}</div>
                  <Badge variant="outline" className="text-xs">
                    {stageLabel(p.stage)}
                  </Badge>
                </div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                {p.description ? (
                  <CardDescription className="line-clamp-2">
                    {p.description}
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardFooter className="mt-auto flex items-center justify-between pt-0 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <FileText className="size-3" />
                  документов: {p.documentsCount}
                </span>
                <span>создан {formatDate(p.createdAt)}</span>
              </CardFooter>
              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    store.setDocumentsProjectId(p.id)
                    store.setView('documents')
                  }}
                >
                  Показать документы
                  <ArrowRight className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
