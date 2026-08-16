import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/bench/results/[runId] — детали прогона + findings по семплам
export async function GET(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const run = await db.benchRun.findUnique({
    where: { id: runId },
    include: { findings: { take: 500, orderBy: { sampleId: 'asc' } } },
  })
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  
  // Группируем findings по sampleId
  const bySample: Record<string, any[]> = {}
  for (const f of run.findings) {
    if (!bySample[f.sampleId]) bySample[f.sampleId] = []
    bySample[f.sampleId].push({
      id: f.id, status: f.status,
      foundCode: f.foundCode, foundTitle: f.foundTitle, foundSeverity: f.foundSeverity, foundField: f.foundField,
      expectedCode: f.expectedCode, expectedTitle: f.expectedTitle, expectedSeverity: f.expectedSeverity,
      coordDelta: f.coordDelta,
    })
  }
  
  // Список всех семплов с их статусом в этом прогоне
  const samples = await db.benchSample.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } })
  const samplesWithResults = samples.map(s => {
    const findings = bySample[s.id] || []
    const matched = findings.filter(f => f.status === 'matched').length
    const falsePos = findings.filter(f => f.status === 'false_positive').length
    const falseNeg = findings.filter(f => f.status === 'false_negative').length
    const expected = s.expectedCount
    const recall = expected > 0 ? matched / expected : (falsePos === 0 ? 1 : 0)
    const precision = findings.length > 0 ? matched / findings.length : 1
    const isPass = s.category === 'correct' ? falsePos === 0 : recall >= 0.85 && precision >= 0.5
    return {
      id: s.id, code: s.code, title: s.title, category: s.category, format: s.format,
      expectedCount: expected, foundCount: findings.length,
      matched, falsePositives: falsePos, falseNegatives: falseNeg,
      recall: Math.round(recall * 100), precision: Math.round(precision * 100),
      pass: isPass,
      findings,
    }
  })
  
  return NextResponse.json({
    run: {
      id: run.id, version: run.version, status: run.status, benchStatus: run.benchStatus,
      recall: run.recall, precision: run.precision, recallHigh: run.recallHigh,
      coordAccuracy: run.coordAccuracy,
      totalSamples: run.totalSamples, passedSamples: run.passedSamples, failedSamples: run.failedSamples,
      totalExpected: run.totalExpected, totalFound: run.totalFound,
      totalMatched: run.totalMatched, totalFalsePos: run.totalFalsePos, totalFalseNeg: run.totalFalseNeg,
      durationMs: run.durationMs, notes: run.notes,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    },
    samples: samplesWithResults,
  })
}
