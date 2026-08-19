// db:link — связывает Rule.standardId с Standard.code
// Запускается как часть db:sync (шаг 6).
// Также можно запустить отдельно: `bun run scripts/db-link.ts` (или `bun run db:link`).
//
// Логика сопоставления (несколько эвристик, по порядку приоритета):
//   1. expression.standardCode → findUnique по точному коду стандарта
//   2. gostField, если содержит "ГОСТ Х.ХХХ" → startsWith по префиксу кода
//   3. gostField → search standards по name contains (Покрытия, Подшипники…)
//   4. gostField → search standards по scope contains (как запасной вариант)
//
// Для каждой связи печатает: "✓ R-FORMAT-001 → ГОСТ 2.301-68"

import { db } from '../src/lib/db'

/**
 * Extract "ГОСТ X.XXX" prefix from a string. Returns "ГОСТ 2.301" or null.
 * Examples:
 *   "ГОСТ 2.301-68, п. 3.1" → "ГОСТ 2.301"
 *   "Формат" → null
 *   "ГОСТ 2.104-2006" → "ГОСТ 2.104"
 */
function extractGostPrefix(text: string): string | null {
  // Match "ГОСТ <digits>.<digits>" possibly followed by -YEAR or whitespace/comma
  const m = text.match(/ГОСТ\s*(\d+(?:\.\d+)*)/)
  if (!m) return null
  // Normalise whitespace after ГОСТ
  return `ГОСТ ${m[1]}`
}

/**
 * Build a list of search "stems" for a Russian noun (singular form).
 * Handles singular→plural variants: Покрытие → [Покрытие, Покрыти, Покрытия].
 * Used as a poor-man's stemmer for matching gostField against Standard.name/scope.
 */
function searchStems(text: string): string[] {
  if (!text) return []
  const trimmed = text.trim()
  if (trimmed.length < 4) return [trimmed]
  const stem = trimmed.slice(0, -1) // drop last char → "Покрыти" (matches Покрытие and Покрытия)
  return [trimmed, stem, trimmed + 'и', trimmed + 'а']
}

async function findStandardForRule(rule: {
  id: string
  code: string
  gostField: string | null
  expression: string | null
}): Promise<{ id: string; code: string } | null> {
  // 1. Try expression.standardCode (exact match)
  if (rule.expression) {
    try {
      const expr = JSON.parse(rule.expression)
      if (typeof expr.standardCode === 'string' && expr.standardCode.trim()) {
        const exact = await db.standard.findUnique({
          where: { code: expr.standardCode.trim() },
          select: { id: true, code: true },
        })
        if (exact) return exact
        // Try startsWith as fallback
        const prefix = extractGostPrefix(expr.standardCode)
        if (prefix) {
          const byPrefix = await db.standard.findFirst({
            where: { code: { startsWith: prefix } },
            select: { id: true, code: true },
          })
          if (byPrefix) return byPrefix
        }
      }
    } catch {
      // expression is not valid JSON — skip
    }
  }

  // 2. If gostField contains a "ГОСТ X.XXX" pattern, match by code prefix
  if (rule.gostField) {
    const prefix = extractGostPrefix(rule.gostField)
    if (prefix) {
      const byCode = await db.standard.findFirst({
        where: { code: { startsWith: prefix } },
        select: { id: true, code: true },
      })
      if (byCode) return byCode
    }
  }

  // 3. Try matching gostField against Standard.name (with stem variants)
  if (rule.gostField) {
    const stems = searchStems(rule.gostField)
    const matches = await db.standard.findMany({
      where: { OR: stems.map((s) => ({ name: { contains: s } })) },
      select: { id: true, code: true },
      take: 1,
    })
    if (matches[0]) return matches[0]
  }

  // 4. Final fallback: search by scope contains (with stem variants)
  if (rule.gostField) {
    const stems = searchStems(rule.gostField)
    const matches = await db.standard.findMany({
      where: { OR: stems.map((s) => ({ scope: { contains: s } })) },
      select: { id: true, code: true },
      take: 1,
    })
    if (matches[0]) return matches[0]
  }

  return null
}

async function main() {
  console.log('🔗 db-link — связывание Rule.standardId ↔ Standard.code')
  const rules = await db.rule.findMany({
    where: { standardId: null },
    select: { id: true, code: true, gostField: true, expression: true },
  })
  console.log(`   Несвязанных правил: ${rules.length}`)

  let linked = 0
  let unmatched = 0
  for (const rule of rules) {
    const standard = await findStandardForRule(rule)
    if (standard) {
      await db.rule.update({
        where: { id: rule.id },
        data: { standardId: standard.id },
      })
      linked++
      console.log(`  ✓ ${rule.code} → ${standard.code}`)
    } else {
      unmatched++
      const hint = rule.gostField
        ? `gostField="${rule.gostField}"`
        : rule.expression
          ? 'expression without standardCode'
          : 'нет gostField/expression'
      console.log(`  ✗ ${rule.code} — стандарт не найден (${hint})`)
    }
  }
  console.log(`   Связано: ${linked}, не сопоставлено: ${unmatched}`)

  // Итоговая сводка
  const totalLinked = await db.rule.count({ where: { NOT: { standardId: null } } })
  const totalRules = await db.rule.count()
  console.log(`\n✅ db-link завершён: ${totalLinked}/${totalRules} правил связаны со стандартами`)

  // Fix R-CAD method: vision → deterministic (preserved from previous version)
  const cadFixed = await db.rule.updateMany({
    where: { code: { startsWith: 'R-CAD' }, method: 'vision' },
    data: { method: 'deterministic' },
  })
  if (cadFixed.count > 0) {
    console.log(`   ✓ Fixed ${cadFixed.count} R-CAD rules method: vision → deterministic`)
  }
}

main()
  .catch((e) => {
    console.error('❌ db-link failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
