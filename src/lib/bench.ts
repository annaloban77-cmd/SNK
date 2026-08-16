// Bench runner: прогон всех активных семплов, сравнение с expected, метрики
// Архитектура P5: OCR → Geometry → Rules → LLM (explanations) → post-filter
import { db } from './db'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { llmSemanticCheck } from './zai'
import { runDeterministicRules, toStampFields, fromLlmIssues, type RuleCheckResult } from './rules'
import { parseCadFile, cadToStampFields } from './cad-parser'
import { extractStamp, terminateOcr } from './ocr/stamp-ocr'
import { analyzeGeometry } from './geometry/geometry-checker'
import { filterFindings } from './post-filter'

export interface ExpectedFinding {
  code: string
  title: string
  severity: 'high' | 'medium' | 'low'
  field: string
  x: number
  y: number
}

export interface SampleRunResult {
  sampleId: string
  code: string
  foundIssues: RuleCheckResult[]
  expectedFindings: ExpectedFinding[]
  matched: { found: RuleCheckResult; expected: ExpectedFinding }[]
  falsePositives: RuleCheckResult[]
  falseNegatives: ExpectedFinding[]
  recall: number
  precision: number
  recallHigh: number
  durationMs: number
  stamp: any
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
  const foundIssues: RuleCheckResult[] = []
  let stamp: any = null

  const fullPath = sample.filePath.startsWith('/home')
    ? sample.filePath
    : path.join('/home/z/my-project/public', sample.filePath.replace(/^\/+/, ''))

  const ext = fullPath.toLowerCase().split('.').pop() || ''

  // 1. OCR штампа (детерминированный: SVG-парсер для bench, Tesseract для реальных)
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
    try {
      const ocrResult = await extractStamp(fullPath, { useVlmFallback: false })
      stamp = ocrResult.stamp
      console.log(`     [OCR: ${ocrResult.method}, ${ocrResult.durationMs}ms, confidence=${(ocrResult.confidence*100).toFixed(0)}%]`)
    } catch (e) {
      console.error(`OCR failed for ${sample.code}:`, e)
    }
  } else if (['dxf', 'dwg', 'sldprt', 'sldasm', 'slddrw', 'cdw', 'spw'].includes(ext)) {
    // CAD-файл — парсер
    try {
      if (existsSync(fullPath)) {
        const parsed = await parseCadFile(fullPath)
        stamp = cadToStampFields(parsed)
      }
    } catch (e) {
      console.error(`CAD parse failed for ${sample.code}:`, e)
    }
  }

  // 2. Geometry (детекция линий/рамок — детерминированно)
  if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) {
    try {
      const geom = await analyzeGeometry(fullPath)
      // Добавляем geometry-находки (R-FORMAT-003, R-STAMP-000, R-DIM-001, R-VIEW-002)
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
        })
      }
    } catch (e) {
      // geometry не критична
    }
  }

  // 3. Детерминированные правила (по извлечённому штампу)
  if (stamp) {
    const det = runDeterministicRules(toStampFields(stamp))
    foundIssues.push(...det)

    // 4. LLM только для семантических проверок (опционально)
    if (opts.runLlm === true && stamp) {
      try {
        const gostRefs = stamp.gostReferences || []
        const llmIssues = await Promise.race([
          llmSemanticCheck(stamp, gostRefs),
          new Promise<[]>((r) => setTimeout(() => r([]), 30000)),
        ])
        foundIssues.push(...fromLlmIssues(llmIssues))
      } catch {
        // пропускаем LLM при ошибке
      }
    }
  }

  // 5. Пост-фильтрация: дедупликация, отбрасывание low при high, низкий confidence
  const filtered = filterFindings(foundIssues, { minConfidence: 0.4, dedupe: true, dropLowIfHighExists: true })
  foundIssues.length = 0
  foundIssues.push(...filtered)
  
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
  
  // Сравнение found vs expected — матч по code
  const matched: { found: RuleCheckResult; expected: ExpectedFinding }[] = []
  const usedFound = new Set<number>()
  for (const exp of expectedFindings) {
    const foundIdx = foundIssues.findIndex((f, i) => !usedFound.has(i) && f.code === exp.code)
    if (foundIdx >= 0) {
      matched.push({ found: foundIssues[foundIdx], expected: exp })
      usedFound.add(foundIdx)
    }
  }
  const falsePositives = foundIssues.filter((_, i) => !usedFound.has(i))
  const falseNegatives = expectedFindings.filter(e => !matched.some(m => m.expected === e))
  
  const recall = expectedFindings.length > 0 ? matched.length / expectedFindings.length : (foundIssues.length === 0 ? 1 : 0)
  const precision = foundIssues.length > 0 ? matched.length / foundIssues.length : 1
  const expectedHigh = expectedFindings.filter(e => e.severity === 'high')
  const matchedHigh = matched.filter(m => m.expected.severity === 'high')
  const recallHigh = expectedHigh.length > 0 ? matchedHigh.length / expectedHigh.length : 1
  
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
    durationMs: Date.now() - start,
    stamp,
  }
}

// Полный прогон стенда
export async function runBench(opts: { runLlm?: boolean; version?: string } = {}): Promise<{
  runId: string
  totalSamples: number
  passedSamples: number
  failedSamples: number
  recall: number
  precision: number
  recallHigh: number
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
  console.log(`🧪 Starting bench run ${version}...`)
  
  // Создаём запись прогона
  const run = await db.benchRun.create({
    data: { version, status: 'running' },
  })
  
  const samples = await db.benchSample.findMany({ where: { isActive: true } })
  console.log(`   ${samples.length} active samples`)
  
  let totalExpected = 0, totalFound = 0, totalMatched = 0, totalFalsePos = 0, totalFalseNeg = 0
  let passedSamples = 0, failedSamples = 0
  const allFindings: any[] = []
  
  // Параллельная обработка батчами (OCR+rules не требуют rate-limit)
  const BATCH_SIZE = 10
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
      const isPass = sample.category === 'correct'
        ? result.falsePositives.length === 0
        : result.recall >= 0.85 && result.precision >= 0.5
      if (isPass) passedSamples++
      else failedSamples++
      
      totalExpected += result.expectedFindings.length
      totalFound += result.foundIssues.length
      totalMatched += result.matched.length
      totalFalsePos += result.falsePositives.length
      totalFalseNeg += result.falseNegatives.length
      
      for (const m of result.matched) {
        allFindings.push({
          runId: run.id, sampleId: sample.id,
          foundCode: m.found.code, foundTitle: m.found.title, foundSeverity: m.found.severity, foundField: m.found.field,
          expectedCode: m.expected.code, expectedTitle: m.expected.title, expectedSeverity: m.expected.severity,
          status: 'matched',
          expectedX: m.expected.x, expectedY: m.expected.y, foundX: 0, foundY: 0, coordDelta: 0,
        })
      }
      for (const fp of result.falsePositives) {
        allFindings.push({
          runId: run.id, sampleId: sample.id,
          foundCode: fp.code, foundTitle: fp.title, foundSeverity: fp.severity, foundField: fp.field,
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
      
      console.log(`     ✓ ${sample.code}: recall=${(result.recall*100).toFixed(0)}% precision=${(result.precision*100).toFixed(0)}% found=${result.foundIssues.length} expected=${result.expectedFindings.length} ${isPass ? 'PASS' : 'FAIL'}`)
    }
  }
  
  // Метрики
  const recall = totalExpected > 0 ? totalMatched / totalExpected : 1
  const precision = totalFound > 0 ? totalMatched / totalFound : 1
  // Recall по high — считаем из findings
  const expectedHighCount = allFindings.filter(f => f.status === 'matched' && f.expectedSeverity === 'high').length + allFindings.filter(f => f.status === 'false_negative' && f.expectedSeverity === 'high').length
  const matchedHighCount = allFindings.filter(f => f.status === 'matched' && f.expectedSeverity === 'high').length
  const recallHigh = expectedHighCount > 0 ? matchedHighCount / expectedHighCount : 1
  
  // Статус стенда
  // green: Recall>=90% high, Precision>=85%, passedSamples/total>=90%
  // yellow: Recall>=70% high, Precision>=60%
  // red: иначе
  const passRate = samples.length > 0 ? passedSamples / samples.length : 0
  let benchStatus: 'green' | 'yellow' | 'red' = 'red'
  if (recallHigh >= 0.9 && precision >= 0.85 && passRate >= 0.9) benchStatus = 'green'
  else if (recallHigh >= 0.7 && precision >= 0.6) benchStatus = 'yellow'
  
  const durationMs = Date.now() - start
  
  // Записываем findings батчами
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
      coordAccuracy: 0, // координаты в семплах 0,0 — MVP
      benchStatus,
      totalExpected,
      totalFound,
      totalMatched,
      totalFalsePos,
      totalFalseNeg,
    },
  })
  
  console.log(`\n🧪 Bench run ${version} complete:`)
  console.log(`   Samples: ${samples.length} (pass: ${passedSamples}, fail: ${failedSamples})`)
  console.log(`   Recall: ${(recall*100).toFixed(1)}% (high: ${(recallHigh*100).toFixed(1)}%)`)
  console.log(`   Precision: ${(precision*100).toFixed(1)}%`)
  console.log(`   Status: ${benchStatus.toUpperCase()}`)
  console.log(`   Duration: ${(durationMs/1000).toFixed(1)}s`)

  // Очищаем ресурсы OCR
  await terminateOcr()

  return {
    runId: run.id,
    totalSamples: samples.length,
    passedSamples,
    failedSamples,
    recall,
    precision,
    recallHigh,
    benchStatus,
    totalExpected,
    totalFound,
    totalMatched,
    totalFalsePos,
    totalFalseNeg,
    durationMs,
  }
}

// Импорт манифеста семплов в БД
export async function importBenchSamples(manifestPath: string = '/home/z/my-project/public/bench/manifest.json') {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
  let imported = 0
  for (const m of manifest) {
    const filePath = `/bench/samples/${m.code}.png`
    let expectedFindings: string | null = null
    if (m.category === 'with_errors') {
      const expPath = `/home/z/my-project/public/bench/expected/${m.code}.json`
      if (existsSync(expPath)) {
        expectedFindings = await readFile(expPath, 'utf-8')
      }
    }
    await db.benchSample.upsert({
      where: { code: m.code },
      update: {
        title: m.title,
        category: m.category,
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
  console.log(`✓ Imported ${imported} bench samples`)
  return imported
}
