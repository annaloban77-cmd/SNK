import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runBench } from '@/lib/bench'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const BENCH_WATCHDOG_MS = 10 * 60 * 1000 // 10 минут — висящий прогон помечается aborted

/**
 * Watchdog: прогоны со статусом 'running', которые идут дольше 10 минут,
 * помечаются как 'aborted'. Запускается при каждом запросе статуса стенда.
 */
async function runBenchWatchdog() {
  try {
    const cutoff = new Date(Date.now() - BENCH_WATCHDOG_MS)
    const stuck = await db.benchRun.findMany({
      where: { status: 'running', startedAt: { lt: cutoff } },
      select: { id: true, version: true, startedAt: true },
    })
    if (stuck.length === 0) return
    await db.benchRun.updateMany({
      where: { id: { in: stuck.map((s) => s.id) } },
      data: {
        status: 'aborted',
        finishedAt: new Date(),
        durationMs: Date.now() - stuck[0].startedAt.getTime(),
        notes: 'Превышено время ожидания (10 мин) — watchdog',
      },
    })
    console.log(`[bench-watchdog] Aborted ${stuck.length} stuck run(s): ${stuck.map((s) => s.id).join(', ')}`)
  } catch (e) {
    console.error('bench watchdog failed:', e)
  }
}

/**
 * Человеко-читаемое имя версии: "Тест 19.08.2026 14:32" вместо "bench-2026-08-19T14:32:11".
 */
function humanVersion(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Тест ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// GET /api/bench/run — текущий статус стенда
export async function GET() {
  // Watchdog: помечает висящие прогоны как 'aborted' перед возвратом статуса
  await runBenchWatchdog()

  const lastRun = await db.benchRun.findFirst({
    where: { status: 'completed' },
    orderBy: { startedAt: 'desc' },
    include: { _count: { select: { findings: true } } },
  })
  const runningRun = await db.benchRun.findFirst({
    where: { status: 'running' },
    orderBy: { startedAt: 'desc' },
  })
  // Прогресс текущего прогона: сколько findings уже сохранено
  let progress: { processed: number; total: number } | null = null
  if (runningRun) {
    const processed = await db.benchFinding.count({ where: { runId: runningRun.id } })
    const total = await db.benchSample.count({ where: { isActive: true } })
    progress = { processed, total }
  }
  const samplesCount = await db.benchSample.count({ where: { isActive: true } })
  const correctCount = await db.benchSample.count({ where: { isActive: true, category: 'correct' } })
  const errorsCount = await db.benchSample.count({ where: { isActive: true, category: 'with_errors' } })
  const last5Runs = await db.benchRun.findMany({
    where: { status: { in: ['completed', 'aborted', 'failed'] } },
    orderBy: { startedAt: 'desc' },
    take: 5,
    select: {
      id: true, version: true, benchStatus: true, recall: true, precision: true,
      recallHigh: true, passedSamples: true, failedSamples: true, totalSamples: true,
      durationMs: true, startedAt: true, status: true,
    },
  })
  return NextResponse.json({
    lastRun: lastRun ? {
      id: lastRun.id, version: lastRun.version, status: lastRun.status,
      benchStatus: lastRun.benchStatus, recall: lastRun.recall, precision: lastRun.precision,
      recallHigh: lastRun.recallHigh, coordAccuracy: lastRun.coordAccuracy,
      totalSamples: lastRun.totalSamples, passedSamples: lastRun.passedSamples, failedSamples: lastRun.failedSamples,
      totalExpected: lastRun.totalExpected, totalFound: lastRun.totalFound,
      totalMatched: lastRun.totalMatched, totalFalsePos: lastRun.totalFalsePos, totalFalseNeg: lastRun.totalFalseNeg,
      durationMs: lastRun.durationMs, startedAt: lastRun.startedAt.toISOString(),
      finishedAt: lastRun.finishedAt?.toISOString() ?? null,
      findingsCount: lastRun._count.findings,
    } : null,
    runningRun: runningRun ? {
      id: runningRun.id, version: runningRun.version, startedAt: runningRun.startedAt.toISOString(),
      progress,
    } : null,
    samples: { total: samplesCount, correct: correctCount, withErrors: errorsCount },
    history: last5Runs.map(r => ({
      id: r.id, version: r.version, benchStatus: r.benchStatus, status: r.status,
      recall: r.recall, precision: r.precision, recallHigh: r.recallHigh,
      passedSamples: r.passedSamples, failedSamples: r.failedSamples, totalSamples: r.totalSamples,
      durationMs: r.durationMs, startedAt: r.startedAt.toISOString(),
    })),
  })
}

// POST /api/bench/run — запустить новый прогон
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const runLlm = body.runLlm === true
  const version = body.version || humanVersion()

  try {
    const result = await runBench({ runLlm, version })
    await logAudit({
      action: 'bench.run',
      resourceType: 'bench',
      resourceId: result.runId,
      details: { version, status: result.benchStatus, recall: result.recall, precision: result.precision },
    })
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
