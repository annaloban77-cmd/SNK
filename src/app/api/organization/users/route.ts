import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapUser } from '@/app/api/_map'
import { getCurrentOrganizationId } from '@/lib/org-context'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return NextResponse.json({ items: [] })
  }
  const users = await db.user.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ items: users.map(mapUser) })
}

export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
  }

  let body: { email?: string; name?: string; role?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const name = (body.name || '').trim() || null
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Некорректный email' }, { status: 400 })
  }
  const allowedRoles = ['admin', 'normocontroller', 'engineer', 'viewer']
  const role = allowedRoles.includes(body.role || '') ? body.role! : 'engineer'

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Пользователь с таким email уже существует' }, { status: 409 })
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      role,
      organizationId: orgId,
      status: 'pending',
    },
  })

  await logAudit({
    organizationId: orgId,
    action: 'user.invited',
    resourceType: 'user',
    resourceId: user.id,
    details: { email, role, name },
  })

  return NextResponse.json(mapUser(user), { status: 201 })
}
