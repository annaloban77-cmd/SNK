// Returns the first organization in DB — used as the "current tenant" for demo purposes.
// In a real deployment this would be derived from the authenticated session.
import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapOrganization } from '@/app/api/_map'
import { getCurrentOrganization } from '@/lib/org-context'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const org = await getCurrentOrganization()
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
  }

  // Count checks this month by querying CheckLog for 'report' stage entries this month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const checksThisMonth = await db.checkLog.count({
    where: {
      stage: 'report',
      status: 'success',
      createdAt: { gte: monthStart },
    },
  })

  const dto = mapOrganization({
    ...org,
    _count: {
      documents: org._count.documents,
      users: org._count.users,
      apiKeys: org._count.apiKeys,
    },
    checksThisMonth,
  })

  return NextResponse.json(dto)
}

export async function PATCH(req: NextRequest) {
  const org = await getCurrentOrganization()
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
  }

  let body: { name?: string; contactEmail?: string; contactPhone?: string; inn?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
  if (typeof body.contactEmail === 'string') data.contactEmail = body.contactEmail.trim() || null
  if (typeof body.contactPhone === 'string') data.contactPhone = body.contactPhone.trim() || null
  if (typeof body.inn === 'string') data.inn = body.inn.trim() || null

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 })
  }

  const updated = await db.organization.update({
    where: { id: org.id },
    data,
    include: {
      _count: { select: { documents: true, users: true, apiKeys: true } },
    },
  })

  await logAudit({
    organizationId: org.id,
    action: 'organization.updated',
    resourceType: 'organization',
    resourceId: org.id,
    details: { fields: Object.keys(data) },
  })

  const checksThisMonth = await db.checkLog.count({
    where: {
      stage: 'report',
      status: 'success',
      createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    },
  })

  return NextResponse.json(
    mapOrganization({
      ...updated,
      _count: {
        documents: updated._count.documents,
        users: updated._count.users,
        apiKeys: updated._count.apiKeys,
      },
      checksThisMonth,
    })
  )
}
