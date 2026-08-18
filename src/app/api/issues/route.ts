import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapIssue } from '../_map'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const severity = sp.get('severity') || undefined
  const status = sp.get('status') || undefined
  const documentId = sp.get('documentId') || undefined
  const search = sp.get('search')?.trim() || undefined
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(100, parseInt(sp.get('pageSize') || '20', 10)))

  const where: Record<string, unknown> = {}
  if (severity) where.severity = severity
  if (status) where.status = status
  if (documentId) where.documentId = documentId
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { code: { contains: search } },
      { description: { contains: search } },
    ]
  }

  const [total, items] = await Promise.all([
    db.issue.count({ where }),
    db.issue.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        document: { select: { id: true, name: true, format: true } },
        rule: { select: { id: true, code: true, name: true, standardId: true } },
      },
    }),
  ])

  return NextResponse.json({
    items: items.map(mapIssue),
    total,
    page,
    pageSize,
  })
}
