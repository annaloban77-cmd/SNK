'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useProjects, useUploadDocument } from '@/hooks/use-nk-api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { UploadCloud, Loader2 } from 'lucide-react'
import { formatBytes } from './nk-format'
import { cn } from '@/lib/utils'

const ACCEPTED =
  '.pdf,.png,.jpg,.jpeg,.svg,.dwg,.dxf,.cdw,.sldprt,.sldasm,.slddrw,.spw'

export function UploadDocumentDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onUploaded?: (docId: string) => void
}) {
  const { data: projectsData } = useProjects()
  const upload = useUploadDocument()

  const [file, setFile] = React.useState<File | null>(null)
  const [projectId, setProjectId] = React.useState<string>('')
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  function reset() {
    setFile(null)
    setProjectId('')
    setDragOver(false)
  }

  React.useEffect(() => {
    if (!open) {
      // reset after close animation
      const t = setTimeout(reset, 200)
      return () => clearTimeout(t)
    }
  }, [open])

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setFile(files[0])
  }

  async function handleUpload() {
    if (!file) return
    const res = await upload.mutateAsync({
      file,
      projectId: projectId || undefined,
    })
    if (res?.document) {
      onUploaded?.(res.document.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Загрузить документ</DialogTitle>
          <DialogDescription>
            Поддерживаются сканы, PDF, CAD-файлы (DWG/DXF/CDW/SLDPRT/SLDASM/SLDDRW/SPW).
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            dragOver
              ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30'
              : 'border-border hover:border-foreground/30'
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
        >
          {file ? (
            <div className="flex w-full flex-col items-center gap-1">
              <UploadCloud className="size-7 text-emerald-600" />
              <div className="text-sm font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {formatBytes(file.size)} · {file.type || 'неизвестный тип'}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Выбрать другой
              </Button>
            </div>
          ) : (
            <>
              <UploadCloud className="size-7 text-muted-foreground" />
              <div className="text-sm font-medium">
                Перетащите файл сюда или нажмите кнопку ниже
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Выбрать файл
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="project">Проект (необязательно)</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger id="project" className="w-full">
              <SelectValue placeholder="Без проекта" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Без проекта</SelectItem>
              {(projectsData?.items ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={upload.isPending}
          >
            Отмена
          </Button>
          <Button onClick={handleUpload} disabled={!file || upload.isPending}>
            {upload.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Загрузка…
              </>
            ) : (
              'Загрузить'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
