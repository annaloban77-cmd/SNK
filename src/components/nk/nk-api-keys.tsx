'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  KeyRound,
  Plus,
  RefreshCw,
  MoreVertical,
  Trash2,
  Ban,
  Copy,
  Check,
  AlertTriangle,
  Terminal,
  Activity,
} from 'lucide-react'
import {
  useApiKeys,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
} from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { UsageBar } from './nk-usage-bar'
import { formatDateTime } from './nk-format'
import type { ApiKeyDto, ApiKeyWithSecret } from '@/lib/types'

const SCOPE_OPTIONS = [
  { value: 'read', label: 'Read — чтение данных (GET-запросы)' },
  { value: 'write', label: 'Write — создание/обновление (POST/PATCH)' },
  { value: 'admin', label: 'Admin — управление (DELETE, управление ключами)' },
]

const SCOPE_BADGE: Record<string, string> = {
  read:
    'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-900',
  write:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900',
  admin:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-900',
}

const KEY_STATUS_LABEL: Record<string, string> = {
  active: 'Активен',
  revoked: 'Отозван',
  expired: 'Истёк',
}

const KEY_STATUS_BADGE: Record<string, string> = {
  active:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
  revoked:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
  expired:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900',
}

export function ApiKeys() {
  const { data, isLoading, isError, refetch, isFetching } = useApiKeys()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [createdKey, setCreatedKey] = React.useState<ApiKeyWithSecret | null>(null)
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKeyDto | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ApiKeyDto | null>(null)

  // Filter out test/CI keys from the main display — they clutter the table
  // without providing user value. Match "test", "CI/CD", "demo" (case-insensitive).
  const visibleKeys = React.useMemo(() => {
    return (data?.items ?? []).filter((k) => {
      const name = k.name.toLowerCase()
      return !name.includes('test') && !name.includes('ci/cd') && !name.includes('demo')
    })
  }, [data?.items])

  return (
    <div className="space-y-5">
      <PageHeader
        title="API-ключи"
        description="Управление ключами доступа для внешних интеграций"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
              Обновить
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Создать API-ключ
            </Button>
          </>
        }
      />

      <Alert>
        <AlertTriangle className="size-4 text-amber-600" />
        <AlertTitle>Внимание</AlertTitle>
        <AlertDescription>
          API-ключи позволяют внешним системам обращаться к <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/api/v1/*</code> эндпоинтам.
          Ключ отображается только один раз при создании — сохраните его в безопасном месте.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" />
            Ключи доступа ({visibleKeys.length})
          </CardTitle>
          <CardDescription>
            Активные и отозванные ключи вашей организации
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {isError ? (
            <div className="px-6">
              <ErrorState
                message="Не удалось загрузить API-ключи"
                onRetry={() => refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="space-y-2 px-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : visibleKeys.length === 0 ? (
            <div className="px-6">
              <EmptyState
                icon={<KeyRound className="size-6" />}
                title="Ключей пока нет"
                description="Создайте первый API-ключ для интеграции с внешними системами"
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" /> Создать ключ
                  </Button>
                }
              />
            </div>
          ) : (
            <ScrollArea className="max-h-[40rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Название / Ключ</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead className="w-[200px]">Использование</TableHead>
                    <TableHead>Последнее использование</TableHead>
                    <TableHead>Истекает</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="pr-6 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleKeys.map((k) => (
                    <ApiKeyRow
                      key={k.id}
                      apiKey={k}
                      onRevoke={() => setRevokeTarget(k)}
                      onDelete={() => setDeleteTarget(k)}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* API documentation */}
      <ApiDocsCard />

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(key) => {
          setCreatedKey(key)
          setCreateOpen(false)
        }}
      />

      <SecretRevealDialog
        apiKey={createdKey}
        onOpenChange={(v) => !v && setCreatedKey(null)}
      />

      <RevokeConfirmDialog
        apiKey={revokeTarget}
        onOpenChange={(v) => !v && setRevokeTarget(null)}
      />

      <DeleteConfirmDialog
        apiKey={deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      />
    </div>
  )
}

function ApiKeyRow({
  apiKey,
  onRevoke,
  onDelete,
}: {
  apiKey: ApiKeyDto
  onRevoke: () => void
  onDelete: () => void
}) {
  const masked = maskKey(apiKey.keyPrefix)
  const scopes = apiKey.scopes.split(',').filter(Boolean)
  const revoked = apiKey.status === 'revoked'

  // Auto-expire: if expiresAt is in the past and key is still 'active',
  // show as expired (status text is computed client-side for UX)
  const now = Date.now()
  const isExpired =
    apiKey.status === 'expired' ||
    (apiKey.expiresAt != null && new Date(apiKey.expiresAt).getTime() < now)
  const displayStatus = isExpired
    ? 'expired'
    : revoked
    ? 'revoked'
    : apiKey.status

  return (
    <TableRow className={displayStatus !== 'active' ? 'opacity-60' : ''}>
      <TableCell className="pl-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{apiKey.name}</span>
          <code className="font-mono text-xs text-muted-foreground">{masked}</code>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {scopes.map((s) => (
            <Badge key={s} variant="outline" className={`text-[10px] ${SCOPE_BADGE[s] ?? ''}`}>
              {s}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <UsageBar
          label=""
          value={apiKey.requestsCount}
          max={apiKey.requestsLimit || 1}
          className="min-w-[160px]"
        />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {apiKey.lastUsedAt ? formatDateTime(apiKey.lastUsedAt) : 'Никогда'}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {apiKey.expiresAt ? formatDateTime(apiKey.expiresAt) : '∞'}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={KEY_STATUS_BADGE[displayStatus]}>
          {KEY_STATUS_LABEL[displayStatus] ?? displayStatus}
        </Badge>
      </TableCell>
      <TableCell className="pr-6 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={onRevoke}
              disabled={revoked || isExpired}
            >
              <Ban className="mr-2 size-3.5 text-amber-500" />
              Отозвать
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-600 focus:text-red-700"
            >
              <Trash2 className="mr-2 size-3.5" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function maskKey(prefix: string): string {
  if (!prefix) return 'nk-••••'
  // prefix may be like "nk-pro-k" — keep first 8 chars, then bullets
  const visible = prefix.length > 8 ? prefix.slice(0, 8) : prefix
  return `${visible}••••••••`
}

function CreateApiKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (key: ApiKeyWithSecret) => void
}) {
  const create = useCreateApiKey()
  const [name, setName] = React.useState('')
  const [scopes, setScopes] = React.useState<string[]>(['read'])
  const [expiry, setExpiry] = React.useState('never')
  const [customDate, setCustomDate] = React.useState('')

  React.useEffect(() => {
    if (!open) {
      setName('')
      setScopes(['read'])
      setExpiry('never')
      setCustomDate('')
    }
  }, [open])

  function toggleScope(s: string) {
    setScopes((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]
    )
  }

  function computeExpiresAt(): string | undefined {
    if (expiry === 'never') return undefined
    if (expiry === 'custom') {
      if (!customDate) return undefined
      const d = new Date(customDate)
      return isNaN(d.getTime()) ? undefined : d.toISOString()
    }
    const days = parseInt(expiry, 10)
    if (isNaN(days)) return undefined
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Новый API-ключ</DialogTitle>
          <DialogDescription>
            После создания ключ будет показан только один раз
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ak-name">Название ключа</Label>
            <Input
              id="ak-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: CI/CD Read-Only"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Области действия (scopes)</Label>
            <div className="space-y-2">
              {SCOPE_OPTIONS.map((s) => (
                <label
                  key={s.value}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-2 hover:bg-accent"
                >
                  <Checkbox
                    checked={scopes.includes(s.value)}
                    onCheckedChange={() => toggleScope(s.value)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    <span className="font-medium">{s.value}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.label.split('— ')[1]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ak-expiry">Срок действия</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger id="ak-expiry" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Бессрочно</SelectItem>
                <SelectItem value="7">7 дней</SelectItem>
                <SelectItem value="30">30 дней</SelectItem>
                <SelectItem value="90">90 дней</SelectItem>
                <SelectItem value="365">1 год</SelectItem>
                <SelectItem value="custom">Своя дата</SelectItem>
              </SelectContent>
            </Select>
            {expiry === 'custom' ? (
              <Input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={!name || scopes.length === 0 || create.isPending}
            onClick={() => {
              const expiresAt = computeExpiresAt()
              create.mutate(
                { name, scopes: scopes.join(','), expiresAt },
                {
                  onSuccess: (key) => {
                    onCreated(key)
                  },
                }
              )
            }}
          >
            {create.isPending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Создать ключ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SecretRevealDialog({
  apiKey,
  onOpenChange,
}: {
  apiKey: ApiKeyWithSecret | null
  onOpenChange: (v: boolean) => void
}) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!apiKey) setCopied(false)
  }, [apiKey])

  async function copySecret() {
    if (!apiKey?.secret) return
    try {
      await navigator.clipboard.writeText(apiKey.secret)
      setCopied(true)
      toast.success('Ключ скопирован в буфер обмена')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Не удалось скопировать ключ')
    }
  }

  return (
    <AlertDialog open={!!apiKey} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[520px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            Сохраните API-ключ
          </AlertDialogTitle>
          <AlertDialogDescription>
            Ключ <strong>{apiKey?.name}</strong> создан. Это единственный раз, когда полный ключ показывается — сохраните его в безопасном месте.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mr-1 inline size-3.5" />
            После закрытия этого окна ключ восстановить нельзя. В дальнейшем вы увидите только префикс.
          </div>
          <div className="space-y-1.5">
            <Label>Ваш API-ключ</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md border bg-muted/40 p-2 font-mono text-xs">
                {apiKey?.secret}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={copySecret}
                aria-label="Скопировать ключ"
              >
                {copied ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Префикс для отображения: <code className="font-mono">{apiKey?.keyPrefix}••••</code>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Scopes</div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {apiKey?.scopes.split(',').filter(Boolean).map((s) => (
                  <Badge key={s} variant="outline" className={`text-[10px] ${SCOPE_BADGE[s] ?? ''}`}>
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Лимит запросов</div>
              <div className="pt-0.5 font-medium tabular-nums">
                {new Intl.NumberFormat('ru-RU').format(apiKey?.requestsLimit ?? 0)} / мес
              </div>
            </div>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            <Check className="size-4" />
            Я сохранил ключ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function RevokeConfirmDialog({
  apiKey,
  onOpenChange,
}: {
  apiKey: ApiKeyDto | null
  onOpenChange: (v: boolean) => void
}) {
  const revoke = useUpdateApiKey()
  return (
    <AlertDialog open={!!apiKey} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Отозвать API-ключ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ключ <strong>{apiKey?.name}</strong> будет помечен как отозванный. Внешние системы потеряют доступ немедленно. Действие необратимо.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-600 hover:bg-amber-700"
            disabled={revoke.isPending}
            onClick={() => {
              if (!apiKey) return
              revoke.mutate(
                { id: apiKey.id, status: 'revoked' },
                { onSuccess: () => onOpenChange(false) }
              )
            }}
          >
            <Ban className="size-4" />
            Отозвать ключ
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteConfirmDialog({
  apiKey,
  onOpenChange,
}: {
  apiKey: ApiKeyDto | null
  onOpenChange: (v: boolean) => void
}) {
  const del = useDeleteApiKey()
  return (
    <AlertDialog open={!!apiKey} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить API-ключ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ключ <strong>{apiKey?.name}</strong> будет удалён навсегда вместе с историей использования. Это действие нельзя отменить.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            disabled={del.isPending}
            onClick={() => {
              if (!apiKey) return
              del.mutate(
                { id: apiKey.id },
                { onSuccess: () => onOpenChange(false) }
              )
            }}
          >
            <Trash2 className="size-4" />
            Удалить навсегда
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ApiDocsCard() {
  const [copied, setCopied] = React.useState<string | null>(null)

  const examples = [
    {
      id: 'list',
      title: 'Получить список стандартов',
      cmd: `curl -H "Authorization: Bearer nk-your-key-here" \\
  https://your-domain.ru/api/v1/standards`,
    },
    {
      id: 'analyze',
      title: 'Запустить анализ документа',
      cmd: `curl -X POST -H "Authorization: Bearer nk-your-key-here" \\
  -H "Content-Type: application/json" \\
  -d '{"runLlm":true}' \\
  https://your-domain.ru/api/v1/documents/{id}/analyze`,
    },
    {
      id: 'get-doc',
      title: 'Получить документ по ID',
      cmd: `curl -H "Authorization: Bearer nk-your-key-here" \\
  https://your-domain.ru/api/v1/documents/{id}`,
    },
  ]

  async function copyCmd(cmd: string, id: string) {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(id)
      toast.success('Команда скопирована')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Не удалось скопировать')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Terminal className="size-4" />
          Документация API
        </CardTitle>
        <CardDescription>
          Примеры запросов к <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">/api/v1/*</code> эндпоинтам
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {examples.map((ex) => (
          <div key={ex.id} className="rounded-md border bg-muted/30">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Activity className="size-3.5 text-emerald-600" />
                {ex.title}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-xs"
                onClick={() => copyCmd(ex.cmd, ex.id)}
              >
                {copied === ex.id ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    Скопировано
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Копировать
                  </>
                )}
              </Button>
            </div>
            <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
              <code className="font-mono">{ex.cmd}</code>
            </pre>
          </div>
        ))}
        <div className="text-xs text-muted-foreground">
          Все запросы требуют заголовок <code className="rounded bg-muted px-1 py-0.5 font-mono">Authorization: Bearer &lt;ваш-ключ&gt;</code>.
          Лимит запросов — согласно вашему тарифу.
        </div>
      </CardContent>
    </Card>
  )
}
