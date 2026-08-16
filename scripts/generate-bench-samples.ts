// Генератор 100 семплов для стенда: 50 эталонных + 50 с ошибками
// Каждый семпл — PNG-чертёж со штампом ГОСТ 2.104
// Для with_errors — JSON с ожидаемыми замечаниями (код правила, координаты)

import sharp from 'sharp'
import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const OUT_DIR = '/home/z/my-project/public/bench/samples'
const EXPECTED_DIR = '/home/z/my-project/public/bench/expected'
const SVG_DIR = '/home/z/my-project/public/bench/svg' // SVG-исходники для детерминированного OCR

// Шаблоныdesignation для разнообразия
const DESIGNATIONS = [
  'АБВ.301254.001', 'АБВ.301254.002', 'АБВ.301254.003', 'АБВ.301455.012',
  'АБВ.301567.003', 'СВ.401234.001', 'СВ.401234.002', 'СВ.401456.001',
  'СВ.502345.001', 'СВ.502345.002', 'СВ.502345.003', 'СВ.603456.001',
  'СВ.603456.002', 'СВ.704567.001', 'СВ.704567.002', 'СВ.704567.003',
  'СВ.805678.001', 'СВ.805678.002', 'РР.102345.001', 'РР.102345.002',
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

const SCALES = ['1:1', '1:2', '1:2.5', '1:5', '1:10', '2:1', '1:4']
const FORMATS = ['A4', 'A3', 'A2']
const LETTERS = ['О', 'А', 'Б', 'В']
const STAGES = ['РК', 'РД', 'РП', 'ЭП', 'ТП']

const SIZES: Record<string, { w: number; h: number }> = {
  A4: { w: 1000, h: 1414 },
  A3: { w: 1414, h: 2000 },
  A2: { w: 2000, h: 2828 },
}

interface ExpectedFinding {
  code: string
  title: string
  severity: 'high' | 'medium' | 'low'
  field: string
  x: number
  y: number
}

// SVG-шаблон чертежа со штампом ГОСТ 2.104 форма 1
function buildDrawingSvg(opts: {
  format: string
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
  showFrame?: boolean
  showProjections?: boolean
  showWelds?: boolean
  showDimensions?: boolean
}): string {
  const { w, h } = SIZES[opts.format] || SIZES.A4
  const stampX = w - 360
  const stampY = h - 200
  const f = opts.format
  const gostRefs = opts.gostRefs || ['ГОСТ 2.307-2011', 'ГОСТ 2.309-73', 'ГОСТ 2.316-2008']
  const techReqs = opts.techReqs || [
    '1. Неуказенные предельные отклонения H14, h14, ±IT14/2.',
    '2. Острые кромки притупить R0,5...1,0 мм.',
    '3. Покрытие: грунт ГФ-017, эмаль ПФ-115.',
  ]
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Arial, sans-serif">
  <rect width="${w}" height="${h}" fill="#ffffff"/>
  ${opts.showFrame !== false ? `<rect x="20" y="20" width="${w-40}" height="${h-40}" fill="none" stroke="#000" stroke-width="2"/>` : ''}
  
  <!-- Геометрические проекции -->
  ${opts.showProjections !== false ? `
  <g transform="translate(${w*0.15}, ${h*0.15})">
    <circle cx="150" cy="100" r="60" fill="none" stroke="#000" stroke-width="1.5"/>
    <rect x="50" y="50" width="200" height="120" fill="none" stroke="#000" stroke-width="1.5"/>
    <line x1="50" y1="110" x2="250" y2="110" stroke="#000" stroke-width="0.5" stroke-dasharray="10,3,2,3"/>
    <line x1="150" y1="50" x2="150" y2="220" stroke="#000" stroke-width="0.5" stroke-dasharray="10,3,2,3"/>
    ${opts.showDimensions !== false ? `
    <line x1="50" y1="240" x2="250" y2="240" stroke="#000" stroke-width="0.5"/>
    <line x1="50" y1="235" x2="50" y2="245" stroke="#000" stroke-width="0.5"/>
    <line x1="250" y1="235" x2="250" y2="245" stroke="#000" stroke-width="0.5"/>
    <text x="150" y="258" font-size="14" text-anchor="middle">200</text>
    ` : ''}
  </g>
  ` : ''}
  
  <!-- Сварные швы (если есть) -->
  ${opts.showWelds ? `
  <g transform="translate(${w*0.5}, ${h*0.3})">
    <line x1="0" y1="0" x2="120" y2="0" stroke="#000" stroke-width="2"/>
    <line x1="120" y1="-15" x2="135" y2="-15" stroke="#000" stroke-width="1"/>
    <polygon points="135,-15 145,-10 135,-5" fill="#000"/>
    <text x="150" y="-5" font-size="12">⌂ 8 ГОСТ 5264-80</text>
  </g>
  ` : ''}
  
  <!-- Технические требования -->
  <g transform="translate(${w*0.1}, ${h*0.55})">
    <text x="0" y="0" font-size="16" font-weight="bold">Технические требования</text>
    ${techReqs.map((r, i) => `<text x="0" y="${25 + i*20}" font-size="13">${r}</text>`).join('')}
  </g>
  
  <!-- Перечень ГОСТ -->
  <g transform="translate(${w*0.6}, ${h*0.55})">
    <text x="0" y="0" font-size="14" font-weight="bold">Перечень применённых стандартов:</text>
    ${gostRefs.map((g, i) => `<text x="0" y="${20 + i*16}" font-size="12">- ${g}</text>`).join('')}
  </g>
  
  <!-- Штамп ГОСТ 2.104 форма 1 (185×55 мм, масштабируем) -->
  <g transform="translate(${stampX}, ${stampY})">
    <rect x="0" y="0" width="340" height="180" fill="none" stroke="#000" stroke-width="1.5"/>
    <!-- Внутренние линии -->
    <line x1="0" y1="30" x2="340" y2="30" stroke="#000" stroke-width="0.7"/>
    <line x1="0" y1="60" x2="340" y2="60" stroke="#000" stroke-width="0.7"/>
    <line x1="0" y1="90" x2="340" y2="90" stroke="#000" stroke-width="0.7"/>
    <line x1="0" y1="120" x2="340" y2="120" stroke="#000" stroke-width="0.7"/>
    <line x1="0" y1="150" x2="340" y2="150" stroke="#000" stroke-width="0.7"/>
    <line x1="120" y1="0" x2="120" y2="150" stroke="#000" stroke-width="0.7"/>
    <line x1="220" y1="0" x2="220" y2="150" stroke="#000" stroke-width="0.7"/>
    <line x1="280" y1="0" x2="280" y2="150" stroke="#000" stroke-width="0.7"/>
    <line x1="170" y1="150" x2="170" y2="180" stroke="#000" stroke-width="0.7"/>
    
    <!-- Метки полей -->
    <text x="5" y="20" font-size="9" fill="#666">Изм.</text>
    <text x="125" y="20" font-size="9" fill="#666">Лист</text>
    <text x="225" y="20" font-size="9" fill="#666">№ докум.</text>
    <text x="285" y="20" font-size="9" fill="#666">Подп.</text>
    <text x="5" y="50" font-size="9" fill="#666">Разраб.</text>
    <text x="5" y="80" font-size="9" fill="#666">Пров.</text>
    <text x="5" y="110" font-size="9" fill="#666">Н.контр.</text>
    <text x="5" y="140" font-size="9" fill="#666">Утв.</text>
    
    <!-- Подписи (значения) -->
    <text x="125" y="50" font-size="11">${opts.developed || ''}</text>
    <text x="125" y="80" font-size="11">${opts.checked || ''}</text>
    <text x="125" y="110" font-size="11">${opts.normControl || ''}</text>
    <text x="125" y="140" font-size="11">${opts.approved || ''}</text>
    
    <!-- Обозначение (крупно) -->
    <text x="10" y="170" font-size="14" font-weight="bold">${opts.designation || ''}</text>
    
    <!-- Наименование в центре штампа -->
    <text x="180" y="165" font-size="11">${opts.name || ''}</text>
    <text x="180" y="178" font-size="9" fill="#666">${f} · ${opts.scale || ''} · ${opts.mass || ''} · ${opts.material || ''}</text>
    <text x="180" y="178" font-size="9" fill="#666">Лит. ${opts.letter || ''} · Стадия ${opts.stage || ''}</text>
  </g>
</svg>`
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

// Простой seedable RNG
function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

async function main() {
  console.log('🏗 Generating 100 bench samples (50 correct + 50 with errors)...')
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(EXPECTED_DIR, { recursive: true })
  await mkdir(SVG_DIR, { recursive: true })
  
  let idx = 1
  const manifest: { code: string; title: string; category: string; format: string; sourceType: string; expectedCount: number; expectedHigh: number; expectedMedium: number; expectedLow: number; expectedCategories: string[] }[] = []
  
  // ===== 50 эталонных (correct) семплов =====
  for (let i = 0; i < 50; i++) {
    const rng = makeRng(1000 + i)
    const format = pick(FORMATS, rng)
    const designation = DESIGNATIONS[i % DESIGNATIONS.length]
    const name = NAMES[i % NAMES.length]
    const scale = pick(SCALES, rng)
    const mass = `${(rng() * 30 + 0.5).toFixed(1)} кг`
    const material = pick(MATERIALS, rng)
    const letter = pick(LETTERS, rng)
    const stage = pick(STAGES, rng)
    const developed = ['Иванов И.И.', 'Петров П.П.', 'Сидоров С.С.'][i % 3]
    const checked = ['Кузнецов К.К.', 'Смирнов С.С.', 'Волков В.В.'][i % 3]
    const normControl = 'Николаев Н.Н.'
    const approved = 'Директоров Д.Д.'
    
    const svg = buildDrawingSvg({
      format, designation, name, scale, mass, material, letter, stage,
      developed, checked, normControl, approved,
      gostRefs: ['ГОСТ 2.307-2011', 'ГОСТ 2.309-73', 'ГОСТ 2.316-2008', ...material.match(/ГОСТ [\d-]+/g) || []],
      techReqs: [
        '1. Неуказенные предельные отклонения H14, h14, ±IT14/2.',
        '2. Острые кромки притупить R0,5...1,0 мм.',
        '3. Покрытие: грунт ГФ-017, эмаль ПФ-115.',
      ],
      showWelds: i % 4 === 0,
    })
    
    const code = `S-${String(idx).padStart(3, '0')}`
    const pngPath = path.join(OUT_DIR, `${code}.png`)
    const svgPath = path.join(SVG_DIR, `${code}.svg`)
    await sharp(Buffer.from(svg)).png().toFile(pngPath)
    await writeFile(svgPath, svg)
    
    manifest.push({
      code, title: `${name} (эталон, ${format})`, category: 'correct',
      format, sourceType: 'scan', expectedCount: 0, expectedHigh: 0, expectedMedium: 0, expectedLow: 0,
      expectedCategories: [],
    })
    idx++
  }
  console.log(`✓ Generated 50 correct samples`)
  
  // ===== 50 семплов с ошибками =====
  // Каждый — с 1-3 заложенными ошибками
  const errorTemplates = [
    // 1. Масса с лишней точкой
    { errors: [{ code: 'R-MASS-001', title: 'Лишняя точка после единицы массы', severity: 'low', field: 'Масса', x: 0, y: 0 }],
      overrides: (rng: () => number) => ({ mass: `${(rng()*30+0.5).toFixed(1)} кг.` }) },
    // 2. Материал без ГОСТ
    { errors: [{ code: 'R-MAT-002', title: 'В обозначении материала нет ГОСТ', severity: 'medium', field: 'Материал', x: 0, y: 0 }],
      overrides: () => ({ material: 'Сталь 09Г2С' }) },
    // 3. Материал без ГОСТ + нет в перечне
    { errors: [
        { code: 'R-MAT-002', title: 'В обозначении материала нет ГОСТ', severity: 'medium', field: 'Материал', x: 0, y: 0 },
      ],
      overrides: () => ({ material: 'Сталь 09Г2С', gostRefs: ['ГОСТ 2.307-2011', 'ГОСТ 2.309-73'] }) },
    // 4. Нет подписи нормоконтролера
    { errors: [{ code: 'R-SIGN-003', title: 'Отсутствует подпись нормоконтролера', severity: 'high', field: 'Подписи', x: 0, y: 0 }],
      overrides: () => ({ normControl: '' }) },
    // 5. Нет подписи утверждающего
    { errors: [{ code: 'R-SIGN-004', title: 'Отсутствует подпись утверждающего', severity: 'medium', field: 'Подписи', x: 0, y: 0 }],
      overrides: () => ({ approved: '' }) },
    // 6. Нет подписи разработчика
    { errors: [{ code: 'R-SIGN-001', title: 'Отсутствует подпись разработчика', severity: 'high', field: 'Подписи', x: 0, y: 0 }],
      overrides: () => ({ developed: '' }) },
    // 7. Нет наименования
    { errors: [{ code: 'R-STAMP-003', title: 'Отсутствует наименование изделия', severity: 'high', field: 'Наименование', x: 0, y: 0 }],
      overrides: () => ({ name: '' }) },
    // 8. Нет обозначения
    { errors: [{ code: 'R-STAMP-001', title: 'Отсутствует обозначение документа', severity: 'high', field: 'Обозначение', x: 0, y: 0 }],
      overrides: () => ({ designation: '' }) },
    // 9. Нестандартный масштаб 1:3
    { errors: [{ code: 'R-SCALE-001', title: 'Нестандартный масштаб', severity: 'low', field: 'Масштаб', x: 0, y: 0 }],
      overrides: () => ({ scale: '1:3' }) },
    // 10. Нет материала
    { errors: [{ code: 'R-MAT-001', title: 'Не указан материал', severity: 'high', field: 'Материал', x: 0, y: 0 }],
      overrides: () => ({ material: '' }) },
    // 11. Нет литеры
    { errors: [{ code: 'R-LETTER-001', title: 'Литера не указана', severity: 'medium', field: 'Литера', x: 0, y: 0 }],
      overrides: () => ({ letter: '' }) },
    // 12. Нет стадии
    { errors: [{ code: 'R-STAGE-001', title: 'Стадия не указана', severity: 'medium', field: 'Стадия', x: 0, y: 0 }],
      overrides: () => ({ stage: '' }) },
    // 13. Нет ТТ
    { errors: [{ code: 'R-TT-001', title: 'Отсутствуют технические требования', severity: 'medium', field: 'Технические требования', x: 0, y: 0 }],
      overrides: () => ({ techReqs: [] }) },
    // 14. Нет перечня ГОСТ
    { errors: [{ code: 'R-GOST-001', title: 'Отсутствует перечень ссылочных ГОСТ', severity: 'medium', field: 'Перечень ГОСТ', x: 0, y: 0 }],
      overrides: () => ({ gostRefs: [] }) },
    // 15. Комбинация: масса+материал+подпись
    { errors: [
        { code: 'R-MASS-001', title: 'Лишняя точка после единицы массы', severity: 'low', field: 'Масса', x: 0, y: 0 },
        { code: 'R-MAT-002', title: 'В обозначении материала нет ГОСТ', severity: 'medium', field: 'Материал', x: 0, y: 0 },
        { code: 'R-SIGN-003', title: 'Отсутствует подпись нормоконтролера', severity: 'high', field: 'Подписи', x: 0, y: 0 },
      ],
      overrides: (rng: () => number) => ({ mass: `${(rng()*30+0.5).toFixed(1)} кг.`, material: 'Сталь 09Г2С', normControl: '' }) },
    // 16. Нестандартная литера
    { errors: [{ code: 'R-LETTER-001', title: 'Нестандартная литера', severity: 'low', field: 'Литера', x: 0, y: 0 }],
      overrides: () => ({ letter: 'X' }) },
    // 17. Нет подписи проверившего
    { errors: [{ code: 'R-SIGN-002', title: 'Отсутствует подпись проверившего', severity: 'high', field: 'Подписи', x: 0, y: 0 }],
      overrides: () => ({ checked: '' }) },
    // 18. Масса без единицы
    { errors: [{ code: 'R-MASS-001', title: 'Не указана единица измерения массы', severity: 'low', field: 'Масса', x: 0, y: 0 }],
      overrides: (rng: () => number) => ({ mass: `${(rng()*30+0.5).toFixed(1)}` }) },
  ]
  
  for (let i = 0; i < 50; i++) {
    const rng = makeRng(2000 + i)
    const format = pick(FORMATS, rng)
    const designation = DESIGNATIONS[(i + 3) % DESIGNATIONS.length]
    const name = NAMES[(i + 5) % NAMES.length]
    const tmpl = errorTemplates[i % errorTemplates.length]
    const material = pick(MATERIALS, rng)
    const base = {
      format, designation, name,
      scale: pick(SCALES, rng),
      mass: `${(rng()*30+0.5).toFixed(1)} кг`,
      material,
      letter: pick(LETTERS, rng),
      stage: pick(STAGES, rng),
      developed: ['Иванов И.И.', 'Петров П.П.'][i % 2],
      checked: ['Кузнецов К.К.', 'Смирнов С.С.'][i % 2],
      normControl: 'Николаев Н.Н.',
      approved: 'Директоров Д.Д.',
      gostRefs: ['ГОСТ 2.307-2011', 'ГОСТ 2.309-73', 'ГОСТ 2.316-2008', ...material.match(/ГОСТ [\d.-]+/g) || []],
      techReqs: [
        '1. Неуказенные предельные отклонения H14, h14, ±IT14/2.',
        '2. Острые кромки притупить R0,5...1,0 мм.',
      ],
    }
    const overrides = tmpl.overrides(rng)
    const svg = buildDrawingSvg({ ...base, ...overrides, showWelds: i % 5 === 0 })
    
    const code = `E-${String(idx - 50).padStart(3, '0')}`
    const pngPath = path.join(OUT_DIR, `${code}.png`)
    const svgPath = path.join(SVG_DIR, `${code}.svg`)
    await sharp(Buffer.from(svg)).png().toFile(pngPath)
    await writeFile(svgPath, svg)
    
    // expected findings JSON
    const expectedPath = path.join(EXPECTED_DIR, `${code}.json`)
    await writeFile(expectedPath, JSON.stringify({ code, sample: code, findings: tmpl.errors }, null, 2))
    
    const high = tmpl.errors.filter(e => e.severity === 'high').length
    const med = tmpl.errors.filter(e => e.severity === 'medium').length
    const low = tmpl.errors.filter(e => e.severity === 'low').length
    const cats = [...new Set(tmpl.errors.map(e => e.code.split('-')[1].toLowerCase()))]
    
    manifest.push({
      code, title: `${name} (с ошибками, ${format})`, category: 'with_errors',
      format, sourceType: 'scan',
      expectedCount: tmpl.errors.length, expectedHigh: high, expectedMedium: med, expectedLow: low,
      expectedCategories: cats,
    })
    idx++
  }
  console.log(`✓ Generated 50 samples with errors`)
  
  // Манифест для последующего импорта в БД
  await writeFile('/home/z/my-project/public/bench/manifest.json', JSON.stringify(manifest, null, 2))
  console.log(`\n✅ Generated ${manifest.length} samples total`)
  console.log(`   Correct: ${manifest.filter(m => m.category === 'correct').length}`)
  console.log(`   With errors: ${manifest.filter(m => m.category === 'with_errors').length}`)
  console.log(`   Total expected findings: ${manifest.reduce((s, m) => s + m.expectedCount, 0)}`)
  console.log(`   Manifest: /home/z/my-project/public/bench/manifest.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
