import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapIssue } from '@/app/api/_map'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { id: true } })
  if (!doc) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  }
  const items = await db.checkLog.findMany({
    where: { documentId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      stage: c.stage,
      status: c.status,
      durationMs: c.durationMs,
      message: c.message,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : new Date(c.createdAt).toISOString(),
    })),
  })
}
