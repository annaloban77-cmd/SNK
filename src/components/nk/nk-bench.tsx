'use client'

import * as React from 'react'
import { useBenchStatus, useRunBench, useBenchResultsList, useBenchResults } from '@/hooks/use-nk-api'
import { PageHeader } from './nk-page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FlaskConical, Play, CheckCircle2, XCircle, AlertTriangle, Clock,
  TrendingUp, Target, Activity, ChevronRight, History,
} from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline">—</Badge>
  const map: Record<string, { label: string; className: string }> = {
    green: { label: 'ЗЕЛЁНЫЙ', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    yellow: { label: 'ЖЁЛТЫЙ', className: 'bg-amber-100 text-amber-700 border-amber-300' },
    red: { label: 'КРАСНЫЙ', className: 'bg-red-100 text-red-700 border-red-300' },
  }
  const m = map[status] || { label: status, className: '' }
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: 'Завершён', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    aborted: { label: 'Прерван (watchdog)', className: 'bg-red-100 text-red-700 border-red-300' },
    failed: { label: 'Ошибка', className: 'bg-red-100 text-red-700 border-red-300' },
    running: { label: 'Идёт...', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  }
  const m = map[status] || { label: status, className: '' }
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>
}

function MetricCard({ label, value, target, icon, tone = 'slate' }: {
  label: string; value: number | null; target?: string; icon: React.ReactNode; tone?: string
}) {
  const toneClass: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    sky: 'bg-sky-100 text-sky-700',
  }
  const pct = value !== null ? Math.round(value * 100) : 0
  const isOk = target ? (value !== null && pct >= parseInt(target)) : false
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {value !== null ? `${pct}%` : '—'}
            </div>
            {target && (
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Цель: ≥ {target}% {isOk && <CheckCircle2 className="inline size-3 text-emerald-600" />}
              </div>
            )}
          </div>
          <div className={`rounded-lg p-2 ${toneClass[tone]}`}>{icon}</div>
        </div>
        {target && (
          <Progress value={pct} className="mt-3 h-1.5" />
        )}
      </CardContent>
    </Card>
  )
}

export function Bench() {
  const { data: status, isLoading } = useBenchStatus()
  const runBench = useRunBench()
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null)

  const lastRun = status?.lastRun
  const running = status?.runningRun
  const samples = status?.samples
  const history = status?.history || []

  // Прогресс текущего прогона: 0..100
  const progressPct = running?.progress
    ? running.progress.total > 0
      ? Math.min(100, Math.round((running.progress.processed / running.progress.total) * 100))
      : 0
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Стенд (Bench)"
        description="Предохранитель релиза. Тест на тестовых документах с известными ошибками."
        actions={
          <Button
            onClick={() => runBench.mutate({ runLlm: false })}
            disabled={runBench.isPending || !!running}
          >
            <Play className="size-4 mr-2" />
            {running ? 'Идёт тестирование...' : 'Запустить тест'}
          </Button>
        }
      />

      {/* Info alert */}
      <Card className="border-sky-200 bg-sky-50/50">
        <CardContent className="p-4 flex gap-3">
          <FlaskConical className="size-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-sky-900">Регламент релиза (P4)</div>
            <div className="text-sky-800 mt-1">
              Ни один релиз ядра не уходит в продакшн, пока стенд не зелёный.
              Критерий: <strong>Recall ≥ 90%</strong> по высококритичным ошибкам,{' '}
              <strong>Precision ≥ 85%</strong>, координатная точность ≤ 5 мм.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Running indicator with live progress */}
      {running && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-3 rounded-full bg-amber-500 animate-pulse" />
              <div className="text-sm flex-1">
                <span className="font-medium">Идёт тестирование... {progressPct}%</span>
                {running.progress && (
                  <span className="text-muted-foreground ml-2">
                    ({running.progress.processed}/{running.progress.total})
                  </span>
                )}
                <span className="text-muted-foreground ml-2">
                  {format(new Date(running.startedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                </span>
              </div>
            </div>
            {running.progress && (
              <Progress value={progressPct} className="h-2" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Samples summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Всего тестовых документов</div>
            <div className="mt-1 text-2xl font-bold">{samples?.total ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Эталонные</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{samples?.correct ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">С ошибками</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{samples?.withErrors ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-[11px] uppercase text-muted-foreground">Статус</div>
            <div className="mt-1">
              {lastRun ? <StatusBadge status={lastRun.benchStatus} /> : <Badge variant="outline">Нет тестов</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics of last run */}
      {lastRun ? (
        <>
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Target className="size-5" /> Метрики последнего теста
              <span className="text-sm font-normal text-muted-foreground">— {lastRun.version}</span>
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Recall (высокая)" value={lastRun.recallHigh} target="90" icon={<AlertTriangle className="size-5" />} tone="red" />
              <MetricCard label="Recall (общий)" value={lastRun.recall} target="90" icon={<TrendingUp className="size-5" />} tone="sky" />
              <MetricCard label="Precision" value={lastRun.precision} target="85" icon={<Target className="size-5" />} tone="emerald" />
              <MetricCard label="Pass rate" value={lastRun.totalSamples > 0 ? lastRun.passedSamples / lastRun.totalSamples : null} target="90" icon={<CheckCircle2 className="size-5" />} tone="amber" />
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="size-4" /> Сводка теста
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Всего документов" value={lastRun.totalSamples} />
                <Row label="Пройдено (PASS)" value={lastRun.passedSamples} tone="emerald" />
                <Row label="Провалено (FAIL)" value={lastRun.failedSamples} tone="red" />
                <Row label="Ожидаемых ошибок" value={lastRun.totalExpected} />
                <Row label="Найдено замечаний" value={lastRun.totalFound} />
                <Row label="Совпадений (TP)" value={lastRun.totalMatched} tone="emerald" />
                <Row label="Ложных срабатываний (FP)" value={lastRun.totalFalsePos} tone="amber" />
                <Row label="Пропущено (FN)" value={lastRun.totalFalseNeg} tone="red" />
                <Row label="Длительность" value={lastRun.durationMs ? `${(lastRun.durationMs / 1000).toFixed(1)} с` : '—'} />
                <Row label="Завершён" value={lastRun.finishedAt ? format(new Date(lastRun.finishedAt), 'dd.MM.yyyy HH:mm:ss', { locale: ru }) : '—'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="size-4" /> История тестов
                </CardTitle>
                <CardDescription className="text-xs">Последние 5 тестов</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Версия</TableHead>
                        <TableHead className="text-xs">Статус</TableHead>
                        <TableHead className="text-xs">Recall</TableHead>
                        <TableHead className="text-xs">Precision</TableHead>
                        <TableHead className="text-xs">Pass</TableHead>
                        <TableHead className="text-xs">Дата</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h) => (
                        <TableRow
                          key={h.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedRunId(h.id)}
                        >
                          <TableCell className="text-xs font-mono">{h.version.slice(0, 24)}</TableCell>
                          <TableCell>
                            {h.status === 'completed' ? (
                              <StatusBadge status={h.benchStatus} />
                            ) : (
                              <RunStatusBadge status={h.status} />
                            )}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">{h.recall !== null ? `${Math.round(h.recall * 100)}%` : '—'}</TableCell>
                          <TableCell className="text-xs tabular-nums">{h.precision !== null ? `${Math.round(h.precision * 100)}%` : '—'}</TableCell>
                          <TableCell className="text-xs tabular-nums">{h.passedSamples}/{h.totalSamples}</TableCell>
                          <TableCell className="text-xs">{format(new Date(h.startedAt), 'dd.MM HH:mm', { locale: ru })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {selectedRunId && <RunDetails runId={selectedRunId} />}
        </>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <FlaskConical className="size-12 mx-auto mb-3 opacity-50" />
            <div className="text-lg font-medium">Тестов ещё нет</div>
            <div className="text-sm mt-1">Нажмите «Запустить тест» чтобы проверить систему на тестовых документах</div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600 font-medium' : tone === 'red' ? 'text-red-600 font-medium' : tone === 'amber' ? 'text-amber-600 font-medium' : ''
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${toneClass}`}>{value}</span>
    </div>
  )
}

function RunDetails({ runId }: { runId: string }) {
  const { data, isLoading } = useBenchResults(runId)
  if (isLoading) return <Skeleton className="h-64" />
  if (!data) return null

  const { run, samples } = data
  const correctSamples = samples.filter((s: any) => s.category === 'correct')
  const errorSamples = samples.filter((s: any) => s.category === 'with_errors')
  const passed = samples.filter((s: any) => s.pass).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ChevronRight className="size-4" /> Детали теста {run.version}
          <StatusBadge status={run.benchStatus} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="errors">
          <TabsList>
            <TabsTrigger value="errors">С ошибками ({errorSamples.length})</TabsTrigger>
            <TabsTrigger value="correct">Без ошибок ({correctSamples.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="errors">
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Код</TableHead>
                    <TableHead className="text-xs">Ожид.</TableHead>
                    <TableHead className="text-xs">Найдено</TableHead>
                    <TableHead className="text-xs">TP</TableHead>
                    <TableHead className="text-xs">FP</TableHead>
                    <TableHead className="text-xs">FN</TableHead>
                    <TableHead className="text-xs">Recall</TableHead>
                    <TableHead className="text-xs">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorSamples.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs font-mono">{s.code}</TableCell>
                      <TableCell className="text-xs tabular-nums">{s.expectedCount}</TableCell>
                      <TableCell className="text-xs tabular-nums">{s.foundCount}</TableCell>
                      <TableCell className="text-xs tabular-nums text-emerald-600">{s.matched}</TableCell>
                      <TableCell className="text-xs tabular-nums text-amber-600">{s.falsePositives}</TableCell>
                      <TableCell className="text-xs tabular-nums text-red-600">{s.falseNegatives}</TableCell>
                      <TableCell className="text-xs tabular-nums">{s.recall}%</TableCell>
                      <TableCell>
                        {s.pass ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="correct">
            <ScrollArea className="max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Код</TableHead>
                    <TableHead className="text-xs">Найдено (FP)</TableHead>
                    <TableHead className="text-xs">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {correctSamples.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs font-mono">{s.code}</TableCell>
                      <TableCell className="text-xs tabular-nums text-amber-600">{s.falsePositives}</TableCell>
                      <TableCell>
                        {s.pass ? <CheckCircle2 className="size-4 text-emerald-600" /> : <XCircle className="size-4 text-red-600" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
