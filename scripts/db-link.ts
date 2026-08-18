// db:link — связывает Rule.standardId с Standard.code
// Запускается как часть db:sync
import { db } from '../src/lib/db'

async function main() {
  console.log('🔗 Linking rules to standards...')
  const rules = await db.rule.findMany({ where: { standardId: null }, select: { id: true, code: true, gostField: true, expression: true } })
  let linked = 0
  for (const rule of rules) {
    // Try expression field (JSON with standardCode for parametrized rules)
    let gostCode = ''
    if (rule.expression) {
      try {
        const expr = JSON.parse(rule.expression)
        gostCode = expr.standardCode || ''
      } catch {}
    }
    if (gostCode) {
      const standard = await db.standard.findUnique({ where: { code: gostCode } })
      if (standard) {
        await db.rule.update({ where: { id: rule.id }, data: { standardId: standard.id } })
        linked++
        continue
      }
    }
    // Try gostField — search standards by scope containing the field text
    if (rule.gostField) {
      const standard = await db.standard.findFirst({ where: { scope: { contains: rule.gostField } } })
      if (standard) {
        await db.rule.update({ where: { id: rule.id }, data: { standardId: standard.id } })
        linked++
      }
    }
  }
  console.log(`  ✓ Linked ${linked} rules to standards`)
  
  // Fix R-CAD method: vision → deterministic
  const cadFixed = await db.rule.updateMany({ where: { code: { startsWith: 'R-CAD' }, method: 'vision' }, data: { method: 'deterministic' } })
  console.log(`  ✓ Fixed ${cadFixed.count} R-CAD rules method: vision → deterministic`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
