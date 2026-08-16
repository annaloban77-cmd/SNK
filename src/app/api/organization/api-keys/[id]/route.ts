import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapApiKey } from '@/app/api/_map'
import { getCurrentOrganizationId } from '@/lib/org-context'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = ['active', 'revoked', 'expired']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orgId = await getCurrentOrganizationId()

  let body: { status?: string; name?: string; requestsLimit?: number } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const existing = await db.apiKey.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'API-ключ не найден' }, { status: 404 })
  }
  if (orgId && existing.organizationId !== orgId) {
    return NextResponse.json({ error: 'Нет доступа к этому ключу' }, { status: 403 })
  }

  const data: Record<string, unknown> = {}
  if (body.status && ALLOWED_STATUSES.includes(body.status)) data.status = body.status
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.requestsLimit === 'number' && body.requestsLimit > 0) data.requestsLimit = body.requestsLimit

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  const updated = await db.apiKey.update({ where: { id }, data })

  await logAudit({
    organizationId: orgId,
    action: 'apikey.updated',
    resourceType: 'apikey',
    resourceId: id,
    details: { fields: Object.keys(data), values: data },
  })

  return NextResponse.json(mapApiKey(updated))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const orgId = await getCurrentOrganizationId()

  const existing = await db.apiKey.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'API-ключ не найден' }, { status: 404 })
  }
  if (orgId && existing.organizationId !== orgId) {
    return NextResponse.json({ error: 'Нет доступа к этому ключу' }, { status: 403 })
  }

  await db.apiKey.delete({ where: { id } })

  await logAudit({
    organizationId: orgId,
    action: 'apikey.deleted',
    resourceType: 'apikey',
    resourceId: id,
    details: { name: existing.name },
  })

  return NextResponse.json({ ok: true })
}
