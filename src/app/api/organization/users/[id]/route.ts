import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapUser } from '@/app/api/_map'
import { getCurrentOrganizationId } from '@/lib/org-context'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = ['active', 'disabled', 'pending']
const ALLOWED_ROLES = ['admin', 'normocontroller', 'engineer', 'viewer']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orgId = await getCurrentOrganizationId()

  let body: { role?: string; status?: string; name?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
  }
  if (orgId && existing.organizationId !== orgId) {
    return NextResponse.json({ error: 'Нет доступа к этому пользователю' }, { status: 403 })
  }

  const data: Record<string, unknown> = {}
  if (body.role && ALLOWED_ROLES.includes(body.role)) data.role = body.role
  if (body.status && ALLOWED_STATUSES.includes(body.status)) data.status = body.status
  if (typeof body.name === 'string') data.name = body.name.trim() || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  const updated = await db.user.update({ where: { id }, data })

  await logAudit({
    organizationId: orgId,
    userId: id,
    action: 'user.updated',
    resourceType: 'user',
    resourceId: id,
    details: { fields: Object.keys(data), values: data },
  })

  return NextResponse.json(mapUser(updated))
}
