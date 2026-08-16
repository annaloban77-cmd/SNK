// API-key authentication for public /api/v1/* endpoints (monetization layer).
// External clients pass `Authorization: Bearer nk-<...>` and we verify the hash
// against ApiKey.keyHash (the hashing scheme is intentionally simple — demo_hash_<base64(token)> —
// and MUST match what scripts/seed-comprehensive.ts uses).
import { dbMon as db } from './db-monetization'
import { headers } from 'next/headers'

export interface ApiAuthResult {
  ok: boolean
  organizationId?: string
  apiKeyId?: string
  error?: string
  scopes?: string[]
}

function hashToken(token: string): string {
  // Must match seed-comprehensive.ts: 'demo_hash_' + base64(token)
  return 'demo_hash_' + Buffer.from(token).toString('base64')
}

export async function authenticateApiKey(): Promise<ApiAuthResult> {
  const h = await headers()
  const auth = h.get('authorization') || h.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing Authorization header' }
  }
  const token = auth.slice(7).trim()
  if (!token.startsWith('nk-')) {
    return { ok: false, error: 'Invalid API key format' }
  }

  const keyHash = hashToken(token)
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    include: { organization: true },
  })
  if (!apiKey) return { ok: false, error: 'API key not found' }
  if (apiKey.status !== 'active') return { ok: false, error: 'API key revoked or expired' }
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return { ok: false, error: 'API key expired' }
  }

  // Increment usage counter & update lastUsedAt (fire-and-forget, but await to keep serializable)
  try {
    await db.apiKey.update({
      where: { id: apiKey.id },
      data: { requestsCount: { increment: 1 }, lastUsedAt: new Date() },
    })
  } catch (e) {
    console.error('Failed to increment API key usage:', e)
  }

  return {
    ok: true,
    organizationId: apiKey.organizationId,
    apiKeyId: apiKey.id,
    scopes: apiKey.scopes.split(',').map((s) => s.trim()).filter(Boolean),
  }
}

export function requireScope(auth: ApiAuthResult, scope: string): boolean {
  if (!auth.ok) return false
  const scopes = auth.scopes ?? []
  return scopes.includes(scope) || scopes.includes('admin')
}
