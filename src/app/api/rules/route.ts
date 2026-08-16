import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapRule } from '../_map'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const category = sp.get('category') || undefined
  const method = sp.get('method') || undefined
  const enabledRaw = sp.get('enabled')
  const enabled = enabledRaw === 'true' ? true : enabledRaw === 'false' ? false : undefined
  const search = sp.get('search')?.trim() || undefined
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(100, parseInt(sp.get('pageSize') || '20', 10)))

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (method) where.method = method
  if (enabled !== undefined) where.enabled = enabled
  if (search) {
    where.OR = [
      { code: { contains: search } },
      { name: { contains: search } },
      { description: { contains: search } },
      { gostField: { contains: search } },
    ]
  }

  const [total, items] = await Promise.all([
    db.rule.count({ where }),
    db.rule.findMany({
      where,
      orderBy: { code: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { standard: { select: { id: true, code: true, name: true } } },
    }),
  ])

  return NextResponse.json({
    items: items.map(mapRule),
    total,
    page,
    pageSize,
  })
}
