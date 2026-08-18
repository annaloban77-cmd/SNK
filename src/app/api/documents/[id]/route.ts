import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapDocument } from '@/app/api/_map'
import { logAudit } from '@/lib/audit'

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

/**
 * PATCH /api/documents/[id]
 * Body: { action: 'retry' }
 * Сбрасывает статус 'failed' → 'new', чтобы пользователь мог запустить проверку повторно.
 * Также очищает накопленные issues (они будут пересозданы при следующем анализе).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const doc = await db.document.findUnique({
    where: { id },
    select: { id: true, status: true, organizationId: true },
  })
  if (!doc) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  }

  let body: { action?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  if (body.action !== 'retry') {
    return NextResponse.json(
      { error: "Поддерживается только action: 'retry'" },
      { status: 400 }
    )
  }

  // Reset to 'new' + clear issue counters. Old issues will be removed on next analyze.
  const updated = await db.document.update({
    where: { id },
    data: {
      status: 'new',
      issueCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      checkDuration: null,
    },
    include: { project: { select: { id: true, code: true, name: true } } },
  })

  // Drop old issues so the document list / detail reflects a clean state
  await db.issue.deleteMany({ where: { documentId: id } })

  await logAudit({
    organizationId: doc.organizationId ?? null,
    action: 'document.retry',
    resourceType: 'document',
    resourceId: id,
    details: { previousStatus: doc.status, newStatus: 'new' },
  })

  return NextResponse.json(mapDocument(updated))
}
