import { NextRequest, NextResponse } from 'next/server'
import { dbMon as db } from '@/lib/db-monetization'
import { mapDocument } from '@/app/api/_map'
import { runAnalyzePipeline } from '@/app/api/_analyze'
import { authenticateApiKey, requireScope } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function fetchToFile(url: string): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Не удалось скачать файл: HTTP ${res.status}`)
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const buffer = Buffer.from(await res.arrayBuffer())
  // Determine extension from content-type
  let ext = 'bin'
  if (contentType.includes('image/png')) ext = 'png'
  else if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) ext = 'jpg'
  else if (contentType.includes('image/webp')) ext = 'webp'
  else if (contentType.includes('application/pdf')) ext = 'pdf'
  else if (contentType.includes('image/svg')) ext = 'svg'
  else {
    // Try from URL path
    const u = new URL(url)
    const urlExt = u.pathname.split('.').pop() || ''
    if (urlExt) ext = urlExt.toLowerCase()
  }
  return { buffer, mimeType: contentType, ext }
}

function sourceTypeFromExt(ext: string): string {
  switch (ext) {
    case 'pdf': return 'pdf'
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'svg': return 'scan'
    case 'dwg': return 'dwg'
    case 'dxf': return 'dxf'
    case 'cdw': return 'cdw'
    case 'sldprt': return 'sldprt'
    case 'sldasm': return 'sldasm'
    case 'slddrw': return 'slddrw'
    case 'spw': return 'spw'
    default: return 'scan'
  }
}

async function computeFormat(filePath: string, mimeType: string): Promise<string> {
  if (!mimeType.startsWith('image/') && !mimeType.includes('pdf')) return 'unknown'
  try {
    const meta = await sharp(filePath).metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (!w || !h) return 'unknown'
    const ratio = Math.max(w, h) / Math.min(w, h)
    const longer = Math.max(w, h)
    if (Math.abs(ratio - Math.SQRT2) > 0.18) return 'unknown'
    if (longer >= 4800) return 'A0'
    if (longer >= 3400) return 'A1'
    if (longer >= 2400) return 'A2'
    if (longer >= 1700) return 'A3'
    if (longer >= 1100) return 'A4'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }
  if (!requireScope(auth, 'write')) {
    return NextResponse.json({ error: 'Недостаточно прав: требуется scope "write"' }, { status: 403 })
  }

  let body: { imageUrl?: string; runLlm?: boolean; name?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  if (!body.imageUrl || !/^https?:\/\//.test(body.imageUrl)) {
    return NextResponse.json({ error: 'Параметр imageUrl обязателен (http(s)://)' }, { status: 400 })
  }

  try {
    // Download the file
    const { buffer, mimeType, ext } = await fetchToFile(body.imageUrl)
    const sourceType = sourceTypeFromExt(ext)

    // Save to uploads/
    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    const fileName = `${randomUUID()}.${ext}`
    const filePath = path.join(uploadsDir, fileName)
    await writeFile(filePath, buffer)

    const format = await computeFormat(filePath, mimeType)

    // Determine project (default to first available)
    const project = await db.project.findFirst({ select: { id: true } })

    const originalName = body.name || body.imageUrl.split('/').pop() || `api-upload.${ext}`
    const doc = await db.document.create({
      data: {
        name: originalName,
        originalName,
        mimeType,
        size: buffer.length,
        format,
        sourceType,
        status: 'new',
        filePath,
        projectId: project?.id ?? null,
        organizationId: auth.organizationId ?? null,
        stampJson: null,
        ocrText: null,
      },
      include: { project: { select: { id: true, code: true, name: true } } },
    })

    await db.checkLog.create({
      data: {
        documentId: doc.id,
        stage: 'upload',
        status: 'success',
        message: `Загружен через API из ${body.imageUrl} (${buffer.length} байт)`,
      },
    })

    await logAudit({
      organizationId: auth.organizationId ?? null,
      action: 'api.document.uploaded',
      resourceType: 'document',
      resourceId: doc.id,
      details: { imageUrl: body.imageUrl, sourceType, format, size: buffer.length },
    })

    // Run analyze pipeline
    const result = await runAnalyzePipeline(doc.id, { runLlm: body.runLlm !== false })

    await logAudit({
      organizationId: auth.organizationId ?? null,
      action: 'api.document.analyzed',
      resourceType: 'document',
      resourceId: doc.id,
      details: {
        runLlm: body.runLlm !== false,
        status: 'status' in result ? result.status : 'failed',
        issuesCount: 'issues' in result ? result.issues.length : 0,
      },
    })

    return NextResponse.json({
      document: mapDocument(doc),
      ...result,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'Не удалось обработать документ: ' + msg }, { status: 500 })
  }
}
