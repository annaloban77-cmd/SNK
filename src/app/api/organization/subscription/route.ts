import { NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapSubscription } from '@/app/api/_map'
import { getCurrentOrganizationId } from '@/lib/org-context'

export const dynamic = 'force-dynamic'

export async function GET() {
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
  }
  const sub = await db.subscription.findUnique({
    where: { organizationId: orgId },
  })
  if (!sub) {
    return NextResponse.json({ error: 'Подписка не найдена' }, { status: 404 })
  }
  return NextResponse.json(mapSubscription(sub))
}
