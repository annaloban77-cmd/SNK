import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runBench } from '@/lib/bench'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// GET /api/bench/run — текущий статус стенда
export async function GET() {
  const lastRun = await db.benchRun.findFirst({
    where: { status: 'completed' },
    orderBy: { startedAt: 'desc' },
    include: { _count: { select: { findings: true } } },
  })
  const runningRun = await db.benchRun.findFirst({
    where: { status: 'running' },
    orderBy: { startedAt: 'desc' },
  })
  const samplesCount = await db.benchSample.count({ where: { isActive: true } })
  const correctCount = await db.benchSample.count({ where: { isActive: true, category: 'correct' } })
  const errorsCount = await db.benchSample.count({ where: { isActive: true, category: 'with_errors' } })
  const last5Runs = await db.benchRun.findMany({
    where: { status: 'completed' },
    orderBy: { startedAt: 'desc' },
    take: 5,
    select: {
      id: true, version: true, benchStatus: true, recall: true, precision: true,
      recallHigh: true, passedSamples: true, failedSamples: true, totalSamples: true,
      durationMs: true, startedAt: true,
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
    } : null,
    samples: { total: samplesCount, correct: correctCount, withErrors: errorsCount },
    history: last5Runs.map(r => ({
      id: r.id, version: r.version, benchStatus: r.benchStatus,
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
  const version = body.version || `bench-${new Date().toISOString().slice(0, 19)}`

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
