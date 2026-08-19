// Shared analyze pipeline — used by /api/documents/[id]/analyze and /api/samples/[id]/analyze
// Архитектура P5: OCR → Geometry → Rules → LLM (explanations) → post-filter
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { mapIssue, parseStamp } from './_map'
import { llmSemanticCheck, type ExtractedStamp } from '@/lib/zai'
import { runDeterministicRules, toStampFields, fromLlmIssues, cadNoStampFinding, isStampEmpty, mkIssue, type RuleCheckResult } from '@/lib/rules'
import { extractStamp } from '@/lib/ocr/stamp-ocr'
import { analyzeGeometry } from '@/lib/geometry/geometry-checker'
import { filterFindings } from '@/lib/post-filter'
import { detectFormatFromImage, detectFormatFromCad } from '@/lib/format-detector'
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
          // Честный детектор формата: CAD stamp attributes или null.
          // НЕ подменяем 'A3' по умолчанию для sldasm/sldprt — формат остаётся null,
          // если CAD-парсер его не извлёк (P5: честный формат).
          const cadFormat = detectFormatFromCad({
            stampAttributes: parsed.stampAttributes,
            format: stamp.format as string | undefined,
          })
          if (cadFormat) {
            ;(stamp as ExtractedStamp & { format?: string }).format = cadFormat
          } else {
            // Явно затираем возможный 'unknown' из CAD-парсера → null
            ;(stamp as ExtractedStamp & { format?: string }).format = undefined as unknown as string
          }
          await db.document.update({
            where: { id: documentId },
            data: {
              stampJson: JSON.stringify(stamp),
              format: cadFormat, // null если не определён
            },
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
          // Format detector: если OCR не вернул формат, пытаемся определить
          // по пропорциям изображения с допуском 2%. Возвращает null, если
          // честно определить нельзя (P5: честный формат, без подмены).
          if (!stamp.format || String(stamp.format).trim() === '' || String(stamp.format).toLowerCase() === 'unknown') {
            const detected = await detectFormatFromImage(doc.filePath)
            if (detected) {
              ;(stamp as ExtractedStamp & { format?: string }).format = detected
            } else {
              ;(stamp as ExtractedStamp & { format?: string }).format = undefined as unknown as string
            }
          }
          const finalFormat = (stamp.format as string | undefined) || null
          await db.document.update({
            where: { id: documentId },
            data: {
              stampJson: JSON.stringify(stamp),
              format: finalFormat, // null если не определён
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
        // P5: если формат честно не определён (null) — R-FORMAT-* не запускаются
        // (нечего проверять), но добавляем информационное замечание low,
        // призывающее пользователя указать формат в штампе.
        const fmt = (stampFields.format as string | null) ?? null
        if (!fmt || fmt.trim() === '' || fmt.toLowerCase() === 'unknown') {
          const formatInfoIssue = mkIssue(
            'R-FORMAT-INFO',
            'Формат листа не определён',
            'Формат листа не удалось определить ни из штампа, ни по пропорциям изображения. Проверки формата (R-FORMAT-*) пропускаются, пока формат не указан.',
            'low',
            'Формат',
            'Указать формат листа в основной надписи (A0, A1, A2, A3 или A4 по ГОСТ 2.301).',
            'ГОСТ 2.301-68',
            ''
          )
          deterministicResults.push(formatInfoIssue)
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
