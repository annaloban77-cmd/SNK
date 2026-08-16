import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapAuditLog } from '@/app/api/_map'
import { getCurrentOrganizationId } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const orgId = await getCurrentOrganizationId()

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10))
  const pageSize = Math.max(1, Math.min(200, parseInt(sp.get('pageSize') || '50', 10)))
  const action = sp.get('action')?.trim() || undefined
  const userId = sp.get('userId')?.trim() || undefined
  const resourceType = sp.get('resourceType')?.trim() || undefined

  const where: Record<string, unknown> = {}
  if (orgId) where.organizationId = orgId
  if (action) where.action = { contains: action }
  if (userId) where.userId = userId
  if (resourceType) where.resourceType = resourceType

  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
  ])

  return NextResponse.json({
    items: items.map(mapAuditLog),
    total,
    page,
    pageSize,
  })
}
