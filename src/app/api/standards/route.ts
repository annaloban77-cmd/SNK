import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapStandard } from '../_map'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const type = sp.get('type') || undefined
  const category = sp.get('category') || undefined
  const source = sp.get('source') || undefined
  const search = sp.get('search')?.trim() || undefined
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(100, parseInt(sp.get('pageSize') || '20', 10)))

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (category) where.category = category
  if (source) where.source = source
  if (search) {
    where.OR = [
      { code: { contains: search } },
      { name: { contains: search } },
      { scope: { contains: search } },
    ]
  }

  const [total, items] = await Promise.all([
    db.standard.count({ where }),
    db.standard.findMany({
      where,
      orderBy: { code: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { rules: true, clauses: true } } },
    }),
  ])

  return NextResponse.json({
    items: items.map((s) => mapStandard(s)),
    total,
    page,
    pageSize,
  })
}
