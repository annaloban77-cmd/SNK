import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ACTION_TO_STATUS: Record<string, string> = {
  confirm: 'confirmed',
  reject: 'rejected',
  fix: 'fixed',
}

export async function POST(req: NextRequest) {
  let body: { ids?: string[]; action?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids должен быть непустым массивом' }, { status: 400 })
  }
  const action = body.action || ''
  const status = ACTION_TO_STATUS[action]
  if (!status) {
    return NextResponse.json({ error: `Недопустимое действие: ${action}. Допустимо: confirm, reject, fix` }, { status: 400 })
  }

  // Pre-fetch issues for audit logging
  const existing = await db.issue.findMany({
    where: { id: { in: body.ids } },
    select: { id: true, code: true, documentId: true, document: { select: { organizationId: true } } },
  })

  const result = await db.issue.updateMany({
    where: { id: { in: body.ids } },
    data: { status },
  })

  // Audit log — single entry summarizing the bulk action
  const orgId = existing.find((i) => i.document?.organizationId)?.document?.organizationId ?? null
  await logAudit({
    organizationId: orgId,
    action: 'issue.bulk_update',
    resourceType: 'issue',
    details: {
      action,
      newStatus: status,
      ids: body.ids,
      affectedCount: result.count,
      codes: existing.map((i) => i.code),
    },
  })

  return NextResponse.json({ updated: result.count })
}
