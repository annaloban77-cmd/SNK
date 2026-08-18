// Shared analyze pipeline — used by /api/documents/[id]/analyze and /api/samples/[id]/analyze
// Архитектура P5: OCR → Geometry → Rules → LLM (explanations) → post-filter
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { mapIssue, parseStamp } from './_map'
import { llmSemanticCheck, type ExtractedStamp } from '@/lib/zai'
import { runDeterministicRules, toStampFields, fromLlmIssues, cadNoStampFinding, isStampEmpty, type RuleCheckResult } from '@/lib/rules'
import { extractStamp } from '@/lib/ocr/stamp-ocr'
import { analyzeGeometry } from '@/lib/geometry/geometry-checker'
import { filterFindings } from '@/lib/post-filter'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import sharp from 'sharp'
import type { AnalyzeResponse, StampFields, IssueDto } from '@/lib/types'

const TIMEOUT_MS = 60_000

function timeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} (${ms} ms)`)), ms)
    ),
  ])
}

const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

/**
 * Detect paper format (A0..A4 or "unknown") from image aspect ratio.
 * ratio = width / height
 *   - A4 portrait:   ratio ≈ 0.71 (210/297)
 *   - A3 portrait:   ratio ≈ 0.71 too — indistinguishable without DPI/sheet markers
 *   - A4 landscape:  ratio ≈ 1.41 (297/210)
 *   - A3/A2 landscape: similar landscape ratio
 * We pick a coarse guess based on the ratio ranges defined in the task.
 */
export async function detectFormatFromImage(
  filePath: string
): Promise<string | null> {
  try {
    const meta = await sharp(filePath).metadata()
    if (!meta.width || !meta.height) return null
    const ratio = meta.width / meta.height
    if (ratio < 0.75) {
      // Tall portrait — A4 portrait is most common
      return 'A4'
    }
    if (ratio > 1.4) {
      // Wide landscape — A3/A2 landscape; default to A3 (most common in shipbuilding)
      return 'A3'
    }
    // 0.75 ≤ ratio ≤ 1.4 — could be anything square-ish; can't reliably detect
    return 'unknown'
  } catch {
    return null
  }
}

export async function fileToImageDataUrl(filePath: string, mimeType: string): Promise<string | null> {
  if (!existsSync(filePath)) return null
  if (IMAGE_MIME.includes(mimeType.toLowerCase())) {
    const buf = await readFile(filePath)
    const ext = mimeType.split('/')[1] || 'png'
    return `data:image/${ext};base64,${buf.toString('base64')}`
  }
  if (mimeType.toLowerCase() === 'application/pdf') {
    try {
      const pdfBuf = await readFile(filePath)
      const pngBuf = await sharp(pdfBuf, { page: 1, density: 200 }).resize(1600).png().toBuffer()
      return `data:image/png;base64,${pngBuf.toString('base64')}`
    } catch (e) {
      console.error('PDF rasterize failed:', e)
      return null
    }
  }
  return null
}

interface StageLog {
  stage: string
  status: 'started' | 'success' | 'failed'
  durationMs: number | null
  message?: string
}

async function logStage(
  documentId: string,
  stage: string,
  status: 'started' | 'success' | 'failed',
  durationMs?: number,
  message?: string
) {
  await db.checkLog.create({
    data: {
      documentId,
      stage,
      status,
      durationMs: durationMs ?? null,
      message: message ?? null,
    },
  })
}

async function lookupRuleId(code: string): Promise<string | null> {
  const rule = await db.rule.findUnique({ where: { code }, select: { id: true } })
  return rule?.id ?? null
}

export type AnalyzeResult = AnalyzeResponse

export async function runAnalyzePipeline(
  documentId: string,
  opts: { runLlm?: boolean } = {}
): Promise<AnalyzeResult | { error: string; documentId: string; status: 'failed'; stages: StageLog[] }> {
  const runLlm = opts.runLlm !== false
  const doc = await db.document.findUnique({ where: { id: documentId } })
  if (!doc) {
    throw new Error('Документ не найден')
  }

  const startedAt = Date.now()
  const stages: StageLog[] = []
  let pipelineConfidence = 1.0 // confidence для post-filter

  try {
    await db.document.update({ where: { id: documentId }, data: { status: 'processing' } })
    await logStage(documentId, 'upload', 'started')
    stages.push({ stage: 'upload', status: 'started', durationMs: null })

    let dataUrl: string | null = null
    if (doc.filePath && existsSync(doc.filePath)) {
      dataUrl = await fileToImageDataUrl(doc.filePath, doc.mimeType)
    }

    let stamp: ExtractedStamp | null = null
    // 1. Извлечение штампа: OCR для изображений, CAD-парсер для CAD-файлов
    const fileExt = doc.filePath.toLowerCase().split('.').pop() || ''
    const isCadFile = ['dxf', 'dwg', 'sldprt', 'sldasm', 'slddrw', 'cdw', 'spw'].includes(fileExt)
    const isImageFile = ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(fileExt)

    if (isCadFile && doc.filePath && existsSync(doc.filePath)) {
      // CAD-файл — используем CAD-парсер (детерминированный, confidence=1.0)
      const cadStart = Date.now()
      try {
        const { parseCadFile, cadToStampFields } = await import('@/lib/cad-parser')
        const parsed = await parseCadFile(doc.filePath)
        stamp = cadToStampFields(parsed) as unknown as ExtractedStamp
        pipelineConfidence = 1.0
        const dur = Date.now() - cadStart
        const msg = `CAD: ${parsed.format}, ${parsed.attributes.length} attrs, ${parsed.textEntities.length} texts`
        await logStage(documentId, 'ocr_extract', stamp ? 'success' : 'failed', dur, msg)
        stages.push({ stage: 'ocr_extract', status: stamp ? 'success' : 'failed', durationMs: dur, message: msg })
        if (stamp) {
          await db.document.update({
            where: { id: documentId },
            data: { stampJson: JSON.stringify(stamp) },
          })
        }
      } catch (e) {
        const dur = Date.now() - cadStart
        const msg = e instanceof Error ? e.message : String(e)
        await logStage(documentId, 'ocr_extract', 'failed', dur, msg)
        stages.push({ stage: 'ocr_extract', status: 'failed', durationMs: dur, message: msg })
      }
    } else if (isImageFile && doc.filePath && existsSync(doc.filePath)) {
      const ocrStart = Date.now()
      try {
        const ocrResult = await extractStamp(doc.filePath, { useVlmFallback: runLlm })
        stamp = ocrResult.stamp as ExtractedStamp | null
        pipelineConfidence = ocrResult.confidence
        const dur = Date.now() - ocrStart
        const msg = `OCR: ${ocrResult.method}, confidence=${(ocrResult.confidence*100).toFixed(0)}%`
        await logStage(documentId, 'ocr_extract', stamp ? 'success' : 'failed', dur, msg)
        stages.push({ stage: 'ocr_extract', status: stamp ? 'success' : 'failed', durationMs: dur, message: msg })
        if (stamp) {
          // Format detector: if OCR didn't return a format, infer from image aspect ratio
          if (!stamp.format || String(stamp.format).trim() === '') {
            const detected = await detectFormatFromImage(doc.filePath)
            if (detected) {
              ;(stamp as ExtractedStamp & { format?: string }).format = detected
            }
          }
          await db.document.update({
            where: { id: documentId },
            data: {
              stampJson: JSON.stringify(stamp),
              ...(stamp.format && stamp.format !== 'unknown'
                ? { format: String(stamp.format) }
                : {}),
            },
          })
        }
      } catch (e) {
        const dur = Date.now() - ocrStart
        const msg = e instanceof Error ? e.message : String(e)
        await logStage(documentId, 'ocr_extract', 'failed', dur, msg)
        stages.push({ stage: 'ocr_extract', status: 'failed', durationMs: dur, message: msg })
      }
    } else if (doc.stampJson) {
      try {
        stamp = JSON.parse(doc.stampJson) as ExtractedStamp
        await logStage(documentId, 'ocr_extract', 'success', 0, 'Использован ранее извлечённый штамп')
        stages.push({ stage: 'ocr_extract', status: 'success', durationMs: 0, message: 'Использован ранее извлечённый штамп' })
      } catch {
        await logStage(documentId, 'ocr_extract', 'failed', 0, 'Файл отсутствует, штамп не извлечён')
        stages.push({ stage: 'ocr_extract', status: 'failed', durationMs: 0, message: 'Файл отсутствует' })
      }
    } else {
      await logStage(documentId, 'ocr_extract', 'failed', 0, 'Файл отсутствует, источник — CAD')
      stages.push({ stage: 'ocr_extract', status: 'failed', durationMs: 0, message: 'Файл отсутствует' })
    }

    // 2. Geometry (детекция линий/рамок — только для изображений/SVG, не для CAD)
    const geometryFindings: RuleCheckResult[] = []
    if (isImageFile && doc.filePath && existsSync(doc.filePath)) {
      const geomStart = Date.now()
      try {
        const geom = await analyzeGeometry(doc.filePath)
        const dur = Date.now() - geomStart
        for (const gf of geom.findings) {
          geometryFindings.push({
            code: gf.code, title: gf.title, description: gf.description,
            severity: gf.severity, field: gf.field, source: 'auto',
            gostRef: undefined, recommendation: undefined, requirement: undefined,
            evidence: `[geometry confidence: ${(gf.confidence*100).toFixed(0)}%]`,
          })
        }
        await logStage(documentId, 'geometry', 'success', dur, `${geom.findings.length} findings`)
        stages.push({ stage: 'geometry', status: 'success', durationMs: dur, message: `${geom.findings.length} findings` })
      } catch (e) {
        const dur = Date.now() - geomStart
        await logStage(documentId, 'geometry', 'failed', dur)
        stages.push({ stage: 'geometry', status: 'failed', durationMs: dur })
      }
    }

    let deterministicResults: RuleCheckResult[] = []
    if (stamp) {
      const rulesStart = Date.now()
      try {
        const stampFields: StampFields = toStampFields(stamp)
        // CAD-nostamp shortcut: if CAD file produced an essentially empty stamp,
        // emit a single R-CAD-NOSTAMP finding instead of all "missing-field" findings.
        if (isCadFile && isStampEmpty(stampFields)) {
          deterministicResults = [cadNoStampFinding()]
        } else {
          deterministicResults = runDeterministicRules(stampFields)
        }
        const dur = Date.now() - rulesStart
        await logStage(documentId, 'rules_check', 'success', dur, `${deterministicResults.length} замечаний`)
        stages.push({ stage: 'rules_check', status: 'success', durationMs: dur, message: `${deterministicResults.length} замечаний` })
      } catch (e) {
        const dur = Date.now() - rulesStart
        const msg = e instanceof Error ? e.message : String(e)
        await logStage(documentId, 'rules_check', 'failed', dur, msg)
        stages.push({ stage: 'rules_check', status: 'failed', durationMs: dur, message: msg })
      }
    } else {
      await logStage(documentId, 'rules_check', 'failed', 0, 'Штамп не извлечён — правила не запускались')
      stages.push({ stage: 'rules_check', status: 'failed', durationMs: 0, message: 'Штамп не извлечён' })
    }

    let llmResults: RuleCheckResult[] = []
    if (runLlm && stamp) {
      const llmStart = Date.now()
      try {
        const llmIssues = await timeout(
          llmSemanticCheck(stamp, stamp.gostReferences || []),
          TIMEOUT_MS,
          'LLM semantic'
        )
        llmResults = fromLlmIssues(llmIssues || [])
        const dur = Date.now() - llmStart
        await logStage(documentId, 'llm_semantic', 'success', dur, `${llmResults.length} замечаний`)
        stages.push({ stage: 'llm_semantic', status: 'success', durationMs: dur, message: `${llmResults.length} замечаний` })
      } catch (e) {
        const dur = Date.now() - llmStart
        const msg = e instanceof Error ? e.message : String(e)
        await logStage(documentId, 'llm_semantic', 'failed', dur, msg)
        stages.push({ stage: 'llm_semantic', status: 'failed', durationMs: dur, message: msg })
      }
    } else {
      await logStage(documentId, 'llm_semantic', 'failed', 0, runLlm ? 'Нет штампа' : 'Отключено клиентом')
      stages.push({ stage: 'llm_semantic', status: 'failed', durationMs: 0, message: runLlm ? 'Нет штампа' : 'Отключено клиентом' })
    }

    await db.issue.deleteMany({ where: { documentId } })

    // Объединяем все результаты + применяем пост-фильтрацию (P5: детерминированность)
    const rawResults = [...geometryFindings, ...deterministicResults, ...llmResults]
    const allResults = filterFindings(rawResults, {
      minConfidence: 0.4, dedupe: true, dropLowIfHighExists: true,
      ocrConfidence: pipelineConfidence,
    })

    if (allResults.length > 0) {
      const codes = Array.from(new Set(allResults.map((r) => r.code)))
      const ruleLookup = new Map<string, string | null>()
      for (const code of codes) {
        ruleLookup.set(code, await lookupRuleId(code))
      }
      await db.issue.createMany({
        data: allResults.map((r) => ({
          documentId,
          ruleId: ruleLookup.get(r.code) ?? null,
          code: r.code,
          title: r.title,
          description: r.description,
          requirement: r.requirement ?? null,
          recommendation: r.recommendation ?? null,
          gostRef: r.gostRef ?? null,
          field: r.field ?? null,
          severity: r.severity,
          status: 'new',
          source: r.source,
          evidence: r.evidence ?? null,
        })),
      })
    }

    const issueRows = await db.issue.findMany({
      where: { documentId },
      select: { severity: true },
    })
    const issueCount = issueRows.length
    const highCount = issueRows.filter((i) => i.severity === 'high').length
    const mediumCount = issueRows.filter((i) => i.severity === 'medium').length
    const lowCount = issueRows.filter((i) => i.severity === 'low').length

    const totalDur = Date.now() - startedAt

    await db.document.update({
      where: { id: documentId },
      data: {
        status: 'analyzed',
        issueCount,
        highCount,
        mediumCount,
        lowCount,
        checkDuration: totalDur,
      },
    })

    await logStage(documentId, 'report', 'success', totalDur, `Всего: ${issueCount} замечаний (high=${highCount}, med=${mediumCount}, low=${lowCount})`)
    stages.push({ stage: 'report', status: 'success', durationMs: totalDur, message: `${issueCount} замечаний` })

    // Audit log — analyze action
    await logAudit({
      organizationId: doc.organizationId ?? null,
      action: 'document.analyze',
      resourceType: 'document',
      resourceId: documentId,
      details: {
        runLlm,
        status: 'analyzed',
        issueCount,
        highCount,
        mediumCount,
        lowCount,
        durationMs: totalDur,
        stages: stages.map((s) => ({ stage: s.stage, status: s.status, durationMs: s.durationMs })),
      },
    })

    const freshIssues = await db.issue.findMany({
      where: { documentId },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      include: {
        document: { select: { id: true, name: true, format: true } },
        rule: { select: { id: true, code: true, name: true, standardId: true } },
      },
    })

    const stampFields = parseStamp(stamp ? JSON.stringify(stamp) : doc.stampJson)

    const response: AnalyzeResult = {
      documentId,
      status: 'analyzed',
      stamp: stampFields,
      issues: freshIssues.map(mapIssue) as IssueDto[],
      checkDurationMs: totalDur,
      stages: stages.map((s) => ({
        stage: s.stage,
        status: s.status,
        durationMs: s.durationMs,
        message: s.message,
      })),
    }

    return response
  } catch (e) {
    const totalDur = Date.now() - startedAt
    const msg = e instanceof Error ? e.message : String(e)
    await db.document.update({ where: { id: documentId }, data: { status: 'failed', checkDuration: totalDur } })
    await logStage(documentId, 'report', 'failed', totalDur, msg)
    stages.push({ stage: 'report', status: 'failed', durationMs: totalDur, message: msg })
    // Audit log — analyze failure
    await logAudit({
      organizationId: doc.organizationId ?? null,
      action: 'document.analyze',
      resourceType: 'document',
      resourceId: documentId,
      details: { runLlm, status: 'failed', error: msg, durationMs: totalDur },
    })
    return {
      error: msg,
      documentId,
      status: 'failed',
      stages,
    }
  }
}
