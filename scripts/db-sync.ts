// db:sync — единый идемпотентный скрипт синхронизации БД
// Запускает ВСЕ сиды/генераторы: стандарты, правила (460), справочники (4403), bench (180)
// Повторный запуск не дублирует записи (upsert)
// Версия сидов хранится в таблице Meta

import { db } from '../src/lib/db'

const SYNC_VERSION = '1.1.0'

async function main() {
  console.log(`\n🔄 db:sync v${SYNC_VERSION} — идемпотентная синхронизация БД`)
  console.log('='.repeat(60))

  // Проверяем версию
  const meta = await db.meta.findUnique({ where: { key: 'sync_version' } })
  if (meta?.value === SYNC_VERSION) {
    console.log(`✅ БД уже синхронизирована (версия ${SYNC_VERSION})`)
    console.log('   Для принудительной синхронизации удалите запись Meta или измените SYNC_VERSION')
    return
  }
  console.log(`Текущая версия БД: ${meta?.value || 'нет'} → ${SYNC_VERSION}`)
  console.log('')

  // 1. Стандарты (573) — scripts/seed-comprehensive.ts
  console.log('📚 1. Стандарты (ГОСТ/ОСТ/СТО/Регистры)...')
  await import('../scripts/seed-comprehensive')

  // 2. Правила (320 базовых + 140 параметризованных = 460) — scripts/seed-more-rules-standards.ts + seed-block2-rules.ts
  console.log('\n📐 2. Правила (базовые + параметризованные)...')
  await import('../scripts/seed-more-rules-standards')
  await import('../scripts/seed-block2-rules')

  // 3. Справочники (4403) — scripts/generate-reference.ts
  console.log('\n📊 3. Справочники (материалы/крепёж/подшипники/прокат/сварка/покрытия/трубы/оборудование)...')
  await import('../scripts/generate-reference')

  // 4. Bench семплы (180) — scripts/generate-bench-samples.ts + generate-dxf-samples.ts
  console.log('\n🧪 4. Bench семплы (синтетические + DXF + деградированные + realistic)...')
  // Bench импортируется отдельно т.к. генераторы пишут файлы
  const { importBenchSamples } = await import('../src/lib/bench')
  await importBenchSamples()

  // 5. StandardClause (пункты ГОСТ) — scripts/seed-clauses.ts
  console.log('\n📜 5. Ключевые пункты стандартов (StandardClause)...')
  await import('../scripts/seed-clauses')

  // 6. Связывание Rule.standardId ↔ Standard.code — scripts/db-link.ts
  console.log('\n🔗 6. Связывание правил со стандартами (db-link)...')
  await import('../scripts/db-link')

  // 7. Демо-данные организации
  console.log('\n🏢 7. Организация (демо)...')
  const orgCount = await db.organization.count()
  if (orgCount === 0) {
    await db.organization.create({
      data: {
        name: 'АО "Судоверфь "Северо-Верфь"',
        slug: 'severo-verf',
        inn: '7800000000',
        contactEmail: 'nk@severo-verf.example',
        plan: 'pro',
        maxDocuments: 500,
        maxChecks: 2000,
        maxUsers: 15,
        status: 'active',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    console.log('  ✓ Создана организация "Северо-Верфь" (plan: pro)')
  } else {
    console.log(`  ↪ Организация уже существует (${orgCount})`)
  }

  // Финальный подсчёт
  const standards = await db.standard.count()
  const rules = await db.rule.count()
  const linkedRules = await db.rule.count({ where: { NOT: { standardId: null } } })
  const clauses = await db.standardClause.count()
  const materials = await db.material.count()
  const fasteners = await db.fastener.count()
  const bearings = await db.bearing.count()
  const rolled = await db.rolledProduct.count()
  const welding = await db.weldingMaterial.count()
  const coatings = await db.coating.count()
  const pipes = await db.pipeFitting.count()
  const equipment = await db.shipEquipment.count()
  const benchSamples = await db.benchSample.count()
  const refTotal = materials + fasteners + bearings + rolled + welding + coatings + pipes + equipment

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Синхронизация завершена!`)
  console.log(`\n📊 Итоговые объёмы базы знаний:`)
  console.log(`   Стандартов:     ${standards}`)
  console.log(`   Правил:         ${rules} (связано со стандартами: ${linkedRules})`)
  console.log(`   Пунктов ГОСТ:   ${clauses}`)
  console.log(`   Справочников:   ${refTotal}`)
  console.log(`     • Материалы:      ${materials}`)
  console.log(`     • Крепёж:          ${fasteners}`)
  console.log(`     • Подшипники:      ${bearings}`)
  console.log(`     • Прокат:          ${rolled}`)
  console.log(`     • Сварка:          ${welding}`)
  console.log(`     • Покрытия:        ${coatings}`)
  console.log(`     • Трубы:           ${pipes}`)
  console.log(`     • Оборудование:    ${equipment}`)
  console.log(`   Bench семплов:  ${benchSamples}`)

  // Записываем версию
  await db.meta.upsert({
    where: { key: 'sync_version' },
    update: { value: SYNC_VERSION },
    create: { key: 'sync_version', value: SYNC_VERSION },
  })
  console.log(`\n🏷 Версия БД: ${SYNC_VERSION}`)
}

main()
  .catch(e => { console.error('❌ db:sync failed:', e); process.exit(1) })
  .finally(async () => { await db.$disconnect() })

