'use client'

import * as React from 'react'

/**
 * Role helpers for client-side role checks.
 *
 * The role is stored in cookie `nk-role` (set by <RoleSwitcher />).
 * Possible values: 'admin' | 'normocontroller' | 'engineer' | 'viewer'.
 * Default fallback: 'admin' (when cookie is missing or invalid).
 *
 * Server-side role enforcement happens in src/middleware.ts and src/lib/auth.ts.
 * These helpers are for **client-side UI gating only** — never use them to
 * enforce security boundaries; always validate on the server too.
 */

export type NKRole = 'admin' | 'normocontroller' | 'engineer' | 'viewer'

const VALID_ROLES: NKRole[] = ['admin', 'normocontroller', 'engineer', 'viewer']

/**
 * Read the current role from the `nk-role` cookie.
 * Returns 'admin' if cookie is missing or invalid (default role).
 *
 * SSR-safe: returns 'admin' on the server (no document).
 */
export function readCurrentRole(): NKRole {
  if (typeof document === 'undefined') return 'admin'
  const match = document.cookie.match(/(?:^|;\s*)nk-role=([^;]+)/)
  const r = match?.[1]
  if (r && (VALID_ROLES as string[]).includes(r)) {
    return r as NKRole
  }
  return 'admin'
}

export interface UseCurrentRoleResult {
  role: NKRole
  isAdmin: boolean
  isNormocontroller: boolean
  isEngineer: boolean
  isViewer: boolean
  /** True after the hook has mounted on the client (avoids SSR mismatch). */
  mounted: boolean
}

/**
 * React hook that returns the current role and re-reads on mount.
 *
 * Usage:
 *   const { isAdmin, mounted } = useCurrentRole()
 *   if (mounted && !isAdmin) return null  // hide admin-only UI
 *
 * Note: SSR returns 'admin' (the default). The hook re-reads the cookie
 * in a useEffect and updates state on the client. Use the `mounted` flag
 * to defer strict decisions until after hydration.
 */
export function useCurrentRole(): UseCurrentRoleResult {
  const [role, setRole] = React.useState<NKRole>('admin')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setRole(readCurrentRole())
    setMounted(true)
  }, [])

  return {
    role,
    isAdmin: role === 'admin',
    isNormocontroller: role === 'normocontroller',
    isEngineer: role === 'engineer',
    isViewer: role === 'viewer',
    mounted,
  }
}
