// Bench runner: прогон семплов по tier, сравнение с expected, метрики
// Архитектура P5: OCR → Geometry → Rules → LLM (explanations) → post-filter
// ПРАВКИ: матч по code+координаты(5мм), coordAccuracy считается, порог 85%, tier-фильтрация, env paths, source_ocr
import { db } from './db'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { llmSemanticCheck } from './zai'
import { runDeterministicRules, toStampFields, fromLlmIssues, type RuleCheckResult } from './rules'
import { parseCadFile, cadToStampFields } from './cad-parser'
import { extractStamp, terminateOcr } from './ocr/stamp-ocr'
import { terminateZoneOcr } from './ocr/zone-ocr'
import { analyzeGeometry } from './geometry/geometry-checker'
import { filterFindings } from './post-filter'

// 7. Убираем hardcoded пути — используем env
const BENCH_DATA_DIR = process.env.BENCH_DATA_DIR || path.join(process.cwd(), 'public')

// 1. Координатная точность: допуск 5мм
const COORD_TOLERANCE_MM = 5.0

// Маппинг кода правила → координаты поля в штампе ГОСТ 2.104 (мм, от левого нижнего угла штампа)
function getRuleCoords(code: string): { x?: number; y?: number } {
  const c = code.toUpperCase()
  // Обозначение: нижняя строка, левая часть
  if (c.startsWith('R-STAMP-001') || c.startsWith('R-STAMP-002')) return { x: 5, y: 5 }
  // Наименование: центр-низ
  if (c.startsWith('R-STAMP-003')) return { x: 100, y: 8 }
  // Масштаб: нижняя строка, центр
  if (c.startsWith('R-SCALE')) return { x: 100, y: 5 }
  // Масса: нижняя строка, правее
  if (c.startsWith('R-MASS')) return { x: 130, y: 5 }
  // Материал: нижняя строка, центр
  if (c.startsWith('R-MAT')) return { x: 100, y: 5 }
  // Литера: правая часть, верх
  if (c.startsWith('R-LETTER')) return { x: 160, y: 10 }
  // Стадия: правая часть, низ
  if (c.startsWith('R-STAGE')) return { x: 160, y: 5 }
  // Подписи (по конкретной роли)
  if (c.startsWith('R-SIGN-001')) return { x: 70, y: 40 } // Разраб
  if (c.startsWith('R-SIGN-002')) return { x: 70, y: 35 } // Пров
  if (c.startsWith('R-SIGN-003')) return { x: 70, y: 25 } // Н.контр
  if (c.startsWith('R-SIGN-004')) return { x: 70, y: 15 } // Утв
  // ТТ: над штампом
  if (c.startsWith('R-TT')) return { x: 5, y: 100 }
  // Перечень ГОСТ: справа от ТТ
  if (c.startsWith('R-GOST')) return { x: 200, y: 100 }
  // Формат: правый верхний угол штампа
  if (c.startsWith('R-FORMAT')) return { x: 170, y: 50 }
  return {}
}

// Маппинг кода правила → ключ поля для fieldCoords из PaddleOCR
function mapCodeToFieldKey(code: string): string | null {
  const c = code.toUpperCase()
  if (c.startsWith('R-STAMP-001') || c.startsWith('R-STAMP-002')) return 'designation'
  if (c.startsWith('R-STAMP-003')) return 'name'
  if (c.startsWith('R-SCALE')) return 'scale'
  if (c.startsWith('R-MASS')) return 'mass'
  if (c.startsWith('R-MAT')) return 'material'
  if (c.startsWith('R-LETTER')) return 'letter'
  if (c.startsWith('R-STAGE')) return 'stage'
  if (c.startsWith('R-SIGN-001')) return 'developed'
  if (c.startsWith('R-SIGN-002')) return 'checked'
  if (c.startsWith('R-SIGN-003')) return 'normControl'
  if (c.startsWith('R-SIGN-004')) return 'approved'
  if (c.startsWith('R-FORMAT')) return 'format'
  return null
}

export interface ExpectedFinding {
  code: string
  title: string
  severity: 'high' | 'medium' | 'low'
  field: string
  x: number
  y: number
}

export interface FoundIssueWithCoords extends RuleCheckResult {
  x?: number  // координата X найденной ошибки (мм)
  y?: number  // координата Y найденной ошибки (мм)
  sourceOcr?: string  // какой движок нашёл
}

export interface MatchedPair {
  found: FoundIssueWithCoords
  expected: ExpectedFinding
  delta: number | null  // расстояние в мм (null если координат нет)
}

export interface SampleRunResult {
  sampleId: string
  code: string
  foundIssues: FoundIssueWithCoords[]
  expectedFindings: ExpectedFinding[]
  matched: MatchedPair[]
  falsePositives: FoundIssueWithCoords[]
  falseNegatives: ExpectedFinding[]
  recall: number
  precision: number
  recallHigh: number
  coordAccuracy: number | null  // среднее отклонение в мм (null если нет координат)
  durationMs: number
  stamp: any
  sourceOcr: string  // какой движок сработал
}

// Запустить один семпл
export async function runSingleSample(sample: {
  id: string
  code: string
  filePath: string
  sourceType: string
  expectedFindings?: string | null
}, opts: { runLlm?: boolean } = {}): Promise<SampleRunResult> {
  const start = Date.now()
  const foundIssues: FoundIssueWithCoords[] = []
  let stamp: any = null
  let ocrConfidence = 0.0
  let fieldMeta: Record<string, { hasText: boolean; confidence: number; parsed: boolean }> | null = null
  let sourceOcr = 'none'

  // 7. Убираем hardcoded пути
  const fullPath = sample.filePath.startsWith('/')
    ? path.join(BENCH_DATA_DIR, sample.filePath.replace(/^\/+/, ''))
    : path.join(BENCH_DATA_DIR, sample.filePath.replace(/^\/+/, ''))

  const ext = fullPath.toLowerCase().split('.').pop() || ''

  // 1. OCR штампа
  let ocrFieldCoords: Record<string, { x: number; y: number }> | undefined
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
    try {
      const ocrResult = await extractStamp(fullPath, { useVlmFallback: true })
      stamp = ocrResult.stamp
      ocrConfidence = ocrResult.confidence
      fieldMeta = ocrResult.fieldMeta ?? null
      sourceOcr = ocrResult.sourceOcr
      ocrFieldCoords = ocrResult.fieldCoords
      console.log(`     [OCR: ${ocrResult.method}/${sourceOcr}, ${ocrResult.durationMs}ms, confidence=${(ocrResult.confidence*100).toFixed(0)}%${ocrFieldCoords ? ', coords=' + Object.keys(ocrFieldCoords).length : ''}]`)
    } catch (e) {
      console.error(`OCR failed for ${sample.code}:`, e)
    }
  } else if (['dxf', 'dwg', 'sldprt', 'sldasm', 'slddrw', 'cdw', 'spw'].includes(ext)) {
    try {
      if (existsSync(fullPath)) {
        const parsed = await parseCadFile(fullPath)
        stamp = cadToStampFields(parsed)
        ocrConfidence = 1.0
        sourceOcr = 'cad'
      }
    } catch (e) {
      console.error(`CAD parse failed for ${sample.code}:`, e)
    }
  }

  // 2. Geometry
  if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) {
    try {
      const geom = await analyzeGeometry(fullPath)
      for (const gf of geom.findings) {
        foundIssues.push({
          code: gf.code,
          title: gf.title,
          description: gf.description,
          severity: gf.severity,
          field: gf.field,
          source: 'auto',
          gostRef: undefined,
          recommendation: undefined,
          requirement: undefined,
          evidence: `[geometry confidence: ${(gf.confidence * 100).toFixed(0)}%]`,
          sourceOcr: 'geometry',
        })
      }
    } catch {
      // geometry не критична
    }
  }

  // 3. Детерминированные правила (с координатами полей штампа)
  if (stamp) {
    const det = runDeterministicRules(toStampFields(stamp))
    for (const d of det) {
      // Назначаем координаты: сначала из PaddleOCR bounding boxes (если есть),
      // затем fallback на статический маппинг по ГОСТ 2.104
      const fieldKey = mapCodeToFieldKey(d.code)
      let coords: { x?: number; y?: number }
      if (ocrFieldCoords && fieldKey && ocrFieldCoords[fieldKey]) {
        // Реальные pixel-координаты от PaddleOCR
        coords = ocrFieldCoords[fieldKey]
      } else {
        // Статический маппинг по ГОСТ 2.104 (мм)
        coords = getRuleCoords(d.code)
      }
      foundIssues.push({ ...d, sourceOcr, ...coords })
    }

    // 4. LLM (опционально)
    if (opts.runLlm === true && stamp) {
      try {
        const gostRefs = stamp.gostReferences || []
        const llmIssues = await Promise.race([
          llmSemanticCheck(stamp, gostRefs),
          new Promise<[]>((r) => setTimeout(() => r([]), 30000)),
        ])
        for (const l of fromLlmIssues(llmIssues)) {
          foundIssues.push({ ...l, sourceOcr: 'llm' })
        }
      } catch {
        // пропускаем LLM при ошибке
      }
    }
  }

  // 5. Пост-фильтрация
  const filtered = filterFindings(foundIssues, {
    minConfidence: 0.4, dedupe: true, dropLowIfHighExists: true,
    ocrConfidence, fieldMeta,
  })
  foundIssues.length = 0
  foundIssues.push(...filtered as FoundIssueWithCoords[])

  // Парсим expected
  let expectedFindings: ExpectedFinding[] = []
  if (sample.expectedFindings) {
    try {
      const parsed = JSON.parse(sample.expectedFindings)
      expectedFindings = parsed.findings || []
    } catch {
      // ignore
    }
  }

  // 1. СРАВНЕНИЕ: матч по code + координаты (5мм допуск)
  const matched: MatchedPair[] = []
  const usedFound = new Set<number>()
  const usedExpected = new Set<number>()

  for (let ei = 0; ei < expectedFindings.length; ei++) {
    const exp = expectedFindings[ei]
    let bestFoundIdx = -1
    let bestDelta = Infinity

    for (let fi = 0; fi < foundIssues.length; fi++) {
      if (usedFound.has(fi)) continue
      const found = foundIssues[fi]
      if (found.code !== exp.code) continue

      // Сравниваем координаты (если есть у обоих)
      if (exp.x !== undefined && exp.y !== undefined && exp.x !== 0 && exp.y !== 0 &&
          found.x !== undefined && found.y !== undefined && found.x !== 0 && found.y !== 0) {
        const delta = Math.sqrt(
          Math.pow(found.x - exp.x, 2) + Math.pow(found.y - exp.y, 2)
        )
        if (delta <= COORD_TOLERANCE_MM && delta < bestDelta) {
          bestFoundIdx = fi
          bestDelta = delta
        }
      } else {
        // Если координат нет — матч только по code (fallback)
        // Но только если в этом семпле одна ошибка этого типа
        const sameCodeCount = expectedFindings.filter(e => e.code === exp.code).length
        if (sameCodeCount === 1) {
          bestFoundIdx = fi
          bestDelta = 0
          break
        }
      }
    }

    if (bestFoundIdx >= 0) {
      matched.push({
        found: foundIssues[bestFoundIdx],
        expected: exp,
        delta: bestDelta === Infinity ? null : bestDelta,
      })
      usedFound.add(bestFoundIdx)
      usedExpected.add(ei)
    }
  }

  const falsePositives = foundIssues.filter((_, i) => !usedFound.has(i))
  const falseNegatives = expectedFindings.filter((_, ei) => !usedExpected.has(ei))

  const recall = expectedFindings.length > 0 ? matched.length / expectedFindings.length : (foundIssues.length === 0 ? 1 : 0)
  const precision = foundIssues.length > 0 ? matched.length / foundIssues.length : 1
  const expectedHigh = expectedFindings.filter(e => e.severity === 'high')
  const matchedHigh = matched.filter(m => m.expected.severity === 'high')
  const recallHigh = expectedHigh.length > 0 ? matchedHigh.length / expectedHigh.length : 1

  // 2. coordAccuracy — среднее отклонение в мм
  const deltas = matched.filter(m => m.delta !== null && m.delta !== undefined).map(m => m.delta!)
  const coordAccuracy = deltas.length > 0
    ? deltas.reduce((a, b) => a + b, 0) / deltas.length
    : null

  return {
    sampleId: sample.id,
    code: sample.code,
    foundIssues,
    expectedFindings,
    matched,
    falsePositives,
    falseNegatives,
    recall,
    precision,
    recallHigh,
    coordAccuracy,
    durationMs: Date.now() - start,
    stamp,
    sourceOcr,
  }
}

// 8. Tier-фильтрация в runBench
export async function runBench(opts: {
  runLlm?: boolean
  version?: string
  tier?: 'synthetic' | 'realistic' | 'torture' | 'real' | 'dxf' | 'all'
  organizationId?: string
} = {}): Promise<{
  runId: string
  tier: string
  totalSamples: number
  passedSamples: number
  failedSamples: number
  recall: number
  precision: number
  recallHigh: number
  coordAccuracy: number | null
  benchStatus: 'green' | 'yellow' | 'red'
  totalExpected: number
  totalFound: number
  totalMatched: number
  totalFalsePos: number
  totalFalseNeg: number
  durationMs: number
}> {
  const start = Date.now()
  const version = opts.version || `bench-${Date.now()}`
  const tier = opts.tier || 'all'
  console.log(`🧪 Starting bench run ${version} (tier: ${tier})...`)

  const run = await db.benchRun.create({
    data: {
      version,
      tier,
      status: 'running',
      organizationId: opts.organizationId ?? null,
    },
  })

  // 8. Фильтр по tier
  const where: any = { isActive: true }
  if (tier !== 'all') {
    where.tier = tier
  }
  if (opts.organizationId) {
    where.organizationId = opts.organizationId
  }
  const samples = await db.benchSample.findMany({ where })
  console.log(`   ${samples.length} active samples (tier: ${tier})`)

  let totalExpected = 0, totalFound = 0, totalMatched = 0, totalFalsePos = 0, totalFalseNeg = 0
  let passedSamples = 0, failedSamples = 0
  const allFindings: any[] = []
  let totalCoordDelta = 0
  let coordDeltaCount = 0

  const BATCH_SIZE = 1
  for (let bi = 0; bi < samples.length; bi += BATCH_SIZE) {
    const batch = samples.slice(bi, bi + BATCH_SIZE)
    console.log(`   ▶ batch ${Math.floor(bi/BATCH_SIZE)+1}/${Math.ceil(samples.length/BATCH_SIZE)}: ${batch.map(s=>s.code).join(', ')}`)
    const results = await Promise.allSettled(batch.map(sample =>
      runSingleSample({
        id: sample.id, code: sample.code, filePath: sample.filePath,
        sourceType: sample.sourceType, expectedFindings: sample.expectedFindings,
      }, { runLlm: opts.runLlm })
    ))
    for (let ri = 0; ri < results.length; ri++) {
      const sample = batch[ri]
      const res = results[ri]
      if (res.status !== 'fulfilled') {
        console.error(`     ✗ ${sample.code} error:`, res.reason?.message)
        failedSamples++
        continue
      }
      const result = res.value

      // 3. Порог pass — 85% (было 0.5)
      const isPass = sample.category === 'correct'
        ? result.falsePositives.length === 0
        : result.recall >= 0.85 && result.precision >= 0.85

      if (isPass) passedSamples++
      else failedSamples++

      totalExpected += result.expectedFindings.length
      totalFound += result.foundIssues.length
      totalMatched += result.matched.length
      totalFalsePos += result.falsePositives.length
      totalFalseNeg += result.falseNegatives.length

      // 2. Собираем coordDelta
      if (result.coordAccuracy !== null) {
        totalCoordDelta += result.coordAccuracy * result.matched.length
        coordDeltaCount += result.matched.length
      }

      for (const m of result.matched) {
        allFindings.push({
          runId: run.id, sampleId: sample.id,
          foundCode: m.found.code, foundTitle: m.found.title, foundSeverity: m.found.severity,
          foundField: m.found.field, sourceOcr: m.found.sourceOcr || result.sourceOcr,
          expectedCode: m.expected.code, expectedTitle: m.expected.title, expectedSeverity: m.expected.severity,
          status: 'matched',
          expectedX: m.expected.x, expectedY: m.expected.y,
          foundX: m.found.x || null, foundY: m.found.y || null,
          coordDelta: m.delta,
        })
      }
      for (const fp of result.falsePositives) {
        allFindings.push({
          runId: run.id, sampleId: sample.id,
          foundCode: fp.code, foundTitle: fp.title, foundSeverity: fp.severity,
          foundField: fp.field, sourceOcr: fp.sourceOcr || result.sourceOcr,
          status: 'false_positive',
        })
      }
      for (const fn of result.falseNegatives) {
        allFindings.push({
          runId: run.id, sampleId: sample.id,
          expectedCode: fn.code, expectedTitle: fn.title, expectedSeverity: fn.severity,
          status: 'false_negative',
          expectedX: fn.x, expectedY: fn.y,
        })
      }

      console.log(`     ✓ ${sample.code}: recall=${(result.recall*100).toFixed(0)}% precision=${(result.precision*100).toFixed(0)}% coord=${result.coordAccuracy !== null ? result.coordAccuracy.toFixed(1)+'mm' : 'N/A'} src=${result.sourceOcr} found=${result.foundIssues.length} expected=${result.expectedFindings.length} ${isPass ? 'PASS' : 'FAIL'}`)
    }
  }

  // Метрики
  const recall = totalExpected > 0 ? totalMatched / totalExpected : 1
  const precision = totalFound > 0 ? totalMatched / totalFound : 1
  const expectedHighCount = allFindings.filter(f => f.status === 'matched' && f.expectedSeverity === 'high').length + allFindings.filter(f => f.status === 'false_negative' && f.expectedSeverity === 'high').length
  const matchedHighCount = allFindings.filter(f => f.status === 'matched' && f.expectedSeverity === 'high').length
  const recallHigh = expectedHighCount > 0 ? matchedHighCount / expectedHighCount : 1

  // 2. coordAccuracy — среднее по всем matched с координатами
  const coordAccuracy = coordDeltaCount > 0 ? totalCoordDelta / coordDeltaCount : null

  // Статус: green = Recall≥90% high, Precision≥85%, passRate≥90%
  const passRate = samples.length > 0 ? passedSamples / samples.length : 0
  let benchStatus: 'green' | 'yellow' | 'red' = 'red'
  if (recallHigh >= 0.9 && precision >= 0.85 && passRate >= 0.9) benchStatus = 'green'
  else if (recallHigh >= 0.7 && precision >= 0.6) benchStatus = 'yellow'

  const durationMs = Date.now() - start

  for (let i = 0; i < allFindings.length; i += 100) {
    await db.benchFinding.createMany({ data: allFindings.slice(i, i + 100) })
  }

  await db.benchRun.update({
    where: { id: run.id },
    data: {
      status: 'completed',
      finishedAt: new Date(),
      durationMs,
      totalSamples: samples.length,
      passedSamples,
      failedSamples,
      recall,
      precision,
      recallHigh,
      coordAccuracy,
      benchStatus,
      totalExpected,
      totalFound,
      totalMatched,
      totalFalsePos,
      totalFalseNeg,
    },
  })

  console.log(`\n🧪 Bench run ${version} (tier: ${tier}) complete:`)
  console.log(`   Samples: ${samples.length} (pass: ${passedSamples}, fail: ${failedSamples})`)
  console.log(`   Recall: ${(recall*100).toFixed(1)}% (high: ${(recallHigh*100).toFixed(1)}%)`)
  console.log(`   Precision: ${(precision*100).toFixed(1)}%`)
  console.log(`   Coord accuracy: ${coordAccuracy !== null ? coordAccuracy.toFixed(2) + 'mm' : 'N/A'}`)
  console.log(`   Status: ${benchStatus.toUpperCase()}`)
  console.log(`   Duration: ${(durationMs/1000).toFixed(1)}s`)

  await terminateOcr()
  await terminateZoneOcr()

  return {
    runId: run.id,
    tier,
    totalSamples: samples.length,
    passedSamples,
    failedSamples,
    recall,
    precision,
    recallHigh,
    coordAccuracy,
    benchStatus,
    totalExpected,
    totalFound,
    totalMatched,
    totalFalsePos,
    totalFalseNeg,
    durationMs,
  }
}

// 7. Убираем hardcoded пути — используем env
export async function importBenchSamples(
  manifestPath: string = path.join(BENCH_DATA_DIR, 'bench/manifest.json'),
  tier: string = 'synthetic'
) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
  let imported = 0
  for (const m of manifest) {
    const filePath = `/bench/samples/${m.code}.png`
    let expectedFindings: string | null = null
    if (m.category === 'with_errors') {
      const expPath = path.join(BENCH_DATA_DIR, 'public/bench/expected', `${m.code}.json`)
      if (existsSync(expPath)) {
        expectedFindings = await readFile(expPath, 'utf-8')
      }
    }
    await db.benchSample.upsert({
      where: { code: m.code },
      update: {
        title: m.title,
        category: m.category,
        tier,
        documentType: 'drawing',
        format: m.format,
        sourceType: m.sourceType,
        filePath,
        expectedFindings,
        expectedCount: m.expectedCount,
        expectedHigh: m.expectedHigh,
        expectedMedium: m.expectedMedium,
        expectedLow: m.expectedLow,
        expectedCategories: JSON.stringify(m.expectedCategories),
        isActive: true,
      },
      create: {
        code: m.code,
        title: m.title,
        category: m.category,
        tier,
        documentType: 'drawing',
        format: m.format,
        sourceType: m.sourceType,
        filePath,
        expectedFindings,
        expectedCount: m.expectedCount,
        expectedHigh: m.expectedHigh,
        expectedMedium: m.expectedMedium,
        expectedLow: m.expectedLow,
        expectedCategories: JSON.stringify(m.expectedCategories),
        isActive: true,
      },
    })
    imported++
  }
  console.log(`✓ Imported ${imported} bench samples (tier: ${tier})`)
  return imported
}

// 9. Релизный гейт: GREEN только если все тиры проходят
export async function runReleaseGate(opts: {
  runLlm?: boolean
  version?: string
  organizationId?: string
} = {}): Promise<{
  overallStatus: 'green' | 'yellow' | 'red'
  tiers: {
    tier: string
    status: string
    recall: number
    precision: number
    recallHigh: number
    coordAccuracy: number | null
    passRate: number
    totalSamples: number
  }[]
}> {
  const version = opts.version || `release-gate-${Date.now()}`
  console.log(`🚦 Running release gate ${version}...`)

  const tiers = ['synthetic', 'dxf', 'realistic']
  const results: any[] = []

  for (const tier of tiers) {
    console.log(`\n--- Tier: ${tier} ---`)
    const r = await runBench({
      runLlm: opts.runLlm,
      version: `${version}-${tier}`,
      tier: tier as any,
      organizationId: opts.organizationId,
    })
    results.push({
      tier,
      status: r.benchStatus,
      recall: r.recall,
      precision: r.precision,
      recallHigh: r.recallHigh,
      coordAccuracy: r.coordAccuracy,
      passRate: r.totalSamples > 0 ? r.passedSamples / r.totalSamples : 0,
      totalSamples: r.totalSamples,
    })
  }

  // GREEN только если все тиры GREEN
  const allGreen = results.every(r => r.status === 'green')
  const allYellowOrBetter = results.every(r => r.status === 'green' || r.status === 'yellow')
  const overallStatus = allGreen ? 'green' : allYellowOrBetter ? 'yellow' : 'red'

  console.log(`\n🚦 Release gate ${version} result:`)
  console.log(`   Overall: ${overallStatus.toUpperCase()}`)
  for (const r of results) {
    console.log(`   ${r.tier}: ${r.status.toUpperCase()} R=${(r.recall*100).toFixed(0)}% P=${(r.precision*100).toFixed(0)}% pass=${(r.passRate*100).toFixed(0)}% coord=${r.coordAccuracy !== null ? r.coordAccuracy.toFixed(1)+'mm' : 'N/A'}`)
  }

  return { overallStatus, tiers: results }
}
