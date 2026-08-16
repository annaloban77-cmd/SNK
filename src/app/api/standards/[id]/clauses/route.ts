import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapStandardClause } from '@/app/api/_map'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const std = await db.standard.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!std) {
    return NextResponse.json({ error: 'Стандарт не найден' }, { status: 404 })
  }
  const clauses = await db.standardClause.findMany({
    where: { standardId: id },
    orderBy: [{ number: 'asc' }],
  })
  return NextResponse.json({ items: clauses.map(mapStandardClause) })
}
