'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Building2,
  CreditCard,
  BarChart3,
  Users,
  Shield,
  Save,
  UserPlus,
  MoreVertical,
  RefreshCw,
  ChevronDown,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'
import {
  useOrganization,
  useUpdateOrganization,
  useOrgUsers,
  useInviteUser,
  useUpdateUser,
  useSubscription,
  useUsageStats,
  usePlans,
  type PlanItem,
} from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { PlanCard } from './nk-plan-card'
import { UsageBar } from './nk-usage-bar'
import { formatDateTime, formatDate } from './nk-format'
import type { UserDto } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  normocontroller: 'Нормоконтролёр',
  engineer: 'Инженер',
  viewer: 'Наблюдатель',
}

const ROLE_BADGE: Record<string, string> = {
  admin:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-200 dark:border-red-900',
  normocontroller:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
  engineer:
    'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-900',
  viewer:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
}

const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  disabled: 'Отключён',
  pending: 'Ожидает',
}

const USER_STATUS_BADGE: Record<string, string> = {
  active:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
  disabled:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
  pending:
    'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-900',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Старт',
  pro: 'Профи',
  enterprise: 'Предприятие',
}

const PLAN_BADGE: Record<string, string> = {
  free:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
  pro:
    'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-900',
  enterprise:
    'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:border-violet-900',
}

const SUB_STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  past_due: 'Просрочена',
  cancelled: 'Отменена',
  trialing: 'Триал',
}

function formatAmount(amount: number, currency: string): string {
  const sym = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : ''
  return `${new Intl.NumberFormat('ru-RU').format(amount)} ${sym}`
}

export function Settings() {
  const orgQ = useOrganization()
  const subQ = useSubscription()
  const usageQ = useUsageStats()
  const plansQ = usePlans()

  return (
    <div className="space-y-5">
      <PageHeader
        title="Настройки"
        description="Организация, подписка, использование и пользователи"
        actions={
          <Button variant="outline" size="sm" onClick={() => {
            orgQ.refetch()
            subQ.refetch()
            usageQ.refetch()
          }}>
            <RefreshCw className={orgQ.isFetching || subQ.isFetching || usageQ.isFetching ? 'size-4 animate-spin' : 'size-4'} />
            Обновить
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <OrganizationSection />
        <SubscriptionSection />
      </div>

      <UsageSection />

      <UsersSection />

      {/* Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" />
            Тарифные планы
          </CardTitle>
          <CardDescription>
            Сравните возможности тарифов. Текущий тариф подсвечен.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plansQ.isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-80 w-full" />
              ))}
            </div>
          ) : plansQ.isError ? (
            <ErrorState
              message="Не удалось загрузить тарифы"
              onRetry={() => plansQ.refetch()}
            />
          ) : (plansQ.data && (Array.isArray(plansQ.data) ? plansQ.data.length : plansQ.data.items.length) === 0) ? (
            <EmptyState
              title="Тарифы не найдены"
              description="Обратитесь к администратору"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(Array.isArray(plansQ.data) ? plansQ.data : plansQ.data?.items ?? []).map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  current={p.id === orgQ.data?.plan}
                  onSelect={() =>
                    toast.info('Свяжитесь с отделом продаж для смены тарифа', {
                      description: 'sales@nk-control.ru · +7 (812) 555-00-00',
                    })
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============ Organization ============

function OrganizationSection() {
  const { data, isLoading, isError, refetch } = useOrganization()
  const updateMut = useUpdateOrganization()

  const [name, setName] = React.useState('')
  const [contactEmail, setContactEmail] = React.useState('')
  const [contactPhone, setContactPhone] = React.useState('')

  React.useEffect(() => {
    if (data) {
      setName(data.name)
      setContactEmail(data.contactEmail ?? '')
      setContactPhone(data.contactPhone ?? '')
    }
  }, [data])

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" />
            Организация
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState
            message="Не удалось загрузить данные организации"
            onRetry={() => refetch()}
          />
        </CardContent>
      </Card>
    )
  }

  const dirty =
    data != null &&
    (name !== data.name ||
      contactEmail !== (data.contactEmail ?? '') ||
      contactPhone !== (data.contactPhone ?? ''))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4" />
          Организация
        </CardTitle>
        <CardDescription>Реквизиты и контакты</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Наименование</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Наименование организации"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="org-slug">Slug</Label>
                <Input
                  id="org-slug"
                  value={data?.slug ?? ''}
                  readOnly
                  disabled
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-inn">ИНН</Label>
                <Input
                  id="org-inn"
                  value={data?.inn ?? ''}
                  readOnly
                  disabled
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-email">Email для связи</Label>
              <Input
                id="org-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="info@example.ru"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-phone">Телефон</Label>
              <Input
                id="org-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+7 (___) ___-__-__"
              />
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="size-3.5" />
          Обновлено: {data ? formatDateTime(data.updatedAt) : '—'}
        </div>
        <Button
          size="sm"
          disabled={!dirty || updateMut.isPending}
          onClick={() => {
            updateMut.mutate({
              name,
              contactEmail: contactEmail || undefined,
              contactPhone: contactPhone || undefined,
            })
          }}
        >
          {updateMut.isPending ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Сохранить
        </Button>
      </CardFooter>
    </Card>
  )
}

// ============ Subscription ============

function SubscriptionSection() {
  const { data, isLoading, isError, refetch } = useSubscription()
  const orgQ = useOrganization()
  const plansQ = usePlans()
  const [compareOpen, setCompareOpen] = React.useState(false)

  const currentPlan = orgQ.data?.plan ?? data?.plan

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-4" />
          Подписка
        </CardTitle>
        <CardDescription>Текущий тариф и реквизиты оплаты</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            message="Не удалось загрузить подписку"
            onRetry={() => refetch()}
          />
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
              <div>
                <div className="text-xs text-muted-foreground">Тариф</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-base font-semibold">
                    {PLAN_LABELS[currentPlan ?? 'free'] ?? currentPlan}
                  </span>
                  {currentPlan ? (
                    <Badge variant="outline" className={PLAN_BADGE[currentPlan]}>
                      {currentPlan}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Сумма</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {data ? formatAmount(data.amount, data.currency) : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {data?.interval === 'month' ? 'в месяц' : data?.interval === 'year' ? 'в год' : ''}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Статус</div>
                <div className="mt-0.5 text-sm font-medium">
                  {data ? SUB_STATUS_LABELS[data.status] ?? data.status : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Окончание периода</div>
                <div className="mt-0.5 text-sm font-medium">
                  {data?.currentPeriodEnd ? formatDate(data.currentPeriodEnd) : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Начало периода</div>
                <div className="mt-0.5 text-sm font-medium">
                  {data ? formatDate(data.currentPeriodStart) : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Платёжная система</div>
                <div className="mt-0.5 text-sm font-medium">
                  {data?.paymentProvider ?? '—'}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCompareOpen(true)}
        >
          <ChevronDown className="size-4" />
          Сравнить тарифы
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.info('Свяжитесь с отделом продаж для смены тарифа', {
              description: 'sales@nk-control.ru · +7 (812) 555-00-00',
            })
          }
        >
          Изменить тариф
        </Button>
      </CardFooter>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Сравнение тарифов</DialogTitle>
            <DialogDescription>
              Доступные планы подписки и их возможности
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {(Array.isArray(plansQ.data) ? plansQ.data : plansQ.data?.items ?? []).map((p: PlanItem) => (
              <PlanCard
                key={p.id}
                plan={p}
                current={p.id === currentPlan}
                onSelect={() => {
                  setCompareOpen(false)
                  toast.info('Свяжитесь с отделом продаж для смены тарифа', {
                    description: 'sales@nk-control.ru · +7 (812) 555-00-00',
                  })
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ============ Usage ============

function UsageSection() {
  const { data, isLoading, isError, refetch } = useUsageStats()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4" />
          Использование
        </CardTitle>
        <CardDescription>
          Текущее потребление ресурсов в пределах тарифа
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            message="Не удалось загрузить статистику использования"
            onRetry={() => refetch()}
          />
        ) : !data ? null : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <UsageBar
              label="Документов"
              value={data.documentsCount}
              max={data.maxDocuments}
              percent={data.documentsPercent}
            />
            <UsageBar
              label="Проверок в этом месяце"
              value={data.checksThisMonth}
              max={data.maxChecks}
              percent={data.checksPercent}
            />
            <UsageBar
              label="Пользователей"
              value={data.usersCount}
              max={data.maxUsers}
            />
            <UsageBar
              label="API-запросов в этом месяце"
              value={data.apiRequestsThisMonth}
              max={data.maxApiRequests}
            />
          </div>
        )}
        {data?.trialDaysLeft != null && data.trialDaysLeft > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <Clock className="mr-1 inline size-3.5" />
            Осталось дней триала: <span className="font-bold">{data.trialDaysLeft}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ============ Users ============

function UsersSection() {
  const { data, isLoading, isError, refetch } = useOrgUsers()
  const orgQ = useOrganization()

  const [inviteOpen, setInviteOpen] = React.useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" />
              Пользователи
            </CardTitle>
            <CardDescription>
              Сотрудники организации: {data?.items.length ?? 0} из{' '}
              {orgQ.data?.maxUsers ?? '—'}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            Пригласить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {isError ? (
          <div className="px-6">
            <ErrorState
              message="Не удалось загрузить пользователей"
              onRetry={() => refetch()}
            />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 px-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <div className="px-6">
            <EmptyState
              icon={<Users className="size-6" />}
              title="Пользователей нет"
              description="Пригласите сотрудников в организацию"
            />
          </div>
        ) : (
          <ScrollArea className="max-h-[28rem]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Email / Имя</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Последний вход</TableHead>
                  <TableHead className="pr-6 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </Card>
  )
}

function UserRow({ user }: { user: UserDto }) {
  const updateUser = useUpdateUser()
  return (
    <TableRow>
      <TableCell className="pl-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{user.email}</span>
          {user.name ? (
            <span className="text-xs text-muted-foreground">{user.name}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={ROLE_BADGE[user.role]}>
          {ROLE_LABELS[user.role] ?? user.role}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={USER_STATUS_BADGE[user.status]}>
          {USER_STATUS_LABELS[user.status] ?? user.status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Никогда'}
      </TableCell>
      <TableCell className="pr-6 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Изменить роль</DropdownMenuLabel>
            {(['admin', 'normocontroller', 'engineer', 'viewer'] as const).map((r) => (
              <DropdownMenuItem
                key={r}
                onClick={() => updateUser.mutate({ id: user.id, role: r })}
                disabled={user.role === r}
              >
                {ROLE_LABELS[r]}
                {user.role === r ? <CheckCircle2 className="ml-auto size-3.5 text-emerald-500" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Статус</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => updateUser.mutate({ id: user.id, status: 'active' })}
              disabled={user.status === 'active'}
            >
              <CheckCircle2 className="mr-2 size-3.5 text-emerald-500" />
              Активировать
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => updateUser.mutate({ id: user.id, status: 'disabled' })}
              disabled={user.status === 'disabled'}
            >
              <XCircle className="mr-2 size-3.5 text-red-500" />
              Отключить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function InviteUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const invite = useInviteUser()
  const [email, setEmail] = React.useState('')
  const [name, setName] = React.useState('')
  const [role, setRole] = React.useState<'admin' | 'normocontroller' | 'engineer' | 'viewer'>('viewer')

  React.useEffect(() => {
    if (!open) {
      setEmail('')
      setName('')
      setRole('viewer')
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Пригласить пользователя</DialogTitle>
          <DialogDescription>
            На email будет отправлено приглашение присоединиться к организации
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.ru"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Имя</Label>
            <Input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иванов Иван Иванович"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Роль</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as typeof role)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Администратор</SelectItem>
                <SelectItem value="normocontroller">Нормоконтролёр</SelectItem>
                <SelectItem value="engineer">Инженер</SelectItem>
                <SelectItem value="viewer">Наблюдатель</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={!email || invite.isPending}
            onClick={() => {
              invite.mutate(
                { email, name: name || email.split('@')[0], role },
                {
                  onSuccess: () => {
                    onOpenChange(false)
                    toast.success('Приглашение отправлено', {
                      description: (
                        <span className="flex items-center gap-1.5">
                          <Mail className="size-3.5" />
                          {email}
                        </span>
                      ),
                    })
                  },
                }
              )
            }}
          >
            {invite.isPending ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            Отправить приглашение
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
