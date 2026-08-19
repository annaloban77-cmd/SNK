'use client'

import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShieldCheck, HardHat, Eye, Wrench } from 'lucide-react'

type Role = 'admin' | 'normocontroller' | 'engineer' | 'viewer'

const ROLES: { value: Role; label: string; icon: React.ReactNode }[] = [
  { value: 'admin', label: 'Администратор', icon: <Wrench className="size-3" /> },
  { value: 'normocontroller', label: 'Нормоконтролёр', icon: <ShieldCheck className="size-3" /> },
  { value: 'engineer', label: 'Конструктор', icon: <HardHat className="size-3" /> },
  { value: 'viewer', label: 'Наблюдатель', icon: <Eye className="size-3" /> },
]

function getCurrentRole(): Role {
  if (typeof document === 'undefined') return 'admin'
  const match = document.cookie.match(/(?:^|;\s*)nk-role=([^;]+)/)
  const r = match?.[1]
  if (r === 'admin' || r === 'normocontroller' || r === 'engineer' || r === 'viewer') return r
  return 'admin'
}

export function RoleSwitcher() {
  const [role, setRole] = React.useState<Role>('admin')

  React.useEffect(() => {
    setRole(getCurrentRole())
  }, [])

  function changeRole(newRole: Role) {
    // Set cookie (1 day expiry) and reload to apply middleware
    document.cookie = `nk-role=${newRole}; path=/; max-age=86400; samesite=lax`
    setRole(newRole)
    // Reload to apply middleware role checks
    window.location.reload()
  }

  const current = ROLES.find((r) => r.value === role) ?? ROLES[0]

  return (
    <div className="hidden items-center gap-1.5 rounded-md border bg-card px-2 py-1 sm:flex" title="Текущая роль (для проверки доступа)">
      {current.icon}
      <Select value={role} onValueChange={(v) => changeRole(v as Role)}>
        <SelectTrigger className="h-6 w-auto border-0 p-0 text-xs font-medium shadow-none focus:ring-0" aria-label="Роль">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              <span className="flex items-center gap-1.5">
                {r.icon}
                {r.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
