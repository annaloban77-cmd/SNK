// middleware.ts — Centralized role-based access control.
//
// Protects internal API routes based on the user's role (cookie `nk-role`,
// default 'admin' for the demo). External /api/v1/* routes are authenticated
// via API key inside their handlers (see api-auth.ts).
//
// Rules:
//   /api/admin/*                            → admin only
//   /api/organization/api-keys (write)      → admin only
//   /api/organization/users (write)         → admin only
//   /api/organization/audit                  → admin only
//   /api/rules POST/PATCH/DELETE            → admin + normocontroller
//   /api/bench/run POST                     → admin + normocontroller
//   /api/organization (PATCH)               → admin
//   viewer on any write to protected route  → 403
//
// /api/v1/* passes through — auth handled by authenticateApiKey() in route.
// Public GET routes (dashboard, documents list, standards, etc.) are open
// to all authenticated users (no middleware block).
//
// NOTE: middleware runs on Edge runtime — no Prisma, no next/headers.
// Role is read from cookie `nk-role` or header `x-nk-role`, default 'admin'.
//
import { NextRequest, NextResponse } from 'next/server'

type Role = 'viewer' | 'engineer' | 'normocontroller' | 'admin'

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  engineer: 1,
  normocontroller: 2,
  admin: 3,
}

function isValidRole(r: string | undefined | null): r is Role {
  return !!r && r in ROLE_RANK
}

function getRole(req: NextRequest): Role {
  const headerRole = req.headers.get('x-nk-role')
  if (isValidRole(headerRole)) return headerRole
  const cookieRole = req.cookies.get('nk-role')?.value
  if (isValidRole(cookieRole)) return cookieRole
  return 'admin'
}

function isAdmin(role: Role): boolean {
  return role === 'admin'
}

function canManageRoles(role: Role): boolean {
  return role === 'admin' || role === 'normocontroller'
}

export const config = {
  // Run middleware on API routes and /admin pages
  matcher: ['/api/:path*', '/admin/:path*'],
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const method = req.method
  const role = getRole(req)

  // === /admin/* pages (port 3333 in production) → admin only ===
  if (pathname.startsWith('/admin')) {
    if (!isAdmin(role)) {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.searchParams.set('error', 'admin_required')
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // === /api/admin/* → admin only (any method) ===
  if (pathname.startsWith('/api/admin/')) {
    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: 'Доступ запрещён. Требуется роль администратора.', requiredRole: 'admin', currentRole: role },
        { status: 403 }
      )
    }
    return NextResponse.next()
  }

  // === /api/organization/api-keys (write) → admin only ===
  if (pathname === '/api/organization/api-keys' && method !== 'GET') {
    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: 'Управление API-ключами доступно только администратору.', requiredRole: 'admin', currentRole: role },
        { status: 403 }
      )
    }
  }
  // /api/organization/api-keys/[id] PATCH/DELETE → admin
  if (pathname.match(/^\/api\/organization\/api-keys\/[^/]+$/) && (method === 'PATCH' || method === 'DELETE')) {
    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: 'Управление API-ключами доступно только администратору.', requiredRole: 'admin', currentRole: role },
        { status: 403 }
      )
    }
  }

  // === /api/organization/users (write) → admin only ===
  if (pathname === '/api/organization/users' && method === 'POST') {
    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: 'Приглашение пользователей доступно только администратору.', requiredRole: 'admin', currentRole: role },
        { status: 403 }
      )
    }
  }
  // /api/organization/users/[id] PATCH → admin
  if (pathname.match(/^\/api\/organization\/users\/[^/]+$/) && method === 'PATCH') {
    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: 'Управление пользователями доступно только администратору.', requiredRole: 'admin', currentRole: role },
        { status: 403 }
      )
    }
  }

  // === /api/organization/audit → admin only (any method) ===
  if (pathname.startsWith('/api/organization/audit')) {
    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: 'Журнал аудита доступен только администратору.', requiredRole: 'admin', currentRole: role },
        { status: 403 }
      )
    }
  }

  // === /api/organization PATCH (update org settings) → admin only ===
  if (pathname === '/api/organization' && method === 'PATCH') {
    if (!isAdmin(role)) {
      return NextResponse.json(
        { error: 'Изменение настроек организации доступно только администратору.', requiredRole: 'admin', currentRole: role },
        { status: 403 }
      )
    }
  }

  // === /api/rules POST/PATCH/DELETE → admin + normocontroller ===
  if (pathname === '/api/rules' && method === 'POST') {
    if (!canManageRoles(role)) {
      return NextResponse.json(
        { error: 'Создание правил требует роли нормоконтролёра или администратора.', requiredRole: 'normocontroller', currentRole: role },
        { status: 403 }
      )
    }
  }
  if (pathname.match(/^\/api\/rules\/[^/]+$/) && (method === 'PATCH' || method === 'DELETE')) {
    if (!canManageRoles(role)) {
      return NextResponse.json(
        { error: 'Изменение правил требует роли нормоконтролёра или администратора.', requiredRole: 'normocontroller', currentRole: role },
        { status: 403 }
      )
    }
  }

  // === /api/bench/run POST → admin + normocontroller ===
  if (pathname === '/api/bench/run' && method === 'POST') {
    if (!canManageRoles(role)) {
      return NextResponse.json(
        { error: 'Запуск тестов требует роли нормоконтролёра или администратора.', requiredRole: 'normocontroller', currentRole: role },
        { status: 403 }
      )
    }
  }

  // === /api/suggestions/[id]/approve POST → admin + normocontroller ===
  if (pathname.match(/^\/api\/suggestions\/[^/]+\/approve$/) && method === 'POST') {
    if (!canManageRoles(role)) {
      return NextResponse.json(
        { error: 'Одобрение предложений требует роли нормоконтролёра или администратора.', requiredRole: 'normocontroller', currentRole: role },
        { status: 403 }
      )
    }
  }

  // === Viewer block: any POST/PATCH/DELETE on /api/* (except /api/v1/* which uses API keys) ===
  // Viewer can only do GET on internal routes
  if (role === 'viewer' && (method === 'POST' || method === 'PATCH' || method === 'DELETE') && !pathname.startsWith('/api/v1/')) {
    return NextResponse.json(
      { error: 'Роль «Наблюдатель» не позволяет изменять данные. Только просмотр.', requiredRole: 'engineer', currentRole: role },
      { status: 403 }
    )
  }

  return NextResponse.next()
}
