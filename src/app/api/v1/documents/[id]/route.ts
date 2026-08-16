import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapDocument } from '@/app/api/_map'
import { authenticateApiKey, requireScope } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  if (!requireScope(auth, 'read')) {
    return NextResponse.json({ error: 'Недостаточно прав: требуется scope "read"' }, { status: 403 })
  }

  const { id } = await params
  const doc = await db.document.findUnique({
    where: { id },
    include: { project: { select: { id: true, code: true, name: true } } },
  })
  if (!doc) {
    return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
  }

  await logAudit({
    organizationId: auth.organizationId ?? null,
    action: 'api.document.viewed',
    resourceType: 'document',
    resourceId: id,
  })

  return NextResponse.json(mapDocument(doc))
}
