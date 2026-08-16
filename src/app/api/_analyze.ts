// Shared analyze pipeline — used by /api/documents/[id]/analyze and /api/samples/[id]/analyze
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { mapIssue, parseStamp } from './_map'
import { extractStampFromImage, llmSemanticCheck, type ExtractedStamp } from '@/lib/zai'
import { runDeterministicRules, toStampFields, fromLlmIssues, type RuleCheckResult } from '@/lib/rules'
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

  try {
    await db.document.update({ where: { id: documentId }, data: { status: 'processing' } })
    await logStage(documentId, 'upload', 'started')
    stages.push({ stage: 'upload', status: 'started', durationMs: null })

    let dataUrl: string | null = null
    if (doc.filePath && existsSync(doc.filePath)) {
      dataUrl = await fileToImageDataUrl(doc.filePath, doc.mimeType)
    }

    let stamp: ExtractedStamp | null = null
    if (dataUrl) {
      const vlmStart = Date.now()
      try {
        stamp = await timeout(extractStampFromImage(dataUrl), TIMEOUT_MS, 'VLM extract')
        const dur = Date.now() - vlmStart
        await logStage(documentId, 'vlm_extract', stamp ? 'success' : 'failed', dur, stamp ? undefined : 'VLM вернул null')
        stages.push({
          stage: 'vlm_extract',
          status: stamp ? 'success' : 'failed',
          durationMs: dur,
          message: stamp ? undefined : 'VLM вернул null',
        })
        if (stamp) {
          await db.document.update({
            where: { id: documentId },
            data: { stampJson: JSON.stringify(stamp) },
          })
        }
      } catch (e) {
        const dur = Date.now() - vlmStart
        const msg = e instanceof Error ? e.message : String(e)
        await logStage(documentId, 'vlm_extract', 'failed', dur, msg)
        stages.push({ stage: 'vlm_extract', status: 'failed', durationMs: dur, message: msg })
      }
    } else if (doc.stampJson) {
      try {
        stamp = JSON.parse(doc.stampJson) as ExtractedStamp
        await logStage(documentId, 'vlm_extract', 'success', 0, 'Использован ранее извлечённый штамп')
        stages.push({ stage: 'vlm_extract', status: 'success', durationMs: 0, message: 'Использован ранее извлечённый штамп' })
      } catch {
        await logStage(documentId, 'vlm_extract', 'failed', 0, 'Файл отсутствует, штамп не извлечён')
        stages.push({ stage: 'vlm_extract', status: 'failed', durationMs: 0, message: 'Файл отсутствует' })
      }
    } else {
      await logStage(documentId, 'vlm_extract', 'failed', 0, 'Файл отсутствует, источник — CAD')
      stages.push({ stage: 'vlm_extract', status: 'failed', durationMs: 0, message: 'Файл отсутствует' })
    }

    let deterministicResults: RuleCheckResult[] = []
    if (stamp) {
      const rulesStart = Date.now()
      try {
        const stampFields: StampFields = toStampFields(stamp)
        deterministicResults = runDeterministicRules(stampFields)
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

    const allResults = [...deterministicResults, ...llmResults]

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
        rule: { select: { id: true, code: true, name: true } },
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
