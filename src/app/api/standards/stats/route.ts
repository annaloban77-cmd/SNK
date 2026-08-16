import { NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import type { StandardsStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  eskd: { label: 'ЕСКД', color: '#0ea5e9' },
  estd: { label: 'ЕСТД', color: '#06b6d4' },
  espd: { label: 'ЕСПД', color: '#14b8a6' },
  spds: { label: 'СПДС', color: '#22c55e' },
  welding: { label: 'Сварка', color: '#84cc16' },
  materials: { label: 'Материалы', color: '#eab308' },
  tolerances: { label: 'Допуски', color: '#f59e0b' },
  shipbuilding: { label: 'Судостроение', color: '#f97316' },
  register: { label: 'Регистр РФ', color: '#ef4444' },
  rd: { label: 'РД', color: '#ec4899' },
  sto: { label: 'СТО', color: '#8b5cf6' },
}

export async function GET() {
  const [total, activeCount, withClausesCount, byCategoryRows, byTypeRows, bySourceRows] =
    await Promise.all([
      db.standard.count(),
      db.standard.count({ where: { status: 'active' } }),
      db.standard.count({ where: { clauses: { some: {} } } }),
      db.standard.groupBy({
        by: ['category'],
        _count: true,
        orderBy: { _count: { category: 'desc' } },
      }),
      db.standard.groupBy({
        by: ['type'],
        _count: true,
        orderBy: { _count: { type: 'desc' } },
      }),
      db.standard.groupBy({
        by: ['source'],
        _count: true,
        orderBy: { _count: { source: 'desc' } },
      }),
    ])

  const byCategory = byCategoryRows.map((r) => {
    const cat = (r.category ?? 'unknown') as string
    const meta = CATEGORY_META[cat] ?? { label: cat, color: '#94a3b8' }
    return {
      category: cat,
      label: meta.label,
      count: r._count,
      color: meta.color,
    }
  })

  const byType = byTypeRows.map((r) => ({ type: r.type, count: r._count }))
  const bySource = bySourceRows.map((r) => ({ source: r.source, count: r._count }))

  const stats: StandardsStats = {
    total,
    byCategory,
    byType,
    bySource,
    activeCount,
    withClausesCount,
  }
  return NextResponse.json(stats)
}
