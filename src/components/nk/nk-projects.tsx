'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FolderKanban, FileText, RefreshCw, ArrowRight, Plus } from 'lucide-react'
import { useProjects, useCreateProject } from '@/hooks/use-nk-api'
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

const STAGE_OPTIONS = [
  { value: 'concept', label: 'Концепция' },
  { value: 'design', label: 'Проектирование' },
  { value: 'production', label: 'Производство' },
  { value: 'review', label: 'Согласование' },
  { value: 'archive', label: 'Архив' },
]

function stageLabel(s: string): string {
  return STAGE_LABELS[s] ?? s
}

export function Projects() {
  const { data, isLoading, isError, refetch, isFetching } = useProjects()
  const store = useNKStore()
  const [createOpen, setCreateOpen] = React.useState(false)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Проекты"
        description="Проекты судостроительного предприятия"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw
                className={isFetching ? 'size-4 animate-spin' : 'size-4'}
              />
              Обновить
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Создать проект
            </Button>
          </>
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
          description="Создайте первый проект, чтобы группировать документы по комплектам"
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> Создать проект
            </Button>
          }
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

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const create = useCreateProject()
  const [code, setCode] = React.useState('')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [stage, setStage] = React.useState('design')

  React.useEffect(() => {
    if (!open) {
      setCode('')
      setName('')
      setDescription('')
      setStage('design')
    }
  }, [open])

  const canSubmit = code.trim() && name.trim() && !create.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Создать проект</DialogTitle>
          <DialogDescription>
            Проект объединяет комплект документации и позволяет группировать чертежи.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="proj-code">Код проекта</Label>
            <Input
              id="proj-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Судно-проект-2026"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Название</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Танкер-химовоз проекта 00260"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-stage">Стадия</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger id="proj-stage" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-desc">Описание</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание проекта (опц.)"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() =>
              create.mutate(
                {
                  code: code.trim(),
                  name: name.trim(),
                  description: description.trim() || undefined,
                  stage,
                },
                { onSuccess: () => onOpenChange(false) }
              )
            }
            disabled={!canSubmit}
          >
            {create.isPending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
