// post-filter.ts — пост-фильтрация и дедупликация findings
// Убирает low-confidence findings, группирует дубликаты, отбрасывает противоречия

import type { RuleCheckResult } from '@/lib/rules'

export interface FilterOptions {
  minConfidence?: number // 0..1, по умолчанию 0.5
  dedupe?: boolean // группировать одинаковые code+field, по умолчанию true
  dropLowIfHighExists?: boolean // если есть high по тому же полю, отбросить low, по умолчанию true
}

// Главная функция фильтрации
export function filterFindings(
  findings: RuleCheckResult[],
  opts: FilterOptions = {}
): RuleCheckResult[] {
  const {
    minConfidence = 0.5,
    dedupe = true,
    dropLowIfHighExists = true,
  } = opts

  let result = [...findings]

  // 1. Дедупликация: одинаковые code+field → оставляем первый
  if (dedupe) {
    const seen = new Set<string>()
    result = result.filter(f => {
      const key = `${f.code}|${f.field || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // 3. Если есть high по тому же field, отбрасываем low
  if (dropLowIfHighExists) {
    const highFields = new Set(result.filter(f => f.severity === 'high').map(f => f.field || ''))
    result = result.filter(f => {
      if (f.severity === 'low' && highFields.has(f.field || '')) return false
      return true
    })
  }

  return result
}

// Группировка findings по полям для отчёта
export function groupFindingsByField(findings: RuleCheckResult[]): Record<string, RuleCheckResult[]> {
  const groups: Record<string, RuleCheckResult[]> = {}
  for (const f of findings) {
    const key = f.field || '—'
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  }
  return groups
}

// Подсчёт статистики
export function findingsStats(findings: RuleCheckResult[]) {
  return {
    total: findings.length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    byField: groupFindingsByField(findings),
  }
}
