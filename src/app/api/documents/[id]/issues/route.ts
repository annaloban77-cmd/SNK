import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapIssue } from '@/app/api/_map'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sp = req.nextUrl.searchParams
  const severity = sp.get('severity') || undefined
  const status = sp.get('status') || undefined

  const doc = await db.document.findUnique({ where: { id }, select: { id: true } })
  if (!doc) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  }

  const where: Record<string, unknown> = { documentId: id }
  if (severity) where.severity = severity
  if (status) where.status = status

  const items = await db.issue.findMany({
    where,
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    include: {
      document: { select: { id: true, name: true, format: true } },
      rule: { select: { id: true, code: true, name: true, standardId: true } },
    },
  })

  return NextResponse.json({ items: items.map(mapIssue) })
}
