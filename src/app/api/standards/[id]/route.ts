import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapStandard } from '@/app/api/_map'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const std = await db.standard.findUnique({
    where: { id },
    include: {
      rules: {
        orderBy: { code: 'asc' },
      },
      _count: { select: { rules: true, clauses: true } },
    },
  })
  if (!std) {
    return NextResponse.json({ error: 'Стандарт не найден' }, { status: 404 })
  }
  return NextResponse.json(mapStandard(std, true))
}
