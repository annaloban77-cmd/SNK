import { NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { getCurrentOrganization } from '@/lib/org-context'
import type { UsageStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

function percent(used: number, max: number): number {
  if (max <= 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

export async function GET() {
  const org = await getCurrentOrganization()
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [documentsCount, usersCount, apiKeysCount, checksThisMonth, apiRequestsThisMonth] =
    await Promise.all([
      db.document.count({ where: { organizationId: org.id } }),
      db.user.count({ where: { organizationId: org.id } }),
      db.apiKey.count({ where: { organizationId: org.id } }),
      db.checkLog.count({
        where: { stage: 'report', status: 'success', createdAt: { gte: monthStart } },
      }),
      db.apiKey.aggregate({
        where: { organizationId: org.id },
        _sum: { requestsCount: true },
      }),
    ])

  const maxApiRequests = await db.apiKey.aggregate({
    where: { organizationId: org.id },
    _sum: { requestsLimit: true },
  })

  const apiRequests = apiRequestsThisMonth._sum.requestsCount ?? 0
  const apiRequestsLimit = maxApiRequests._sum.requestsLimit ?? 0

  // Trial days left
  let trialDaysLeft: number | null = null
  if (org.trialEndsAt) {
    const trialEnd = new Date(org.trialEndsAt)
    const diff = trialEnd.getTime() - now.getTime()
    if (diff > 0) {
      trialDaysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))
    } else {
      trialDaysLeft = 0
    }
  }

  const stats: UsageStats = {
    organizationId: org.id,
    plan: org.plan,
    documentsCount,
    maxDocuments: org.maxDocuments,
    documentsPercent: percent(documentsCount, org.maxDocuments),
    checksThisMonth,
    maxChecks: org.maxChecks,
    checksPercent: percent(checksThisMonth, org.maxChecks),
    usersCount,
    maxUsers: org.maxUsers,
    apiKeysCount,
    apiRequestsThisMonth: apiRequests,
    maxApiRequests: apiRequestsLimit,
    trialDaysLeft,
  }

  return NextResponse.json(stats)
}
