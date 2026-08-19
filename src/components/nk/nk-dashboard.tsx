'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowRight,
  Activity,
  BookOpen,
  ListChecks,
  Library,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDashboard, useStandardsStats } from '@/hooks/use-nk-api'
import { StatCard } from './nk-stat-card'
import { PageHeader } from './nk-page-header'
import { EmptyState, ErrorState } from './nk-empty-state'
import { DocStatusBadge } from './nk-status-badge'
import { SeverityBadge, IssuesSummary } from './nk-severity-badge'
import { useNKStore } from '@/stores/nk-store'
import { formatDateTime, formatDuration, categoryLabel } from './nk-format'

const SEVERITY_CHART_CONFIG: ChartConfig = {
  Высокая: { label: 'Высокая', color: '#ef4444' },
  Средняя: { label: 'Средняя', color: '#f59e0b' },
  Низкая: { label: 'Низкая', color: '#3b82f6' },
}

const STATUS_CHART_CONFIG: ChartConfig = {
  Новые: { label: 'Новые', color: '#64748b' },
  'В проверке': { label: 'В проверке', color: '#f59e0b' },
  Проверены: { label: 'Проверены', color: '#10b981' },
  Ошибка: { label: 'Ошибка', color: '#ef4444' },
}

export function Dashboard() {
  const { data, isLoading, isError, refetch } = useDashboard()
  const statsQ = useStandardsStats()
  const setView = useNKStore((s) => s.setView)
  const selectDocument = useNKStore((s) => s.selectDocument)

  if (isError) {
    return (
      <ErrorState
        message="Не удалось загрузить дашборд"
        onRetry={() => refetch()}
      />
    )
  }

  const stats = data
  const standardsCount = stats?.standardsCount ?? statsQ.data?.total ?? 0
  const rulesCount = stats?.rulesCount ?? 0
  const categoriesCount =
    stats?.categoriesCount ??
    (statsQ.data?.byCategory ?? []).filter((c) => c.category && c.category !== 'unknown').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Дашборд"
        description="Сводка по документам, замечаниям и проверкам"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Activity className="size-4" />
            Обновить
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Всего документов"
          value={stats?.totalDocuments ?? 0}
          icon={<FileText className="size-5" />}
          tone="slate"
          loading={isLoading}
          hint={
            stats
              ? `Из них проверено: ${stats.analyzedDocuments} · в очереди: ${stats.pendingDocuments}`
              : undefined
          }
        />
        <StatCard
          label="Проверено"
          value={stats?.analyzedDocuments ?? 0}
          icon={<CheckCircle2 className="size-5" />}
          tone="emerald"
          loading={isLoading}
          hint={
            stats ? (
              <span className="inline-flex items-center gap-1">
                Без замечаний:{' '}
                <span className="font-semibold tabular-nums">{stats.passRate}%</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground/60 hover:text-foreground"
                      aria-label="Что значит «Без замечаний»?"
                    >
                      <AlertTriangle className="size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Доля документов, прошедших проверку без замечаний высокой критичности
                  </TooltipContent>
                </Tooltip>
              </span>
            ) : undefined
          }
        />
        <StatCard
          label="Замечания высокой критичности"
          value={stats?.highIssues ?? 0}
          icon={<AlertTriangle className="size-5" />}
          tone="red"
          loading={isLoading}
          hint={
            stats
              ? `Всего замечаний: ${stats.totalIssues} (подтв.: ${stats.confirmedIssues}, исправлено: ${stats.fixedIssues})`
              : undefined
          }
        />
        <StatCard
          label="Среднее время проверки"
          value={
            stats?.avgCheckDurationMs != null
              ? formatDuration(stats.avgCheckDurationMs)
              : '—'
          }
          icon={<Clock className="size-5" />}
          tone="amber"
          loading={isLoading}
          hint="Усреднение по проанализированным документам"
        />
      </div>

      {/* Knowledge Base health */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
                <Library className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base">База знаний</CardTitle>
                <CardDescription>
                  Нормативное обеспечение системы
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('knowledge')}
            >
              Открыть <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KBStat
              label="Стандартов"
              value={standardsCount}
              loading={statsQ.isLoading && !stats?.standardsCount}
              icon={<BookOpen className="size-4" />}
            />
            <KBStat
              label="Правил"
              value={rulesCount}
              loading={isLoading && !stats?.rulesCount}
              icon={<ListChecks className="size-4" />}
            />
            <KBStat
              label="Справочников"
              value={stats?.referenceCount ?? 0}
              loading={isLoading && stats?.referenceCount === undefined}
              icon={<Library className="size-4" />}
            />
            <KBStat
              label={`Версия БД: v${stats?.dbVersion ?? '?'}`}
              value={categoriesCount}
              loading={statsQ.isLoading && !stats?.categoriesCount}
              icon={<CheckCircle2 className="size-4" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Замечания по критичности</CardTitle>
            <CardDescription>
              Распределение по уровням важности
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <ChartContainer
                config={SEVERITY_CHART_CONFIG}
                className="mx-auto aspect-square max-h-[260px]"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="value" />} />
                  <Pie
                    data={stats?.issuesBySeverity ?? []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {(stats?.issuesBySeverity ?? []).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Документы по статусам</CardTitle>
            <CardDescription>Сколько документов в каком состоянии</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <ChartContainer
                config={STATUS_CHART_CONFIG}
                className="aspect-video max-h-[260px] w-full"
              >
                <BarChart data={stats?.documentsByStatus ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={4}>
                    {(stats?.documentsByStatus ?? []).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Документы по форматам</CardTitle>
            <CardDescription>Распределение по ГОСТ-форматам</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <ChartContainer
                config={{ value: { label: 'Документов', color: '#10b981' } }}
                className="aspect-video max-h-[260px] w-full"
              >
                <BarChart data={stats?.documentsByFormat ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="#10b981" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Замечания по категориям</CardTitle>
            <CardDescription>Срез по типам проверок</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <ChartContainer
                config={{ value: { label: 'Замечаний', color: '#f59e0b' } }}
                className="aspect-video max-h-[260px] w-full"
              >
                <BarChart
                  data={(stats?.issuesByCategory ?? []).map((c) => ({
                    ...c,
                    name: categoryLabel(c.name),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="#f59e0b" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent documents + Top issues */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Последние документы</CardTitle>
                <CardDescription>5 самых свежих загрузок</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('documents')}
              >
                Все <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="space-y-2 px-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (stats?.recentDocuments ?? []).length === 0 ? (
              <EmptyState
                title="Документов пока нет"
                description="Загрузите первый чертёж, чтобы увидеть его здесь"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Имя</TableHead>
                    <TableHead>Формат</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Замечания</TableHead>
                    <TableHead className="pr-6 text-right">Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.recentDocuments ?? []).map((d) => (
                    <TableRow
                      key={d.id}
                      className="cursor-pointer"
                      onClick={() => {
                        selectDocument(d.id)
                        setView('document-detail')
                      }}
                    >
                      <TableCell className="pl-6 font-medium">
                        <div className="line-clamp-1 max-w-[260px]">{d.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {d.format}
                        </Badge>
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
                      <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                        {formatDateTime(d.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Топ замечаний</CardTitle>
            <CardDescription>Самые частые нарушения</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (stats?.topIssues ?? []).length === 0 ? (
              <EmptyState
                title="Замечаний нет"
                description="После первых проверок здесь появится статистика"
              />
            ) : (
              (stats?.topIssues ?? []).map((t) => (
                <div
                  key={t.code}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div className="flex w-10 shrink-0 items-center justify-center">
                    <span className="text-xl font-bold leading-none tabular-nums">
                      {t.count}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={t.severity} />
                      <Badge variant="outline" className="font-mono text-xs">
                        {t.code}
                      </Badge>
                    </div>
                    <div className="mt-1 line-clamp-1 text-sm">{t.title}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KBStat({
  label,
  value,
  loading,
  icon,
}: {
  label: string
  value: number
  loading?: boolean
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-1.5 h-6 w-16" />
      ) : (
        <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      )}
    </div>
  )
}

// Avoid unused-import warnings
void ResponsiveContainer
