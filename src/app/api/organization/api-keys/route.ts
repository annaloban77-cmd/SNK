import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapApiKey } from '@/app/api/_map'
import { getCurrentOrganizationId } from '@/lib/org-context'
import { logAudit } from '@/lib/audit'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return NextResponse.json({ items: [] })
  }
  const keys = await db.apiKey.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ items: keys.map(mapApiKey) })
}

export async function POST(req: NextRequest) {
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
  }

  let body: { name?: string; scopes?: string; requestsLimit?: number; expiresAt?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const name = (body.name || '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Укажите имя ключа' }, { status: 400 })
  }

  // Validate scopes
  const allowedScopes = ['read', 'write', 'admin']
  const requestedScopes = (body.scopes || 'read')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const scopes = requestedScopes.length
    ? requestedScopes.filter((s) => allowedScopes.includes(s)).join(',')
    : 'read'
  if (!scopes) {
    return NextResponse.json({ error: 'Недопустимые scopes' }, { status: 400 })
  }

  // Generate secret + hash (must match seed-comprehensive.ts hashing scheme)
  const secret = 'nk-' + randomBytes(24).toString('hex')
  const keyPrefix = secret.slice(0, 8)
  const keyHash = 'demo_hash_' + Buffer.from(secret).toString('base64')

  const requestsLimit =
    typeof body.requestsLimit === 'number' && body.requestsLimit > 0
      ? body.requestsLimit
      : 1000

  let expiresAt: Date | null = null
  if (body.expiresAt) {
    const d = new Date(body.expiresAt)
    if (!isNaN(d.getTime())) expiresAt = d
  }

  const apiKey = await db.apiKey.create({
    data: {
      organizationId: orgId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      requestsLimit,
      periodStart: new Date(),
      expiresAt,
      status: 'active',
    },
  })

  await logAudit({
    organizationId: orgId,
    action: 'apikey.created',
    resourceType: 'apikey',
    resourceId: apiKey.id,
    details: { name, scopes, requestsLimit, expiresAt: expiresAt?.toISOString() ?? null },
  })

  const dto = mapApiKey(apiKey)
  // Attach the secret — only returned ONCE here
  return NextResponse.json({ ...dto, secret }, { status: 201 })
}
