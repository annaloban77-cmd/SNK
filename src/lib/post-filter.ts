// post-filter.ts — пост-фильтрация и дедупликация findings
// Убирает low-confidence findings, группирует дубликаты, отбрасывает противоречия
// Confidence-aware: если OCR confidence низкий, не генерировать "поле отсутствует" замечания

import type { RuleCheckResult } from '@/lib/rules'

export interface FilterOptions {
  minConfidence?: number // 0..1, по умолчанию 0.5
  dedupe?: boolean // группировать одинаковые code+field, по умолчанию true
  dropLowIfHighExists?: boolean // если есть high по тому же полю, отбросить low, по умолчанию true
  ocrConfidence?: number // 0..1, общая уверенность OCR
  fieldMeta?: Record<string, { hasText: boolean; confidence: number; parsed: boolean }> | null
}

// Проверка, является ли finding "поле отсутствует" (vs "поле неверное")
function isMissingFieldFinding(f: RuleCheckResult): boolean {
  const text = `${f.title} ${f.description}`.toLowerCase()
  return /отсутствует|не указан|не указана|не распознан|не заполнен|не найден/.test(text)
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
    ocrConfidence = 1.0,
    fieldMeta = null,
  } = opts

  let result = [...findings]

  // 0. Confidence-aware filtering
  // Если OCR confidence < 0.35 — фильтруем ВСЕ "поле отсутствует" findings
  // (не можем доверять что поле действительно отсутствует, а не просто не распознано)
  // "Wrong value" findings (масса с точкой, материал без ГОСТ) оставляем
  if (ocrConfidence < 0.45) {
    // Nuclear option: при низком confidence не генерируем "missing" findings вообще
    result = result.filter(f => !isMissingFieldFinding(f))
  } else if (fieldMeta) {
    // При нормальном confidence — используем per-field метаданные
    result = result.filter(f => {
      if (!isMissingFieldFinding(f)) return true
      const fieldKey = mapFieldToMetaKey(f)
      const meta = fieldMeta[fieldKey]
      if (meta && meta.hasText && !meta.parsed) {
        return false // текст был, но не распознан → не "отсутствует"
      }
      return true
    })
  }

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

  // 2. Если есть high по тому же field, отбрасываем low
  if (dropLowIfHighExists) {
    const highFields = new Set(result.filter(f => f.severity === 'high').map(f => f.field || ''))
    result = result.filter(f => {
      if (f.severity === 'low' && highFields.has(f.field || '')) return false
      return true
    })
  }

  return result
}

// Маппинг кода правила + имени поля в ключ fieldMeta
function mapFieldToMetaKey(finding: RuleCheckResult): string {
  const code = finding.code.toUpperCase()
  const field = (finding.field || '').toLowerCase()

  // Сначала по коду правила (точнее)
  if (code.startsWith('R-SIGN-001') || code.includes('STAMP-001')) return 'developed' // Разраб
  if (code.startsWith('R-SIGN-002')) return 'checked'      // Пров
  if (code.startsWith('R-SIGN-003')) return 'normControl'  // Н.контр
  if (code.startsWith('R-SIGN-004')) return 'approved'     // Утв
  if (code.startsWith('R-MAT-')) return 'material'
  if (code.startsWith('R-SCALE-')) return 'scale'
  if (code.startsWith('R-MASS-')) return 'mass'
  if (code.startsWith('R-LETTER-')) return 'letter'
  if (code.startsWith('R-STAGE-')) return 'stage'
  if (code.startsWith('R-FORMAT-')) return 'format'
  if (code.startsWith('R-GOST-')) return 'gostReferences'
  if (code.startsWith('R-TT-')) return 'technicalRequirements'
  if (code.startsWith('R-STAMP-001') || code.startsWith('R-STAMP-002')) return 'designation'
  if (code.startsWith('R-STAMP-003')) return 'name'

  // Фолбэк по имени поля
  if (field.includes('обознач')) return 'designation'
  if (field.includes('наименован')) return 'name'
  if (field.includes('масштаб')) return 'scale'
  if (field.includes('масс')) return 'mass'
  if (field.includes('материал')) return 'material'
  if (field.includes('литер')) return 'letter'
  if (field.includes('стади')) return 'stage'
  if (field.includes('формат') || field.includes('рамк')) return 'format'
  if (field.includes('разраб')) return 'developed'
  if (field.includes('пров')) return 'checked'
  if (field.includes('контр')) return 'normControl'
  if (field.includes('утв')) return 'approved'
  if (field.includes('перечень') || field.includes('гост')) return 'gostReferences'
  if (field.includes('технические') || field.includes('тт')) return 'technicalRequirements'
  return ''
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
