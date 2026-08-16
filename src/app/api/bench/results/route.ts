import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/bench/results — список прогонов с пагинацией
export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
  const pageSize = parseInt(req.nextUrl.searchParams.get('pageSize') || '20')
  const runs = await db.benchRun.findMany({
    orderBy: { startedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { _count: { select: { findings: true } } },
  })
  const total = await db.benchRun.count()
  return NextResponse.json({
    items: runs.map(r => ({
      id: r.id, version: r.version, status: r.status, benchStatus: r.benchStatus,
      recall: r.recall, precision: r.precision, recallHigh: r.recallHigh,
      totalSamples: r.totalSamples, passedSamples: r.passedSamples, failedSamples: r.failedSamples,
      totalMatched: r.totalMatched, totalFalsePos: r.totalFalsePos, totalFalseNeg: r.totalFalseNeg,
      durationMs: r.durationMs, findingsCount: r._count.findings,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    total, page, pageSize,
  })
}
