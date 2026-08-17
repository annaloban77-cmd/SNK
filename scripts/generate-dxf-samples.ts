// Генератор 20 DXF-семплов для бенча: 10 эталонных + 10 с ошибками
// DXF — текстовый формат, генерируем программно с блоком штампа и атрибутами

import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const OUT_DIR = '/home/z/my-project/public/bench/dxf'
const EXPECTED_DIR = '/home/z/my-project/public/bench/expected'

function makeRng(seed: number) {
  let s = seed
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

const DESIGNATIONS = [
  'АБВ.301254.001', 'АБВ.301254.002', 'АБВ.301455.012', 'АБВ.301567.003',
  'СВ.401234.001', 'СВ.401234.002', 'СВ.502345.001', 'СВ.502345.002',
  'СВ.603456.001', 'СВ.603456.002', 'СВ.704567.001', 'СВ.704567.002',
  'СВ.805678.001', 'СВ.805678.002', 'РР.102345.001', 'РР.102345.002',
  'СВ.906789.001', 'СВ.906789.002', 'СВ.906789.003', 'СВ.906789.004',
]

const NAMES = [
  'Кронштейн', 'Фланец', 'Опора', 'Крышка', 'Вал', 'Втулка', 'Обечайка',
  'Днище', 'Переборка', 'Палуба', 'Шпангоут', 'Стрингер', 'Карлингс',
  'Бимс', 'Флор', 'Пиллерс', 'Брашпиль', 'Кнехт', 'Клюз', 'Рым',
]

const MATERIALS = [
  'Сталь 09Г2С ГОСТ 19281-2014',
  'Сталь 10ХСНД ГОСТ 19281-2014',
  'Сталь Ст3сп ГОСТ 380-2005',
  'Сталь 20 ГОСТ 1050-2013',
  'Сталь 09Г2 ГОСТ 19281-2014',
  'Бронза БрАЖ9-4 ГОСТ 18175-78',
  'Латунь Л63 ГОСТ 15527-2004',
  'Алюминий АМг6 ГОСТ 4784-97',
]

const SCALES = ['1:1', '1:2', '1:5', '1:10', '2:1']
const LETTERS = ['О', 'А', 'Б', 'В']
const STAGES = ['РК', 'РД', 'РП']
const SIGS = ['Иванов И.И.', 'Петров П.П.', 'Сидоров С.С.', 'Кузнецов К.К.', 'Николаев Н.Н.', 'Директоров Д.Д.']
const GOST_REFS = ['ГОСТ 2.307-2011', 'ГОСТ 2.309-73', 'ГОСТ 2.316-2008']

// Генерация DXF-файла с штампом и атрибутами
function buildDxf(opts: {
  designation?: string
  name?: string
  scale?: string
  mass?: string
  material?: string
  letter?: string
  stage?: string
  developed?: string
  checked?: string
  normControl?: string
  approved?: string
  gostRefs?: string[]
  techReqs?: string[]
  format?: string
}): string {
  const lines: string[] = []
  const add = (code: number, value: string) => { lines.push(String(code)); lines.push(value) }

  // HEADER
  add(0, 'SECTION')
  add(2, 'HEADER')
  add(9, '$ACADVER')
  add(1, 'AC1015')
  add(9, '$DWGCODEPAGE')
  add(3, 'ANSI_1251')
  add(9, '$LASTSAVEDBY')
  add(1, 'НК-Контроль')
  add(0, 'ENDSEC')

  // TABLES (layers)
  add(0, 'SECTION')
  add(2, 'TABLES')
  add(0, 'TABLE')
  add(2, 'LAYER')
  add(70, '3')
  add(0, 'LAYER')
  add(2, '0')
  add(70, '0')
  add(62, '7')
  add(6, 'CONTINUOUS')
  add(0, 'LAYER')
  add(2, 'STAMP')
  add(70, '0')
  add(62, '7')
  add(6, 'CONTINUOUS')
  add(0, 'LAYER')
  add(2, 'TEXT')
  add(70, '0')
  add(62, '3')
  add(6, 'CONTINUOUS')
  add(0, 'ENDTAB')
  add(0, 'ENDSEC')

  // BLOCKS — блок штампа с атрибутами
  add(0, 'SECTION')
  add(2, 'BLOCKS')
  add(0, 'BLOCK')
  add(8, 'STAMP')
  add(2, 'TITLE_BLOCK')
  add(70, '0')
  add(10, '0')
  add(20, '0')
  add(30, '0')

  // ATTDEF для каждого поля штампа
  const attdefs: { tag: string; text: string; prompt: string; x: number; y: number }[] = [
    { tag: 'DESIGNATION', text: opts.designation || '', prompt: 'Обозначение', x: 10, y: 10 },
    { tag: 'NAME', text: opts.name || '', prompt: 'Наименование', x: 100, y: 20 },
    { tag: 'SCALE', text: opts.scale || '', prompt: 'Масштаб', x: 100, y: 15 },
    { tag: 'MASS', text: opts.mass || '', prompt: 'Масса', x: 150, y: 15 },
    { tag: 'MATERIAL', text: opts.material || '', prompt: 'Материал', x: 100, y: 10 },
    { tag: 'LETTER', text: opts.letter || '', prompt: 'Литера', x: 200, y: 20 },
    { tag: 'STAGE', text: opts.stage || '', prompt: 'Стадия', x: 200, y: 15 },
    { tag: 'DEVELOPED', text: opts.developed || '', prompt: 'Разработал', x: 50, y: 40 },
    { tag: 'CHECKED', text: opts.checked || '', prompt: 'Проверил', x: 50, y: 35 },
    { tag: 'NORMCONTROL', text: opts.normControl || '', prompt: 'Н.контр.', x: 50, y: 30 },
    { tag: 'APPROVED', text: opts.approved || '', prompt: 'Утвердил', x: 50, y: 25 },
    { tag: 'FORMAT', text: opts.format || 'A3', prompt: 'Формат', x: 200, y: 10 },
  ]

  for (const ad of attdefs) {
    add(0, 'ATTDEF')
    add(8, 'STAMP')
    add(10, String(ad.x))
    add(20, String(ad.y))
    add(30, '0')
    add(40, '3.5')
    add(1, ad.text)
    add(3, ad.prompt)
    add(2, ad.tag)
    add(70, '0')
  }

  add(0, 'ENDBLK')
  add(8, 'STAMP')
  add(0, 'ENDSEC')

  // ENTITIES — линии рамки + текст ТТ + перечень ГОСТ
  add(0, 'SECTION')
  add(2, 'ENTITIES')

  // Внешняя рамка
  add(0, 'LINE')
  add(8, '0')
  add(10, '20')
  add(20, '5')
  add(11, '407')
  add(21, '5')
  add(0, 'LINE')
  add(8, '0')
  add(10, '20')
  add(20, '5')
  add(11, '20')
  add(21, '292')
  add(0, 'LINE')
  add(8, '0')
  add(10, '20')
  add(20, '292')
  add(11, '407')
  add(21, '292')
  add(0, 'LINE')
  add(8, '0')
  add(10, '407')
  add(20, '5')
  add(11, '407')
  add(21, '292')

  // Вставка блока штампа
  add(0, 'INSERT')
  add(8, 'STAMP')
  add(2, 'TITLE_BLOCK')
  add(10, '180')
  add(20, '20')
  add(30, '0')

  // Технические требования (TEXT entities)
  const ttItems = opts.techReqs || [
    '1. Неуказанные предельные отклонения H14, h14, ±IT14/2.',
    '2. Острые кромки притупить R0,5...1,0 мм.',
  ]
  let ttY = 150
  add(0, 'TEXT')
  add(8, 'TEXT')
  add(10, '30')
  add(20, String(ttY))
  add(40, '5')
  add(1, 'Технические требования')
  ttY -= 7
  for (const tt of ttItems) {
    add(0, 'TEXT')
    add(8, 'TEXT')
    add(10, '30')
    add(20, String(ttY))
    add(40, '3.5')
    add(1, tt)
    ttY -= 5
  }

  // Перечень ГОСТ
  const gostRefs = opts.gostRefs || GOST_REFS
  let gostY = 150
  add(0, 'TEXT')
  add(8, 'TEXT')
  add(10, '250')
  add(20, String(gostY))
  add(40, '4')
  add(1, 'Перечень примененных стандартов:')
  gostY -= 6
  for (const g of gostRefs) {
    add(0, 'TEXT')
    add(8, 'TEXT')
    add(10, '250')
    add(20, String(gostY))
    add(40, '3.5')
    add(1, '- ' + g)
    gostY -= 5
  }

  add(0, 'ENDSEC')
  add(0, 'EOF')

  return lines.join('\n')
}

async function main() {
  console.log('📐 Generating 20 DXF bench samples...')
  await mkdir(OUT_DIR, { recursive: true })

  const manifest: { code: string; title: string; category: string; format: string; sourceType: string; expectedCount: number; expectedHigh: number; expectedMedium: number; expectedLow: number; expectedCategories: string[] }[] = []
  let idx = 1

  // 10 correct DXF samples
  for (let i = 0; i < 10; i++) {
    const rng = makeRng(7000 + i)
    const material = MATERIALS[i % MATERIALS.length]
    const gostRefs = [...GOST_REFS, ...material.match(/ГОСТ [\d.-]+/g) || []]
    const dxf = buildDxf({
      designation: DESIGNATIONS[i],
      name: NAMES[i],
      scale: SCALES[Math.floor(rng() * SCALES.length)],
      mass: `${(rng() * 30 + 0.5).toFixed(1)} кг`,
      material,
      letter: LETTERS[Math.floor(rng() * LETTERS.length)],
      stage: STAGES[Math.floor(rng() * STAGES.length)],
      developed: SIGS[i % SIGS.length],
      checked: SIGS[(i + 1) % SIGS.length],
      normControl: 'Николаев Н.Н.',
      approved: 'Директоров Д.Д.',
      gostRefs,
      techReqs: [
        '1. Неуказанные предельные отклонения H14, h14, ±IT14/2.',
        '2. Острые кромки притупить R0,5...1,0 мм.',
        '3. Покрытие: грунт ГФ-017, эмаль ПФ-115.',
      ],
      format: 'A3',
    })

    const code = `X-${String(idx).padStart(3, '0')}`
    await writeFile(path.join(OUT_DIR, `${code}.dxf`), dxf)
    manifest.push({
      code, title: `${NAMES[i]} (DXF эталон)`, category: 'correct',
      format: 'A3', sourceType: 'dxf',
      expectedCount: 0, expectedHigh: 0, expectedMedium: 0, expectedLow: 0,
      expectedCategories: [],
    })
    console.log(`  ✓ ${code} (correct)`)
    idx++
  }

  // 10 DXF samples with errors — координаты в мм (ГОСТ 2.104 форма 1)
  const errorTemplates = [
    { errors: [{ code: 'R-MASS-001', title: 'Лишняя точка после единицы массы', severity: 'low', field: 'Масса', x: 130, y: 5 }],
      overrides: (rng: () => number) => ({ mass: `${(rng() * 30 + 0.5).toFixed(1)} кг.` }) },
    { errors: [{ code: 'R-MAT-002', title: 'В обозначении материала нет ГОСТ', severity: 'medium', field: 'Материал', x: 100, y: 5 }],
      overrides: () => ({ material: 'Сталь 09Г2С' }) },
    { errors: [{ code: 'R-SIGN-003', title: 'Отсутствует подпись нормоконтролера', severity: 'high', field: 'Подписи', x: 70, y: 25 }],
      overrides: () => ({ normControl: '' }) },
    { errors: [{ code: 'R-SIGN-004', title: 'Отсутствует подпись утверждающего', severity: 'medium', field: 'Подписи', x: 70, y: 15 }],
      overrides: () => ({ approved: '' }) },
    { errors: [{ code: 'R-SIGN-001', title: 'Отсутствует подпись разработчика', severity: 'high', field: 'Подписи', x: 70, y: 40 }],
      overrides: () => ({ developed: '' }) },
    { errors: [{ code: 'R-STAMP-003', title: 'Отсутствует наименование изделия', severity: 'high', field: 'Наименование', x: 100, y: 8 }],
      overrides: () => ({ name: '' }) },
    { errors: [{ code: 'R-SCALE-001', title: 'Нестандартный масштаб', severity: 'low', field: 'Масштаб', x: 100, y: 5 }],
      overrides: () => ({ scale: '1:3' }) },
    { errors: [{ code: 'R-MAT-001', title: 'Не указан материал', severity: 'high', field: 'Материал', x: 100, y: 5 }],
      overrides: () => ({ material: '' }) },
    { errors: [{ code: 'R-LETTER-001', title: 'Литера не указана', severity: 'medium', field: 'Литера', x: 160, y: 10 }],
      overrides: () => ({ letter: '' }) },
    { errors: [{ code: 'R-STAGE-001', title: 'Стадия не указана', severity: 'medium', field: 'Стадия', x: 160, y: 5 }],
      overrides: () => ({ stage: '' }) },
  ]

  for (let i = 0; i < 10; i++) {
    const rng = makeRng(8000 + i)
    const tmpl = errorTemplates[i]
    const material = MATERIALS[i % MATERIALS.length]
    const gostRefs = [...GOST_REFS, ...material.match(/ГОСТ [\d.-]+/g) || []]
    const base = {
      designation: DESIGNATIONS[i + 10],
      name: NAMES[i + 10],
      scale: SCALES[Math.floor(rng() * SCALES.length)],
      mass: `${(rng() * 30 + 0.5).toFixed(1)} кг`,
      material,
      letter: LETTERS[Math.floor(rng() * LETTERS.length)],
      stage: STAGES[Math.floor(rng() * STAGES.length)],
      developed: SIGS[i % SIGS.length],
      checked: SIGS[(i + 1) % SIGS.length],
      normControl: 'Николаев Н.Н.',
      approved: 'Директоров Д.Д.',
      gostRefs,
      techReqs: [
        '1. Неуказанные предельные отклонения H14, h14, ±IT14/2.',
        '2. Острые кромки притупить R0,5...1,0 мм.',
      ],
      format: 'A3',
    }
    const overrides = tmpl.overrides(rng)
    const dxf = buildDxf({ ...base, ...overrides })

    const code = `XE-${String(idx - 10).padStart(3, '0')}`
    await writeFile(path.join(OUT_DIR, `${code}.dxf`), dxf)

    const expectedPath = path.join(EXPECTED_DIR, `${code}.json`)
    await writeFile(expectedPath, JSON.stringify({ code, sample: code, findings: tmpl.errors }, null, 2))

    const high = tmpl.errors.filter(e => e.severity === 'high').length
    const med = tmpl.errors.filter(e => e.severity === 'medium').length
    const low = tmpl.errors.filter(e => e.severity === 'low').length
    const cats = [...new Set(tmpl.errors.map(e => e.code.split('-')[1].toLowerCase()))] as string[]

    manifest.push({
      code, title: `${NAMES[i + 10]} (DXF с ошибкой: ${tmpl.errors[0].code})`, category: 'with_errors',
      format: 'A3', sourceType: 'dxf',
      expectedCount: tmpl.errors.length, expectedHigh: high, expectedMedium: med, expectedLow: low,
      expectedCategories: cats,
    })
    console.log(`  ✓ ${code} (with_errors: ${tmpl.errors[0].code})`)
    idx++
  }

  await writeFile('/home/z/my-project/public/bench/dxf-manifest.json', JSON.stringify(manifest, null, 2))
  console.log(`\n✅ Generated ${manifest.length} DXF samples`)
  console.log(`   Correct: ${manifest.filter(m => m.category === 'correct').length}`)
  console.log(`   With errors: ${manifest.filter(m => m.category === 'with_errors').length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
