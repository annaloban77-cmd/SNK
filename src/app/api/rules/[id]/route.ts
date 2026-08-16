import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mapRule } from '@/app/api/_map'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const ALLOWED_FIELDS = ['enabled', 'severity', 'name', 'description', 'category', 'method', 'gostField', 'expression', 'standardId']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const rule = await db.rule.findUnique({ where: { id }, select: { id: true, code: true, enabled: true, severity: true } })
  if (!rule) {
    return NextResponse.json({ error: 'Правило не найдено' }, { status: 404 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) data[key] = body[key]
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  const updated = await db.rule.update({
    where: { id },
    data,
    include: { standard: { select: { id: true, code: true, name: true } } },
  })

  await logAudit({
    organizationId: null,
    action: 'rule.update',
    resourceType: 'rule',
    resourceId: id,
    details: {
      code: rule.code,
      previousEnabled: rule.enabled,
      previousSeverity: rule.severity,
      fields: Object.keys(data),
      values: data,
    },
  })

  return NextResponse.json(mapRule(updated))
}
