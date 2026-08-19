// auth.ts — Role-based access control for internal API routes.
//
// The system is a single-organization demo without a real login flow.
// To support role-based testing (viewer / engineer / normocontroller / admin),
// we read the current role from a cookie `nk-role` or header `x-nk-role`.
// Default role is 'admin' so the demo keeps working out-of-the-box.
//
// Hierarchy: viewer < engineer < normocontroller < admin
//   viewer:         GET only on public data
//   engineer:       + upload/analyze documents, view issues
//   normocontroller: + confirm/reject issues, manage rules, run bench
//   admin:          + API keys, audit log, config, users
//
// For /api/v1/* (external API), see api-auth.ts (API-key based).

import { headers, cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export type Role = 'viewer' | 'engineer' | 'normocontroller' | 'admin'

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  engineer: 1,
  normocontroller: 2,
  admin: 3,
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Наблюдатель',
  engineer: 'Конструктор',
  normocontroller: 'Нормоконтролёр',
  admin: 'Администратор',
}

function isValidRole(r: string | undefined | null): r is Role {
  return !!r && r in ROLE_RANK
}

/**
 * Get the current user's role from request context (route handlers).
 * Reads `x-nk-role` header first, then `nk-role` cookie, defaults to 'admin'.
 */
export async function getCurrentUserRole(): Promise<Role> {
  const h = await headers()
  const roleHeader = h.get('x-nk-role')
  if (isValidRole(roleHeader)) return roleHeader
  const c = await cookies()
  const roleCookie = c.get('nk-role')?.value
  if (isValidRole(roleCookie)) return roleCookie
  return 'admin' // demo default — keeps existing functionality working
}

/**
 * Check if the current user has at least the required role.
 */
export async function hasRole(min: Role): Promise<boolean> {
  const current = await getCurrentUserRole()
  return ROLE_RANK[current] >= ROLE_RANK[min]
}

/**
 * Get role from a NextRequest (for middleware use, where cookies() isn't available).
 */
export function getRoleFromRequest(req: NextRequest): Role {
  const headerRole = req.headers.get('x-nk-role')
  if (isValidRole(headerRole)) return headerRole
  const cookieRole = req.cookies.get('nk-role')?.value
  if (isValidRole(cookieRole)) return cookieRole
  return 'admin'
}

/**
 * Check if a role is at least `min`.
 */
export function roleAtLeast(current: Role, min: Role): boolean {
  return ROLE_RANK[current] >= ROLE_RANK[min]
}

/**
 * Roles allowed to manage rules (create/update/delete).
 */
export function canManageRules(role: Role): boolean {
  return role === 'admin' || role === 'normocontroller'
}

/**
 * Roles allowed to access admin console (port 3333, /api/admin/*).
 */
export function isAdmin(role: Role): boolean {
  return role === 'admin'
}
