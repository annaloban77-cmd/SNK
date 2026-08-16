import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runAnalyzePipeline } from '@/app/api/_analyze'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const doc = await db.document.findUnique({ where: { id }, select: { id: true } })
  if (!doc) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  }

  let runLlm = true
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json()
      if (typeof body?.runLlm === 'boolean') runLlm = body.runLlm
    }
  } catch {
    /* ignore */
  }

  const result = await runAnalyzePipeline(id, { runLlm })
  return NextResponse.json(result)
}
