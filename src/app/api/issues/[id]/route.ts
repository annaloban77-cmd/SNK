import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapIssue } from '@/app/api/_map'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = ['new', 'confirmed', 'rejected', 'fixed']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const issue = await db.issue.findUnique({ where: { id }, select: { id: true, documentId: true, code: true, severity: true, status: true } })
  if (!issue) {
    return NextResponse.json({ error: 'Замечание не найдено' }, { status: 404 })
  }

  let body: { status?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }
  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Недопустимый статус' }, { status: 400 })
  }

  const previousStatus = issue.status
  const updated = await db.issue.update({
    where: { id },
    data: { status: body.status },
    include: {
      document: { select: { id: true, name: true, format: true, organizationId: true } },
      rule: { select: { id: true, code: true, name: true, standardId: true } },
    },
  })

  await logAudit({
    organizationId: updated.document?.organizationId ?? null,
    action: 'issue.update',
    resourceType: 'issue',
    resourceId: id,
    details: {
      code: issue.code,
      severity: issue.severity,
      previousStatus,
      newStatus: body.status,
      documentId: issue.documentId,
    },
  })

  return NextResponse.json(mapIssue(updated))
}
