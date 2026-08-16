import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDocument } from '@/app/api/_map'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const doc = await db.document.findUnique({
    where: { id },
    include: { project: { select: { id: true, code: true, name: true } } },
  })
  if (!doc) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  }
  return NextResponse.json(mapDocument(doc))
}
