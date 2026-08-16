// Returns the first organization in DB — used as the "current tenant" for demo purposes.
// In a real deployment this would be derived from the authenticated session.
import { dbMon } from './db-monetization'

export async function getCurrentOrganizationId(): Promise<string | null> {
  const org = await dbMon.organization.findFirst({ select: { id: true } })
  return org?.id ?? null
}

export async function getCurrentOrganization() {
  const org = await dbMon.organization.findFirst({
    include: {
      _count: { select: { documents: true, users: true, apiKeys: true } },
    },
  })
  return org
}
