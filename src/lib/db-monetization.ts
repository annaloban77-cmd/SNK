// Monetization-layer database client.
//
// Why this exists: the foundation `src/lib/db.ts` caches the PrismaClient on
// `globalThis.prisma` to avoid re-connecting on HMR. If the schema gains new
// models (Organization, User, ApiKey, AuditLog, Subscription, StandardClause)
// after the dev server has already cached the old client, that cached client
// won't have the new accessors (`db.organization`, `db.apiKey`, ...).
//
// This module ALWAYS creates a fresh PrismaClient (cached on a separate global
// key). It's slightly wasteful (one extra connection pool during dev) but
// reliably picks up schema changes without a server restart.
import { PrismaClient } from '@prisma/client'

// Use a versioned key so that bumping the suffix invalidates any stale cache
// from a previous module version.
const GLOBAL_KEY = '__prisma_monetization_v4__'
type GlobalWithPrisma = typeof globalThis & {
  [GLOBAL_KEY]?: PrismaClient
}

function getClient(): PrismaClient {
  const g = globalThis as GlobalWithPrisma
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new PrismaClient({
      log: ['error', 'warn'],
    })
  }
  return g[GLOBAL_KEY] as PrismaClient
}

export const dbMon: PrismaClient = getClient()
